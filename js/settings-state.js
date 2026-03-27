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
    const APP_STORAGE_PREFIXES = ['holidayData:'];

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

    const DEFAULT_DAY_COLORS = {
        current: {
            light: { workColor: '#DBE7F3', offColor: '#1F9D73' },
            dark: { workColor: '#2A3B52', offColor: '#2AA876' }
        },
        ios26: {
            light: { workColor: '#E5E5EA', offColor: '#34C759' },
            dark: { workColor: '#2C2C2E', offColor: '#30D158' }
        },
        material: {
            light: { workColor: '#E8DEF8', offColor: '#4F8D57' },
            dark: { workColor: '#4A4458', offColor: '#7CC684' }
        }
    };

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

    const getDefaultDayColors = (stylePreset = 'current', themeName = 'light') => {
        const palette = DEFAULT_DAY_COLORS[stylePreset] || DEFAULT_DAY_COLORS.current;
        return palette[themeName] || palette.light;
    };

    const normalizePublicStylePreset = (stylePreset) => (
        PUBLIC_STYLE_PRESETS.has(stylePreset) ? stylePreset : FALLBACK_STYLE_PRESET
    );

    const matchesBuiltInPalette = (workColor, offColor) => {
        const normalizedWork = normalizeHexColor(workColor, '#E5E5EA');
        const normalizedOff = normalizeHexColor(offColor, '#34C759');

        return Object.values(DEFAULT_DAY_COLORS).some((palette) =>
            Object.values(palette).some((variant) =>
                variant.workColor === normalizedWork && variant.offColor === normalizedOff
            )
        );
    };

    const clearCustomColors = () => {
        const styleEl = document.getElementById('custom-colors-style');
        if (styleEl) {
            styleEl.remove();
        }
    };

    const applyColors = (workColor, offColor) => {
        let styleEl = document.getElementById('custom-colors-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-colors-style';
            document.head.appendChild(styleEl);
        }

        styleEl.textContent = `
            body {
                --work-bg: ${normalizeHexColor(workColor, '#E5E5EA')} !important;
                --off-bg: ${normalizeHexColor(offColor, '#34C759')} !important;
            }
        `;
    };

    const syncColorInputsFromTheme = (settingsEls) => {
        if (!settingsEls?.workColor || !settingsEls?.offColor) return;

        const computedStyles = getComputedStyle(document.body);
        const workColor = normalizeHexColor(computedStyles.getPropertyValue('--work-bg'), '#E5E5EA');
        const offColor = normalizeHexColor(computedStyles.getPropertyValue('--off-bg'), '#34C759');

        settingsEls.workColor.value = workColor;
        settingsEls.offColor.value = offColor;

        if (settingsEls.workPreview) {
            settingsEls.workPreview.style.background = workColor;
        }
        if (settingsEls.offPreview) {
            settingsEls.offPreview.style.background = offColor;
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

        if (settingsState.customSettings?.isCustomColors) {
            applyColors(settingsState.customSettings.workColor, settingsState.customSettings.offColor);
        } else {
            clearCustomColors();
        }
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
            workText: '#1d1d1f',
            offColor: normalizedOff,
            offText: '#ffffff',
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
                ? '🌓'
                : (settingsState.isDark ? '☀️' : '🌙');
            themeBtn.textContent = nextIcon;
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

            if (settingsState.customSettings?.isCustomColors) {
                applyColors(settingsState.customSettings.workColor, settingsState.customSettings.offColor);
            } else {
                clearCustomColors();
            }

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
