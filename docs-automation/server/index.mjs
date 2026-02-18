import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { spawn } from 'child_process';
import {
  getPaths,
  loadManifestWithOverrides,
  resolveFlowById,
  resolveProductById,
  resolveProductEnv,
  saveFlowOverride,
  saveProductOverride,
  saveVoiceoverOverride,
  validateManifest,
} from './manifest-utils.mjs';

const VOICES_LIST = [
  { name: 'pt-BR-Neural2-C', languageCode: 'pt-BR', gender: 'FEMALE', type: 'Neural2' },
  { name: 'pt-BR-Neural2-A', languageCode: 'pt-BR', gender: 'FEMALE', type: 'Neural2' },
  { name: 'pt-BR-Neural2-B', languageCode: 'pt-BR', gender: 'MALE', type: 'Neural2' },
  { name: 'pt-BR-Wavenet-A', languageCode: 'pt-BR', gender: 'FEMALE', type: 'WaveNet' },
  { name: 'pt-BR-Wavenet-B', languageCode: 'pt-BR', gender: 'MALE', type: 'WaveNet' },
  { name: 'pt-BR-Standard-A', languageCode: 'pt-BR', gender: 'FEMALE', type: 'Standard' },
];

const PORT = Number(process.env.DOCS_SERVER_PORT ?? 3333);
const app = express();
const jobs = new Map();
const upload = multer({ storage: multer.memoryStorage() });

const { docsAutomationDir } = getPaths();
const repoRoot = process.cwd();
const docsOutputDir = path.join(repoRoot, 'docs-output');
const docsOutputDirResolved = path.resolve(docsOutputDir);
const brandDir = path.join(docsAutomationDir, 'assets', 'brand');
const JOB_TTL_MS = 10 * 60 * 1000; // 10 minutes

fs.mkdirSync(docsOutputDir, { recursive: true });
fs.mkdirSync(brandDir, { recursive: true });

app.use(express.json({ limit: '2mb' }));
app.use('/assets/brand', express.static(brandDir));

// Fail fast if manifest is broken.
validateManifest(loadManifestWithOverrides());

app.get('/api/voiceover/settings', (req, res) => {
  const manifest = loadManifestWithOverrides();
  res.json(manifest.defaults.voiceover);
});

app.get('/api/voiceover/voices', (req, res) => {
  res.json(VOICES_LIST);
});

