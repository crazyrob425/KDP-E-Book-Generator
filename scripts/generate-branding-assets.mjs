import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = '/home/runner/work/KDP-E-Book-Generator/KDP-E-Book-Generator';
const sourceLogoImage = path.join(ROOT, 'assets/branding/logo_source.png');
const fallbackIconSvg = path.join(ROOT, 'assets/branding/app-icon.svg');
const splashSvg = path.join(ROOT, 'assets/branding/splash-screen.svg');

const tauriIconsDir = path.join(ROOT, 'src-tauri/icons');
const installerAssetsDir = path.join(ROOT, 'installer/windows/assets');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeIconPng(size, outPath) {
  if (fsSync.existsSync(sourceLogoImage)) {
    let metadata;
    try {
      metadata = await sharp(sourceLogoImage).metadata();
    } catch {
      metadata = null;
    }
    if (!metadata || !metadata.width || !metadata.height) {
      await sharp(fallbackIconSvg).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
      return;
    }
    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 576;

    const cropSize = Math.min(
      Math.round(width * 0.42),
      Math.round(height * 0.75),
      width,
      height
    );
    const left = Math.max(0, Math.round((width - cropSize) / 2));
    const top = Math.max(0, Math.round(height * 0.12));
    const safeTop = Math.min(top, Math.max(0, height - cropSize));

    await sharp(sourceLogoImage)
      .extract({ left, top: safeTop, width: cropSize, height: cropSize })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    return;
  }

  await sharp(fallbackIconSvg).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
}

async function main() {
  await ensureDir(tauriIconsDir);
  await ensureDir(installerAssetsDir);

  const png32 = path.join(tauriIconsDir, '32x32.png');
  const png128 = path.join(tauriIconsDir, '128x128.png');
  const png256 = path.join(tauriIconsDir, '128x128@2x.png');
  const iconPng1024 = path.join(tauriIconsDir, 'icon.png');
  const installerIconPng = path.join(installerAssetsDir, 'installer-icon-256.png');
  const officialLogoPng = path.join(ROOT, 'assets/branding/official-logo.png');

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

  if (fsSync.existsSync(sourceLogoImage)) {
    let metadata;
    try {
      metadata = await sharp(sourceLogoImage).metadata();
    } catch {
      metadata = null;
    }
    if (!metadata || !metadata.width || !metadata.height) {
      await sharp(fallbackIconSvg)
        .resize(700, 500, { fit: 'inside' })
        .png({ compressionLevel: 9 })
        .toFile(officialLogoPng);
      console.warn(`Logo source exists but is not a valid image at ${sourceLogoImage}. Used fallback SVG.`);
      return;
    }
    const width = metadata.width ?? 1024;
    const height = metadata.height ?? 576;
    const logoWidth = Math.min(width, Math.round(width * 0.55));
    const logoHeight = Math.min(height, Math.round(height * 0.82));
    const left = Math.max(0, Math.round((width - logoWidth) / 2));
    const top = Math.max(0, Math.round(height * 0.06));
    const safeTop = Math.min(top, Math.max(0, height - logoHeight));

    await sharp(sourceLogoImage)
      .extract({ left, top: safeTop, width: logoWidth, height: logoHeight })
      .resize(700, 500, { fit: 'inside' })
      .png({ compressionLevel: 9 })
      .toFile(officialLogoPng);
  } else {
    await sharp(fallbackIconSvg)
      .resize(700, 500, { fit: 'inside' })
      .png({ compressionLevel: 9 })
      .toFile(officialLogoPng);
  }

  await sharp(splashSvg)
    .resize(1646, 823)
    .png({ compressionLevel: 9 })
    .toFile(path.join(installerAssetsDir, 'installer-splash.png'));

  await sharp(splashSvg)
    .resize(620, 300)
    .png({ compressionLevel: 9 })
    .toFile(path.join(installerAssetsDir, 'wizard-header.png'));

  console.log('Branding assets generated successfully.');
  if (!fsSync.existsSync(sourceLogoImage)) {
    console.warn(
      `Source logo not found at ${sourceLogoImage}. Generated assets from fallback SVG.`
    );
  }
}

main().catch((err) => {
  console.error('Failed to generate branding assets:', err);
  process.exit(1);
});
