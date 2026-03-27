const {
    applyColors,
    createThemeController,
    getSavedStylePreset,
    getSavedThemeMode,
    hardResetAllData,
    loadCustomSettings,
    persistStylePreset,
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
    styleSection: document.getElementById('appearance-presets')?.closest('.settings-group') ?? null,
    stylePresetBtns: document.querySelectorAll('.appearance-preset'),
    themeModeBtns: document.querySelectorAll('.theme-mode-btn'),
    workColor: document.getElementById('work-color'),
    offColor: document.getElementById('off-color'),
    workPreview: document.getElementById('work-preview'),
    offPreview: document.getElementById('off-preview'),
    applyBtn: document.getElementById('apply-settings'),
    resetBtn: document.getElementById('reset-settings'),
    hardResetBtn: document.getElementById('hard-reset-btn')
};

if (settingsEls.resetBtn) {
    settingsEls.resetBtn.textContent = 'Скинути вигляд';
    settingsEls.resetBtn.title = 'Скинути лише тему, стиль і кольори';
}

if (settingsEls.styleSection) {
    settingsEls.styleSection.hidden = true;
}

const HARD_RESET_HOLD_MS = 2000;
let hardResetHoldTimer = null;
let hardResetAnimationFrameId = null;
let hardResetHoldStartedAt = 0;

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

if (settingsEls.hardResetBtn) {
    settingsEls.hardResetBtn.innerHTML = `
        <span class="settings-danger-btn-fill" aria-hidden="true"></span>
        <span class="settings-danger-btn-content">
            <span class="settings-danger-btn-title">Утримуй для hard reset</span>
            <span class="settings-danger-btn-meta">1.8с до дії</span>
        </span>
    `;
}

if (settingsEls.hardResetBtn) {
    const hardResetMeta = settingsEls.hardResetBtn.querySelector('.settings-danger-btn-meta');
    const hardResetTitle = settingsEls.hardResetBtn.querySelector('.settings-danger-btn-title');

    if (hardResetMeta) {
        hardResetMeta.remove();
    }

    if (hardResetTitle) {
        hardResetTitle.textContent = '\u0048\u0061\u0072\u0064\u0020\u0072\u0065\u0073\u0065\u0074';
    }
}

const updatePreview = () => {
    settingsEls.workPreview.style.background = settingsEls.workColor.value;
    settingsEls.offPreview.style.background = settingsEls.offColor.value;
};

const setHardResetButtonState = (title, progressPercent) => {
    if (!settingsEls.hardResetBtn) {
        return;
    }

    const titleEl = settingsEls.hardResetBtn.querySelector('.settings-danger-btn-title');

    settingsEls.hardResetBtn.style.setProperty('--hold-progress', `${progressPercent}%`);
    if (titleEl) {
        titleEl.textContent = title;
    }
};

const clearHardResetHold = () => {
    if (hardResetHoldTimer) {
        clearTimeout(hardResetHoldTimer);
        hardResetHoldTimer = null;
    }

    if (hardResetAnimationFrameId) {
        cancelAnimationFrame(hardResetAnimationFrameId);
        hardResetAnimationFrameId = null;
    }

    hardResetHoldStartedAt = 0;

    if (settingsEls.hardResetBtn) {
        settingsEls.hardResetBtn.classList.remove('is-holding');
        setHardResetButtonState('\u0048\u0061\u0072\u0064\u0020\u0072\u0065\u0073\u0065\u0074', 0);
    }
};

const updateHardResetProgress = () => {
    if (!hardResetHoldStartedAt) {
        return;
    }

    const elapsed = Date.now() - hardResetHoldStartedAt;
    const progress = Math.min(elapsed / HARD_RESET_HOLD_MS, 1);
    const remainingMs = Math.max(HARD_RESET_HOLD_MS - elapsed, 0);
    const remainingSeconds = (remainingMs / 1000).toFixed(1);

    setHardResetButtonState(`${remainingSeconds}\u0441 \u0434\u043e hard reset`, progress * 100);

    if (progress < 1) {
        hardResetAnimationFrameId = requestAnimationFrame(updateHardResetProgress);
    } else {
        hardResetAnimationFrameId = null;
    }
};

const startHardResetHold = () => {
    if (!settingsEls.hardResetBtn || hardResetHoldTimer) {
        return;
    }

    hardResetHoldStartedAt = Date.now();
    settingsEls.hardResetBtn.classList.add('is-holding');
    updateHardResetProgress();
    hardResetHoldTimer = window.setTimeout(() => {
        hardResetHoldTimer = null;
        hardResetHoldStartedAt = 0;
        settingsEls.hardResetBtn.classList.remove('is-holding');
        setHardResetButtonState('\u041f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f...', 100);

        if (confirm('\u0048\u0061\u0072\u0064\u0020\u0072\u0065\u0073\u0065\u0074 \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0432\u0435\u0441\u044c \u0433\u0440\u0430\u0444\u0456\u043a, \u0440\u0443\u0447\u043d\u0456 \u0437\u043c\u0456\u043d\u0438, \u043d\u043e\u0442\u0430\u0442\u043a\u0438, \u043a\u0435\u0448 \u0441\u0432\u044f\u0442 \u0456 \u0432\u0441\u0456 \u043d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f. \u041f\u0440\u043e\u0434\u043e\u0432\u0436\u0438\u0442\u0438?')) {
            hardResetAllData();
            return;
        }

        clearHardResetHold();
    }, HARD_RESET_HOLD_MS);
};

settingsEls.workColor.addEventListener('change', updatePreview);
settingsEls.offColor.addEventListener('change', updatePreview);

settingsEls.settingsBtn.addEventListener('click', () => {
    settingsEls.overlay.classList.add('active');
    clearHardResetHold();
});

settingsEls.closeBtn.addEventListener('click', () => {
    clearHardResetHold();
    settingsEls.overlay.classList.remove('active');
});

settingsEls.overlay.addEventListener('click', (e) => {
    if (e.target === settingsEls.overlay) {
        clearHardResetHold();
        settingsEls.overlay.classList.remove('active');
    }
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

settingsEls.applyBtn.addEventListener('click', () => {
    const workColor = settingsEls.workColor.value;
    const offColor = settingsEls.offColor.value;

    applyColors(workColor, offColor);
    saveCustomSettings(workColor, offColor);
    persistStylePreset(selectedStylePreset);

    if (applySelectedThemeMode) {
        applySelectedThemeMode(selectedThemeMode);
    }

    settingsEls.overlay.classList.remove('active');
});

settingsEls.resetBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (confirm('Скинути лише тему, стиль і кольори?')) {
        resetSettings();
    }
}, { capture: true });

settingsEls.resetBtn.addEventListener('click', () => {
    if (confirm('Скидати усі налаштування?')) {
        resetSettings();
    }
});

if (settingsEls.hardResetBtn) {
    settingsEls.hardResetBtn.addEventListener('mousedown', startHardResetHold);
    settingsEls.hardResetBtn.addEventListener('touchstart', startHardResetHold, { passive: true });
    settingsEls.hardResetBtn.addEventListener('mouseup', clearHardResetHold);
    settingsEls.hardResetBtn.addEventListener('mouseleave', clearHardResetHold);
    settingsEls.hardResetBtn.addEventListener('touchend', clearHardResetHold);
    settingsEls.hardResetBtn.addEventListener('touchcancel', clearHardResetHold);
}

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

if (window.scheduleUI?.isSetupPending()) {
    window.scheduleUI.openOnboarding();
} else {
    renderCalendar(currentState.year, currentState.month);
    fetchTodayWeather();
}
