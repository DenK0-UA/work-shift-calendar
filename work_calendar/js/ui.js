let cachedCustomSettings = null;

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
            return '#' + matches.slice(0, 3).map((x) => Number.parseInt(x, 10).toString(16).padStart(2, '0')).join('').toUpperCase();
        }
    }
    return fallback;
};

function getDefaultDayColors(stylePreset = 'current', themeName = 'light') {
    const palette = DEFAULT_DAY_COLORS[stylePreset] || DEFAULT_DAY_COLORS.current;
    return palette[themeName] || palette.light;
}

function matchesBuiltInPalette(workColor, offColor) {
    const normalizedWork = normalizeHexColor(workColor, '#E5E5EA');
    const normalizedOff = normalizeHexColor(offColor, '#34C759');

    return Object.values(DEFAULT_DAY_COLORS).some((palette) => Object.values(palette).some((variant) => (
        variant.workColor === normalizedWork && variant.offColor === normalizedOff
    )));
}

function clearCustomColors() {
    const styleEl = document.getElementById('custom-colors-style');
    if (styleEl) {
        styleEl.remove();
    }
}

// --- Налаштування з localStorage ---
function applyColors(workColor, offColor) {
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
}

function syncColorInputsFromTheme() {
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
}

function loadCustomSettings() {
    try {
        const saved = localStorage.getItem('workCalendarSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (!settings || !settings.workColor || !settings.offColor) {
                cachedCustomSettings = null;
                clearCustomColors();
                return null;
            }

            const isLegacyDefault = settings.isCustomColors !== true && matchesBuiltInPalette(settings.workColor, settings.offColor);
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
}

function saveCustomSettings(workColor, offColor) {
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
}

function resetSettings() {
    try {
        localStorage.removeItem('workCalendarSettings');
        localStorage.removeItem('stylePreset');
        localStorage.removeItem('theme');
        localStorage.removeItem('themeMode');
    } catch (e) { }
    location.reload();
}

// Завантажуємо збережені налаштування
loadCustomSettings();

let visualSwitchTimeoutId = null;
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

// --- DOM Елементи для налаштувань ---
const settingsEls = {
    overlay: document.getElementById('settings-overlay'),
    settingsBtn: document.getElementById('settings-btn'),
    closeBtn: document.getElementById('settings-overlay-close'),
    stylePresetBtns: document.querySelectorAll('.appearance-preset'),
    themeModeBtns: document.querySelectorAll('.theme-mode-btn'),
    workColor: document.getElementById('work-color'),
    offColor: document.getElementById('off-color'),
    workPreview: document.getElementById('work-preview'),
    offPreview: document.getElementById('off-preview'),
    applyBtn: document.getElementById('apply-settings'),
    resetBtn: document.getElementById('reset-settings')
};

const getSavedStylePreset = () => {
    try {
        return localStorage.getItem('stylePreset') || 'current';
    } catch (e) {
        return 'current';
    }
};

const setStylePreset = (stylePreset) => {
    withVisualSwitchGuard();
    document.body.setAttribute('data-style', stylePreset);
    settingsEls.stylePresetBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.style === stylePreset);
    });

    if (!cachedCustomSettings) {
        syncColorInputsFromTheme();
    }
};

let selectedStylePreset = getSavedStylePreset();
setStylePreset(selectedStylePreset);

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

const setThemeModeUI = (themeMode) => {
    settingsEls.themeModeBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.themeMode === themeMode);
    });
};

let selectedThemeMode = getSavedThemeMode();
setThemeModeUI(selectedThemeMode);
let applySelectedThemeMode = null;

// Ініціалізація колір-піккерів
const getHexColor = (rgbOrHex) => {
    if (typeof rgbOrHex === 'string' && rgbOrHex.startsWith('#')) return rgbOrHex;
    if (typeof rgbOrHex === 'string' && rgbOrHex.startsWith('rgb')) {
        const matches = rgbOrHex.match(/\d+/g);
        if (matches) {
            return '#' + matches.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
        }
    }
    return '#34C759';
};

syncColorInputsFromTheme();

// Превью кольорів
const updatePreview = () => {
    settingsEls.workPreview.style.background = settingsEls.workColor.value;
    settingsEls.offPreview.style.background = settingsEls.offColor.value;
};

settingsEls.workColor.addEventListener('change', updatePreview);
settingsEls.offColor.addEventListener('change', updatePreview);

