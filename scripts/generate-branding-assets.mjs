import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = '/home/runner/work/KDP-E-Book-Generator/KDP-E-Book-Generator';
const iconSvg = path.join(ROOT, 'assets/branding/app-icon.svg');
const splashSvg = path.join(ROOT, 'assets/branding/splash-screen.svg');

const tauriIconsDir = path.join(ROOT, 'src-tauri/icons');
const installerAssetsDir = path.join(ROOT, 'installer/windows/assets');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeIconPng(size, outPath) {
  await sharp(iconSvg)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  await ensureDir(tauriIconsDir);
  await ensureDir(installerAssetsDir);

  const png32 = path.join(tauriIconsDir, '32x32.png');
  const png128 = path.join(tauriIconsDir, '128x128.png');
  const png256 = path.join(tauriIconsDir, '128x128@2x.png');
  const iconPng1024 = path.join(tauriIconsDir, 'icon.png');
  const installerIconPng = path.join(installerAssetsDir, 'installer-icon-256.png');

  await Promise.all([
    writeIconPng(32, png32),
    writeIconPng(128, png128),
    writeIconPng(256, png256),
    writeIconPng(1024, iconPng1024),
    writeIconPng(256, installerIconPng),
  ]);

  const icoBuffer = await pngToIco([png32, png128, png256]);
  await fs.writeFile(path.join(tauriIconsDir, 'icon.ico'), icoBuffer);
  await fs.writeFile(path.join(installerAssetsDir, 'installer-icon.ico'), icoBuffer);

  await sharp(splashSvg)
    .resize(1646, 823)
    .png({ compressionLevel: 9 })
    .toFile(path.join(installerAssetsDir, 'installer-splash.png'));

  await sharp(splashSvg)
    .resize(620, 300)
    .png({ compressionLevel: 9 })
    .toFile(path.join(installerAssetsDir, 'wizard-header.png'));

  console.log('Branding assets generated successfully.');
}

main().catch((err) => {
  console.error('Failed to generate branding assets:', err);
  process.exit(1);
});
