import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const port = process.env.CAP_LIVE_PORT || '4173';
const host = process.env.CAP_LIVE_HOST || detectLanIp();

if (!host) {
  console.error(
    'Could not detect a LAN IP automatically. Set CAP_LIVE_HOST=YOUR_IP and try again.',
  );
  process.exit(1);
}

console.log(`Using live reload URL: http://${host}:${port}`);
console.log('Make sure the phone and this computer are on the same Wi-Fi network.');
console.log('Start `npm run dev:web` in another terminal before running this command.');

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';

console.log('Syncing Android project and reapplying local Gradle patches before launch...');
runBlockingCommand(npxCommand, ['cap', 'sync', 'android']);
runBlockingCommand(nodeCommand, [path.join('scripts', 'patch-capacitor-android.mjs')]);

const child = spawn(
  npxCommand,
  ['cap', 'run', 'android', '--no-sync', '--live-reload', '--host', host, '--port', port],
  {
    stdio: 'inherit',
    shell: false,
    cwd: rootDir,
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

function detectLanIp() {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    if (!addresses) {
      continue;
    }

    for (const address of addresses) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }

      if (isPrivateIpv4(address.address)) {
        return address.address;
      }
    }
  }

  return null;
}

function isPrivateIpv4(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function runBlockingCommand(command, args) {
  execFileSync(command, args, {
    stdio: 'inherit',
    cwd: rootDir,
  });
}
