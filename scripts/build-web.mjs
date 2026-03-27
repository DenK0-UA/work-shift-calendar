import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'www');

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

await cp(path.join(rootDir, 'index.html'), path.join(webDir, 'index.html'));

for (const folder of ['js', 'styles', 'data']) {
  await cp(path.join(rootDir, folder), path.join(webDir, folder), {
    recursive: true,
  });
}

console.log(`Built web assets into ${webDir}`);
