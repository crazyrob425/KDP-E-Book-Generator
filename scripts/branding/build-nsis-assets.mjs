import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const preferredSource = path.join(root, 'null library.png');
const fallbackSource = path.join(root, 'src-tauri', 'icons', 'icon.png');
let source;
const outDir = path.join(root, 'src-tauri', 'installer-assets');
const sidebarImage = path.join(outDir, 'nsis-sidebar.bmp');
const headerImage = path.join(outDir, 'nsis-header.bmp');
const installerIcon = path.join(root, 'src-tauri', 'icons', 'icon.ico');

await fs.mkdir(outDir, { recursive: true });

try {
  await fs.access(preferredSource);
  source = preferredSource;
} catch (error) {
  source = fallbackSource;
  if (error?.code && error.code !== 'ENOENT') {
    throw error;
  }
  console.warn(`Preferred installer splash image not found at: ${preferredSource}. Falling back to ${fallbackSource}.`);
}

const toBmp24 = async (inputPath, width, height, outputPath) => {
  const { data, info } = await sharp(inputPath)
    .resize(width, height, { fit: 'cover' })
    .flatten({ background: '#111827' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bytesPerPixel = 3;
  const rowStride = info.width * bytesPerPixel;
  const paddedRowStride = Math.ceil(rowStride / 4) * 4;
  const pixelDataSize = paddedRowStride * info.height;
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const pixelDataOffset = fileHeaderSize + dibHeaderSize;
  const fileSize = pixelDataOffset + pixelDataSize;
  const bmp = Buffer.alloc(fileSize);

  bmp.write('BM', 0, 2, 'ascii');
  bmp.writeUInt32LE(fileSize, 2);
  bmp.writeUInt32LE(pixelDataOffset, 10);
  bmp.writeUInt32LE(dibHeaderSize, 14);
  bmp.writeInt32LE(info.width, 18);
  bmp.writeInt32LE(info.height, 22);
  bmp.writeUInt16LE(1, 26);
  bmp.writeUInt16LE(24, 28);
  bmp.writeUInt32LE(0, 30);
  bmp.writeUInt32LE(pixelDataSize, 34);

  let outOffset = pixelDataOffset;
  for (let y = info.height - 1; y >= 0; y--) {
    for (let x = 0; x < info.width; x++) {
      const inOffset = (y * info.width + x) * info.channels;
      const r = data[inOffset];
      const g = data[inOffset + 1];
      const b = data[inOffset + 2];
      bmp[outOffset++] = b;
      bmp[outOffset++] = g;
      bmp[outOffset++] = r;
    }
    while ((outOffset - pixelDataOffset) % paddedRowStride !== 0) {
      bmp[outOffset++] = 0x00;
    }
  }

  await fs.writeFile(outputPath, bmp);
};

await toBmp24(source, 164, 314, sidebarImage);
await toBmp24(source, 150, 57, headerImage);

console.log('NSIS branding assets prepared:');
console.log(`- source image: ${source}`);
console.log(`- ${headerImage}`);
console.log(`- ${sidebarImage}`);
console.log(`- ${installerIcon}`);
