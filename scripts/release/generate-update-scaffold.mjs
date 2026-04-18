import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const packageJsonPath = path.join(root, 'package.json');
const outDir = path.join(root, 'release', 'updates');
const outPath = path.join(outDir, 'latest.json.template');

const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
const version = pkg.version;

const scaffold = {
  version,
  notes: `Draft update metadata scaffold for v${version}.`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature: '<replace-with-signature>',
      url: '<replace-with-release-asset-url>'
    },
    'darwin-aarch64': {
      signature: '<replace-with-signature>',
      url: '<replace-with-release-asset-url>'
    },
    'darwin-x86_64': {
      signature: '<replace-with-signature>',
      url: '<replace-with-release-asset-url>'
    },
    'linux-x86_64': {
      signature: '<replace-with-signature>',
      url: '<replace-with-release-asset-url>'
    }
  }
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outPath, `${JSON.stringify(scaffold, null, 2)}\n`, 'utf8');

console.log(`Update scaffold generated at ${outPath}`);
