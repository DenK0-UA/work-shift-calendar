const SCHEDULE_STORAGE_KEYS = {
    scheduleConfig: 'scheduleConfig',
    customDayStatuses: 'customDayStatuses',
    dayNotes: 'dayNotes'
};

// Expose so settings-state.js can reference without duplication
window.SCHEDULE_STORAGE_KEYS = SCHEDULE_STORAGE_KEYS;

const scheduleStore = {
    scheduleConfig: null,
    customDayStatuses: null,
    dayNotes: null
};

function safeReadJson(key, fallback) {
    try {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
            return fallback;
        }

        const parsed = JSON.parse(rawValue);
        return parsed ?? fallback;
    } catch (e) {
        return fallback;
    }
}

function hasPersistedScheduleConfig() {
    try {
        return Boolean(localStorage.getItem(SCHEDULE_STORAGE_KEYS.scheduleConfig));
    } catch (e) {
        return false;
    }
}

function cloneRecord(record) {
    return { ...record };
}

function parseDateInputValueAsUtcIso(dateValue) {
    if (typeof dateValue !== 'string' || !dateValue) {
        return DEFAULT_SHIFT_START_DATE.toISOString();
    }

    const [year, month, day] = dateValue.split('-').map(Number);
    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
    ) {
        return DEFAULT_SHIFT_START_DATE.toISOString();
    }

    return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function formatScheduleStartDateForInput(startDate) {
    if (!startDate) {
        return DEFAULT_SHIFT_START_DATE.toISOString().slice(0, 10);
    }

    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) {
        return DEFAULT_SHIFT_START_DATE.toISOString().slice(0, 10);
    }

    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getNormalizedScheduleConfig(config) {
    const fallback = getDefaultScheduleConfig();
    const workDays = Number.isInteger(config?.workDays) ? config.workDays : fallback.workDays;
    const offDays = Number.isInteger(config?.offDays) ? config.offDays : fallback.offDays;

    return {
        type: config?.type || fallback.type,
        workDays,
        offDays,
        startDate: config?.startDate
            ? parseDateInputValueAsUtcIso(formatScheduleStartDateForInput(config.startDate))
            : DEFAULT_SHIFT_START_DATE.toISOString()
    };
}

function ensureScheduleConfigState() {
    if (!scheduleStore.scheduleConfig) {
        const savedConfig = safeReadJson(SCHEDULE_STORAGE_KEYS.scheduleConfig, null);
        scheduleStore.scheduleConfig = savedConfig
            ? getNormalizedScheduleConfig(savedConfig)
            : getDefaultScheduleConfig();
    }

    return scheduleStore.scheduleConfig;
}

function ensureCustomStatusesState() {
    if (!scheduleStore.customDayStatuses) {
        scheduleStore.customDayStatuses = safeReadJson(SCHEDULE_STORAGE_KEYS.customDayStatuses, {});
    }

    return scheduleStore.customDayStatuses;
}

function ensureDayNotesState() {
    if (!scheduleStore.dayNotes) {
        scheduleStore.dayNotes = safeReadJson(SCHEDULE_STORAGE_KEYS.dayNotes, {});
    }

    return scheduleStore.dayNotes;
}

function persistScheduleConfig() {
    try {
        localStorage.setItem(
            SCHEDULE_STORAGE_KEYS.scheduleConfig,
            JSON.stringify(scheduleStore.scheduleConfig)
        );
    } catch (e) {
        console.warn('Не вдалось зберегти графік', e);
    }
}

function persistCustomStatuses() {
    try {
        const statuses = ensureCustomStatusesState();
        if (Object.keys(statuses).length === 0) {
            localStorage.removeItem(SCHEDULE_STORAGE_KEYS.customDayStatuses);
            return;
        }

        localStorage.setItem(
            SCHEDULE_STORAGE_KEYS.customDayStatuses,
            JSON.stringify(statuses)
        );
    } catch (e) {
        console.warn('Не вдалось зберегти статус дня', e);
    }
}

function persistDayNotes() {
    try {
        const notes = ensureDayNotesState();
        if (Object.keys(notes).length === 0) {
            localStorage.removeItem(SCHEDULE_STORAGE_KEYS.dayNotes);
            return;
        }

        localStorage.setItem(SCHEDULE_STORAGE_KEYS.dayNotes, JSON.stringify(notes));
    } catch (e) {
        console.warn('Не вдалось зберегти нотатку дня', e);
    }
}

// --- Логіка Графіка (з динамічною підтримкою) ---
function getScheduleConfig() {
    return { ...ensureScheduleConfigState() };
}

function setScheduleConfig(config) {
    scheduleStore.scheduleConfig = getNormalizedScheduleConfig(config);
    persistScheduleConfig();
}

function getScheduledDayStatus(year, month, day) {
    const schedule = ensureScheduleConfigState();
    const cycleDays = schedule.workDays + schedule.offDays;
    if (cycleDays <= 0) {
        return 'off';
    }

    const targetDateUtc = Date.UTC(year, month, day);
    const startDateUtc = getShiftStartDateUTC();
    const diffDays = Math.floor((targetDateUtc - startDateUtc) / (1000 * 60 * 60 * 24));
    const cycleDay = ((diffDays % cycleDays) + cycleDays) % cycleDays;
    return cycleDay < schedule.workDays ? 'work' : 'off';
}

