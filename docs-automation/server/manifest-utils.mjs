import fs from 'fs';
import path from 'path';

const DOCS_AUTOMATION_DIR = path.resolve(process.cwd(), 'docs-automation');
const MANIFEST_PATH = path.join(DOCS_AUTOMATION_DIR, 'manifest.json');
const FLOW_OVERRIDES_PATH = path.join(DOCS_AUTOMATION_DIR, 'flow-overrides.json');
const PRODUCT_OVERRIDES_PATH = path.join(DOCS_AUTOMATION_DIR, 'product-overrides.json');
const PROJECT_OVERRIDES_PATH = path.join(DOCS_AUTOMATION_DIR, 'project-overrides.json');

const DEFAULT_COMPOSITION = {
  fps: 30,
  width: 1280,
  height: 720,
  durationInSeconds: 12,
  defaultProps: {},
};

const DEFAULT_VOICEOVER = {
  languageCode: 'pt-BR',
  name: 'pt-BR-Neural2-C',
  speakingRate: 1.0,
  pitch: 0.0,
  volumeGainDb: 0.0,
};

export function getPaths() {
  return {
    docsAutomationDir: DOCS_AUTOMATION_DIR,
    manifestPath: MANIFEST_PATH,
    flowOverridesPath: FLOW_OVERRIDES_PATH,
    productOverridesPath: PRODUCT_OVERRIDES_PATH,
    projectOverridesPath: PROJECT_OVERRIDES_PATH,
  };
}

