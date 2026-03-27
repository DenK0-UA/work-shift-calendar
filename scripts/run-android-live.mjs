import os from 'node:os';
import { spawn } from 'node:child_process';

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
const child = spawn(
  npxCommand,
  ['cap', 'run', 'android', '--live-reload', '--host', host, '--port', port],
  {
    stdio: 'inherit',
    shell: false,
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
