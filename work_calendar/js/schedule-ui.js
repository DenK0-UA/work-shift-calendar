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

let selectedSchedule = hasCustomDayOverrides() ? 'custom' : getScheduleConfig().type;

scheduleEls.templateBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        selectedSchedule = btn.dataset.schedule;
        syncScheduleControls(scheduleEls, selectedSchedule);
    });
});

scheduleEls.scheduleBtn.addEventListener('click', () => {
    selectedSchedule = hasCustomDayOverrides() ? 'custom' : getScheduleConfig().type;
    syncScheduleControls(scheduleEls, selectedSchedule);
    scheduleEls.overlay.classList.add('active');
});

const closeScheduleModal = () => {
    scheduleEls.overlay.classList.remove('active');
};

scheduleEls.closeBtn.addEventListener('click', closeScheduleModal);
scheduleEls.closeBtn2.addEventListener('click', closeScheduleModal);
scheduleEls.overlay.addEventListener('click', (e) => {
    if (e.target === scheduleEls.overlay) closeScheduleModal();
});

scheduleEls.applyBtn.addEventListener('click', () => {
    let config = null;

    if (selectedSchedule === 'custom') {
        let workDays = parseInt(scheduleEls.customWorkDays.value, 10);
        let offDays = parseInt(scheduleEls.customOffDays.value, 10);
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
    clearCustomDayStatuses();
    selectedSchedule = config.type;
    syncScheduleControls(scheduleEls, selectedSchedule);
    updateSubtitle();
    updatePeriodStatsPanel(window.activeStatsPeriod || 'month');
    renderCalendar(currentState.year, currentState.month);
    closeScheduleModal();
});

window.scheduleUI = {
    sync: () => {
        selectedSchedule = hasCustomDayOverrides() ? 'custom' : getScheduleConfig().type;
        syncScheduleControls(scheduleEls, selectedSchedule);
    }
};
