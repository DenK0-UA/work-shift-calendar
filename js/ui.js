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
    settingsEls.resetBtn.textContent = '\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u0432\u0438\u0433\u043b\u044f\u0434';
    settingsEls.resetBtn.title = '\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u043b\u0438\u0448\u0435 \u0442\u0435\u043c\u0443, \u043a\u043e\u043b\u044c\u043e\u0440\u0438 \u0442\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u043d\u044f';
}

if (settingsEls.styleSection) {
    settingsEls.styleSection.hidden = true;
}

const HARD_RESET_HOLD_MS = 2000;
let hardResetHoldTimer = null;
let hardResetAnimationFrameId = null;
let hardResetHoldStartedAt = 0;
let applySelectedThemeMode = null;

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

if (settingsEls.hardResetBtn) {
    settingsEls.hardResetBtn.innerHTML = `
        <span class="settings-danger-btn-fill" aria-hidden="true"></span>
        <span class="settings-danger-btn-content">
            <span class="settings-danger-btn-title">Hard reset</span>
        </span>
    `;
}

const updatePreview = () => {
    if (settingsEls.workPreview && settingsEls.workColor) {
        settingsEls.workPreview.style.background = settingsEls.workColor.value;
    }

    if (settingsEls.offPreview && settingsEls.offColor) {
        settingsEls.offPreview.style.background = settingsEls.offColor.value;
    }
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
        setHardResetButtonState('Hard reset', 0);
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

    setHardResetButtonState(`${remainingSeconds}\u0441 \u0434\u043e \u0441\u043a\u0438\u0434\u0430\u043d\u043d\u044f`, progress * 100);

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

        if (confirm('\u0426\u0435 \u043f\u043e\u0432\u043d\u0456\u0441\u0442\u044e \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0433\u0440\u0430\u0444\u0456\u043a, \u0440\u0443\u0447\u043d\u0456 \u0437\u043c\u0456\u043d\u0438, \u043d\u043e\u0442\u0430\u0442\u043a\u0438, \u043a\u0435\u0448 \u0441\u0432\u044f\u0442 \u0456 \u0432\u0441\u0456 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u0456 \u043d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f. \u041f\u0440\u043e\u0434\u043e\u0432\u0436\u0438\u0442\u0438?')) {
            hardResetAllData();
            return;
        }

        clearHardResetHold();
    }, HARD_RESET_HOLD_MS);
};

if (settingsEls.workColor) {
    settingsEls.workColor.addEventListener('change', updatePreview);
}

if (settingsEls.offColor) {
    settingsEls.offColor.addEventListener('change', updatePreview);
}

if (settingsEls.settingsBtn && settingsEls.overlay) {
    settingsEls.settingsBtn.addEventListener('click', () => {
        settingsEls.overlay.classList.add('active');
        clearHardResetHold();
    });
}

if (settingsEls.closeBtn && settingsEls.overlay) {
    settingsEls.closeBtn.addEventListener('click', () => {
        clearHardResetHold();
        settingsEls.overlay.classList.remove('active');
    });
}

if (settingsEls.overlay) {
    settingsEls.overlay.addEventListener('click', (event) => {
        if (event.target === settingsEls.overlay) {
            clearHardResetHold();
            settingsEls.overlay.classList.remove('active');
        }
    });
}

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

if (settingsEls.applyBtn && settingsEls.workColor && settingsEls.offColor) {
    settingsEls.applyBtn.addEventListener('click', () => {
        const workColor = settingsEls.workColor.value;
        const offColor = settingsEls.offColor.value;

        applyColors(workColor, offColor);
        saveCustomSettings(workColor, offColor);
        persistStylePreset(selectedStylePreset);

        if (applySelectedThemeMode) {
            applySelectedThemeMode(selectedThemeMode);
        }

        if (settingsEls.overlay) {
            settingsEls.overlay.classList.remove('active');
        }
    });
}

if (settingsEls.resetBtn) {
    settingsEls.resetBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (confirm('\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u043b\u0438\u0448\u0435 \u0442\u0435\u043c\u0443, \u043a\u043e\u043b\u044c\u043e\u0440\u0438 \u0442\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u043d\u044f?')) {
            resetSettings();
        }
    }, { capture: true });
}

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
    if (!themeBtn) {
        return;
    }

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
} catch (error) {
    console.error('\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0442\u0435\u043c\u0438', error);
}

const modalWeatherRefreshBtn = document.getElementById('modal-weather-refresh');
if (modalWeatherRefreshBtn) {
    modalWeatherRefreshBtn.addEventListener('click', fetchTodayWeather);
}

if (window.scheduleUI) {
    window.scheduleUI.sync();
}

const bootstrapSetupPending = window.scheduleUI?.isSetupPending?.() === true;

if (!bootstrapSetupPending) {
    normalizeStartDate();
    updateSubtitle();
    if (typeof updatePeriodStatsPanel === 'function') {
        updatePeriodStatsPanel(window.activeStatsPeriod || 'month');
    }
}

if (typeof setPeriodStatsCollapsed === 'function') {
    setPeriodStatsCollapsed(true);
}

if (bootstrapSetupPending) {
    document.body.classList.add('app-setup-pending');
    window.scheduleUI.openOnboarding();
} else {
    renderCalendar(currentState.year, currentState.month);
    fetchTodayWeather();
}

document.body.classList.remove('app-shell-pending');
