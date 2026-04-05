const scheduleEls = {
    overlay: document.getElementById('schedule-overlay'),
    scheduleBtn: document.getElementById('schedule-btn'),
    closeBtn: document.getElementById('schedule-overlay-close'),
    closeBtn2: document.getElementById('schedule-overlay-close2'),
    applyBtn: document.getElementById('apply-schedule'),
    onboarding: document.getElementById('schedule-onboarding'),
    templateBtns: document.querySelectorAll('[data-schedule]'),
    customForm: document.getElementById('custom-schedule-form'),
    customWorkDays: document.getElementById('custom-work-days'),
    customOffDays: document.getElementById('custom-off-days'),
    startDate: document.getElementById('schedule-start-date')
};

let isSetupPending = !hasPersistedScheduleConfig();
let selectedSchedule = isSetupPending
    ? null
    : getScheduleConfig().type;

function updateScheduleApplyState() {
    scheduleEls.applyBtn.disabled = !selectedSchedule;
}

function syncScheduleModalState() {
    scheduleEls.overlay.classList.toggle('setup-mode', isSetupPending);
    document.body.classList.toggle('app-setup-pending', isSetupPending);
    updateScheduleApplyState();
}

function prepareScheduleOverlay(setupMode = false) {
    isSetupPending = setupMode;

    if (setupMode) {
        selectedSchedule = null;
        syncScheduleControls(scheduleEls, selectedSchedule);
    } else {
        selectedSchedule = getScheduleConfig().type;
        syncScheduleControls(scheduleEls, selectedSchedule);
    }

    syncScheduleModalState();
}

function openScheduleModal(options = {}) {
    const setupMode = options.setupMode === true;

    if (window.AppShellOverlays?.open) {
        window.AppShellOverlays.open('schedule', { setupMode, reason: options.reason || 'api' });
        return;
    }

    prepareScheduleOverlay(setupMode);
    scheduleEls.overlay.classList.add('active');
}

scheduleEls.templateBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        selectedSchedule = btn.dataset.schedule;
        syncScheduleControls(scheduleEls, selectedSchedule, { preserveDraft: true });
        updateScheduleApplyState();
    });
});

const closeScheduleModal = () => {
    if (isSetupPending) {
        return false;
    }

    scheduleEls.overlay.classList.remove('active');
    return true;
};

const scheduleOverlayController = window.AppShellOverlays?.registerOverlay({
    id: 'schedule',
    overlay: scheduleEls.overlay,
    openButtons: scheduleEls.scheduleBtn,
    closeButtons: [scheduleEls.closeBtn, scheduleEls.closeBtn2],
    onOpen: ({ setupMode = false } = {}) => {
        prepareScheduleOverlay(setupMode);
        scheduleEls.overlay.classList.add('active');
        return true;
    },
    onClose: () => closeScheduleModal()
});

if (!scheduleOverlayController) {
    scheduleEls.scheduleBtn.addEventListener('click', () => {
        openScheduleModal();
    });

    scheduleEls.closeBtn.addEventListener('click', closeScheduleModal);
    scheduleEls.closeBtn2.addEventListener('click', closeScheduleModal);
    scheduleEls.overlay.addEventListener('click', (e) => {
        if (e.target === scheduleEls.overlay) closeScheduleModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && scheduleEls.overlay.classList.contains('active')) {
            closeScheduleModal();
        }
    });
}

scheduleEls.applyBtn.addEventListener('click', () => {
    if (!selectedSchedule) {
        alert('Спочатку виберіть графік.');
        return;
    }

    let config = null;

    if (selectedSchedule === 'custom') {
        let workDays = parseInt(scheduleEls.customWorkDays.value, 10);
        let offDays = parseInt(scheduleEls.customOffDays.value, 10);
        if (Number.isNaN(workDays)) workDays = 5;
        if (Number.isNaN(offDays)) offDays = 5;
        if (workDays < 0) workDays = 0;
        if (offDays < 0) offDays = 0;

        if (workDays + offDays <= 0) {
            alert('Так не вийде: у циклі має бути хоча б один день. Поставили 5/5.');
            workDays = 5;
            offDays = 5;
            selectedSchedule = '5/5';
        }

        const startDateValue = scheduleEls.startDate.value;
        const startDate = parseDateInputValueAsUtcIso(startDateValue);
        config = {
            type: selectedSchedule === 'custom' ? 'custom' : selectedSchedule,
            workDays,
            offDays,
            startDate
        };
    } else {
        const [work, off] = selectedSchedule.split('/').map(Number);
        let workDays = Number.isNaN(work) ? 5 : work;
        let offDays = Number.isNaN(off) ? 5 : off;
        const startDateValue = scheduleEls.startDate.value;
        const startDate = parseDateInputValueAsUtcIso(startDateValue);

        if (workDays + offDays <= 0) {
            alert('Щось не так із цим циклом. Повернули 5/5.');
            workDays = 5;
            offDays = 5;
            selectedSchedule = '5/5';
        }

        config = { type: selectedSchedule, workDays, offDays, startDate };
    }

    setScheduleConfig(config);
    clearCustomDayStatuses();
    selectedSchedule = config.type;
    isSetupPending = false;
    syncScheduleControls(scheduleEls, selectedSchedule);
    syncScheduleModalState();
    updateSubtitle();
    updatePeriodStatsPanel();
    renderCalendar(currentState.year, currentState.month);
    fetchTodayWeather();
    closeScheduleModal();
});

window.scheduleUI = {
    isSetupPending: () => isSetupPending,
    openOnboarding: () => openScheduleModal({ setupMode: true }),
    sync: () => {
        selectedSchedule = isSetupPending
            ? null
            : getScheduleConfig().type;
        syncScheduleControls(scheduleEls, selectedSchedule);
        syncScheduleModalState();
    }
};
