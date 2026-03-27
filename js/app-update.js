const APP_UPDATE_STORAGE_KEYS = {
    dismissedVersion: 'dismissedAppUpdateVersion'
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

function readDismissedAppUpdateVersion() {
    try {
        return localStorage.getItem(APP_UPDATE_STORAGE_KEYS.dismissedVersion) || '';
    } catch (error) {
        return '';
    }
}

function writeDismissedAppUpdateVersion(version) {
    try {
        localStorage.setItem(APP_UPDATE_STORAGE_KEYS.dismissedVersion, version);
    } catch (error) {}
}

function clearDismissedAppUpdateVersion() {
    try {
        localStorage.removeItem(APP_UPDATE_STORAGE_KEYS.dismissedVersion);
    } catch (error) {}
}

function buildAppUpdateMessage(manifest) {
    const latestVersion = manifest.version;
    const notes = typeof manifest.notes === 'string' ? manifest.notes.trim() : '';
    const notesSuffix = notes ? ` ${notes}` : '';
    return `Доступна версія ${latestVersion}. Поточна версія: ${APP_RELEASE_VERSION}.${notesSuffix}`;
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
}

function showAppUpdateBanner(manifest) {
    if (!appUpdateEls.banner || !appUpdateEls.text || !appUpdateEls.downloadBtn || !appUpdateEls.dismissBtn) {
        return;
    }

    appUpdateEls.text.textContent = buildAppUpdateMessage(manifest);
    appUpdateEls.downloadBtn.dataset.downloadUrl = manifest.apkUrl;
    appUpdateEls.dismissBtn.dataset.version = manifest.version;
    appUpdateEls.banner.hidden = false;
    appUpdateEls.banner.classList.add('active');
}

async function fetchAppUpdateManifest() {
    if (!APP_UPDATE_MANIFEST_URL) {
        return null;
    }

    const controller = typeof AbortController === 'function'
        ? new AbortController()
        : null;
    const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), APP_UPDATE_CHECK_TIMEOUT_MS)
        : null;

    try {
        const response = await fetch(APP_UPDATE_MANIFEST_URL, {
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

async function checkForAppUpdate() {
    if (!APP_UPDATE_CHECK_ENABLED || !isNativeAndroidApp()) {
        hideAppUpdateBanner();
        return;
    }

    const manifest = await fetchAppUpdateManifest();
    if (!manifest) {
        hideAppUpdateBanner();
        return;
    }

    if (compareAppVersions(manifest.version, APP_RELEASE_VERSION) <= 0) {
        clearDismissedAppUpdateVersion();
        hideAppUpdateBanner();
        return;
    }

    if (readDismissedAppUpdateVersion() === manifest.version) {
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
        if (version) {
            writeDismissedAppUpdateVersion(version);
        }
        hideAppUpdateBanner();
    });
}

window.AppUpdate = {
    checkForAppUpdate,
    compareAppVersions
};
