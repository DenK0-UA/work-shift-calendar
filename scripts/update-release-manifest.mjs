import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const [channelArg, versionArg, apkUrlArg, ...notesParts] = process.argv.slice(2);

const channel = channelArg?.trim();
const version = versionArg?.trim();
const apkUrl = apkUrlArg?.trim();
const notes = notesParts.join(' ').trim();

if (!['beta', 'stable'].includes(channel || '')) {
    console.error('Usage: node scripts/update-release-manifest.mjs <beta|stable> <version> <apkUrl> [notes]');
    process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
    console.error('Version must match <major.minor.patch>.');
    process.exit(1);
}

if (!apkUrl) {
    console.error('apkUrl is required.');
    process.exit(1);
}

const manifestPath = path.join(rootDir, channel, 'version.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.version = version;
manifest.apkUrl = apkUrl;
manifest.notes = notes || `${channel === 'beta' ? 'Beta' : 'Stable'} release channel.`;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Updated ${channel}/version.json -> ${version}`);
