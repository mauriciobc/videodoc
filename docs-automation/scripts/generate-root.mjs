import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadManifestWithOverrides, resolveProductById, validateManifest } from '../server/manifest-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsAutomationDir = path.join(__dirname, '..');
const outputPath = path.join(docsAutomationDir, 'Root.generated.jsx');

const manifest = loadManifestWithOverrides();
validateManifest(manifest);

const imports = manifest.flows
  .map((flow) => `import { ${flow.id} } from './compositions/${flow.id}.jsx';`)
  .join('\n');

const compositionBlocks = manifest.flows
  .map((flow) => {
    let product;
    try {
      product = resolveProductById(manifest, flow.productId);
    } catch (err) {
      throw new Error(
        `Product not found for flow "${flow.id}" (productId: ${flow.productId}). ${err.message}`
      );
    }
    const composition = flow.composition ?? {};
    const fps = composition.fps ?? manifest.defaults.composition.fps;
    const width = composition.width ?? manifest.defaults.composition.width;
    const height = composition.height ?? manifest.defaults.composition.height;
    const durationInSeconds = composition.durationInSeconds ?? 12;
    const durationInFrames = Math.round(durationInSeconds * fps);
    const defaultProps = {
      ...(composition.defaultProps ?? {}),
      brand: product.brand ?? {},
    };

    return `      <Composition
        id="${flow.id}"
        component={${flow.id}}
        durationInFrames={${durationInFrames}}
        fps={${fps}}
        width={${width}}
        height={${height}}
        defaultProps={${JSON.stringify(defaultProps)}}
      />`;
  })
  .join('\n\n');

const source = `import { Composition, registerRoot } from 'remotion';
${imports}

const RemotionRoot = () => {
  return (
    <>
${compositionBlocks}
    </>
  );
};

registerRoot(RemotionRoot);
`;

fs.writeFileSync(outputPath, source, 'utf-8');
console.log(`Generated ${outputPath}`);

