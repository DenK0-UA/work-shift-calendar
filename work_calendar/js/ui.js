const {
    applyColors,
    createThemeController,
    getSavedStylePreset,
    getSavedThemeMode,
    loadCustomSettings,
    resetSettings,
    saveCustomSettings,
    setStylePreset,
    syncColorInputsFromTheme,
    hasCustomColors
} = window.SettingsState;

loadCustomSettings();

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

const applyStylePreset = (stylePreset) => {
    setStylePreset(stylePreset, settingsEls.stylePresetBtns);

    if (!hasCustomColors()) {
        syncColorInputsFromTheme(settingsEls);
    }
};

const setThemeModeUI = (themeMode) => {
    settingsEls.themeModeBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.themeMode === themeMode);
    });
};

let selectedStylePreset = getSavedStylePreset();
applyStylePreset(selectedStylePreset);

let selectedThemeMode = getSavedThemeMode();
setThemeModeUI(selectedThemeMode);

syncColorInputsFromTheme(settingsEls);
let applySelectedThemeMode = null;
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
        applyStylePreset(selectedStylePreset);
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
    const themeController = createThemeController({
        themeBtn,
        onThemeModeUIChange: (themeMode) => {
            selectedThemeMode = themeMode;
            setThemeModeUI(themeMode);
        },
        onThemeApplied: ({ hasCustomColors: hasStoredCustomColors }) => {
            if (!hasStoredCustomColors) {
                syncColorInputsFromTheme(settingsEls);
            }
        }
    });

    applySelectedThemeMode = (nextThemeMode) => {
        themeController.applySelectedThemeMode(nextThemeMode);
    };

    themeBtn.addEventListener('click', () => {
        themeController.toggleTheme();
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
