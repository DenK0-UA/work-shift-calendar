// --- Логіка Графіка (з динамічною підтримкою) ---
function getScheduleConfig() {
    try {
        const saved = localStorage.getItem('scheduleConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.type && typeof parsed.workDays === 'number' && typeof parsed.offDays === 'number') {
                if (!parsed.startDate) {
                    parsed.startDate = DEFAULT_SHIFT_START_DATE.toISOString();
                }
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Не вдалось зчитати конфіг графіку', e);
    }
    return getDefaultScheduleConfig();
}

function setScheduleConfig(config) {
    try {
        if (!config.startDate) {
            config.startDate = DEFAULT_SHIFT_START_DATE.toISOString();
        }
        localStorage.setItem('scheduleConfig', JSON.stringify(config));
    } catch (e) {
        console.warn('Не вдалось зберегти графік', e);
    }
}

function getDayStatus(year, month, day) {
    // Спочатку перевіряємо пользовательский статус
    const customStatus = getCustomDayStatus(year, month, day);
    if (customStatus) return customStatus;

    // Отримуємо поточний графік конфіг
    const schedule = getScheduleConfig();
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

// --- Управління пользовательскими статусами днів ---
function getCustomDayStatus(year, month, day) {
    try {
        const customs = JSON.parse(localStorage.getItem('customDayStatuses') || '{}');
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return customs[key] || null;
    } catch (e) {
        return null;
    }
}

function setCustomDayStatus(year, month, day, status) {
    try {
        const customs = JSON.parse(localStorage.getItem('customDayStatuses') || '{}');
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (status === null) {
            delete customs[key];
        } else {
            customs[key] = status;
        }
        localStorage.setItem('customDayStatuses', JSON.stringify(customs));
    } catch (e) {
        console.warn('Не вдалось зберегти статус дня', e);
    }
}

function getCustomDayStatuses() {
    try {
        return JSON.parse(localStorage.getItem('customDayStatuses') || '{}');
    } catch (e) {
        return {};
    }
}

function getDayStorageKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDayNote(year, month, day) {
    try {
        const notes = JSON.parse(localStorage.getItem('dayNotes') || '{}');
        return notes[getDayStorageKey(year, month, day)] || '';
    } catch (e) {
        return '';
    }
}

function setDayNote(year, month, day, note) {
    try {
        const notes = JSON.parse(localStorage.getItem('dayNotes') || '{}');
        const key = getDayStorageKey(year, month, day);
        const normalizedNote = typeof note === 'string' ? note.trim() : '';

        if (!normalizedNote) {
            delete notes[key];
        } else {
            notes[key] = normalizedNote;
        }

        localStorage.setItem('dayNotes', JSON.stringify(notes));
    } catch (e) {
        console.warn('Не вдалось зберегти нотатку дня', e);
    }
}

function toggleDayStatus(year, month, day) {
    const current = getDayStatus(year, month, day);
    const newStatus = current === 'work' ? 'off' : 'work';
    setCustomDayStatus(year, month, day, newStatus);
    renderCalendar(currentState.year, currentState.month);
}

function syncScheduleControls(scheduleEls, selectedSchedule) {
    const schedule = getScheduleConfig();

    scheduleEls.templateBtns.forEach((btn) => {
        if (btn.dataset.schedule === selectedSchedule) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Показуємо кастомну форму якщо вибрано custom
    if (selectedSchedule === 'custom') {
        scheduleEls.customForm.classList.add('active');
    } else {
        scheduleEls.customForm.classList.remove('active');
    }

    // Заповнюємо поля за збереженим графіком
    scheduleEls.customWorkDays.value = schedule.workDays;
    scheduleEls.customOffDays.value = schedule.offDays;
    scheduleEls.startDate.value = schedule.startDate ? schedule.startDate.slice(0, 10) : DEFAULT_SHIFT_START_DATE.toISOString().slice(0, 10);
}

function updateSubtitle() {
    const schedule = getScheduleConfig();
    const subtitle = document.querySelector('.subtitle');
    if (!subtitle) return;
    let startDate = schedule.startDate;
    if (startDate) {
        const d = new Date(startDate);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        startDate = `${day}.${month}.${year}`;
    } else {
        startDate = '27.03.2026';
    }
    subtitle.textContent = `Графік ${schedule.type}. Старт: ${startDate}`;
}

function getPeriodRange(period, year = currentState.year, month = currentState.month) {
    if (period === 'year') {
        return {
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31),
            label: `${year} рік`
        };
    }

    if (period === 'quarter') {
        return {
            start: new Date(year, month, 1),
            end: new Date(year, month + 3, 0),
            label: `${localeData.months[month]} + 2 міс.`
        };
    }

    return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
        label: `${localeData.months[month]} ${year}`
    };
}

function calculatePeriodStats(period, year = currentState.year, month = currentState.month) {
    const range = getPeriodRange(period, year, month);
    const customStatuses = getCustomDayStatuses();
    let work = 0;
    let off = 0;
    let currentWorkStreak = 0;
    let currentOffStreak = 0;
    let maxWorkStreak = 0;
    let maxOffStreak = 0;
    let customCount = 0;

    for (let date = new Date(range.start); date <= range.end; date.setDate(date.getDate() + 1)) {
        const yearValue = date.getFullYear();
        const monthValue = date.getMonth();
        const dayValue = date.getDate();
        const status = getDayStatus(yearValue, monthValue, dayValue);
        const key = `${yearValue}-${String(monthValue + 1).padStart(2, '0')}-${String(dayValue).padStart(2, '0')}`;

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
        longestStreak: Math.max(maxWorkStreak, maxOffStreak),
        longestStreakLabel: maxWorkStreak >= maxOffStreak ? 'роб.' : 'вих.'
    };
}

function updatePeriodStatsPanel(period) {
    const stats = calculatePeriodStats(period);
    const caption = document.getElementById('period-stats-caption');

    document.getElementById('period-stat-work').textContent = stats.work;
    document.getElementById('period-stat-off').textContent = stats.off;
    document.getElementById('period-stat-streak').textContent = `${stats.longestStreak} ${stats.longestStreakLabel}`;
    document.getElementById('period-stat-custom').textContent = stats.customCount;

    if (caption) {
        caption.textContent = `Огляд періоду: ${stats.label}`;
    }
}
