import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configRelativePath = path.join('.github', 'one-time-stable-release.json');
const configPath = path.join(rootDir, configRelativePath);

const repository = process.env.GITHUB_REPOSITORY || 'DenK0-UA/work-shift-calendar';
const defaultBranch = process.env.DEFAULT_BRANCH || 'main';
const githubToken = process.env.GITHUB_TOKEN || '';
const pagesManifestUrl = 'https://denk0-ua.github.io/work-shift-calendar/stable/version.json';

const githubHeaders = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'one-time-stable-release',
    'X-GitHub-Api-Version': '2022-11-28'
};

if (githubToken) {
    githubHeaders.Authorization = `Bearer ${githubToken}`;
}

const log = (message) => {
    console.log(`[one-time-stable-release] ${message}`);
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const runNode = (...args) => execFileSync('node', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'inherit'
});

const readConfig = () => {
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    return {
        enabled: rawConfig.enabled === true,
        version: typeof rawConfig.version === 'string' ? rawConfig.version.trim() : '',
        releaseAtUtc: typeof rawConfig.releaseAtUtc === 'string' ? rawConfig.releaseAtUtc.trim() : '',
        notes: typeof rawConfig.notes === 'string' && rawConfig.notes.trim()
            ? rawConfig.notes.trim()
            : 'Stable release channel.'
    };
};

const validateConfig = (config) => {
    if (!config.enabled) {
        return null;
    }

    if (!/^\d+\.\d+\.\d+$/.test(config.version)) {
        throw new Error(`${configRelativePath} must contain version in x.y.z format when enabled is true.`);
    }

    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(config.releaseAtUtc)) {
        throw new Error(`${configRelativePath} must contain releaseAtUtc in UTC ISO format YYYY-MM-DDTHH:MM:SSZ when enabled is true.`);
    }

    const releaseAtMilliseconds = Date.parse(config.releaseAtUtc);

    if (Number.isNaN(releaseAtMilliseconds)) {
        throw new Error(`${configRelativePath} contains an invalid releaseAtUtc value.`);
    }

    return releaseAtMilliseconds;
};

const fetchJson = async (url, { allow404 = false } = {}) => {
    const response = await fetch(url, { headers: githubHeaders });
    const responseText = await response.text();

    if (response.status === 404 && allow404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}: ${responseText}`);
    }

    return responseText ? JSON.parse(responseText) : null;
};

const dispatchWorkflow = async (workflowFileName, inputs = undefined) => {
    if (!githubToken) {
        throw new Error('GITHUB_TOKEN is required to dispatch workflows.');
    }

    const response = await fetch(
        `https://api.github.com/repos/${repository}/actions/workflows/${workflowFileName}/dispatches`,
        {
            method: 'POST',
            headers: {
                ...githubHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: defaultBranch,
                ...(inputs ? { inputs } : {})
            })
        }
    );

    const responseText = await response.text();

    if (response.status !== 204) {
        throw new Error(`Failed to dispatch ${workflowFileName}: HTTP ${response.status} ${responseText}`);
    }
};

const fetchReleaseState = async (version) => {
    const cacheBust = `nocache=${Date.now()}`;
    const stableRelease = await fetchJson(
        `https://api.github.com/repos/${repository}/releases/tags/v${version}`,
        { allow404: true }
    );
    const mainManifest = await fetchJson(
        `https://raw.githubusercontent.com/${repository}/${defaultBranch}/stable/version.json?${cacheBust}`,
        { allow404: true }
    );
    const pagesManifest = await fetchJson(`${pagesManifestUrl}?${cacheBust}`, { allow404: true });

    return {
        releaseExists: stableRelease?.tag_name === `v${version}`,
        mainVersion: typeof mainManifest?.version === 'string' ? mainManifest.version : '',
        pagesVersion: typeof pagesManifest?.version === 'string' ? pagesManifest.version : ''
    };
};

const waitForCondition = async (label, getState, isReady, { timeoutMs, intervalMs }) => {
    const deadline = Date.now() + timeoutMs;
    let lastState = null;

    while (Date.now() < deadline) {
        lastState = await getState();

        if (isReady(lastState)) {
            return lastState;
        }

        log(`${label} is still pending. main=${lastState.mainVersion || 'n/a'}, release=${lastState.releaseExists}, pages=${lastState.pagesVersion || 'n/a'}`);
        await sleep(intervalMs);
    }

    throw new Error(`${label} timed out. Last state: ${JSON.stringify(lastState)}`);
};

try {
    const config = readConfig();
    const releaseAtMilliseconds = validateConfig(config);

    if (!config.enabled) {
        log(`No scheduled stable release is armed in ${configRelativePath}.`);
        process.exit(0);
    }

    if (Date.now() < releaseAtMilliseconds) {
        log(`Stable ${config.version} is scheduled for ${config.releaseAtUtc}. Current UTC time is ${new Date().toISOString()}.`);
        process.exit(0);
    }

    if (!githubToken) {
        throw new Error('GITHUB_TOKEN is required once the scheduled release window is open.');
    }

    let state = await fetchReleaseState(config.version);

    log(`Current state before action: main=${state.mainVersion || 'n/a'}, release=${state.releaseExists}, pages=${state.pagesVersion || 'n/a'}`);

    if (state.pagesVersion === config.version) {
        log(`Stable ${config.version} is already live on GitHub Pages.`);
        process.exit(0);
    }

    if (state.mainVersion !== config.version && !state.releaseExists) {
        log(`Running stable preflight for ${config.version}.`);
        runNode('scripts/release-preflight.mjs', 'stable', config.version);

        log(`Dispatching promote-stable workflow for ${config.version}.`);
        await dispatchWorkflow('promote-stable.yml', {
            version: config.version,
            notes: config.notes
        });
    }

    if (state.mainVersion !== config.version || !state.releaseExists) {
        state = await waitForCondition(
            'Stable release metadata',
            () => fetchReleaseState(config.version),
            (nextState) => nextState.mainVersion === config.version && nextState.releaseExists,
            {
                timeoutMs: 20 * 60 * 1000,
                intervalMs: 15 * 1000
            }
        );
    }

    if (state.pagesVersion !== config.version) {
        log(`Dispatching GitHub Pages deployment for stable ${config.version}.`);
        await dispatchWorkflow('deploy-pages.yml');

        state = await waitForCondition(
            'GitHub Pages deployment',
            () => fetchReleaseState(config.version),
            (nextState) => nextState.pagesVersion === config.version,
            {
                timeoutMs: 15 * 60 * 1000,
                intervalMs: 15 * 1000
            }
        );
    }

    log(`One-time stable release ${config.version} is fully live.`);
} catch (error) {
    console.error(`[one-time-stable-release] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}