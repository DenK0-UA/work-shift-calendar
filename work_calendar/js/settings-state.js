(() => {
    let cachedCustomSettings = null;
    let visualSwitchTimeoutId = null;

    const DEFAULT_DAY_COLORS = {
        current: {
            light: { workColor: '#E5E5EA', offColor: '#34C759' },
            dark: { workColor: '#2C2C2E', offColor: '#30D158' }
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

    const getDefaultDayColors = (stylePreset = 'current', themeName = 'light') => {
        const palette = DEFAULT_DAY_COLORS[stylePreset] || DEFAULT_DAY_COLORS.current;
        return palette[themeName] || palette.light;
    };

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

    const loadCustomSettings = () => {
        try {
            const saved = localStorage.getItem('workCalendarSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (!settings || !settings.workColor || !settings.offColor) {
                    cachedCustomSettings = null;
                    clearCustomColors();
                    return null;
                }

                const isLegacyDefault =
                    settings.isCustomColors !== true &&
                    matchesBuiltInPalette(settings.workColor, settings.offColor);

                if (isLegacyDefault || settings.isCustomColors === false) {
                    cachedCustomSettings = null;
                    clearCustomColors();
                    localStorage.removeItem('workCalendarSettings');
                    return null;
                }

                cachedCustomSettings = {
                    ...settings,
                    isCustomColors: true,
                    workColor: normalizeHexColor(settings.workColor, '#E5E5EA'),
                    offColor: normalizeHexColor(settings.offColor, '#34C759')
                };
                applyColors(cachedCustomSettings.workColor, cachedCustomSettings.offColor);
                return cachedCustomSettings;
            }
        } catch (e) {
            console.warn('Не вдалось завантажити налаштування', e);
        }

        cachedCustomSettings = null;
        clearCustomColors();
        return null;
    };

    const saveCustomSettings = (workColor, offColor) => {
        try {
            const normalizedWork = normalizeHexColor(workColor, '#E5E5EA');
            const normalizedOff = normalizeHexColor(offColor, '#34C759');
            const currentStyle = document.body.getAttribute('data-style') || 'current';
            const currentTheme = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const defaultColors = getDefaultDayColors(currentStyle, currentTheme);

            if (normalizedWork === defaultColors.workColor && normalizedOff === defaultColors.offColor) {
                cachedCustomSettings = null;
                clearCustomColors();
                localStorage.removeItem('workCalendarSettings');
                return null;
            }

            const settings = {
                workColor: normalizedWork,
                workText: '#1d1d1f',
                offColor: normalizedOff,
                offText: '#ffffff',
                isCustomColors: true
            };

            cachedCustomSettings = settings;
            localStorage.setItem('workCalendarSettings', JSON.stringify(settings));
            return settings;
        } catch (e) {
            console.warn('Не вдалось зберегти налаштування', e);
            return null;
        }
    };

    const getSavedStylePreset = () => {
        try {
            return localStorage.getItem('stylePreset') || 'current';
        } catch (e) {
            return 'current';
        }
    };

    const getSavedThemeMode = () => {
        try {
            const savedThemeMode = localStorage.getItem('themeMode');
            if (savedThemeMode === 'auto' || savedThemeMode === 'light' || savedThemeMode === 'dark') {
                return savedThemeMode;
            }

            const legacyTheme = localStorage.getItem('theme');
            if (legacyTheme === 'light' || legacyTheme === 'dark') {
                return legacyTheme;
            }
        } catch (e) {
            return 'auto';
        }

        return 'auto';
    };

    const resetSettings = () => {
        try {
            localStorage.removeItem('workCalendarSettings');
            localStorage.removeItem('stylePreset');
            localStorage.removeItem('theme');
            localStorage.removeItem('themeMode');
        } catch (e) { }
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
        withVisualSwitchGuard();
        document.body.setAttribute('data-style', stylePreset);

        if (stylePresetBtns) {
            stylePresetBtns.forEach((button) => {
                button.classList.toggle('active', button.dataset.style === stylePreset);
            });
        }
    };

    const createThemeController = ({ themeBtn, onThemeModeUIChange, onThemeApplied }) => {
        let darkModeQuery = null;
        let themeMode = getSavedThemeMode();
        let isDark = false;
        let mediaListenerAttached = false;

        const updateThemeToggleIcon = () => {
            if (!themeBtn) return;
            const nextIcon = themeMode === 'auto' ? '🌓' : (isDark ? '☀️' : '🌙');
            themeBtn.textContent = nextIcon;
            themeBtn.setAttribute(
                'aria-label',
                themeMode === 'auto'
                    ? `Тема: авто (${isDark ? 'темна' : 'світла'})`
                    : `Тема: ${isDark ? 'темна' : 'світла'}`
            );
            themeBtn.setAttribute('title', themeBtn.getAttribute('aria-label'));
        };

        const persistThemeMode = () => {
            try {
                localStorage.setItem('themeMode', themeMode);
                if (themeMode === 'auto') {
                    localStorage.removeItem('theme');
                } else {
                    localStorage.setItem('theme', themeMode);
                }
            } catch (e) {
                console.warn('LocalStorage заблоковано. Використовую тему системи.');
            }
        };

        const setTheme = (nextIsDark) => {
            isDark = nextIsDark;
            withVisualSwitchGuard();
            document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
            updateThemeToggleIcon();

            if (cachedCustomSettings?.isCustomColors) {
                applyColors(cachedCustomSettings.workColor, cachedCustomSettings.offColor);
            } else {
                clearCustomColors();
            }

            if (typeof onThemeApplied === 'function') {
                onThemeApplied({ isDark, themeMode, hasCustomColors: Boolean(cachedCustomSettings?.isCustomColors) });
            }
        };

        const applyThemeMode = () => {
            if (themeMode === 'auto') {
                if (!darkModeQuery && window.matchMedia) {
                    darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
                }

                if (darkModeQuery && !mediaListenerAttached) {
                    darkModeQuery.addEventListener('change', (e) => {
                        if (themeMode === 'auto') {
                            setTheme(e.matches);
                            if (typeof onThemeModeUIChange === 'function') {
                                onThemeModeUIChange(themeMode);
                            }
                        }
                    });
                    mediaListenerAttached = true;
                }

                isDark = darkModeQuery ? darkModeQuery.matches : false;
            } else {
                isDark = themeMode === 'dark';
            }

            setTheme(isDark);

            if (typeof onThemeModeUIChange === 'function') {
                onThemeModeUIChange(themeMode);
            }
        };

        const applySelectedThemeMode = (nextThemeMode) => {
            themeMode = nextThemeMode;
            persistThemeMode();
            applyThemeMode();
        };

        persistThemeMode();
        applyThemeMode();

        return {
            applySelectedThemeMode,
            toggleTheme: () => applySelectedThemeMode(isDark ? 'light' : 'dark'),
            getThemeMode: () => themeMode,
            isDark: () => isDark
        };
    };

    window.SettingsState = {
        clearCustomColors,
        applyColors,
        syncColorInputsFromTheme,
        loadCustomSettings,
        saveCustomSettings,
        resetSettings,
        getSavedStylePreset,
        getSavedThemeMode,
        setStylePreset,
        withVisualSwitchGuard,
        createThemeController,
        hasCustomColors: () => Boolean(cachedCustomSettings?.isCustomColors),
        getCustomSettings: () => cachedCustomSettings ? { ...cachedCustomSettings } : null
    };
})();
