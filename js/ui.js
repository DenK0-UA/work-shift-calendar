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
    appUpdateCheckNow: document.getElementById('app-update-check-now'),
    appUpdateSummary: document.getElementById('app-update-summary'),
    appUpdateDownloadInline: document.getElementById('app-update-download-inline'),
    appUpdateDebugStatus: document.getElementById('app-update-debug-status'),
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
let appVersionTapCount = 0;
const isDevUiMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const APP_VERSION_TAP_TO_ENABLE_BETA_THRESHOLD = 20;

const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    tempTextArea.setAttribute('readonly', '');
    tempTextArea.style.position = 'absolute';
    tempTextArea.style.left = '-9999px';
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    tempTextArea.remove();
};

const showAppVersionHint = (message) => {
    if (!settingsEls.appVersionHint) {
        return;
    }

    if (installIdHintResetTimer) {
        clearTimeout(installIdHintResetTimer);
    }

    settingsEls.appVersionHint.hidden = false;
    settingsEls.appVersionHint.textContent = message;
    installIdHintResetTimer = window.setTimeout(() => {
        installIdHintResetTimer = null;
        refreshAppUpdateSettingsUI();
    }, 1800);
};

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

const formatUpdateTime = (timestamp) => {
    if (!timestamp) {
        return '';
    }

    return new Date(timestamp).toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const refreshAppUpdateSettingsUI = async () => {
    if (!window.AppUpdate) {
        return;
    }

    const betaAccessState = await window.AppUpdate.loadBetaAccessState?.(true);
    const currentChannel = window.AppUpdate.getSelectedChannel?.() || 'stable';
    const betaAllowed = betaAccessState?.isAllowed === true;
    const isNativeAndroidApp = window.AppUpdate.isNativeAndroidApp?.() === true;
    const channelLabel = window.AppUpdate.getChannelLabel?.(currentChannel) || currentChannel;
    const appVersion = window.AppUpdate.getAppVersion?.() || APP_RELEASE_VERSION;
    const debugState = window.AppUpdate.getDebugState?.();
    const debugMatchesCurrentChannel = !debugState?.channel || debugState.channel === currentChannel;

    // Never leave non-beta users on beta channel from stale local storage state.
    if (!betaAllowed && currentChannel === 'beta') {
        window.AppUpdate.setSelectedChannel?.('stable');
    }

    const effectiveChannel = betaAllowed
        ? (window.AppUpdate.getSelectedChannel?.() || 'stable')
        : 'stable';

    if (settingsEls.appVersionValue) {
        settingsEls.appVersionValue.textContent = appVersion;
    }

    if (settingsEls.appUpdateChannelSummary) {
        settingsEls.appUpdateChannelSummary.textContent = effectiveChannel === 'beta'
            ? 'Отримуєте Beta-оновлення'
            : 'Отримуєте Stable-оновлення';
    }

    if (settingsEls.appUpdateSummary) {
        let summaryText = '';

        if (!debugMatchesCurrentChannel) {
            summaryText = `Канал змінено на ${channelLabel}. Перевірте оновлення для цього каналу.`;
        } else if (debugState?.status === 'update-available' && debugState.availableVersion) {
            summaryText = `Доступна новіша ${channelLabel.toLowerCase()}-версія ${debugState.availableVersion}.`;
        } else if (debugState?.status === 'dismissed' && debugState.availableVersion) {
            const untilText = formatUpdateTime(debugState.dismissedUntil);
            summaryText = untilText
                ? `Оновлення ${debugState.availableVersion} приховано до ${untilText}.`
                : `Оновлення ${debugState.availableVersion} тимчасово приховано.`;
        } else if (debugState?.status === 'up-to-date') {
            summaryText = `У вас актуальна версія ${appVersion}.`;
        } else if (debugState?.status === 'checking') {
            summaryText = 'Перевіряємо наявність новішої версії...';
        } else if (debugState?.status === 'manifest-unavailable') {
            summaryText = 'Не вдалося перевірити оновлення. Спробуйте ще раз трохи пізніше.';
        }

        settingsEls.appUpdateSummary.hidden = !summaryText;
        settingsEls.appUpdateSummary.textContent = summaryText;
    }

    if (settingsEls.appUpdateDownloadInline) {
        const downloadUrl = debugState?.downloadUrl || '';
        const availableVersion = debugState?.availableVersion || '';
        const canDownload = debugMatchesCurrentChannel && debugState?.status === 'update-available' && Boolean(downloadUrl);

        settingsEls.appUpdateDownloadInline.hidden = !canDownload;
        settingsEls.appUpdateDownloadInline.disabled = !canDownload;
        settingsEls.appUpdateDownloadInline.textContent = availableVersion
            ? `Завантажити ${availableVersion}`
            : 'Завантажити оновлення';
        settingsEls.appUpdateDownloadInline.dataset.downloadUrl = canDownload ? downloadUrl : '';
    }

    if (settingsEls.appUpdateCheckNow) {
        settingsEls.appUpdateCheckNow.hidden = false;
        settingsEls.appUpdateCheckNow.disabled = false;
        settingsEls.appUpdateCheckNow.textContent = 'Перевірити оновлення';
        settingsEls.appUpdateCheckNow.title = isNativeAndroidApp
            ? 'Перевірити наявність новішої версії'
            : 'Кнопка працює тільки в Android-додатку';
    }

    if (settingsEls.appUpdateDebugStatus) {
        if (!isDevUiMode) {
            settingsEls.appUpdateDebugStatus.hidden = true;
            settingsEls.appUpdateDebugStatus.textContent = '';
        } else {
        const checkedAt = debugState?.checkedAt
            ? new Date(debugState.checkedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : '';
        const debugParts = [];

        if (debugState?.message) {
            debugParts.push(debugState.message);
        }

        if (debugState?.manifestVersion) {
            debugParts.push(`Маніфест: ${debugState.manifestVersion}`);
        }

        if (checkedAt) {
            debugParts.push(`Перевірено: ${checkedAt}`);
        }

        const shouldHideDebugStatus = debugState?.status === 'disabled' || debugParts.length === 0;
        settingsEls.appUpdateDebugStatus.hidden = shouldHideDebugStatus;
        settingsEls.appUpdateDebugStatus.textContent = shouldHideDebugStatus
            ? ''
            : debugParts.join('\n');
        }
    }

    if (settingsEls.updateChannelGroup) {
        const shouldHide = !betaAllowed;
        settingsEls.updateChannelGroup.hidden = shouldHide;
        // Backup: также установить display:none для полной уверенности
        if (shouldHide) {
            settingsEls.updateChannelGroup.style.display = 'none';
        } else {
            settingsEls.updateChannelGroup.style.display = '';
        }
        console.log('[AppUpdate] Channel group visibility:', { betaAllowed, shouldHide, hidden: settingsEls.updateChannelGroup.hidden, installId: betaAccessState?.installId });
    }

    settingsEls.updateChannelBtns.forEach((button) => {
        const isBetaButton = button.dataset.updateChannel === 'beta';
        button.disabled = isBetaButton && !betaAllowed;
    });
    setUpdateChannelUI(effectiveChannel);

    if (settingsEls.updateChannelHelp) {
        settingsEls.updateChannelHelp.hidden = true;
        settingsEls.updateChannelHelp.textContent = '';
    }

    if (settingsEls.appVersionHint && !installIdHintResetTimer) {
        settingsEls.appVersionHint.textContent = '';
        settingsEls.appVersionHint.hidden = true;
    }
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

        if (confirm('Це повністю очистить графік, ручні зміни, нотатки і всі локальні налаштування. Свята залишяться. Продовжити?')) {
            hardResetAllData();
            return;
        }

        clearHardResetHold();
    }, HARD_RESET_HOLD_MS);
};