// Відкриття/закриття налаштувань
settingsEls.settingsBtn.addEventListener('click', () => {
    settingsEls.overlay.classList.add('active');
});

settingsEls.closeBtn.addEventListener('click', () => {
    settingsEls.overlay.classList.remove('active');
});

settingsEls.overlay.addEventListener('click', (e) => {
    if (e.target === settingsEls.overlay) settingsEls.overlay.classList.remove('active');
});

settingsEls.stylePresetBtns.forEach((button) => {
    button.addEventListener('click', () => {
        selectedStylePreset = button.dataset.style;
        setStylePreset(selectedStylePreset);
    });
});

settingsEls.themeModeBtns.forEach((button) => {
    button.addEventListener('click', () => {
        selectedThemeMode = button.dataset.themeMode;
        setThemeModeUI(selectedThemeMode);
    });
});

// Застосування та скидання
settingsEls.applyBtn.addEventListener('click', () => {
    const workColor = settingsEls.workColor.value;
    const offColor = settingsEls.offColor.value;

    applyColors(workColor, offColor);
    saveCustomSettings(workColor, offColor);
    try {
        localStorage.setItem('stylePreset', selectedStylePreset);
        if (applySelectedThemeMode) {
            applySelectedThemeMode(selectedThemeMode);
        }
    } catch (e) {
        console.warn('Не вдалось зберегти налаштування інтерфейсу', e);
    }

    settingsEls.overlay.classList.remove('active');
});

settingsEls.resetBtn.addEventListener('click', () => {
    if (confirm('Скидати усі налаштування?')) {
        resetSettings();
    }
});

// --- Безпечна Тема ---
const initTheme = () => {
    const themeBtn = document.getElementById('theme-btn');
    let darkModeQuery = null;
    let themeMode = getSavedThemeMode();
    let isDark = false;
    let mediaListenerAttached = false;

    const updateThemeToggleIcon = () => {
        if (!themeBtn) return;
        const nextIcon = themeMode === 'auto' ? '🌓' : (isDark ? '☀️' : '🌙');
        themeBtn.textContent = nextIcon;
        themeBtn.setAttribute('aria-label', themeMode === 'auto'
            ? `Тема: авто (${isDark ? 'темна' : 'світла'})`
            : `Тема: ${isDark ? 'темна' : 'світла'}`);
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
            syncColorInputsFromTheme();
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
                    }
                });
                mediaListenerAttached = true;
            }

            isDark = darkModeQuery ? darkModeQuery.matches : false;
        } else {
            isDark = themeMode === 'dark';
        }

        setTheme(isDark);
        setThemeModeUI(themeMode);
    };

    applySelectedThemeMode = (nextThemeMode) => {
        themeMode = nextThemeMode;
        selectedThemeMode = nextThemeMode;
        persistThemeMode();
        applyThemeMode();
    };

    persistThemeMode();
    applyThemeMode();

    themeBtn.addEventListener('click', () => {
        applySelectedThemeMode(isDark ? 'light' : 'dark');
    });
};

// --- Безпечний Запуск ---
try {
    initTheme();
} catch (e) {
    console.error('Помилка теми', e);
}

// --- УПРАВЛІННЯ МОДАЛЛЮ ГРАФІКУ ---
const scheduleEls = {
    overlay: document.getElementById('schedule-overlay'),
    scheduleBtn: document.getElementById('schedule-btn'),
    closeBtn: document.getElementById('schedule-overlay-close'),
    closeBtn2: document.getElementById('schedule-overlay-close2'),
    applyBtn: document.getElementById('apply-schedule'),
    templateBtns: document.querySelectorAll('.schedule-btn'),
    customForm: document.getElementById('custom-schedule-form'),
    customWorkDays: document.getElementById('custom-work-days'),
    customOffDays: document.getElementById('custom-off-days'),
    startDate: document.getElementById('schedule-start-date')
};

const periodStatsEls = {
    panel: document.getElementById('insights-panel'),
    content: document.getElementById('insights-content'),
    toggle: document.getElementById('period-stats-toggle'),
    toggleIcon: document.getElementById('period-stats-toggle-icon'),
    switcher: document.getElementById('period-switcher'),
    buttons: document.querySelectorAll('.period-btn')
};

let selectedSchedule = getScheduleConfig().type;
window.activeStatsPeriod = 'month';

