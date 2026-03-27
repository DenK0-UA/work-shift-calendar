const APP_UPDATE_CHANNELS = {
    stable: 'stable',
    beta: 'beta'
};

const APP_UPDATE_STORAGE_KEYS = {
    selectedChannel: 'appUpdate:channel',
    betaUnlocked: 'appUpdate:betaUnlocked',
    dismissedVersionPrefix: 'appUpdate:dismissed:'
};

const appUpdateEls = {
    banner: document.getElementById('app-update-banner'),
    text: document.getElementById('app-update-banner-text'),
    downloadBtn: document.getElementById('app-update-download'),
    dismissBtn: document.getElementById('app-update-dismiss')
};

function isNativeAndroidApp() {
    return window.Capacitor?.getPlatform?.() === 'android';
}

function normalizeUpdateChannel(channel) {
    return channel === APP_UPDATE_CHANNELS.beta
        ? APP_UPDATE_CHANNELS.beta
        : APP_UPDATE_CHANNELS.stable;
}

function getChannelLabel(channel) {
    return normalizeUpdateChannel(channel) === APP_UPDATE_CHANNELS.beta
        ? 'Beta'
        : 'Stable';
}

function readConfiguredManifestUrls() {
    const configuredUrls =
        typeof APP_UPDATE_MANIFEST_URLS === 'object' && APP_UPDATE_MANIFEST_URLS
            ? APP_UPDATE_MANIFEST_URLS
            : {};

    const normalizeUrl = (value) => (typeof value === 'string' ? value.trim() : '');

    return {
        stable: normalizeUrl(configuredUrls.stable),
        beta: normalizeUrl(configuredUrls.beta)
    };
}

function canUseBetaChannel() {
    return Boolean(readConfiguredManifestUrls().beta);
}

function readConfiguredDefaultChannel() {
    const normalizedDefault = normalizeUpdateChannel(APP_UPDATE_CHANNEL_DEFAULT);
    if (normalizedDefault === APP_UPDATE_CHANNELS.beta && !canUseBetaChannel()) {
        return APP_UPDATE_CHANNELS.stable;
    }

    return normalizedDefault;
}

function isBetaChannelUnlocked() {
    try {
        return localStorage.getItem(APP_UPDATE_STORAGE_KEYS.betaUnlocked) === '1';
    } catch (error) {
        return false;
    }
}

function unlockBetaChannel() {
    try {
        localStorage.setItem(APP_UPDATE_STORAGE_KEYS.betaUnlocked, '1');
        return true;
    } catch (error) {
        return false;
    }
}

function normalizeVersionParts(version) {
    if (typeof version !== 'string') {
        return [];
    }

    return version
        .trim()
        .split('.')
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part) && part >= 0);
}

function compareAppVersions(left, right) {
    const leftParts = normalizeVersionParts(left);
    const rightParts = normalizeVersionParts(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] || 0;
        const rightPart = rightParts[index] || 0;

        if (leftPart > rightPart) return 1;
        if (leftPart < rightPart) return -1;
    }

    return 0;
}

function getDismissedVersionStorageKey(channel) {
    return `${APP_UPDATE_STORAGE_KEYS.dismissedVersionPrefix}${normalizeUpdateChannel(channel)}`;
}

function readSelectedChannel() {
    try {
        const storedChannel = localStorage.getItem(APP_UPDATE_STORAGE_KEYS.selectedChannel);
        const normalizedChannel = normalizeUpdateChannel(storedChannel || readConfiguredDefaultChannel());

        if (normalizedChannel === APP_UPDATE_CHANNELS.beta) {
            if (!isBetaChannelUnlocked() || !canUseBetaChannel()) {
                return APP_UPDATE_CHANNELS.stable;
            }
        }

        return normalizedChannel;
    } catch (error) {
        return readConfiguredDefaultChannel();
    }
}

function writeSelectedChannel(channel) {
    const normalizedChannel = normalizeUpdateChannel(channel);
    const nextChannel =
        normalizedChannel === APP_UPDATE_CHANNELS.beta && isBetaChannelUnlocked() && canUseBetaChannel()
            ? APP_UPDATE_CHANNELS.beta
            : APP_UPDATE_CHANNELS.stable;

    try {
        localStorage.setItem(APP_UPDATE_STORAGE_KEYS.selectedChannel, nextChannel);
    } catch (error) {}

    return nextChannel;
}

function readDismissedAppUpdateVersion(channel) {
    try {
        return localStorage.getItem(getDismissedVersionStorageKey(channel)) || '';
    } catch (error) {
        return '';
    }
}

function writeDismissedAppUpdateVersion(channel, version) {
    try {
        localStorage.setItem(getDismissedVersionStorageKey(channel), version);
    } catch (error) {}
}

function clearDismissedAppUpdateVersion(channel) {
    try {
        localStorage.removeItem(getDismissedVersionStorageKey(channel));
    } catch (error) {}
}

