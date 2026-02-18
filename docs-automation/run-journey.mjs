import { spawn } from 'child_process';
import path from 'path';
import {
  loadManifestWithOverrides,
  resolveFlowById,
  resolveProductById,
  resolveProductEnv,
  validateManifest,
} from './server/manifest-utils.mjs';

const flowId = process.argv[2];

if (!flowId) {
  console.error('Uso: node docs-automation/run-journey.mjs <flowId>');
  process.exit(1);
}

const manifest = loadManifestWithOverrides();
validateManifest(manifest);
const flow = resolveFlowById(manifest, flowId);
const product = resolveProductById(manifest, flow.productId);

const env = {
  ...process.env,
  ...resolveProductEnv(product),
};

const args = [
  'playwright',
  'test',
  '--config=docs-automation/playwright.config.js',
  flow.journeyFile,
];

const child = spawn('npx', args, {
  cwd: path.resolve(process.cwd()),
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

