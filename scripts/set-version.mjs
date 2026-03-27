import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const nextVersion = process.argv[2]?.trim();

if (!/^\d+\.\d+\.\d+$/.test(nextVersion || '')) {
    console.error('Usage: npm run version:set -- <major.minor.patch>');
    process.exit(1);
}

const versionParts = nextVersion.split('.').map((part) => Number.parseInt(part, 10));
const nextVersionCode = (versionParts[0] * 10000) + (versionParts[1] * 100) + versionParts[2];

const updateTextFile = (relativePath, transform) => {
    const absolutePath = path.join(rootDir, relativePath);
    const previousValue = fs.readFileSync(absolutePath, 'utf8');
    const nextValue = transform(previousValue);

    if (nextValue === previousValue) {
        return;
    }

    fs.writeFileSync(absolutePath, nextValue, 'utf8');
};

updateTextFile('package.json', (source) => {
    const parsed = JSON.parse(source);
    parsed.version = nextVersion;
    return `${JSON.stringify(parsed, null, 2)}\n`;
});

updateTextFile(path.join('data', 'config.js'), (source) =>
    source.replace(
        /const APP_RELEASE_VERSION = '.*?';/,
        `const APP_RELEASE_VERSION = '${nextVersion}';`
    )
);

updateTextFile(path.join('android', 'app', 'build.gradle'), (source) =>
    source
        .replace(/versionCode \d+/, `versionCode ${nextVersionCode}`)
        .replace(/versionName ".*?"/, `versionName "${nextVersion}"`)
);

for (const channel of ['beta', 'stable']) {
    updateTextFile(path.join(channel, 'version.json'), (source) => {
        const parsed = JSON.parse(source);
        parsed.version = nextVersion;
        return `${JSON.stringify(parsed, null, 2)}\n`;
    });
}

console.log(`Updated app version to ${nextVersion} (versionCode ${nextVersionCode}).`);
