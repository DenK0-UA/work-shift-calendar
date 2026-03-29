import { execFileSync } from 'node:child_process';

const channel = process.argv[2]?.trim();
const version = process.argv[3]?.trim();

if (!['beta', 'stable'].includes(channel || '')) {
    console.error('Usage: node scripts/push-release-tag.mjs <beta|stable> <major.minor.patch>');
    process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
    console.error('Version must match <major.minor.patch>.');
    process.exit(1);
}

const tagName = `${channel}-${version}`;

const runGit = (...args) => execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
}).trim();

const runNode = (...args) => execFileSync('node', args, {
    encoding: 'utf8',
    stdio: 'inherit'
});

const worktreeStatus = runGit('status', '--short');

if (worktreeStatus) {
    console.error('Git worktree must be clean before creating a release tag.');
    console.error(worktreeStatus);
    process.exit(1);
}

const currentBranch = runGit('branch', '--show-current');

if (currentBranch !== 'main') {
    console.error(`Release tags must be created from main. Current branch: ${currentBranch || '(detached HEAD)'}.`);
    process.exit(1);
}

runGit('fetch', 'origin', 'main', '--tags');
const existingTags = runGit('tag', '--list', tagName);

if (existingTags === tagName) {
    console.error(`Tag ${tagName} already exists.`);
    process.exit(1);
}

runNode('scripts/release-preflight.mjs', channel, version);

runGit('tag', '-a', tagName, '-m', `${channel} release ${version}`);
runGit('push', 'origin', tagName);

console.log(`Pushed ${tagName}. GitHub Actions will publish the ${channel} release.`);
