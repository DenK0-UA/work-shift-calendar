const APP_UPDATE_CHANNELS = {
    stable: 'stable',
    beta: 'beta'
};

const APP_UPDATE_STORAGE_KEYS = {
    installId: 'appInstallId',
    selectedChannel: 'appUpdate:channel',
    dismissedEntryPrefix: 'appUpdate:dismissed:'
};

const APP_UPDATE_DISMISS_MS = 24 * 60 * 60 * 1000;

const betaAccessState = {
    installId: readOrCreateInstallId(),
    isAllowed: false,
    isConfigured: false,
    isLoaded: false,
    lastResolvedAt: 0,
    lastError: false,
    loadingPromise: null
};

const appUpdateEls = {
    banner: document.getElementById('app-update-banner'),
    text: document.getElementById('app-update-banner-text'),
    downloadBtn: document.getElementById('app-update-download'),
    dismissBtn: document.getElementById('app-update-dismiss')
};

const appUpdateDebugState = {
    checkedAt: 0,
    channel: '',
    manifestVersion: '',
    availableVersion: '',
    downloadUrl: '',
    dismissedUntil: 0,
    status: 'idle',
    message: ''
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

function setAppUpdateDebugState(patch) {
    Object.assign(appUpdateDebugState, {
        manifestVersion: '',
        availableVersion: '',
        downloadUrl: '',
        dismissedUntil: 0
    }, patch, {
        checkedAt: Date.now()
    });

    document.dispatchEvent(new CustomEvent('app-update:state-changed', {
        detail: getAppUpdateDebugSnapshot()
    }));
}

function getAppUpdateDebugSnapshot() {
    return { ...appUpdateDebugState };
}

function normalizeInstallId(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function createInstallId() {
    if (window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    const randomPart = () => Math.random().toString(36).slice(2, 10);
    return `${Date.now().toString(36)}-${randomPart()}-${randomPart()}`;
}

function readOrCreateInstallId() {
    try {
        const existingInstallId = normalizeInstallId(localStorage.getItem(APP_UPDATE_STORAGE_KEYS.installId));
        if (existingInstallId) {
            return existingInstallId;
        }

        const nextInstallId = createInstallId();
        localStorage.setItem(APP_UPDATE_STORAGE_KEYS.installId, nextInstallId);
        return nextInstallId;
    } catch (error) {
        return createInstallId();
    }
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

function readBetaAccessUrl() {
    return typeof APP_UPDATE_BETA_ACCESS_URL === 'string'
        ? APP_UPDATE_BETA_ACCESS_URL.trim()
        : '';
}

function isBetaFeatureConfigured() {
    const manifestUrls = readConfiguredManifestUrls();
    return Boolean(manifestUrls.beta && readBetaAccessUrl());
}

function getBetaAccessSnapshot() {
    return {
        installId: betaAccessState.installId,
        isAllowed: betaAccessState.isAllowed,
        isConfigured: betaAccessState.isConfigured,
        isLoaded: betaAccessState.isLoaded,
        lastResolvedAt: betaAccessState.lastResolvedAt,
        lastError: betaAccessState.lastError
    };
}

function canAccessBetaChannel() {
    return betaAccessState.isConfigured && betaAccessState.isAllowed;
}

function readConfiguredDefaultChannel() {
    const normalizedDefault = normalizeUpdateChannel(APP_UPDATE_CHANNEL_DEFAULT);
    if (normalizedDefault === APP_UPDATE_CHANNELS.beta && !canAccessBetaChannel()) {
        return APP_UPDATE_CHANNELS.stable;
    }

    return normalizedDefault;
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

function readSelectedChannel() {
    try {
        const storedChannel = localStorage.getItem(APP_UPDATE_STORAGE_KEYS.selectedChannel);
        const normalizedChannel = normalizeUpdateChannel(storedChannel || readConfiguredDefaultChannel());

        if (normalizedChannel === APP_UPDATE_CHANNELS.beta && !canAccessBetaChannel()) {
            return APP_UPDATE_CHANNELS.stable;
        }

        return normalizedChannel;
    } catch (error) {
        return readConfiguredDefaultChannel();
    }
}

function writeSelectedChannel(channel) {
    const normalizedChannel = normalizeUpdateChannel(channel);
    const nextChannel =
        normalizedChannel === APP_UPDATE_CHANNELS.beta && canAccessBetaChannel()
            ? APP_UPDATE_CHANNELS.beta
            : APP_UPDATE_CHANNELS.stable;

    try {
        localStorage.setItem(APP_UPDATE_STORAGE_KEYS.selectedChannel, nextChannel);
    } catch (error) {}

    return nextChannel;
}

function readDismissedAppUpdateEntry(channel) {
    const normalizedChannel = normalizeUpdateChannel(channel);

    try {
        const rawValue = localStorage.getItem(`${APP_UPDATE_STORAGE_KEYS.dismissedEntryPrefix}${normalizedChannel}`);
        if (!rawValue) {
            return null;
        }

        const parsedValue = JSON.parse(rawValue);
        const version = typeof parsedValue?.version === 'string' ? parsedValue.version.trim() : '';
        const until = Number.parseInt(String(parsedValue?.until || ''), 10);

        if (!version || !Number.isFinite(until) || until <= 0) {
            return null;
        }

        return { version, until };
    } catch (error) {
        return null;
    }
}

function writeDismissedAppUpdateEntry(channel, version, timestamp) {
    const normalizedChannel = normalizeUpdateChannel(channel);
    const normalizedVersion = typeof version === 'string' ? version.trim() : '';
    const normalizedTimestamp = Number.isFinite(timestamp) ? Math.max(0, Math.trunc(timestamp)) : 0;

    try {
        if (normalizedVersion && normalizedTimestamp > 0) {
            localStorage.setItem(
                `${APP_UPDATE_STORAGE_KEYS.dismissedEntryPrefix}${normalizedChannel}`,
                JSON.stringify({
                    version: normalizedVersion,
                    until: normalizedTimestamp
                })
            );
        } else {
            localStorage.removeItem(`${APP_UPDATE_STORAGE_KEYS.dismissedEntryPrefix}${normalizedChannel}`);
        }
    } catch (error) {}
}

function clearDismissedAppUpdateUntil(channel) {
    writeDismissedAppUpdateEntry(channel, '', 0);
}

function resolveManifestAssetUrl(manifestUrl, assetUrl) {
    if (typeof assetUrl !== 'string') {
        return '';
    }

    const normalizedAssetUrl = assetUrl.trim();
    if (!normalizedAssetUrl) {
        return '';
    }

    try {
        return new URL(normalizedAssetUrl, manifestUrl).toString();
    } catch (error) {
        return normalizedAssetUrl;
    }
}

function buildAppUpdateMessage(manifest) {
    const latestVersion = manifest.version;
    const notes = typeof manifest.notes === 'string' ? manifest.notes.trim() : '';
    const notesSuffix = notes ? ` ${notes}` : '';
    const channelLabel = manifest.channel === APP_UPDATE_CHANNELS.beta ? 'beta' : 'stable';
    return `Доступна новіша ${channelLabel}-версія ${latestVersion}. Поточна версія: ${APP_RELEASE_VERSION}.${notesSuffix}`;
}

async function openApkDownload(url) {
    if (typeof url !== 'string' || !url) {
        return;
    }

    // Спосіб 1: Capacitor нативні API (для Android/iOS)
    if (window.Capacitor?.isNativePlatform?.()) {
        try {
            const { Filesystem, Directory } = window.Capacitor.Plugins;
            if (Filesystem) {
                console.log('Завантажуємо через Capacitor Filesystem API...');
                
                // Спочатку завантажимо файл через fetch
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const base64String = btoa(String.fromCharCode.apply(null, uint8Array));
                
                // Зберігаємо в Download директорію
                await Filesystem.writeFile({
                    path: 'work-shift-calendar-1.0.17.apk',
                    data: base64String,
                    directory: Directory.Documents,
                    recursive: true
                });
                
                console.log('APK успішно завантажений в Downloads');
                return;
            }
        } catch (error) {
            console.warn('Capacitor download failed:', error);
            // Fallback до наступного методу
        }
    }

    // Спосіб 2: Спробуємо через <a> тег з download атрибутом (для веб)
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'work-shift-calendar-1.0.17.apk';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    } catch (error) {
        console.warn('Link download failed:', error);
    }

    // Спосіб 3: fetch + blob з явним контролем
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const fallbackLink = document.createElement('a');
        fallbackLink.href = blobUrl;
        fallbackLink.download = 'work-shift-calendar-1.0.17.apk';
        fallbackLink.style.display = 'none';
        
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        return;
    } catch (error) {
        console.warn('Blob download failed:', error);
    }

    // Спосіб 4: Fallback на прямий window.location
    console.warn('All download methods failed, trying direct navigation');
    window.location.href = url;
}

function getDismissedUntil(channel) {
    const dismissedEntry = readDismissedAppUpdateEntry(channel);
    return dismissedEntry?.until || 0;
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

async function fetchJsonWithTimeout(url) {
    if (typeof url !== 'string' || !url.trim()) {
        return null;
    }

    const controller = typeof AbortController === 'function'
        ? new AbortController()
        : null;
    const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), APP_UPDATE_CHECK_TIMEOUT_MS)
        : null;

    try {
        const response = await fetch(url, {
            cache: 'no-store',
            signal: controller?.signal
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        return null;
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function loadBetaAccessState(force = false) {
    if (!force && betaAccessState.loadingPromise) {
        return betaAccessState.loadingPromise;
    }

    const betaFeatureConfigured = isBetaFeatureConfigured();
    betaAccessState.isConfigured = betaFeatureConfigured;

    if (!force && betaFeatureConfigured && betaAccessState.isLoaded) {
        return getBetaAccessSnapshot();
    }

    if (!betaFeatureConfigured) {
        betaAccessState.isAllowed = false;
        betaAccessState.isLoaded = true;
        betaAccessState.lastResolvedAt = 0;
        betaAccessState.lastError = false;
        writeSelectedChannel(APP_UPDATE_CHANNELS.stable);
        return getBetaAccessSnapshot();
    }

    betaAccessState.loadingPromise = (async () => {
        const accessData = await fetchJsonWithTimeout(readBetaAccessUrl());
        if (!accessData || !Array.isArray(accessData.allowedInstallIds)) {
            betaAccessState.isLoaded = true;
            betaAccessState.lastError = true;
            return getBetaAccessSnapshot();
        }

        const allowedInstallIds = Array.isArray(accessData?.allowedInstallIds)
            ? accessData.allowedInstallIds
                .map((installId) => normalizeInstallId(installId))
                .filter(Boolean)
            : [];

        betaAccessState.isAllowed = allowedInstallIds.includes(betaAccessState.installId);
        betaAccessState.isLoaded = true;
        betaAccessState.lastResolvedAt = Date.now();
        betaAccessState.lastError = false;

        if (!betaAccessState.isAllowed) {
            writeSelectedChannel(APP_UPDATE_CHANNELS.stable);
        }

        return getBetaAccessSnapshot();
    })();

    try {
        return await betaAccessState.loadingPromise;
    } finally {
        betaAccessState.loadingPromise = null;
    }
}

async function fetchAppUpdateManifest(channel) {
    const manifestUrls = readConfiguredManifestUrls();
    const manifestUrl = manifestUrls[normalizeUpdateChannel(channel)];
    if (!manifestUrl) {
        setAppUpdateDebugState({
            channel: normalizeUpdateChannel(channel),
            status: 'manifest-missing',
            message: 'Маніфест каналу не налаштований.'
        });
        return null;
    }

    const data = await fetchJsonWithTimeout(manifestUrl);
    if (
        !data ||
        typeof data.version !== 'string' ||
        typeof data.apkUrl !== 'string' ||
        !data.apkUrl.trim()
    ) {
        setAppUpdateDebugState({
            channel: normalizeUpdateChannel(channel),
            status: 'manifest-unavailable',
            message: 'Не вдалося завантажити маніфест оновлення.'
        });
        return null;
    }

    setAppUpdateDebugState({
        channel: normalizeUpdateChannel(channel),
        manifestVersion: data.version.trim(),
        status: 'manifest-loaded',
        message: `Знайдено маніфест ${data.version.trim()}.`
    });

    return {
        channel: normalizeUpdateChannel(channel),
        version: data.version.trim(),
        apkUrl: resolveManifestAssetUrl(manifestUrl, data.apkUrl),
        notes: typeof data.notes === 'string' ? data.notes.trim() : ''
    };
}

async function resolveAvailableAppUpdateManifest(options = {}) {
    const manualCheck = options.manualCheck === true;
    await loadBetaAccessState();

    const selectedChannel = readSelectedChannel();
    let sawCurrentVersionInPreferredChannel = false;
    setAppUpdateDebugState({
        channel: selectedChannel,
        status: 'checking',
        message: `Перевіряємо канал ${getChannelLabel(selectedChannel)}.`
    });

    const channelsToTry =
        selectedChannel === APP_UPDATE_CHANNELS.beta && canAccessBetaChannel()
            ? [APP_UPDATE_CHANNELS.beta, APP_UPDATE_CHANNELS.stable]
            : [APP_UPDATE_CHANNELS.stable];

    for (const channel of channelsToTry) {
        const manifest = await fetchAppUpdateManifest(channel);
        if (!manifest) {
            continue;
        }

        if (compareAppVersions(manifest.version, APP_RELEASE_VERSION) <= 0) {
            clearDismissedAppUpdateUntil(channel);
            if (channel === selectedChannel) {
                sawCurrentVersionInPreferredChannel = true;
            }
            setAppUpdateDebugState({
                channel,
                manifestVersion: manifest.version,
                status: 'up-to-date',
                message: `Оновлень немає. Поточна версія ${APP_RELEASE_VERSION}.`
            });
            continue;
        }

        const dismissedEntry = readDismissedAppUpdateEntry(channel);
        if (!manualCheck && dismissedEntry?.version === manifest.version && dismissedEntry.until > Date.now()) {
            setAppUpdateDebugState({
                channel,
                manifestVersion: manifest.version,
                availableVersion: manifest.version,
                dismissedUntil: dismissedEntry.until,
                status: 'dismissed',
                message: 'Оновлення тимчасово приховано на 24 години.'
            });
            continue;
        }

        setAppUpdateDebugState({
            channel,
            manifestVersion: manifest.version,
            availableVersion: manifest.version,
            downloadUrl: manifest.apkUrl,
            status: 'update-available',
            message: `Доступне оновлення ${manifest.version}.`
        });
        return manifest;
    }

    if (sawCurrentVersionInPreferredChannel) {
        setAppUpdateDebugState({
            channel: selectedChannel,
            manifestVersion: APP_RELEASE_VERSION,
            status: 'up-to-date',
            message: `Оновлень немає. Поточна версія ${APP_RELEASE_VERSION}.`
        });
    } else if (appUpdateDebugState.status === 'checking') {
        setAppUpdateDebugState({
            channel: selectedChannel,
            status: 'no-update',
            message: 'Оновлення не знайдено.'
        });
    }

    return null;
}

async function checkForAppUpdate(options = {}) {
    const manualCheck = options.manualCheck === true;
    if (!APP_UPDATE_CHECK_ENABLED || !isNativeAndroidApp()) {
        setAppUpdateDebugState({
            status: 'disabled',
            message: !APP_UPDATE_CHECK_ENABLED
                ? 'Перевірку оновлень вимкнено в конфігу.'
                : 'Оновлення перевіряються тільки в Android-додатку.'
        });
        hideAppUpdateBanner();
        return;
    }

    const manifest = await resolveAvailableAppUpdateManifest({ manualCheck });
    if (!manifest) {
        hideAppUpdateBanner();
        return;
    }

    if (!manualCheck) {
        showAppUpdateBanner(manifest);
    }
}

function bindAutomaticAppUpdateChecks() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkForAppUpdate();
        }
    });

    window.addEventListener('focus', () => {
        checkForAppUpdate();
    });
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
            const dismissedUntil = Date.now() + APP_UPDATE_DISMISS_MS;
            writeDismissedAppUpdateEntry(channel, version, dismissedUntil);
            setAppUpdateDebugState({
                channel,
                manifestVersion: version,
                availableVersion: version,
                dismissedUntil,
                status: 'dismissed',
                message: 'Оновлення тимчасово приховано на 24 години.'
            });
        }
        hideAppUpdateBanner();
    });
}

loadBetaAccessState();
bindAutomaticAppUpdateChecks();

window.AppUpdate = {
    checkForAppUpdate,
    compareAppVersions,
    getDebugState: getAppUpdateDebugSnapshot,
    getAppVersion: () => APP_RELEASE_VERSION,
    getBetaAccessSnapshot,
    getChannelLabel,
    getInstallId: () => betaAccessState.installId,
    getSelectedChannel: readSelectedChannel,
    isBetaAllowedForThisInstall: canAccessBetaChannel,
    isNativeAndroidApp,
    loadBetaAccessState,
    openDownload: openApkDownload,
    setSelectedChannel: writeSelectedChannel
};