bindLiveColorInput(settingsEls.workColor);
bindLiveColorInput(settingsEls.offColor);
// Initialize UI after DOM is ready - don't wait, just call
refreshAppUpdateSettingsUI().catch(e => console.error('[AppUpdate] Error initializing UI:', e));

document.addEventListener('app-update:state-changed', () => {
    refreshAppUpdateSettingsUI().catch(e => console.error('[AppUpdate] Error updating UI:', e));
});

if (settingsEls.settingsBtn && settingsEls.overlay) {
    settingsEls.settingsBtn.addEventListener('click', () => {
        console.log('[AppUpdate] Settings clicked, refreshing UI');
        setSettingsOverlayOpen(true);
        refreshAppUpdateSettingsUI();
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

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && settingsEls.overlay?.classList.contains('active')) {
        setSettingsOverlayOpen(false);
    }
});

settingsEls.themeModeBtns.forEach((button) => {
    button.addEventListener('click', () => {
        selectedThemeMode = button.dataset.themeMode;
        setThemeModeUI(selectedThemeMode);
        if (applySelectedThemeMode) {
            applySelectedThemeMode(selectedThemeMode);
        }
    });
});

if (settingsEls.appVersionTrigger) {
    settingsEls.appVersionTrigger.addEventListener('click', async () => {
        appVersionTapCount += 1;

        if (appVersionTapCount < APP_VERSION_TAP_TO_ENABLE_BETA_THRESHOLD) {
            return;
        }

        appVersionTapCount = 0;

        if (!window.AppUpdate) {
            showAppVersionHint('Beta зараз недоступна');
            return;
        }

        try {
            if (window.AppUpdate.isBetaAllowedForThisInstall?.() === true) {
                window.AppUpdate.setSelectedChannel?.('beta');
                await window.AppUpdate.checkForAppUpdate?.({ manualCheck: true });
                await refreshAppUpdateSettingsUI();
                showAppVersionHint('Beta-доступ уже увімкнено');
                return;
            }

            const betaEnabled = window.AppUpdate.enableLocalBetaAccess?.() === true;
            if (!betaEnabled) {
                showAppVersionHint('Не вдалося увімкнути Beta');
                return;
            }

            await window.AppUpdate.loadBetaAccessState?.(true);
            window.AppUpdate.setSelectedChannel?.('beta');
            await window.AppUpdate.checkForAppUpdate?.({ manualCheck: true });
            await refreshAppUpdateSettingsUI();
            showAppVersionHint('Beta-доступ увімкнено');
        } catch (error) {
            console.error('[AppUpdate] Failed to enable local beta access', error);
            showAppVersionHint('Не вдалося увімкнути Beta');
        }
    });
}

