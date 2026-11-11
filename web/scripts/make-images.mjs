// Rasterize the project's own vector art using the image library bundled with Next.
import { createRequire } from 'node:module';
import { icon, social, makeArt } from './make-art.mjs';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
makeArt();
await Promise.all([
  sharp(Buffer.from(icon)).png().toFile(new URL('../public/apple-touch-icon.png', import.meta.url).pathname),
  sharp(Buffer.from(social)).png().toFile(new URL('../public/og.png', import.meta.url).pathname),
]);