export function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse JSON in ${filePath}: ${err.message}`);
  }
}

export function loadManifestWithOverrides() {
  const manifest = readJsonIfExists(MANIFEST_PATH, null);
  if (!manifest) {
    throw new Error(`Manifest não encontrado: ${MANIFEST_PATH}`);
  }

  const flowOverrides = readJsonIfExists(FLOW_OVERRIDES_PATH, {});
  const productOverrides = readJsonIfExists(PRODUCT_OVERRIDES_PATH, {});
  const projectOverrides = readJsonIfExists(PROJECT_OVERRIDES_PATH, {});

  const defaults = {
    composition: {
      ...DEFAULT_COMPOSITION,
      ...(manifest.defaults?.composition ?? {}),
    },
    voiceover: {
      ...DEFAULT_VOICEOVER,
      ...(manifest.defaults?.voiceover ?? {}),
      ...(projectOverrides.voiceover ?? {}),
    },
  };

  const products = (manifest.products ?? []).map((product) => {
    const override = productOverrides[product.id] ?? {};
    return {
      ...product,
      ...override,
      brand: {
        ...(product.brand ?? {}),
        ...(override.brand ?? {}),
        colors: {
          ...(product.brand?.colors ?? {}),
          ...(override.brand?.colors ?? {}),
        },
        assets: {
          ...(product.brand?.assets ?? {}),
          ...(override.brand?.assets ?? {}),
        },
      },
    };
  });

  const flows = (manifest.flows ?? []).map((flow) => {
    const override = flowOverrides[flow.id] ?? {};
    return {
      ...flow,
      ...override,
      composition: {
        ...defaults.composition,
        ...(flow.composition ?? {}),
        ...(override.composition ?? {}),
        defaultProps: {
          ...(defaults.composition.defaultProps ?? {}),
          ...(flow.composition?.defaultProps ?? {}),
          ...(override.composition?.defaultProps ?? {}),
        },
      },
    };
  });

  return {
    ...manifest,
    defaults,
    products,
    flows,
  };
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest inválido: objeto não encontrado.');
  }

  if (!Array.isArray(manifest.products) || manifest.products.length === 0) {
    throw new Error('Manifest inválido: products deve conter ao menos 1 item.');
  }

  if (!Array.isArray(manifest.flows) || manifest.flows.length === 0) {
    throw new Error('Manifest inválido: flows deve conter ao menos 1 item.');
  }

  const productIds = new Set();
  for (const product of manifest.products) {
    if (!product.id) {
      throw new Error('Manifest inválido: produto sem id.');
    }
    if (productIds.has(product.id)) {
      throw new Error(`Manifest inválido: product.id duplicado "${product.id}".`);
    }
    productIds.add(product.id);
  }

  const flowIds = new Set();
  for (const flow of manifest.flows) {
    if (!flow.id) {
      throw new Error('Manifest inválido: flow sem id.');
    }
    if (flowIds.has(flow.id)) {
      throw new Error(`Manifest inválido: flow.id duplicado "${flow.id}".`);
    }
    flowIds.add(flow.id);

    if (!productIds.has(flow.productId)) {
      throw new Error(
        `Manifest inválido: flow "${flow.id}" referencia productId inexistente "${flow.productId}".`
      );
    }

    if (!flow.journeyFile) {
      throw new Error(`Manifest inválido: flow "${flow.id}" sem journeyFile.`);
    }
    const journeyPath = path.join(DOCS_AUTOMATION_DIR, 'journeys', flow.journeyFile);
    if (!fs.existsSync(journeyPath)) {
      throw new Error(
        `Manifest inválido: journey não encontrado para flow "${flow.id}" em ${journeyPath}`
      );
    }

    const compositionPath = path.join(DOCS_AUTOMATION_DIR, 'compositions', `${flow.id}.jsx`);
    if (!fs.existsSync(compositionPath)) {
      throw new Error(
        `Manifest inválido: composition não encontrada para flow "${flow.id}" em ${compositionPath}`
      );
    }
  }
}

export function resolveFlowById(manifest, flowId) {
  const flow = manifest.flows.find((item) => item.id === flowId);
  if (!flow) {
    throw new Error(`Flow "${flowId}" não encontrado no manifesto.`);
  }
  return flow;
}

export function resolveProductById(manifest, productId) {
  const product = manifest.products.find((item) => item.id === productId);
  if (!product) {
    throw new Error(`Produto "${productId}" não encontrado no manifesto.`);
  }
  return product;
}

export function saveFlowOverride(flowId, patch) {
  const all = readJsonIfExists(FLOW_OVERRIDES_PATH, {});
  all[flowId] = {
    ...(all[flowId] ?? {}),
    ...patch,
    composition: {
      ...(all[flowId]?.composition ?? {}),
      ...(patch.composition ?? {}),
      defaultProps: {
        ...(all[flowId]?.composition?.defaultProps ?? {}),
        ...(patch.composition?.defaultProps ?? {}),
      },
    },
  };
  const dir = path.dirname(FLOW_OVERRIDES_PATH);
  const tempPath = path.join(dir, `.flow-overrides.json.tmp.${process.pid}`);
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(all, null, 2)}\n`, 'utf-8');
    fs.renameSync(tempPath, FLOW_OVERRIDES_PATH);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
    throw err;
  }
}

export function saveProductOverride(productId, patch) {
  const all = readJsonIfExists(PRODUCT_OVERRIDES_PATH, {});
  all[productId] = {
    ...(all[productId] ?? {}),
    ...patch,
    brand: {
      ...(all[productId]?.brand ?? {}),
      ...(patch.brand ?? {}),
      colors: {
        ...(all[productId]?.brand?.colors ?? {}),
        ...(patch.brand?.colors ?? {}),
      },
      assets: {
        ...(all[productId]?.brand?.assets ?? {}),
        ...(patch.brand?.assets ?? {}),
      },
    },
  };
  fs.writeFileSync(PRODUCT_OVERRIDES_PATH, `${JSON.stringify(all, null, 2)}\n`, 'utf-8');
}

export function saveVoiceoverOverride(patch) {
  const all = readJsonIfExists(PROJECT_OVERRIDES_PATH, {});
  all.voiceover = {
    ...(all.voiceover ?? {}),
    ...patch,
  };
  fs.writeFileSync(PROJECT_OVERRIDES_PATH, `${JSON.stringify(all, null, 2)}\n`, 'utf-8');
}

export function resolveProductEnv(product) {
  const envMap = product.env ?? {};
  const resolved = {};
  for (const [key, value] of Object.entries(envMap)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      resolved[key] = process.env[value.slice(1)] ?? '';
    } else {
      resolved[key] = String(value);
    }
  }
  return resolved;
}

