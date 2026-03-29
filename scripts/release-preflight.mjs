import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const channel = process.argv[2]?.trim();
const version = process.argv[3]?.trim();

if (!['beta', 'stable'].includes(channel || '')) {
    console.error('Usage: node scripts/release-preflight.mjs <beta|stable> <major.minor.patch>');
    process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
    console.error('Version must match <major.minor.patch>.');
    process.exit(1);
}

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

const readJson = (relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
};

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const packageJson = readJson('package.json');
const betaManifest = readJson(path.join('beta', 'version.json'));
const stableManifest = readJson(path.join('stable', 'version.json'));
const betaAccess = readJson(path.join('beta', 'access.json'));
const configSource = readText(path.join('data', 'config.js'));
const gradleSource = readText(path.join('android', 'app', 'build.gradle'));

const configVersion = configSource.match(/const APP_RELEASE_VERSION = '([^']+)';/)?.[1] || '';
const versionName = gradleSource.match(/versionName "([^"]+)"/)?.[1] || '';

if (packageJson.version !== configVersion || packageJson.version !== versionName) {
    fail('App version is inconsistent across package.json, data/config.js, and android/app/build.gradle.');
}

if (channel === 'beta' && betaManifest.version !== packageJson.version) {
    fail('beta/version.json must match the current app version before creating the next beta release.');
}

if (channel === 'stable' && betaManifest.version !== version) {
    fail(`beta/version.json must already be ${version} before promoting to stable.`);
}

if (channel === 'stable' && stableManifest.version === version) {
    fail(`stable/version.json is already on ${version}.`);
}

if (!Array.isArray(betaAccess.allowedInstallIds) || betaAccess.allowedInstallIds.length === 0) {
    fail('beta/access.json has no allowedInstallIds. Beta release would be invisible to testers.');
}

if (!configSource.includes('https://denk0-ua.github.io/work-shift-calendar/stable/version.json')
    || !configSource.includes('https://denk0-ua.github.io/work-shift-calendar/beta/version.json')) {
    fail('App update manifest URLs are not pointing to GitHub Pages.');
}

console.log(`Release preflight passed for ${channel} ${version}.`);
