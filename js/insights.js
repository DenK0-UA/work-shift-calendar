const insightsEls = {
    panel: document.getElementById('insights-panel'),
    toggle: document.getElementById('period-stats-toggle'),
    caption: document.getElementById('period-stats-caption'),
    buttons: document.querySelectorAll('.period-btn'),
    work: document.getElementById('period-stat-work'),
    off: document.getElementById('period-stat-off'),
    workStreak: document.getElementById('period-stat-work-streak'),
    offStreak: document.getElementById('period-stat-off-streak'),
    custom: document.getElementById('period-stat-custom'),
    notes: document.getElementById('period-stat-notes'),
    holidays: document.getElementById('period-stat-holidays'),
    workShare: document.getElementById('period-stat-work-share')
};

let activeStatsPeriod = 'month';

function setPeriodStatsCollapsed(isCollapsed) {
    if (!insightsEls.panel || !insightsEls.toggle) return;
    insightsEls.panel.classList.toggle('is-collapsed', isCollapsed);
    insightsEls.toggle.setAttribute('aria-expanded', String(!isCollapsed));
}

function updatePeriodStatsPanel(period = activeStatsPeriod) {
    const stats = calculatePeriodStats(period);
    insightsEls.work.textContent = stats.work;
    insightsEls.off.textContent = stats.off;
    insightsEls.workStreak.textContent = `${stats.longestWorkStreak} д`;
    insightsEls.offStreak.textContent = `${stats.longestOffStreak} д`;
    insightsEls.custom.textContent = stats.customCount;
    insightsEls.notes.textContent = stats.notesCount;
    insightsEls.holidays.textContent = stats.holidayCount;
    insightsEls.workShare.textContent = `${stats.workShare}%`;

    if (insightsEls.caption) {
        insightsEls.caption.textContent = `${stats.label} · ${stats.totalDays} днів`;
    }
}

if (insightsEls.toggle) {
    insightsEls.toggle.addEventListener('click', () => {
        setPeriodStatsCollapsed(!insightsEls.panel.classList.contains('is-collapsed'));
    });
}

insightsEls.buttons.forEach((button) => {
    button.addEventListener('click', () => {
        activeStatsPeriod = button.dataset.period;
        insightsEls.buttons.forEach((item) => item.classList.toggle('active', item === button));
        updatePeriodStatsPanel(activeStatsPeriod);
    });
});

window.setPeriodStatsCollapsed = setPeriodStatsCollapsed;
window.updatePeriodStatsPanel = updatePeriodStatsPanel;
