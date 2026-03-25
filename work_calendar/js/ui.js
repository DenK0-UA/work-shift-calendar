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

const modalWeatherRefreshBtn = document.getElementById('modal-weather-refresh');
if (modalWeatherRefreshBtn) {
    modalWeatherRefreshBtn.addEventListener('click', fetchTodayWeather);
}

normalizeStartDate();
updateSubtitle();
if (window.scheduleUI) {
    window.scheduleUI.sync();
}
if (typeof updatePeriodStatsPanel === 'function') {
    updatePeriodStatsPanel(window.activeStatsPeriod || 'month');
}
if (typeof setPeriodStatsCollapsed === 'function') {
    setPeriodStatsCollapsed(true);
}

renderCalendar(currentState.year, currentState.month);
fetchTodayWeather();
