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
  console.error('Usage: node docs-automation/run-journey.mjs <flowId>');
  process.exit(1);
}

const manifest = loadManifestWithOverrides();
validateManifest(manifest);
let flow;
let product;
try {
  flow = resolveFlowById(manifest, flowId);
  product = resolveProductById(manifest, flow.productId);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

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

child.on('error', (err) => {
  console.error('Child process error', err);
  process.exit(1);
});
child.on('exit', (code) => {
  process.exit(code ?? 1);
});