function buildAppUpdateMessage(manifest) {
    const latestVersion = manifest.version;
    const notes = typeof manifest.notes === 'string' ? manifest.notes.trim() : '';
    const notesSuffix = notes ? ` ${notes}` : '';
    const channelPrefix = manifest.channel === APP_UPDATE_CHANNELS.beta ? 'beta-' : '';
    return `Доступна ${channelPrefix}версія ${latestVersion}. Поточна версія: ${APP_RELEASE_VERSION}.${notesSuffix}`;
}

function openApkDownload(url) {
    if (typeof url !== 'string' || !url) {
        return;
    }

    const openedWindow = window.open(url, '_blank', 'noopener');
    if (!openedWindow) {
        window.location.href = url;
    }
}

function hideAppUpdateBanner() {
    if (!appUpdateEls.banner) {
        return;
    }

    appUpdateEls.banner.hidden = true;
    appUpdateEls.banner.classList.remove('active');
    appUpdateEls.downloadBtn?.removeAttribute('data-download-url');
    appUpdateEls.dismissBtn?.removeAttribute('data-version');
    appUpdateEls.dismissBtn?.removeAttribute('data-channel');
}

function showAppUpdateBanner(manifest) {
    if (!appUpdateEls.banner || !appUpdateEls.text || !appUpdateEls.downloadBtn || !appUpdateEls.dismissBtn) {
        return;
    }

    appUpdateEls.text.textContent = buildAppUpdateMessage(manifest);
    appUpdateEls.downloadBtn.dataset.downloadUrl = manifest.apkUrl;
    appUpdateEls.dismissBtn.dataset.version = manifest.version;
    appUpdateEls.dismissBtn.dataset.channel = manifest.channel;
    appUpdateEls.banner.hidden = false;
    appUpdateEls.banner.classList.add('active');
}

async function fetchAppUpdateManifest(channel) {
    const manifestUrls = readConfiguredManifestUrls();
    const manifestUrl = manifestUrls[normalizeUpdateChannel(channel)];
    if (!manifestUrl) {
        return null;
    }

    const controller = typeof AbortController === 'function'
        ? new AbortController()
        : null;
    const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), APP_UPDATE_CHECK_TIMEOUT_MS)
        : null;

    try {
        const response = await fetch(manifestUrl, {
            cache: 'no-store',
            signal: controller?.signal
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (
            !data ||
            typeof data.version !== 'string' ||
            typeof data.apkUrl !== 'string' ||
            !data.apkUrl.trim()
        ) {
            return null;
        }

        return {
            channel: normalizeUpdateChannel(channel),
            version: data.version.trim(),
            apkUrl: data.apkUrl.trim(),
            notes: typeof data.notes === 'string' ? data.notes.trim() : ''
        };
    } catch (error) {
        return null;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function resolveAvailableAppUpdateManifest() {
    const selectedChannel = readSelectedChannel();
    const channelsToTry =
        selectedChannel === APP_UPDATE_CHANNELS.beta
            ? [APP_UPDATE_CHANNELS.beta, APP_UPDATE_CHANNELS.stable]
            : [APP_UPDATE_CHANNELS.stable];

    for (const channel of channelsToTry) {
        const manifest = await fetchAppUpdateManifest(channel);
        if (!manifest) {
            continue;
        }

        if (compareAppVersions(manifest.version, APP_RELEASE_VERSION) <= 0) {
            clearDismissedAppUpdateVersion(channel);
            continue;
        }

        if (readDismissedAppUpdateVersion(channel) === manifest.version) {
            continue;
        }

        return manifest;
    }

    return null;
}

async function checkForAppUpdate() {
    if (!APP_UPDATE_CHECK_ENABLED || !isNativeAndroidApp()) {
        hideAppUpdateBanner();
        return;
    }

    const manifest = await resolveAvailableAppUpdateManifest();
    if (!manifest) {
        hideAppUpdateBanner();
        return;
    }

    showAppUpdateBanner(manifest);
}

if (appUpdateEls.downloadBtn) {
    appUpdateEls.downloadBtn.addEventListener('click', () => {
        const downloadUrl = appUpdateEls.downloadBtn.dataset.downloadUrl;
        openApkDownload(downloadUrl);
    });
}

if (appUpdateEls.dismissBtn) {
    appUpdateEls.dismissBtn.addEventListener('click', () => {
        const version = appUpdateEls.dismissBtn.dataset.version;
        const channel = normalizeUpdateChannel(appUpdateEls.dismissBtn.dataset.channel);
        if (version) {
            writeDismissedAppUpdateVersion(channel, version);
        }
        hideAppUpdateBanner();
    });
}

window.AppUpdate = {
    checkForAppUpdate,
    compareAppVersions,
    canUseBetaChannel,
    getAppVersion: () => APP_RELEASE_VERSION,
    getChannelLabel,
    getSelectedChannel: readSelectedChannel,
    isBetaChannelUnlocked,
    isNativeAndroidApp,
    setSelectedChannel: writeSelectedChannel,
    unlockBetaChannel
};
