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
    themeModeBtns: document.querySelectorAll('#theme-mode-switcher .theme-mode-btn'),
    workColor: document.getElementById('work-color'),
    offColor: document.getElementById('off-color'),
    workPreview: document.getElementById('work-preview'),
    offPreview: document.getElementById('off-preview'),
    resetBtn: document.getElementById('reset-settings'),
    hardResetBtn: document.getElementById('hard-reset-btn'),
    appVersionTrigger: document.getElementById('app-version-trigger'),
    appVersionValue: document.getElementById('app-version-value'),
    appVersionHint: document.getElementById('app-version-hint'),
    appInstallId: document.getElementById('app-install-id'),
    appUpdateChannelSummary: document.getElementById('app-update-channel-summary'),
    updateChannelGroup: document.getElementById('update-channel-group'),
    updateChannelBtns: document.querySelectorAll('#update-channel-switcher [data-update-channel]'),
    updateChannelHelp: document.getElementById('update-channel-help')
};

if (settingsEls.resetBtn) {
    settingsEls.resetBtn.textContent = '\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u0442\u0435\u043c\u0443';
    settingsEls.resetBtn.title = '\u0421\u043a\u0438\u043d\u0443\u0442\u0438 \u0442\u0435\u043c\u0443, \u043a\u043e\u043b\u044c\u043e\u0440\u0438 \u0442\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u043d\u044f';
}

const HARD_RESET_HOLD_MS = 1500;
let hardResetHoldTimer = null;
let hardResetAnimationFrameId = null;
let hardResetHoldStartedAt = 0;
let applySelectedThemeMode = null;
let installIdHintResetTimer = null;

const setSettingsOverlayOpen = (isOpen) => {
    if (!settingsEls.overlay) {
        return;
    }

    if (isOpen) {
        settingsEls.overlay.classList.add('active');
        clearHardResetHold();
        return;
    }

    clearHardResetHold();
    settingsEls.overlay.classList.remove('active');
};

const applyStylePreset = (stylePreset) => {
    setStylePreset(stylePreset);
    persistStylePreset(stylePreset);

    if (!hasCustomColors()) {
        syncColorInputsFromTheme(settingsEls);
    }
};

const setThemeModeUI = (themeMode) => {
    settingsEls.themeModeBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.themeMode === themeMode);
    });
};

const setUpdateChannelUI = (channel) => {
    settingsEls.updateChannelBtns.forEach((button) => {
        button.classList.toggle('active', button.dataset.updateChannel === channel);
    });
};