settingsEls.updateChannelBtns.forEach((button) => {
    button.addEventListener('click', async () => {
        if (!window.AppUpdate) {
            return;
        }

        const nextChannel = button.dataset.updateChannel;
        window.AppUpdate.setSelectedChannel?.(nextChannel);
        await window.AppUpdate.checkForAppUpdate?.({ manualCheck: true });
        await refreshAppUpdateSettingsUI();
    });
});

if (settingsEls.appUpdateCheckNow) {
    settingsEls.appUpdateCheckNow.addEventListener('click', async () => {
        if (!window.AppUpdate) {
            return;
        }

        if (window.AppUpdate.isNativeAndroidApp?.() !== true) {
            if (settingsEls.appUpdateSummary) {
                settingsEls.appUpdateSummary.hidden = false;
                settingsEls.appUpdateSummary.textContent = 'Перевірка оновлень працює тільки в Android-додатку.';
            }
            return;
        }

        settingsEls.appUpdateCheckNow.disabled = true;
        settingsEls.appUpdateCheckNow.textContent = 'Перевіряємо...';

        try {
            await window.AppUpdate.checkForAppUpdate?.({ manualCheck: true });
            await refreshAppUpdateSettingsUI();
        } finally {
            settingsEls.appUpdateCheckNow.disabled = false;
            settingsEls.appUpdateCheckNow.textContent = 'Перевірити оновлення';
        }
    });
}

if (settingsEls.appUpdateDownloadInline) {
    settingsEls.appUpdateDownloadInline.addEventListener('click', () => {
        const downloadUrl = settingsEls.appUpdateDownloadInline.dataset.downloadUrl;
        if (!downloadUrl) {
            return;
        }

        window.AppUpdate?.openDownload?.(downloadUrl);
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
        updatePeriodStatsPanel();
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