// Обробники для кнопок графікури
scheduleEls.templateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedSchedule = btn.dataset.schedule;
        syncScheduleControls(scheduleEls, selectedSchedule);
    });
});

// Відкриття модалю графіку
scheduleEls.scheduleBtn.addEventListener('click', () => {
    selectedSchedule = getScheduleConfig().type;
    syncScheduleControls(scheduleEls, selectedSchedule);
    scheduleEls.overlay.classList.add('active');
});

// Закриття модалю
const closeScheduleModal = () => {
    scheduleEls.overlay.classList.remove('active');
};

scheduleEls.closeBtn.addEventListener('click', closeScheduleModal);
scheduleEls.closeBtn2.addEventListener('click', closeScheduleModal);
scheduleEls.overlay.addEventListener('click', (e) => {
    if (e.target === scheduleEls.overlay) closeScheduleModal();
});

// Застосування обраного графіку
scheduleEls.applyBtn.addEventListener('click', () => {
    let config = null;

    if (selectedSchedule === 'custom') {
        let workDays = parseInt(scheduleEls.customWorkDays.value);
        let offDays = parseInt(scheduleEls.customOffDays.value);
        if (Number.isNaN(workDays)) workDays = 5;
        if (Number.isNaN(offDays)) offDays = 5;
        if (workDays < 0) workDays = 0;
        if (offDays < 0) offDays = 0;

        if (workDays + offDays <= 0) {
            alert('Невірний цикл: кількість робочих і вихідних днів повинна бути більше 0. Використано 5/5 за замовчуванням.');
            workDays = 5;
            offDays = 5;
            selectedSchedule = '5/5';
        }

        const startDateValue = scheduleEls.startDate.value;
        const startDate = startDateValue ? new Date(startDateValue).toISOString() : DEFAULT_SHIFT_START_DATE.toISOString();
        config = {
            type: selectedSchedule === 'custom' ? 'custom' : selectedSchedule,
            workDays,
            offDays,
            startDate
        };
    } else {
        // Розбираємо графік вигляду "5/5"
        const [work, off] = selectedSchedule.split('/').map(Number);
        let workDays = Number.isNaN(work) ? 5 : work;
        let offDays = Number.isNaN(off) ? 5 : off;
        const startDateValue = scheduleEls.startDate.value;
        const startDate = startDateValue ? new Date(startDateValue).toISOString() : DEFAULT_SHIFT_START_DATE.toISOString();

        if (workDays + offDays <= 0) {
            alert('Невірний цикл графіку. Використано 5/5 за замовчуванням.');
            workDays = 5;
            offDays = 5;
            selectedSchedule = '5/5';
        }

        config = { type: selectedSchedule, workDays, offDays, startDate };
    }

    setScheduleConfig(config);

    // Оновимо підпис
    syncScheduleControls(scheduleEls, selectedSchedule);
    updateSubtitle();
    updatePeriodStatsPanel(window.activeStatsPeriod);
    renderCalendar(currentState.year, currentState.month);
    closeScheduleModal();
});

document.getElementById('weather-refresh').addEventListener('click', fetchTodayWeather);

const setPeriodStatsCollapsed = (isCollapsed) => {
    if (!periodStatsEls.panel || !periodStatsEls.toggle) return;
    periodStatsEls.panel.classList.toggle('is-collapsed', isCollapsed);
    periodStatsEls.toggle.setAttribute('aria-expanded', String(!isCollapsed));
};

if (periodStatsEls.toggle) {
    periodStatsEls.toggle.addEventListener('click', () => {
        setPeriodStatsCollapsed(!periodStatsEls.panel.classList.contains('is-collapsed'));
    });
}

periodStatsEls.buttons.forEach((button) => {
    button.addEventListener('click', () => {
        window.activeStatsPeriod = button.dataset.period;
        periodStatsEls.buttons.forEach((item) => item.classList.toggle('active', item === button));
        updatePeriodStatsPanel(window.activeStatsPeriod);
    });
});

normalizeStartDate();
selectedSchedule = getScheduleConfig().type;
syncScheduleControls(scheduleEls, selectedSchedule);
updateSubtitle();
updatePeriodStatsPanel(window.activeStatsPeriod);
setPeriodStatsCollapsed(true);

// Рендеримо календар одразу
renderCalendar(currentState.year, currentState.month);

// Погоду на сьогодні вантажимо окремо з геолокації
fetchTodayWeather();