const refreshAppUpdateSettingsUI = async () => {
    if (!window.AppUpdate) {
        return;
    }

    const betaAccessState = await window.AppUpdate.loadBetaAccessState?.();
    const currentChannel = window.AppUpdate.getSelectedChannel?.() || 'stable';
    const betaAllowed = betaAccessState?.isAllowed === true;
    const betaConfigured = betaAccessState?.isConfigured === true;
    const channelLabel = window.AppUpdate.getChannelLabel?.(currentChannel) || currentChannel;
    const appVersion = window.AppUpdate.getAppVersion?.() || APP_RELEASE_VERSION;
    const installId = window.AppUpdate.getInstallId?.() || betaAccessState?.installId || '';

    if (settingsEls.appVersionValue) {
        settingsEls.appVersionValue.textContent = appVersion;
    }

    if (settingsEls.appInstallId) {
        settingsEls.appInstallId.innerHTML = installId
            ? `<span class="settings-device-id-label">ID пристрою</span><span class="settings-device-id-value">${installId}</span>`
            : '<span class="settings-device-id-label">ID пристрою</span><span class="settings-device-id-value">недоступний</span>';
        settingsEls.appInstallId.title = installId
            ? 'Натисніть, щоб скопіювати ID'
            : 'ID пристрою недоступний';
    }

    if (settingsEls.appUpdateChannelSummary) {
        settingsEls.appUpdateChannelSummary.textContent = `Канал оновлень: ${channelLabel}`;
    }

    if (settingsEls.updateChannelGroup) {
        settingsEls.updateChannelGroup.hidden = !betaAllowed;
    }

    settingsEls.updateChannelBtns.forEach((button) => {
        const isBetaButton = button.dataset.updateChannel === 'beta';
        button.disabled = isBetaButton && !betaAllowed;
    });
    setUpdateChannelUI(currentChannel);

    if (settingsEls.updateChannelHelp) {
        settingsEls.updateChannelHelp.textContent = !betaAllowed
            ? 'Beta-перемикач доступний тільки для дозволених пристроїв.'
            : (currentChannel === 'beta'
                ? 'Цей пристрій зараз отримує beta-оновлення. Інші користувачі залишаються на Stable.'
                : 'Stable використовується для всіх. Beta можна вмикати тільки на цьому пристрої.');
    }

    if (!settingsEls.appVersionHint) {
        return;
    }

    if (!betaConfigured) {
        settingsEls.appVersionHint.textContent = 'Beta-доступ ще не налаштовано. Пристрій працює лише через Stable.';
        return;
    }

    if (betaAllowed) {
        settingsEls.appVersionHint.textContent = 'Цей пристрій є в allowlist і може перемикатися між Stable та Beta.';
        return;
    }

    settingsEls.appVersionHint.textContent = 'Цей пристрій не має beta-доступу.';
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

const applyColorSelection = () => {
    if (!settingsEls.workColor || !settingsEls.offColor) {
        return;
    }

    const workColor = settingsEls.workColor.value;
    const offColor = settingsEls.offColor.value;

    updatePreview();
    applyColors(workColor, offColor);
    saveCustomSettings(workColor, offColor);
};

const bindLiveColorInput = (inputEl) => {
    if (!inputEl) {
        return;
    }

    inputEl.addEventListener('input', applyColorSelection);
    inputEl.addEventListener('change', applyColorSelection);
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

bindLiveColorInput(settingsEls.workColor);
bindLiveColorInput(settingsEls.offColor);
refreshAppUpdateSettingsUI();

if (settingsEls.settingsBtn && settingsEls.overlay) {
    settingsEls.settingsBtn.addEventListener('click', () => {
        setSettingsOverlayOpen(true);
    });
}

if (settingsEls.closeBtn && settingsEls.overlay) {
    settingsEls.closeBtn.addEventListener('click', () => {
        setSettingsOverlayOpen(false);
    });
}

if (settingsEls.overlay) {
    settingsEls.overlay.addEventListener('click', (event) => {
        if (event.target === settingsEls.overlay) {
            setSettingsOverlayOpen(false);
        }
    });
}

settingsEls.themeModeBtns.forEach((button) => {
    button.addEventListener('click', () => {
        selectedThemeMode = button.dataset.themeMode;
        setThemeModeUI(selectedThemeMode);
        if (applySelectedThemeMode) {
            applySelectedThemeMode(selectedThemeMode);
        }
    });
});

if (settingsEls.appInstallId) {
    settingsEls.appInstallId.addEventListener('click', async () => {
        const installId = window.AppUpdate?.getInstallId?.();
        if (!installId) {
            return;
        }

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(installId);
            } else {
                const tempTextArea = document.createElement('textarea');
                tempTextArea.value = installId;
                tempTextArea.setAttribute('readonly', '');
                tempTextArea.style.position = 'absolute';
                tempTextArea.style.left = '-9999px';
                document.body.appendChild(tempTextArea);
                tempTextArea.select();
                document.execCommand('copy');
                tempTextArea.remove();
            }

            if (installIdHintResetTimer) {
                clearTimeout(installIdHintResetTimer);
            }

            if (settingsEls.appVersionHint) {
                settingsEls.appVersionHint.textContent = 'ID пристрою скопійовано.';
                installIdHintResetTimer = window.setTimeout(() => {
                    installIdHintResetTimer = null;
                    refreshAppUpdateSettingsUI();
                }, 1800);
            }
        } catch (error) {
            if (settingsEls.appVersionHint) {
                settingsEls.appVersionHint.textContent = 'Не вдалося скопіювати ID.';
            }
        }
    });
}

settingsEls.updateChannelBtns.forEach((button) => {
    button.addEventListener('click', () => {
        if (!window.AppUpdate) {
            return;
        }

        const nextChannel = button.dataset.updateChannel;
        window.AppUpdate.setSelectedChannel?.(nextChannel);
        refreshAppUpdateSettingsUI();
        window.AppUpdate.checkForAppUpdate?.();
    });
});

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

if (window.AppUpdate?.checkForAppUpdate) {
    window.AppUpdate.checkForAppUpdate();
}