app.patch('/api/voiceover/settings', (req, res) => {
  try {
    const patch = req.body ?? {};
    
    // Validation
    if (patch.speakingRate != null) {
      if (typeof patch.speakingRate !== 'number' || patch.speakingRate < 0.25 || patch.speakingRate > 2.0) {
        throw new Error('speakingRate deve estar entre 0.25 e 2.0');
      }
    }
    if (patch.pitch != null) {
      if (typeof patch.pitch !== 'number' || patch.pitch < -20 || patch.pitch > 20) {
        throw new Error('pitch deve estar entre -20 e 20');
      }
    }
    if (patch.volumeGainDb != null) {
      if (typeof patch.volumeGainDb !== 'number' || patch.volumeGainDb < -96 || patch.volumeGainDb > 16) {
        throw new Error('volumeGainDb deve estar entre -96 e 16');
      }
    }
    if (patch.name) {
      // Auto-infer languageCode if not provided and matches pattern
      if (!patch.languageCode && /^[a-z]{2}-[A-Z]{2}-/.test(patch.name)) {
        patch.languageCode = patch.name.split('-').slice(0, 2).join('-');
      }
      
      if (!patch.languageCode) {
        throw new Error('languageCode é obrigatório quando name é fornecido (se não for possível inferir).');
      }
    }

    saveVoiceoverOverride(patch);
    const manifest = loadManifestWithOverrides();
    res.json(manifest.defaults.voiceover);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/products', (_req, res) => {
  const manifest = loadManifestWithOverrides();
  res.json(manifest.products);
});

app.get('/api/products/:productId', (req, res) => {
  try {
    const manifest = loadManifestWithOverrides();
    const product = resolveProductById(manifest, req.params.productId);
    res.json(product);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.patch('/api/products/:productId', upload.single('logo'), (req, res) => {
  try {
    const manifest = loadManifestWithOverrides();
    const product = resolveProductById(manifest, req.params.productId);

    const patch = parseProductPatch(req.body);

    if (req.file) {
      const ext = getSafeExt(req.file.originalname);
      const filename = `${product.id}-logo${ext}`;
      fs.writeFileSync(path.join(brandDir, filename), req.file.buffer);
      patch.brand = patch.brand ?? {};
      patch.brand.assets = patch.brand.assets ?? {};
      patch.brand.assets.logo = `brand/${filename}`;
    }

    saveProductOverride(product.id, patch);
    const next = resolveProductById(loadManifestWithOverrides(), product.id);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/flows', (req, res) => {
  const manifest = loadManifestWithOverrides();
  const productId = req.query.productId;
  const flows = productId
    ? manifest.flows.filter((flow) => flow.productId === productId)
    : manifest.flows;
  res.json(flows);
});

app.get('/api/flows/:flowId', (req, res) => {
  try {
    const manifest = loadManifestWithOverrides();
    const flow = resolveFlowById(manifest, req.params.flowId);
    res.json(flow);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.patch('/api/flows/:flowId', (req, res) => {
  try {
    const manifest = loadManifestWithOverrides();
    const flow = resolveFlowById(manifest, req.params.flowId);
    const patch = req.body ?? {};

    if (patch.composition) {
      validateCompositionPatch(patch.composition);
    }

    saveFlowOverride(flow.id, patch);
    const next = resolveFlowById(loadManifestWithOverrides(), flow.id);
    res.json(next);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/flows/:flowId/generate', async (req, res) => {
  try {
    const manifest = loadManifestWithOverrides();
    const flow = resolveFlowById(manifest, req.params.flowId);
    const product = resolveProductById(manifest, flow.productId);
    const jobId = createJob(flow.id);
    const job = jobs.get(jobId);

    res.status(202).json({ jobId });

    const env = {
      ...process.env,
      ...resolveProductEnv(product),
    };

    runGeneratePipeline(job, flow, env).catch((error) => {
      job.status = 'error';
      job.error = error.message;
      appendLog(job, `[error] ${error.message}`);
      scheduleJobRemoval(job.id);
    });
  } catch (error) {
    if (error.message && error.message.includes('não encontrado no manifesto')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: `Job não encontrado: ${req.params.jobId}` });
  }

  res.json(job);
});

function validateAndResolveFlowOutputPath(flowId) {
  if (!flowId || typeof flowId !== 'string') return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(flowId)) return null;
  const outputFile = path.resolve(docsOutputDir, `${flowId}.mp4`);
  if (!outputFile.startsWith(docsOutputDirResolved)) return null;
  return outputFile;
}

app.get('/api/flows/:flowId/output', (req, res) => {
  const flowId = req.params.flowId;
  const outputFile = validateAndResolveFlowOutputPath(flowId);
  if (!outputFile) {
    return res.status(400).json({ error: 'Invalid flowId' });
  }
  const exists = fs.existsSync(outputFile);

  if (!exists) {
    return res.json({
      exists: false,
      downloadUrl: `/api/flows/${flowId}/output/file`,
    });
  }

  const stat = fs.statSync(outputFile);
  res.json({
    exists: true,
    generatedAt: stat.mtime.toISOString(),
    fileSizeBytes: stat.size,
    downloadUrl: `/api/flows/${flowId}/output/file`,
  });
});

app.get('/api/flows/:flowId/output/file', (req, res) => {
  const flowId = req.params.flowId;
  const outputFile = validateAndResolveFlowOutputPath(flowId);
  if (!outputFile) {
    return res.status(400).json({ error: 'Invalid flowId' });
  }
  if (!fs.existsSync(outputFile)) {
    return res.status(404).json({ error: 'Arquivo ainda não foi gerado.' });
  }

  return res.sendFile(outputFile);
});

app.listen(PORT, () => {
  console.log(`Docs server rodando em http://localhost:${PORT}`);
});

function createJob(flowId) {
  const id = `${flowId}-${Date.now()}`;
  jobs.set(id, {
    id,
    flowId,
    status: 'pending',
    outputPath: path.join('docs-output', `${flowId}.mp4`),
    error: null,
    log: [],
    steps: {
      screenshots: 'pending',
      voiceover: 'pending',
      render: 'pending',
    },
  });
  return id;
}

function scheduleJobRemoval(jobId) {
  setTimeout(() => {
    jobs.delete(jobId);
  }, JOB_TTL_MS);
}

async function runGeneratePipeline(job, flow, env) {
  job.status = 'running';

  job.steps.screenshots = 'running';
  await runCommand(
    ['npx', 'playwright', 'test', '--config=docs-automation/playwright.config.js', flow.journeyFile],
    env,
    job
  );
  job.steps.screenshots = 'done';

  const hasVoiceoverCredentials =
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    Boolean(process.env.GOOGLE_TTS_API_KEY);

  job.steps.voiceover = hasVoiceoverCredentials ? 'running' : 'skipped';
  job.steps.render = 'running';

  await runCommand(['node', 'docs-automation/render.mjs', flow.id], env, job);

  job.steps.render = 'done';
  if (hasVoiceoverCredentials) {
    job.steps.voiceover = 'done';
  }
  job.status = 'done';
  scheduleJobRemoval(job.id);
}

async function runCommand(parts, env, job) {
  const [command, ...args] = parts;
  appendLog(job, `$ ${[command, ...args].join(' ')}`);

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => appendChunk(job, chunk));
    child.stderr.on('data', (chunk) => appendChunk(job, chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Comando falhou (${code}): ${[command, ...args].join(' ')}`));
    });
  });
}

function appendChunk(job, chunk) {
  const text = String(chunk);
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    appendLog(job, line);
  }
}

function appendLog(job, line) {
  job.log.push(line);
  if (job.log.length > 800) {
    job.log = job.log.slice(-800);
  }
}

function parseProductPatch(body) {
  const patch = {};
  if (body.brand) {
    patch.brand = typeof body.brand === 'string' ? JSON.parse(body.brand) : body.brand;
  } else {
    // Support flat fields from simple forms.
    const colors = {};
    if (body.accent) colors.accent = body.accent;
    if (body.accentAlt) colors.accentAlt = body.accentAlt;
    if (body.background) colors.background = body.background;
    if (Object.keys(colors).length > 0) {
      patch.brand = { colors };
    }
  }
  return patch;
}

function validateCompositionPatch(composition) {
  for (const key of ['fps', 'width', 'height']) {
    if (composition[key] != null && (!Number.isInteger(composition[key]) || composition[key] <= 0)) {
      throw new Error(`Campo composition.${key} deve ser inteiro positivo.`);
    }
  }

  if (
    composition.durationInSeconds != null &&
    (typeof composition.durationInSeconds !== 'number' || composition.durationInSeconds <= 0)
  ) {
    throw new Error('Campo composition.durationInSeconds deve ser número positivo.');
  }
}

function getSafeExt(filename) {
  const raw = path.extname(filename ?? '').toLowerCase();
  if (raw === '.png' || raw === '.jpg' || raw === '.jpeg' || raw === '.webp' || raw === '.svg') {
    return raw;
  }
  return '.png';
}

