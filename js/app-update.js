const APP_UPDATE_CHANNELS = {
    stable: 'stable',
    beta: 'beta'
};

const APP_UPDATE_STORAGE_KEYS = {
    installId: 'appInstallId',
    localBetaAccess: 'appUpdate:localBetaAccess',
    selectedChannel: 'appUpdate:channel',
    dismissedEntryPrefix: 'appUpdate:dismissed:',
    installedVersion: 'appUpdate:installedVersion',
    seenReleaseNotesVersion: 'appUpdate:seenReleaseNotesVersion'
};

const APP_UPDATE_DISMISS_MS = 24 * 60 * 60 * 1000;
const getAppUpdateBannerTransitionMs = () => window.AppMotion?.getDurationMs?.('overlayHide', 280) ?? 280;

const betaAccessState = {
    installId: readOrCreateInstallId(),
    isAllowed: false,
    isConfigured: false,
    isLoaded: false,
    isLocallyEnabled: false,
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

const appReleaseNotesEls = {
    overlay: document.getElementById('app-whats-new-overlay'),
    title: document.getElementById('app-whats-new-title'),
    summary: document.getElementById('app-whats-new-summary'),
    list: document.getElementById('app-whats-new-list'),
    closeBtn: document.getElementById('app-whats-new-close')
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
    ? 'Тестовий'
    : 'Основний';
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

let pendingAppUpdateBannerManifest = null;

function normalizeStoredVersion(value) {
    if (typeof value !== 'string') {
        return '';
    }

    const normalizedValue = value.trim();
    return /^\d+\.\d+\.\d+$/.test(normalizedValue) ? normalizedValue : '';
}

function readStoredVersion(key) {
    try {
        return normalizeStoredVersion(localStorage.getItem(key));
    } catch (error) {
        return '';
    }
}

function writeStoredVersion(key, version) {
    const normalizedVersion = normalizeStoredVersion(version);
    if (!normalizedVersion) {
        return;
    }

    try {
        localStorage.setItem(key, normalizedVersion);
    } catch (error) {}
}

function readInstalledAppVersion() {
    return readStoredVersion(APP_UPDATE_STORAGE_KEYS.installedVersion);
}

function writeInstalledAppVersion(version) {
    writeStoredVersion(APP_UPDATE_STORAGE_KEYS.installedVersion, version);
}

function readSeenReleaseNotesVersion() {
    return readStoredVersion(APP_UPDATE_STORAGE_KEYS.seenReleaseNotesVersion);
}

function writeSeenReleaseNotesVersion(version) {
    writeStoredVersion(APP_UPDATE_STORAGE_KEYS.seenReleaseNotesVersion, version);
}

function hasPersistedAppUsage() {
    try {
        const scheduleKeys = window.SCHEDULE_STORAGE_KEYS
            ? Object.values(window.SCHEDULE_STORAGE_KEYS)
            : ['scheduleConfig', 'customDayStatuses', 'dayNotes'];
        const candidateKeys = [
            ...scheduleKeys,
            'workCalendarSettings',
            APP_UPDATE_STORAGE_KEYS.selectedChannel,
            APP_UPDATE_STORAGE_KEYS.localBetaAccess
        ];

        return candidateKeys.some((key) => Boolean(localStorage.getItem(key)));
    } catch (error) {
        return false;
    }
}

function getCurrentReleaseNotes() {
    const releaseNotesMap = typeof APP_RELEASE_NOTES === 'object' && APP_RELEASE_NOTES
        ? APP_RELEASE_NOTES
        : null;
    const entry = releaseNotesMap?.[APP_RELEASE_VERSION];

    if (!entry || !Array.isArray(entry.items)) {
        return null;
    }

    const items = entry.items
        .map((item) => {
            if (typeof item === 'string') {
                const normalizedItem = item.trim();
                return normalizedItem ? { title: normalizedItem, text: '' } : null;
            }

            const title = typeof item?.title === 'string' ? item.title.trim() : '';
            const text = typeof item?.text === 'string' ? item.text.trim() : '';

            if (!title && !text) {
                return null;
            }

            return {
                title: title || text,
                text: title ? text : ''
            };
        })
        .filter(Boolean);

    if (items.length === 0) {
        return null;
    }

    return {
        version: APP_RELEASE_VERSION,
        title: typeof entry.title === 'string' && entry.title.trim()
            ? entry.title.trim()
            : `Що нового у ${APP_RELEASE_VERSION}`,
        summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
        items
    };
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

function readLocalBetaAccessEnabled() {
    try {
        return localStorage.getItem(APP_UPDATE_STORAGE_KEYS.localBetaAccess) === '1';
    } catch (error) {
        return false;
    }
}

function writeLocalBetaAccessEnabled(enabled) {
    try {
        if (enabled) {
            localStorage.setItem(APP_UPDATE_STORAGE_KEYS.localBetaAccess, '1');
        } else {
            localStorage.removeItem(APP_UPDATE_STORAGE_KEYS.localBetaAccess);
        }
    } catch (error) {}
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
        isLocallyEnabled: betaAccessState.isLocallyEnabled,
        lastResolvedAt: betaAccessState.lastResolvedAt,
        lastError: betaAccessState.lastError
    };
}

function canAccessBetaChannel() {
    return betaAccessState.isConfigured && betaAccessState.isAllowed;
}

function enableLocalBetaAccess() {
    if (!isBetaFeatureConfigured()) {
        return false;
    }

    writeLocalBetaAccessEnabled(true);
    betaAccessState.isConfigured = true;
    betaAccessState.isAllowed = true;
    betaAccessState.isLoaded = true;
    betaAccessState.isLocallyEnabled = true;
    betaAccessState.lastResolvedAt = Date.now();
    betaAccessState.lastError = false;
    writeSelectedChannel(APP_UPDATE_CHANNELS.beta);
    return true;
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

function getVisibleAppUpdateNotes(manifest) {
    const notes = typeof manifest?.notes === 'string' ? manifest.notes.trim() : '';
    if (!notes) {
        return '';
    }

    const normalizedNotes = notes.toLowerCase();
    const hiddenDefaultNotes = new Set([
        'stable release channel.',
        'beta release channel.',
        'основний канал оновлень.',
        'тестовий канал оновлень.'
    ]);

    return hiddenDefaultNotes.has(normalizedNotes) ? '' : notes;
}

function buildAvailableUpdateLabel(channel, version) {
    if (normalizeUpdateChannel(channel) === APP_UPDATE_CHANNELS.beta) {
        return `Доступна тестова версія ${version}.`;
    }

    return `Доступна версія ${version}.`;
}

function buildAppUpdateMessage(manifest) {
    const latestVersion = manifest.version;
    const notes = getVisibleAppUpdateNotes(manifest);
    const messageParts = [
        buildAvailableUpdateLabel(manifest.channel, latestVersion),
        `Зараз у вас ${APP_RELEASE_VERSION}.`
    ];

    if (notes) {
        messageParts.push(notes);
    }

    return messageParts.join(' ');
}

function renderCurrentReleaseNotes(releaseNotes) {
    if (!appReleaseNotesEls.overlay || !appReleaseNotesEls.title || !appReleaseNotesEls.summary || !appReleaseNotesEls.list) {
        return;
    }

    appReleaseNotesEls.title.textContent = releaseNotes.title;
    appReleaseNotesEls.summary.textContent = releaseNotes.summary;
    appReleaseNotesEls.summary.hidden = !releaseNotes.summary;
    appReleaseNotesEls.list.replaceChildren();

    releaseNotes.items.forEach((item) => {
        const cardEl = document.createElement('article');
        cardEl.className = 'app-whats-new-item';

        const titleEl = document.createElement('div');
        titleEl.className = 'app-whats-new-item-title';
        titleEl.textContent = item.title;
        cardEl.appendChild(titleEl);

        if (item.text) {
            const textEl = document.createElement('p');
            textEl.className = 'app-whats-new-item-text';
            textEl.textContent = item.text;
            cardEl.appendChild(textEl);
        }

        appReleaseNotesEls.list.appendChild(cardEl);
    });
}

function setReleaseNotesOverlayOpen(isOpen) {
    if (!appReleaseNotesEls.overlay) {
        return false;
    }

    if (appReleaseNotesEls.overlay._hideTimerId) {
        clearTimeout(appReleaseNotesEls.overlay._hideTimerId);
        appReleaseNotesEls.overlay._hideTimerId = null;
    }

    if (isOpen) {
        appReleaseNotesEls.overlay.hidden = false;
        // Force layout so the active class transition can run immediately.
        void appReleaseNotesEls.overlay.offsetWidth;
        appReleaseNotesEls.overlay.classList.add('active');
        return true;
    }

    appReleaseNotesEls.overlay.classList.remove('active');
    appReleaseNotesEls.overlay._hideTimerId = window.setTimeout(() => {
        appReleaseNotesEls.overlay.hidden = true;
        appReleaseNotesEls.overlay._hideTimerId = null;
    }, getAppUpdateBannerTransitionMs());
    return true;
}

function isReleaseNotesOverlayOpen() {
    return Boolean(
        appReleaseNotesEls.overlay
        && !appReleaseNotesEls.overlay.hidden
        && appReleaseNotesEls.overlay.classList.contains('active')
    );
}

function closeReleaseNotesOverlay() {
    writeSeenReleaseNotesVersion(APP_RELEASE_VERSION);

    if (window.AppShellOverlays?.isOpen?.('whats-new')) {
        return window.AppShellOverlays.close('whats-new', { reason: 'dismiss' });
    }

    if (pendingAppUpdateBannerManifest) {
        window.setTimeout(() => {
            flushPendingAppUpdateBanner();
        }, getAppUpdateBannerTransitionMs());
    }

    return setReleaseNotesOverlayOpen(false);
}

function flushPendingAppUpdateBanner() {
    if (!pendingAppUpdateBannerManifest) {
        return;
    }

    const manifest = pendingAppUpdateBannerManifest;
    pendingAppUpdateBannerManifest = null;
    showAppUpdateBanner(manifest);
}

function openReleaseNotesOverlay(options = {}) {
    const releaseNotes = options.releaseNotes || getCurrentReleaseNotes();
    if (!releaseNotes || !appReleaseNotesEls.overlay) {
        return false;
    }

    if (window.AppShellOverlays?.open) {
        return window.AppShellOverlays.open('whats-new', {
            reason: options.reason || 'manual',
            releaseNotes
        });
    }

    renderCurrentReleaseNotes(releaseNotes);
    return setReleaseNotesOverlayOpen(true);
}

const releaseNotesOverlayController = window.AppShellOverlays?.registerOverlay({
    id: 'whats-new',
    overlay: appReleaseNotesEls.overlay,
    closeButtons: appReleaseNotesEls.closeBtn,
    onOpen: ({ releaseNotes } = {}) => {
        const notes = releaseNotes || getCurrentReleaseNotes();
        if (!notes) {
            return false;
        }

        renderCurrentReleaseNotes(notes);
        return setReleaseNotesOverlayOpen(true);
    },
    onClose: () => {
        writeSeenReleaseNotesVersion(APP_RELEASE_VERSION);
        const closed = setReleaseNotesOverlayOpen(false);

        if (closed && pendingAppUpdateBannerManifest) {
            window.setTimeout(() => {
                flushPendingAppUpdateBanner();
            }, getAppUpdateBannerTransitionMs());
        }

        return closed;
    }
});

if (!releaseNotesOverlayController && appReleaseNotesEls.overlay && appReleaseNotesEls.closeBtn) {
    appReleaseNotesEls.closeBtn.addEventListener('click', closeReleaseNotesOverlay);
    appReleaseNotesEls.overlay.addEventListener('click', (event) => {
        if (event.target === appReleaseNotesEls.overlay) {
            closeReleaseNotesOverlay();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isReleaseNotesOverlayOpen()) {
            closeReleaseNotesOverlay();
        }
    });
}

function maybeShowCurrentReleaseNotes() {
    const releaseNotes = getCurrentReleaseNotes();
    const installedVersion = readInstalledAppVersion();
    const seenReleaseNotesVersion = readSeenReleaseNotesVersion();

    if (!installedVersion) {
        writeInstalledAppVersion(APP_RELEASE_VERSION);

        if (!hasPersistedAppUsage()) {
            writeSeenReleaseNotesVersion(APP_RELEASE_VERSION);
            return false;
        }

        if (!releaseNotes || seenReleaseNotesVersion === APP_RELEASE_VERSION) {
            return false;
        }

        return openReleaseNotesOverlay({ reason: 'existing-install', releaseNotes });
    }

    if (installedVersion !== APP_RELEASE_VERSION) {
        writeInstalledAppVersion(APP_RELEASE_VERSION);

        if (!releaseNotes || seenReleaseNotesVersion === APP_RELEASE_VERSION) {
            return false;
        }

        return openReleaseNotesOverlay({ reason: 'updated', releaseNotes });
    }

    if (!releaseNotes || seenReleaseNotesVersion === APP_RELEASE_VERSION) {
        return false;
    }

    return openReleaseNotesOverlay({ reason: 'unseen-current-version', releaseNotes });
}

function toExternalDownloadUrl(url) {
    if (typeof url !== 'string') {
        return '';
    }

    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
        return '';
    }

    return normalizedUrl;
}

function buildApkFileName(url, fallbackVersion) {
    const safeVersion = typeof fallbackVersion === 'string' && /^\d+\.\d+\.\d+$/.test(fallbackVersion)
        ? fallbackVersion
        : APP_RELEASE_VERSION;

    try {
        const parsedUrl = new URL(url);
        const tail = parsedUrl.pathname.split('/').pop() || '';
        const decodedTail = decodeURIComponent(tail);
        if (/\.apk$/i.test(decodedTail)) {
            return decodedTail;
        }
    } catch (error) {}

    return `work-shift-calendar-${safeVersion}.apk`;
}

function openReleasePageFallback(downloadUrl, message) {
    const externalUrl = toReleasePageUrl(downloadUrl);
    setAppUpdateDebugState({
        status: 'open-release-page',
        channel: appUpdateDebugState.channel || getSelectedChannel(),
        availableVersion: appUpdateDebugState.availableVersion || '',
        downloadUrl,
        message: message || 'Не вдалося запустити пряме завантаження. Відкриваємо сторінку релізу.'
    });

    const openedWindow = window.open(externalUrl, '_blank', 'noopener');
    if (!openedWindow) {
        window.location.assign(externalUrl);
    }
}

function syncUpdateBannerRuntimeState() {
    if (!appUpdateEls.banner || !appUpdateEls.downloadBtn || !appUpdateEls.dismissBtn || appUpdateEls.banner.hidden) {
        return;
    }

    const status = appUpdateDebugState.status;
    appUpdateEls.downloadBtn.disabled = false;
    appUpdateEls.downloadBtn.textContent = 'Відкрити оновлення';
    appUpdateEls.dismissBtn.textContent = 'Пізніше';

    if (status === 'download-starting' || status === 'downloading') {
        appUpdateEls.downloadBtn.disabled = true;
        appUpdateEls.downloadBtn.textContent = status === 'download-starting' ? 'Готуємо...' : 'Завантажуємо...';
        appUpdateEls.dismissBtn.textContent = 'Згорнути';
        if (appUpdateEls.text) {
            appUpdateEls.text.textContent = status === 'download-starting'
                ? 'Готуємо завантаження APK. Це може зайняти кілька секунд.'
                : 'Завантаження оновлення вже стартувало. Дочекайтесь завершення в системних сповіщеннях.';
        }
        return;
    }

    if (status === 'permission-required') {
        appUpdateEls.downloadBtn.textContent = 'Надати дозвіл';
        if (appUpdateEls.text) {
            appUpdateEls.text.textContent = 'Щоб встановити APK, дозвольте встановлення з невідомих джерел і натисніть ще раз.';
        }
        return;
    }

    if (status === 'open-release-page') {
        appUpdateEls.downloadBtn.textContent = 'Відкрити сторінку релізу';
        if (appUpdateEls.text) {
            appUpdateEls.text.textContent = 'Відкрили сторінку релізу як резервний варіант, якщо пряме завантаження недоступне.';
        }
    }
}

function toReleasePageUrl(url) {
    const externalUrl = toExternalDownloadUrl(url);
    if (!externalUrl) {
        return '';
    }

    try {
        const parsedUrl = new URL(externalUrl);
        const pathMatch = parsedUrl.pathname.match(/^(\/[^/]+\/[^/]+)\/releases\/download\/([^/]+)\/[^/]+$/i);
        if (pathMatch) {
            return `${parsedUrl.origin}${pathMatch[1]}/releases/tag/${pathMatch[2]}`;
        }
    } catch (error) {}

    return externalUrl;
}

function openApkDownload(url) {
    const downloadUrl = toExternalDownloadUrl(url);
    if (!downloadUrl) {
        return;
    }

    if (isNativeAndroidApp()) {
        const apkDownloadPlugin = window.Capacitor?.Plugins?.ApkDownload;
        if (apkDownloadPlugin?.downloadApk) {
            setAppUpdateDebugState({
                status: 'download-starting',
                channel: appUpdateDebugState.channel || getSelectedChannel(),
                availableVersion: appUpdateDebugState.availableVersion || '',
                downloadUrl,
                message: 'Готуємо завантаження APK...'
            });
            apkDownloadPlugin.downloadApk({
                url: downloadUrl,
                fileName: buildApkFileName(downloadUrl, appUpdateDebugState.availableVersion)
            }).then((result) => {
                if (result?.started) {
                    setAppUpdateDebugState({
                        status: 'downloading',
                        channel: appUpdateDebugState.channel || getSelectedChannel(),
                        availableVersion: appUpdateDebugState.availableVersion || '',
                        downloadUrl,
                        message: 'Завантаження APK розпочато. Після завершення Android запропонує встановлення.'
                    });
                    return;
                }

                if (result?.permissionRequired) {
                    setAppUpdateDebugState({
                        status: 'permission-required',
                        channel: appUpdateDebugState.channel || getSelectedChannel(),
                        availableVersion: appUpdateDebugState.availableVersion || '',
                        downloadUrl,
                        message: 'Потрібен дозвіл на встановлення з невідомих джерел. Після дозволу натисніть "Оновити" ще раз.'
                    });
                }
            }).catch(() => {
                openReleasePageFallback(downloadUrl);
            });
            return;
        }

        openReleasePageFallback(downloadUrl, 'Пряме завантаження недоступне у цій збірці. Відкриваємо сторінку релізу.');
        return;
    }

    const externalUrl = toReleasePageUrl(downloadUrl);
    setAppUpdateDebugState({
        status: 'open-release-page',
        channel: appUpdateDebugState.channel || getSelectedChannel(),
        availableVersion: appUpdateDebugState.availableVersion || '',
        downloadUrl,
        message: 'Веб-режим: відкриваємо сторінку релізу для завантаження.'
    });
    const browserPlugin = window.Capacitor?.Plugins?.Browser;
    if (browserPlugin?.open) {
        browserPlugin.open({
            url: externalUrl,
            presentationStyle: 'fullscreen'
        }).catch(() => {
            const openedWindow = window.open(externalUrl, '_blank', 'noopener');
            if (!openedWindow) {
                window.location.assign(externalUrl);
            }
        });
        return;
    }

    const openedWindow = window.open(externalUrl, '_blank', 'noopener');
    if (!openedWindow) {
        window.location.assign(externalUrl);
    }
}

function getDismissedUntil(channel) {
    const dismissedEntry = readDismissedAppUpdateEntry(channel);
    return dismissedEntry?.until || 0;
}

function hideAppUpdateBanner() {
    if (!appUpdateEls.banner) {
        return;
    }

    pendingAppUpdateBannerManifest = null;

    appUpdateEls.banner.classList.remove('active');

    if (appUpdateEls.banner._hideTimerId) {
        clearTimeout(appUpdateEls.banner._hideTimerId);
    }

    appUpdateEls.banner._hideTimerId = window.setTimeout(() => {
        appUpdateEls.banner.hidden = true;
        appUpdateEls.banner._hideTimerId = null;
    }, getAppUpdateBannerTransitionMs());

    if (appUpdateEls.downloadBtn) {
        appUpdateEls.downloadBtn.disabled = false;
        appUpdateEls.downloadBtn.textContent = 'Відкрити оновлення';
    }
    if (appUpdateEls.dismissBtn) {
        appUpdateEls.dismissBtn.textContent = 'Пізніше';
    }

    appUpdateEls.downloadBtn?.removeAttribute('data-download-url');
    appUpdateEls.dismissBtn?.removeAttribute('data-version');
    appUpdateEls.dismissBtn?.removeAttribute('data-channel');
}

function showAppUpdateBanner(manifest) {
    if (!appUpdateEls.banner || !appUpdateEls.text || !appUpdateEls.downloadBtn || !appUpdateEls.dismissBtn) {
        return;
    }

    if (isReleaseNotesOverlayOpen() || window.AppShellOverlays?.isOpen?.('whats-new')) {
        pendingAppUpdateBannerManifest = manifest;
        return;
    }

    appUpdateEls.text.textContent = buildAppUpdateMessage(manifest);
    appUpdateEls.downloadBtn.dataset.downloadUrl = manifest.apkUrl;
    appUpdateEls.downloadBtn.disabled = false;
    appUpdateEls.downloadBtn.textContent = 'Відкрити оновлення';
    appUpdateEls.dismissBtn.textContent = 'Пізніше';
    appUpdateEls.dismissBtn.dataset.version = manifest.version;
    appUpdateEls.dismissBtn.dataset.channel = manifest.channel;

    if (appUpdateEls.banner._hideTimerId) {
        clearTimeout(appUpdateEls.banner._hideTimerId);
        appUpdateEls.banner._hideTimerId = null;
    }

    appUpdateEls.banner.hidden = false;
    requestAnimationFrame(() => {
        appUpdateEls.banner.classList.add('active');
    });
}

document.addEventListener('app-update:state-changed', () => {
    syncUpdateBannerRuntimeState();
});

function withCacheBust(url) {
    if (typeof url !== 'string' || !url.trim()) {
        return '';
    }

    const normalizedUrl = url.trim();
    const cacheBustValue = String(Date.now());

    try {
        const parsedUrl = new URL(normalizedUrl, window.location.href);
        parsedUrl.searchParams.set('_ts', cacheBustValue);
        return parsedUrl.toString();
    } catch (error) {
        const separator = normalizedUrl.includes('?') ? '&' : '?';
        return `${normalizedUrl}${separator}_ts=${encodeURIComponent(cacheBustValue)}`;
    }
}

async function fetchJsonWithTimeout(url) {
    if (typeof url !== 'string' || !url.trim()) {
        return null;
    }

    const requestUrl = withCacheBust(url);
    const controller = typeof AbortController === 'function'
        ? new AbortController()
        : null;
    const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), APP_UPDATE_CHECK_TIMEOUT_MS)
        : null;

    try {
        const response = await fetch(requestUrl, {
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
    betaAccessState.isLocallyEnabled = betaFeatureConfigured && readLocalBetaAccessEnabled();

    if (!force && betaFeatureConfigured && betaAccessState.isLoaded) {
        return getBetaAccessSnapshot();
    }

    if (!betaFeatureConfigured) {
        betaAccessState.isAllowed = false;
        betaAccessState.isLoaded = true;
        betaAccessState.isLocallyEnabled = false;
        betaAccessState.lastResolvedAt = 0;
        betaAccessState.lastError = false;
        writeSelectedChannel(APP_UPDATE_CHANNELS.stable);
        return getBetaAccessSnapshot();
    }

    if (betaAccessState.isLocallyEnabled) {
        betaAccessState.isAllowed = true;
        betaAccessState.isLoaded = true;
        betaAccessState.lastResolvedAt = Date.now();
        betaAccessState.lastError = false;
        return getBetaAccessSnapshot();
    }

    betaAccessState.loadingPromise = (async () => {
        console.log('[AppUpdate] Loading beta access state (force=' + force + ')');
        const accessData = await fetchJsonWithTimeout(readBetaAccessUrl());
        if (!accessData || !Array.isArray(accessData.allowedInstallIds)) {
            console.log('[AppUpdate] Failed to load allowlist or invalid format');
            betaAccessState.isAllowed = false;
            betaAccessState.isLoaded = true;
            betaAccessState.lastError = true;
            writeSelectedChannel(APP_UPDATE_CHANNELS.stable);
            return getBetaAccessSnapshot();
        }

        const allowedInstallIds = Array.isArray(accessData?.allowedInstallIds)
            ? accessData.allowedInstallIds
                .map((installId) => normalizeInstallId(installId))
                .filter(Boolean)
            : [];

        betaAccessState.isAllowed = allowedInstallIds.includes(betaAccessState.installId);
        console.log('[AppUpdate] Beta check:', { installId: betaAccessState.installId, isAllowed: betaAccessState.isAllowed, allowedCount: allowedInstallIds.length });
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
            message: 'Не налаштовано адресу файлу з оновленнями.'
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
            message: 'Не вдалося отримати інформацію про оновлення.'
        });
        return null;
    }

    setAppUpdateDebugState({
        channel: normalizeUpdateChannel(channel),
        manifestVersion: data.version.trim(),
        status: 'manifest-loaded',
        message: `Знайшли версію ${data.version.trim()}.`
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
        message: `Перевіряємо ${getChannelLabel(selectedChannel).toLowerCase()} канал.`
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
                message: `У вас уже найновіша версія ${APP_RELEASE_VERSION}.`
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
                message: 'Це оновлення сховано на 24 години.'
            });
            continue;
        }

        setAppUpdateDebugState({
            channel,
            manifestVersion: manifest.version,
            availableVersion: manifest.version,
            downloadUrl: manifest.apkUrl,
            status: 'update-available',
            message: buildAvailableUpdateLabel(channel, manifest.version)
        });
        return manifest;
    }

    if (sawCurrentVersionInPreferredChannel) {
        setAppUpdateDebugState({
            channel: selectedChannel,
            manifestVersion: APP_RELEASE_VERSION,
            status: 'up-to-date',
            message: `У вас уже найновіша версія ${APP_RELEASE_VERSION}.`
        });
    } else if (appUpdateDebugState.status === 'checking') {
        setAppUpdateDebugState({
            channel: selectedChannel,
            status: 'no-update',
            message: 'Новішої версії поки немає.'
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
                ? 'Перевірку оновлень зараз вимкнено.'
                : ''
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
                message: 'Це оновлення сховано на 24 години.'
            });
        }
        hideAppUpdateBanner();
    });
}

loadBetaAccessState();
bindAutomaticAppUpdateChecks();

window.AppUpdate = {
    checkForAppUpdate,
    closeWhatsNew: closeReleaseNotesOverlay,
    compareAppVersions,
    enableLocalBetaAccess,
    getDebugState: getAppUpdateDebugSnapshot,
    getAppVersion: () => APP_RELEASE_VERSION,
    getBetaAccessSnapshot,
    getChannelLabel,
    getCurrentReleaseNotes,
    getInstallId: () => betaAccessState.installId,
    getSelectedChannel: readSelectedChannel,
    hasCurrentReleaseNotes: () => Boolean(getCurrentReleaseNotes()),
    hideBanner: hideAppUpdateBanner,
    isBetaAllowedForThisInstall: canAccessBetaChannel,
    isNativeAndroidApp,
    isWhatsNewOpen: isReleaseNotesOverlayOpen,
    loadBetaAccessState,
    openWhatsNew: openReleaseNotesOverlay,
    openDownload: openApkDownload,
    setSelectedChannel: writeSelectedChannel
};

window.requestAnimationFrame(() => {
    maybeShowCurrentReleaseNotes();
});