function getDayStatus(year, month, day) {
    const customStatus = getCustomDayStatus(year, month, day);
    if (customStatus) return customStatus;
    return getScheduledDayStatus(year, month, day);
}

// --- Управління ручними статусами днів ---
function getDayStorageKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getCustomDayStatus(year, month, day) {
    return ensureCustomStatusesState()[getDayStorageKey(year, month, day)] || null;
}

function setCustomDayStatus(year, month, day, status) {
    const statuses = ensureCustomStatusesState();
    const key = getDayStorageKey(year, month, day);

    if (status === null) {
        delete statuses[key];
    } else {
        statuses[key] = status;
    }

    persistCustomStatuses();
}

function getCustomDayStatuses() {
    return cloneRecord(ensureCustomStatusesState());
}

function clearCustomDayStatuses() {
    scheduleStore.customDayStatuses = {};
    persistCustomStatuses();
}

function getDayNote(year, month, day) {
    return ensureDayNotesState()[getDayStorageKey(year, month, day)] || '';
}

function setDayNote(year, month, day, note) {
    const notes = ensureDayNotesState();
    const key = getDayStorageKey(year, month, day);
    const normalizedNote = typeof note === 'string' ? note.trim() : '';

    if (!normalizedNote) {
        delete notes[key];
    } else {
        notes[key] = normalizedNote;
    }

    persistDayNotes();
}

function normalizeCustomDayStatus(year, month, day, status) {
    if (status === null) {
        return null;
    }

    const scheduledStatus = getScheduledDayStatus(year, month, day);
    return status === scheduledStatus ? null : status;
}

function setDayStatusOverride(year, month, day, status) {
    setCustomDayStatus(year, month, day, normalizeCustomDayStatus(year, month, day, status));
}

function toggleDayStatus(year, month, day) {
    const current = getDayStatus(year, month, day);
    const newStatus = current === 'work' ? 'off' : 'work';
    setDayStatusOverride(year, month, day, newStatus);
    renderCalendar(currentState.year, currentState.month);
}

function syncScheduleControls(scheduleEls, selectedSchedule, options = {}) {
    const schedule = ensureScheduleConfigState();
    const preserveDraft = options.preserveDraft === true;

    scheduleEls.templateBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.schedule === selectedSchedule);
    });

    scheduleEls.customForm.classList.toggle('active', selectedSchedule === 'custom');

    if (!preserveDraft) {
        scheduleEls.customWorkDays.value = schedule.workDays;
        scheduleEls.customOffDays.value = schedule.offDays;
        scheduleEls.startDate.value = formatScheduleStartDateForInput(schedule.startDate);
    }
}

function updateSubtitle() {
    const schedule = ensureScheduleConfigState();
    const subtitle = document.querySelector('.subtitle');
    if (!subtitle) return;

    const startDate = schedule.startDate
        ? (() => {
            const date = new Date(schedule.startDate);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${day}.${month}.${year}`;
        })()
        : (() => {
            const today = DEFAULT_SHIFT_START_DATE;
            const year = today.getUTCFullYear();
            const month = String(today.getUTCMonth() + 1).padStart(2, '0');
            const day = String(today.getUTCDate()).padStart(2, '0');
            return `${day}.${month}.${year}`;
        })();

    subtitle.textContent = `Графік ${schedule.type}. Старт: ${startDate}`;
}

function getPeriodRange(period, year = currentState.year, month = currentState.month) {
    if (period === 'year') {
        return {
            start: new Date(Date.UTC(year, 0, 1)),
            end: new Date(Date.UTC(year, 11, 31)),
            label: `${year} рік`
        };
    }

    if (period === 'quarter') {
        return {
            start: new Date(Date.UTC(year, month, 1)),
            end: new Date(Date.UTC(year, month + 3, 0)),
            label: `${localeData.months[month]} + 2 міс.`
        };
    }

    return {
        start: new Date(Date.UTC(year, month, 1)),
        end: new Date(Date.UTC(year, month + 1, 0)),
        label: `${localeData.months[month]} ${year}`
    };
}

function calculatePeriodStats(period, year = currentState.year, month = currentState.month) {
    const range = getPeriodRange(period, year, month);
    const customStatuses = ensureCustomStatusesState();
    let work = 0;
    let off = 0;
    let currentWorkStreak = 0;
    let currentOffStreak = 0;
    let maxWorkStreak = 0;
    let maxOffStreak = 0;
    let customCount = 0;

    for (let date = new Date(range.start); date <= range.end; date.setUTCDate(date.getUTCDate() + 1)) {
        const yearValue = date.getUTCFullYear();
        const monthValue = date.getUTCMonth();
        const dayValue = date.getUTCDate();
        const key = getDayStorageKey(yearValue, monthValue, dayValue);
        const status = customStatuses[key] || getScheduledDayStatus(yearValue, monthValue, dayValue);

        if (customStatuses[key]) {
            customCount++;
        }

        if (status === 'work') {
            work++;
            currentWorkStreak++;
            currentOffStreak = 0;
            maxWorkStreak = Math.max(maxWorkStreak, currentWorkStreak);
        } else {
            off++;
            currentOffStreak++;
            currentWorkStreak = 0;
            maxOffStreak = Math.max(maxOffStreak, currentOffStreak);
        }
    }

    return {
        label: range.label,
        work,
        off,
        customCount,
        longestWorkStreak: maxWorkStreak,
        longestOffStreak: maxOffStreak,
        totalDays: work + off
    };
}
