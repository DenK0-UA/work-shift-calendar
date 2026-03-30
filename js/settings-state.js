(() => {
    const STORAGE_KEYS = {
        settings: 'workCalendarSettings',
        stylePreset: 'stylePreset',
        theme: 'theme',
        themeMode: 'themeMode'
    };
    const APP_STORAGE_KEYS = [
        STORAGE_KEYS.settings,
        STORAGE_KEYS.stylePreset,
        STORAGE_KEYS.theme,
        STORAGE_KEYS.themeMode,
        'scheduleConfig',
        'customDayStatuses',
        'dayNotes'
    ];
    const APP_STORAGE_PREFIXES = ['holidayData:', 'appUpdate:'];

    const settingsState = {
        customSettings: null,
        savedStylePreset: 'current',
        savedThemeMode: 'auto',
        isDark: false,
        hydrated: false
    };

    let visualSwitchTimeoutId = null;
    const PUBLIC_STYLE_PRESETS = new Set(['current']);
    const FALLBACK_STYLE_PRESET = 'current';

    const normalizeHexColor = (value, fallback = '#34C759') => {
        if (typeof value !== 'string') return fallback;
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        if (trimmed.startsWith('#')) return trimmed.toUpperCase();
        if (trimmed.startsWith('rgb')) {
            const matches = trimmed.match(/\d+/g);
            if (matches && matches.length >= 3) {
                return '#' + matches
                    .slice(0, 3)
                    .map((x) => Number.parseInt(x, 10).toString(16).padStart(2, '0'))
                    .join('')
                    .toUpperCase();
            }
        }
        return fallback;
    };

    const hexToRgb = (value, fallback = '#34C759') => {
        const normalized = normalizeHexColor(value, fallback).replace('#', '');
        const safeHex = normalized.length === 6 ? normalized : fallback.replace('#', '');
        return {
            r: Number.parseInt(safeHex.slice(0, 2), 16),
            g: Number.parseInt(safeHex.slice(2, 4), 16),
            b: Number.parseInt(safeHex.slice(4, 6), 16)
        };
    };

    const mixHex = (value, targetHex, amount) => {
        const source = hexToRgb(value, value);
        const target = hexToRgb(targetHex, targetHex);
        const factor = Math.min(Math.max(amount, 0), 1);
        const channel = (from, to) => Math.round(from + (to - from) * factor);

        return '#' + [channel(source.r, target.r), channel(source.g, target.g), channel(source.b, target.b)]
            .map((part) => part.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    };

    const toRgba = ({ r, g, b }, alpha) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

    const getContrastTextColor = (value) => {
        const { r, g, b } = hexToRgb(value, '#34C759');
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness >= 150 ? '#142033' : '#FFFFFF';
    };

    const safeStorageGet = (key) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    };

    const safeStorageSet = (key, value) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('Не вдалось зберегти налаштування', e);
        }
    };

    const safeStorageRemove = (key) => {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    };

    const getCustomColorsStyleElement = ({ create = false } = {}) => {
        let styleEl = document.getElementById('custom-colors-style');
        if (!styleEl && create) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-colors-style';
            document.head.appendChild(styleEl);
        }
        return styleEl;
    };

    const getCustomColorsStyleText = () => getCustomColorsStyleElement()?.textContent || null;

    const setCustomColorsStyleText = (text) => {
        if (!text) return;
        const styleEl = getCustomColorsStyleElement({ create: true });
        styleEl.textContent = text;
    };

    const removeCustomColorsStyleElement = () => {
        const styleEl = getCustomColorsStyleElement();
        if (styleEl) {
            styleEl.remove();
        }
    };

    const readDayColorsFromComputedStyles = (computedStyles) => ({
        workColor: normalizeHexColor(computedStyles.getPropertyValue('--work-bg'), '#DBE7F3'),
        offColor: normalizeHexColor(computedStyles.getPropertyValue('--off-bg'), '#1F9D73')
    });

    const withTemporaryThemeContext = ({ stylePreset = 'current', themeName = 'light', ignoreCustomColors = true } = {}, callback) => {
        const body = document.body;
        if (!body || typeof callback !== 'function') {
            return { workColor: '#DBE7F3', offColor: '#1F9D73' };
        }

        const previousState = {
            stylePreset: body.getAttribute('data-style') || FALLBACK_STYLE_PRESET,
            themeName: body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
            customColorsText: ignoreCustomColors ? getCustomColorsStyleText() : null
        };

        if (ignoreCustomColors) {
            removeCustomColorsStyleElement();
        }

        body.setAttribute('data-style', normalizePublicStylePreset(stylePreset));
        body.setAttribute('data-theme', themeName === 'dark' ? 'dark' : 'light');

        try {
            return callback(getComputedStyle(body));
        } finally {
            body.setAttribute('data-style', previousState.stylePreset);
            body.setAttribute('data-theme', previousState.themeName);

            if (ignoreCustomColors) {
                removeCustomColorsStyleElement();
            }

            if (ignoreCustomColors && previousState.customColorsText) {
                setCustomColorsStyleText(previousState.customColorsText);
            }
        }
    };

    const getDefaultDayColors = (stylePreset = 'current', themeName = 'light') => {
        return withTemporaryThemeContext(
            { stylePreset, themeName, ignoreCustomColors: true },
            readDayColorsFromComputedStyles
        );
    };

    const normalizePublicStylePreset = (stylePreset) => (
        PUBLIC_STYLE_PRESETS.has(stylePreset) ? stylePreset : FALLBACK_STYLE_PRESET
    );

    const matchesBuiltInPalette = (workColor, offColor) => {
        const normalizedWork = normalizeHexColor(workColor, '#E5E5EA');
        const normalizedOff = normalizeHexColor(offColor, '#34C759');

        const stylePresets = ['current'];
        const themeNames = ['light', 'dark'];

        return stylePresets.some((stylePreset) =>
            themeNames.some((themeName) => {
                const variant = getDefaultDayColors(stylePreset, themeName);
                return variant.workColor === normalizedWork && variant.offColor === normalizedOff;
            })
        );
    };

    const clearCustomColors = () => {
        removeCustomColorsStyleElement();
    };

    const applyColors = (workColor, offColor) => {
        const normalizedWork = normalizeHexColor(workColor, '#E5E5EA');
        const normalizedOff = normalizeHexColor(offColor, '#34C759');
        const workRgb = hexToRgb(normalizedWork, '#E5E5EA');
        const offRgb = hexToRgb(normalizedOff, '#34C759');
        const isDarkTheme = document.body.getAttribute('data-theme') === 'dark';
        const workStart = mixHex(normalizedWork, '#FFFFFF', isDarkTheme ? 0.12 : 0.34);
        const workEnd = mixHex(normalizedWork, '#000000', isDarkTheme ? 0.14 : 0.04);
        const offStart = mixHex(normalizedOff, '#FFFFFF', isDarkTheme ? 0.1 : 0.16);
        const offEnd = mixHex(normalizedOff, '#000000', isDarkTheme ? 0.12 : 0.08);
        const workText = getContrastTextColor(normalizedWork);
        const offText = getContrastTextColor(normalizedOff);

        setCustomColorsStyleText(`
            body {
                --work-bg: ${normalizedWork} !important;
                --off-bg: ${normalizedOff} !important;
                --work-text: ${workText} !important;
                --off-text: ${offText} !important;
                --work-bg-start: ${workStart} !important;
                --work-bg-end: ${workEnd} !important;
                --off-bg-start: ${offStart} !important;
                --off-bg-end: ${offEnd} !important;
                --day-work-shadow: 0 10px 22px ${toRgba(workRgb, isDarkTheme ? 0.28 : 0.18)} !important;
                --day-off-shadow: 0 12px 24px ${toRgba(offRgb, isDarkTheme ? 0.34 : 0.24)} !important;
                --day-work-hover-shadow: 0 14px 30px ${toRgba(workRgb, isDarkTheme ? 0.38 : 0.26)} !important;
                --day-off-hover-shadow: 0 16px 32px ${toRgba(offRgb, isDarkTheme ? 0.42 : 0.32)} !important;
            }
        `);
    };

    const syncColorInputsFromTheme = (settingsEls) => {
        if (!settingsEls?.workColor || !settingsEls?.offColor) return;

        const computedStyles = getComputedStyle(document.body);
        const { workColor, offColor } = readDayColorsFromComputedStyles(computedStyles);

        settingsEls.workColor.value = workColor;
        settingsEls.offColor.value = offColor;

        if (settingsEls.workPreview) {
            settingsEls.workPreview.style.background = workColor;
        }
        if (settingsEls.offPreview) {
            settingsEls.offPreview.style.background = offColor;
        }
    };

    const syncStoredCustomColors = () => {
        if (settingsState.customSettings?.isCustomColors) {
            applyColors(settingsState.customSettings.workColor, settingsState.customSettings.offColor);
        } else {
            clearCustomColors();
        }
    };

    const hydrateSettingsState = () => {
        if (settingsState.hydrated) {
            return;
        }

        const savedStylePreset = safeStorageGet(STORAGE_KEYS.stylePreset);
        if (savedStylePreset) {
            settingsState.savedStylePreset = normalizePublicStylePreset(savedStylePreset);

            if (settingsState.savedStylePreset !== savedStylePreset) {
                safeStorageSet(STORAGE_KEYS.stylePreset, settingsState.savedStylePreset);
            }
        }

        const savedThemeMode = safeStorageGet(STORAGE_KEYS.themeMode);
        const legacyTheme = safeStorageGet(STORAGE_KEYS.theme);
        settingsState.savedThemeMode =
            savedThemeMode === 'auto' || savedThemeMode === 'light' || savedThemeMode === 'dark'
                ? savedThemeMode
                : (legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : 'auto');

        const savedSettingsRaw = safeStorageGet(STORAGE_KEYS.settings);
        if (savedSettingsRaw) {
            try {
                const savedSettings = JSON.parse(savedSettingsRaw);
                const isLegacyDefault =
                    savedSettings &&
                    savedSettings.workColor &&
                    savedSettings.offColor &&
                    savedSettings.isCustomColors !== true &&
                    matchesBuiltInPalette(savedSettings.workColor, savedSettings.offColor);

                if (!isLegacyDefault && savedSettings?.workColor && savedSettings?.offColor && savedSettings.isCustomColors !== false) {
                    settingsState.customSettings = {
                        ...savedSettings,
                        isCustomColors: true,
                        workColor: normalizeHexColor(savedSettings.workColor, '#E5E5EA'),
                        offColor: normalizeHexColor(savedSettings.offColor, '#34C759')
                    };
                } else {
                    safeStorageRemove(STORAGE_KEYS.settings);
                }
            } catch (e) {
                console.warn('Не вдалось завантажити налаштування', e);
            }
        }

        settingsState.hydrated = true;

        syncStoredCustomColors();
    };

    const loadCustomSettings = () => {
        hydrateSettingsState();
        return settingsState.customSettings ? { ...settingsState.customSettings } : null;
    };

    const saveCustomSettings = (workColor, offColor) => {
        hydrateSettingsState();
        const normalizedWork = normalizeHexColor(workColor, '#E5E5EA');
        const normalizedOff = normalizeHexColor(offColor, '#34C759');
        const currentStyle = normalizePublicStylePreset(
            document.body.getAttribute('data-style') || settingsState.savedStylePreset
        );
        const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const defaultColors = getDefaultDayColors(currentStyle, currentTheme);

        if (normalizedWork === defaultColors.workColor && normalizedOff === defaultColors.offColor) {
            settingsState.customSettings = null;
            clearCustomColors();
            safeStorageRemove(STORAGE_KEYS.settings);
            return null;
        }

        settingsState.customSettings = {
            workColor: normalizedWork,
            workText: getContrastTextColor(normalizedWork),
            offColor: normalizedOff,
            offText: getContrastTextColor(normalizedOff),
            isCustomColors: true
        };

        safeStorageSet(STORAGE_KEYS.settings, JSON.stringify(settingsState.customSettings));
        return { ...settingsState.customSettings };
    };

    const getSavedStylePreset = () => {
        hydrateSettingsState();
        return normalizePublicStylePreset(settingsState.savedStylePreset);
    };

    const persistStylePreset = (stylePreset) => {
        hydrateSettingsState();
        settingsState.savedStylePreset = normalizePublicStylePreset(stylePreset);
        safeStorageSet(STORAGE_KEYS.stylePreset, settingsState.savedStylePreset);
    };

    const getSavedThemeMode = () => {
        hydrateSettingsState();
        return settingsState.savedThemeMode;
    };

    const resetSettings = () => {
        safeStorageRemove(STORAGE_KEYS.settings);
        safeStorageRemove(STORAGE_KEYS.stylePreset);
        safeStorageRemove(STORAGE_KEYS.theme);
        safeStorageRemove(STORAGE_KEYS.themeMode);
        location.reload();
    };

    const hardResetAllData = () => {
        try {
            APP_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

            const keysToRemove = [];
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (key && APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
                    keysToRemove.push(key);
                }
            }

            keysToRemove.forEach((key) => localStorage.removeItem(key));
        } catch (e) {
            console.warn('Не вдалося виконати hard reset', e);
        }

        location.reload();
    };

    const withVisualSwitchGuard = () => {
        document.body.classList.add('is-visual-switching');
        if (visualSwitchTimeoutId) {
            clearTimeout(visualSwitchTimeoutId);
        }

        visualSwitchTimeoutId = window.setTimeout(() => {
            document.body.classList.remove('is-visual-switching');
            visualSwitchTimeoutId = null;
        }, 220);
    };

    const setStylePreset = (stylePreset, stylePresetBtns) => {
        const normalizedStylePreset = normalizePublicStylePreset(stylePreset);

        withVisualSwitchGuard();
        document.body.setAttribute('data-style', normalizedStylePreset);

        if (stylePresetBtns) {
            stylePresetBtns.forEach((button) => {
                button.classList.toggle('active', button.dataset.style === normalizedStylePreset);
            });
        }
    };

    const persistThemeMode = (themeMode) => {
        settingsState.savedThemeMode = themeMode;
        safeStorageSet(STORAGE_KEYS.themeMode, themeMode);
        if (themeMode === 'auto') {
            safeStorageRemove(STORAGE_KEYS.theme);
        } else {
            safeStorageSet(STORAGE_KEYS.theme, themeMode);
        }
    };

    const createThemeController = ({ themeBtn, onThemeModeUIChange, onThemeApplied }) => {
        hydrateSettingsState();

        let darkModeQuery = null;
        let mediaListenerAttached = false;

        const updateThemeToggleIcon = () => {
            if (!themeBtn) return;
            const nextIcon = settingsState.savedThemeMode === 'auto'
                ? 'auto'
                : (settingsState.isDark ? 'light' : 'dark');
            themeBtn.dataset.themeIcon = nextIcon;
            themeBtn.setAttribute(
                'aria-label',
                settingsState.savedThemeMode === 'auto'
                    ? `Тема: авто (${settingsState.isDark ? 'темна' : 'світла'})`
                    : `Тема: ${settingsState.isDark ? 'темна' : 'світла'}`
            );
            themeBtn.setAttribute('title', themeBtn.getAttribute('aria-label'));
        };

        const setTheme = (nextIsDark) => {
            settingsState.isDark = nextIsDark;
            withVisualSwitchGuard();
            document.body.setAttribute('data-theme', settingsState.isDark ? 'dark' : 'light');
            updateThemeToggleIcon();

            syncStoredCustomColors();

            if (typeof onThemeApplied === 'function') {
                onThemeApplied({
                    isDark: settingsState.isDark,
                    themeMode: settingsState.savedThemeMode,
                    hasCustomColors: Boolean(settingsState.customSettings?.isCustomColors)
                });
            }
        };

        const applyThemeMode = () => {
            if (settingsState.savedThemeMode === 'auto') {
                if (!darkModeQuery && window.matchMedia) {
                    darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
                }

                if (darkModeQuery && !mediaListenerAttached) {
                    darkModeQuery.addEventListener('change', (e) => {
                        if (settingsState.savedThemeMode === 'auto') {
                            setTheme(e.matches);
                            if (typeof onThemeModeUIChange === 'function') {
                                onThemeModeUIChange(settingsState.savedThemeMode);
                            }
                        }
                    });
                    mediaListenerAttached = true;
                }

                settingsState.isDark = darkModeQuery ? darkModeQuery.matches : false;
            } else {
                settingsState.isDark = settingsState.savedThemeMode === 'dark';
            }

            setTheme(settingsState.isDark);

            if (typeof onThemeModeUIChange === 'function') {
                onThemeModeUIChange(settingsState.savedThemeMode);
            }
        };

        const applySelectedThemeMode = (nextThemeMode) => {
            persistThemeMode(nextThemeMode);
            applyThemeMode();
        };

        applyThemeMode();

        return {
            applySelectedThemeMode,
            toggleTheme: () => applySelectedThemeMode(settingsState.isDark ? 'light' : 'dark'),
            getThemeMode: () => settingsState.savedThemeMode,
            isDark: () => settingsState.isDark
        };
    };

    window.SettingsState = {
        clearCustomColors,
        applyColors,
        syncColorInputsFromTheme,
        loadCustomSettings,
        saveCustomSettings,
        resetSettings,
        hardResetAllData,
        getSavedStylePreset,
        getSavedThemeMode,
        setStylePreset,
        persistStylePreset,
        withVisualSwitchGuard,
        createThemeController,
        hasCustomColors: () => Boolean(settingsState.customSettings?.isCustomColors),
        getCustomSettings: () => settingsState.customSettings ? { ...settingsState.customSettings } : null,
        getState: () => ({ ...settingsState })
    };
})();
