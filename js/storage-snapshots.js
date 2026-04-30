(() => {
    const SNAPSHOT_SCHEMA_VERSION = 1;
    const SNAPSHOT_PREFIX = 'appSnapshot:';
    const SNAPSHOT_INDEX_KEY = `${SNAPSHOT_PREFIX}index`;
    const MAX_SNAPSHOTS = 5;
    const CAPTURE_DEBOUNCE_MS = 1200;

    const USER_DATA_KEYS = [
        'scheduleSchemaVersion',
        'scheduleConfig',
        'customDayStatuses',
        'dayNotes',
        'colleagueProfiles',
        'workCalendarSettings',
        'stylePreset',
        'theme',
        'themeMode'
    ];

    const JSON_DATA_KEYS = new Set([
        'scheduleConfig',
        'customDayStatuses',
        'dayNotes',
        'colleagueProfiles',
        'workCalendarSettings'
    ]);

    const CRITICAL_DATA_KEYS = [
        'scheduleConfig'
    ];

    let captureTimerId = null;
    let isRestoringSnapshot = false;

    function safeGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    function safeRemoveItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            return false;
        }
    }

    function parseJson(rawValue) {
        if (typeof rawValue !== 'string') {
            return null;
        }

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return null;
        }
    }

    function isJsonValueValid(rawValue) {
        if (rawValue === null) {
            return true;
        }

        return parseJson(rawValue) !== null;
    }

    function readSnapshotIndex() {
        const parsed = parseJson(safeGetItem(SNAPSHOT_INDEX_KEY));
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((id) => typeof id === 'string' && id.startsWith(SNAPSHOT_PREFIX))
            .slice(0, MAX_SNAPSHOTS);
    }

    function writeSnapshotIndex(index) {
        safeSetItem(SNAPSHOT_INDEX_KEY, JSON.stringify(index.slice(0, MAX_SNAPSHOTS)));
    }

    function readSnapshot(snapshotKey) {
        const parsed = parseJson(safeGetItem(snapshotKey));
        if (
            !parsed ||
            parsed.schemaVersion !== SNAPSHOT_SCHEMA_VERSION ||
            !parsed.data ||
            typeof parsed.data !== 'object' ||
            Array.isArray(parsed.data)
        ) {
            return null;
        }

        return parsed;
    }

    function collectCurrentData() {
        const data = {};

        USER_DATA_KEYS.forEach((key) => {
            const value = safeGetItem(key);
            if (value !== null) {
                data[key] = value;
            }
        });

        return data;
    }

    function hasSnapshotData(data) {
        return Boolean(data && Object.keys(data).some((key) => key !== 'scheduleSchemaVersion'));
    }

    function dataMatchesLatestSnapshot(data) {
        const [latestSnapshotKey] = readSnapshotIndex();
        const latestSnapshot = latestSnapshotKey ? readSnapshot(latestSnapshotKey) : null;
        return latestSnapshot ? JSON.stringify(latestSnapshot.data) === JSON.stringify(data) : false;
    }

    function pruneSnapshots(index) {
        const keep = new Set(index.slice(0, MAX_SNAPSHOTS));
        readSnapshotIndex().forEach((snapshotKey) => {
            if (!keep.has(snapshotKey)) {
                safeRemoveItem(snapshotKey);
            }
        });
    }

    function captureNow(reason = 'auto') {
        if (isRestoringSnapshot) {
            return false;
        }

        if (captureTimerId) {
            clearTimeout(captureTimerId);
            captureTimerId = null;
        }

        const data = collectCurrentData();
        if (!hasSnapshotData(data) || dataMatchesLatestSnapshot(data)) {
            return false;
        }

        const snapshotKey = `${SNAPSHOT_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const snapshot = {
            schemaVersion: SNAPSHOT_SCHEMA_VERSION,
            capturedAt: new Date().toISOString(),
            appVersion: typeof APP_RELEASE_VERSION === 'string' ? APP_RELEASE_VERSION : '',
            reason,
            data
        };

        if (!safeSetItem(snapshotKey, JSON.stringify(snapshot))) {
            return false;
        }

        const nextIndex = [
            snapshotKey,
            ...readSnapshotIndex().filter((key) => key !== snapshotKey)
        ].slice(0, MAX_SNAPSHOTS);

        writeSnapshotIndex(nextIndex);
        pruneSnapshots(nextIndex);
        return true;
    }

    function queueCapture(reason = 'auto') {
        if (isRestoringSnapshot) {
            return;
        }

        if (captureTimerId) {
            clearTimeout(captureTimerId);
        }

        captureTimerId = window.setTimeout(() => captureNow(reason), CAPTURE_DEBOUNCE_MS);
    }

    function getLatestRestorableSnapshot() {
        for (const snapshotKey of readSnapshotIndex()) {
            const snapshot = readSnapshot(snapshotKey);
            if (snapshot && hasSnapshotData(snapshot.data)) {
                return snapshot;
            }
        }

        return null;
    }

    function hasCorruptedUserJson() {
        return USER_DATA_KEYS.some((key) =>
            JSON_DATA_KEYS.has(key) &&
            safeGetItem(key) !== null &&
            !isJsonValueValid(safeGetItem(key))
        );
    }

    function isCriticalDataMissing(snapshot) {
        return CRITICAL_DATA_KEYS.some((key) =>
            safeGetItem(key) === null &&
            typeof snapshot?.data?.[key] === 'string' &&
            snapshot.data[key].trim()
        );
    }

    function shouldRestoreSnapshot(snapshot) {
        return Boolean(snapshot && (hasCorruptedUserJson() || isCriticalDataMissing(snapshot)));
    }

    function restoreSnapshot(snapshot) {
        if (!snapshot || !snapshot.data) {
            return false;
        }

        isRestoringSnapshot = true;

        try {
            Object.entries(snapshot.data).forEach(([key, value]) => {
                if (!USER_DATA_KEYS.includes(key) || typeof value !== 'string') {
                    return;
                }

                safeSetItem(key, value);

                if (JSON_DATA_KEYS.has(key)) {
                    safeSetItem(`${key}:lastKnownGood`, value);
                }
            });

            return true;
        } finally {
            isRestoringSnapshot = false;
        }
    }

    function restoreLatestIfNeeded() {
        const snapshot = getLatestRestorableSnapshot();
        if (!shouldRestoreSnapshot(snapshot)) {
            return false;
        }

        return restoreSnapshot(snapshot);
    }

    function clearAllSnapshots() {
        if (captureTimerId) {
            clearTimeout(captureTimerId);
            captureTimerId = null;
        }

        readSnapshotIndex().forEach((snapshotKey) => safeRemoveItem(snapshotKey));
        safeRemoveItem(SNAPSHOT_INDEX_KEY);
    }

    window.StorageSnapshots = {
        captureNow,
        queueCapture,
        restoreLatestIfNeeded,
        clearAllSnapshots,
        getStatus: () => ({
            count: readSnapshotIndex().length,
            latest: readSnapshotIndex()[0] || ''
        })
    };

    restoreLatestIfNeeded();

    window.addEventListener('pagehide', () => captureNow('pagehide'));
    window.addEventListener('beforeunload', () => captureNow('beforeunload'));
})();
