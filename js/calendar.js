// --- DOM Елементи ---
const calendarEls = {
    grid: document.getElementById('calendar-grid'),
    monthTitle: document.getElementById('month-year-display'),
    statWork: document.getElementById('stat-work'),
    statOff: document.getElementById('stat-off'),
    modal: document.getElementById('modal'),
    modalDate: document.getElementById('m-date'),
    modalDayWeek: document.getElementById('m-day-week'),
    modalHoliday: document.getElementById('m-holiday'),
    modalClose: document.getElementById('modal-close'),
    legendItems: document.querySelectorAll('.stat-item'),
    magneticBtns: document.querySelectorAll('[data-magnetic]'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    todayBtn: document.getElementById('today-btn')
};

const modalStatusEls = {
    badge: document.getElementById('m-badge'),
    text: document.getElementById('m-status-text'),
    caption: document.getElementById('m-status-caption'),
    setWork: document.getElementById('m-set-work'),
    setOff: document.getElementById('m-set-off'),
    reset: document.getElementById('m-reset-status')
};

const modalNoteEls = {
    block: document.getElementById('m-note-block'),
    input: document.getElementById('m-note-input'),
    actions: document.getElementById('m-note-actions'),
    save: document.getElementById('m-note-save'),
    clear: document.getElementById('m-note-clear')
};

const undoEls = {
    toast: document.getElementById('undo-toast'),
    text: document.getElementById('undo-toast-text'),
    button: document.getElementById('undo-toast-btn')
};

let activeModalDate = null;
let activeModalSavedNote = '';
let activeModalStatusMeta = null;
let pendingUndoState = null;
let undoToastTimerId = null;
let activeFilter = null;
let calendarAnimationFrameId = null;
const renderedDayEls = [];
const supportsInteractiveHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const UI_REVEAL_DURATION_MS = 260;
const UI_TILT_RESET_DURATION_MS = 320;
const MODAL_SECTION_REVEAL_DURATION_MS = UI_REVEAL_DURATION_MS;

function setModalSectionOpen(sectionEl, isOpen) {
    if (!sectionEl) return;

    if (sectionEl._hideTimerId) {
        clearTimeout(sectionEl._hideTimerId);
        sectionEl._hideTimerId = null;
    }

    if (isOpen) {
        sectionEl.classList.add('is-collapsed');
        sectionEl.hidden = false;
        requestAnimationFrame(() => {
            sectionEl.classList.remove('is-collapsed');
        });
        return;
    }

    sectionEl.classList.add('is-collapsed');
    sectionEl._hideTimerId = window.setTimeout(() => {
        sectionEl.hidden = true;
        sectionEl._hideTimerId = null;
    }, MODAL_SECTION_REVEAL_DURATION_MS);
}

function getDayStatusLabel(status) {
    return status === 'work' ? 'Робочий день' : 'Вихідний день';
}

function getDayStatusChangeLabel(status) {
    return status === 'work' ? 'робочий день' : 'вихідний день';
}

function getStatusActionCaption(scheduledStatus, customStatus) {
    if (customStatus) {
        return `Вручну змінено. За графіком тут ${getDayStatusChangeLabel(scheduledStatus)}.`;
    }

    return `Статус визначено Вашим графіком: ${getDayStatusChangeLabel(scheduledStatus)}.`;
}

function updateModalStatusBadge(status) {
    modalStatusEls.badge.dataset.status = status;
    modalStatusEls.text.textContent = getDayStatusLabel(status);
}

function updateModalStatusActions() {
    if (!activeModalStatusMeta) return;

    const { currentStatus, customStatus, scheduledStatus } = activeModalStatusMeta;
    modalStatusEls.setWork.classList.toggle('active', currentStatus === 'work');
    modalStatusEls.setOff.classList.toggle('active', currentStatus === 'off');
    modalStatusEls.reset.classList.toggle('active', customStatus === null);
    modalStatusEls.caption.textContent = getStatusActionCaption(scheduledStatus, customStatus);
}

function syncModalStatusMeta(year, month, day) {
    activeModalStatusMeta = {
        scheduledStatus: getScheduledDayStatus(year, month, day),
        customStatus: getCustomDayStatus(year, month, day),
        currentStatus: getDayStatus(year, month, day)
    };

    updateModalStatusBadge(activeModalStatusMeta.currentStatus);
    updateModalStatusActions();
}

function hideUndoToast() {
    if (undoToastTimerId) {
        clearTimeout(undoToastTimerId);
        undoToastTimerId = null;
    }

    pendingUndoState = null;
    undoEls.toast.classList.remove('active');
}

function showUndoToast(message, undoState) {
    pendingUndoState = undoState;
    undoEls.text.textContent = message;
    undoEls.toast.classList.add('active');

    if (undoToastTimerId) {
        clearTimeout(undoToastTimerId);
    }

    undoToastTimerId = window.setTimeout(() => {
        hideUndoToast();
    }, 3000);
}

function applyDayStatusChange(nextStatus) {
    if (!activeModalDate) return;

    const { year, month, day } = activeModalDate;
    const previousCustomStatus = getCustomDayStatus(year, month, day);
    const normalizedNextStatus = nextStatus === null ? null : normalizeCustomDayStatus(year, month, day, nextStatus);

    if (previousCustomStatus === normalizedNextStatus) {
        return;
    }

    setCustomDayStatus(year, month, day, normalizedNextStatus);
    renderCalendar(currentState.year, currentState.month);
    syncModalStatusMeta(year, month, day);

    const changedTo = getDayStatus(year, month, day);
    const undoLabel = normalizedNextStatus === null
        ? 'За графіком'
        : changedTo === 'work'
            ? 'Робочий день'
            : 'Вихідний день';

    showUndoToast(undoLabel, { year, month, day, previousCustomStatus });
}

function undoLastDayStatusChange() {
    if (!pendingUndoState) return;

    const { year, month, day, previousCustomStatus } = pendingUndoState;
    setCustomDayStatus(year, month, day, previousCustomStatus);
    renderCalendar(currentState.year, currentState.month);

    if (
        activeModalDate &&
        activeModalDate.year === year &&
        activeModalDate.month === month &&
        activeModalDate.day === day &&
        calendarEls.modal.classList.contains('active')
    ) {
        syncModalStatusMeta(year, month, day);
    }

    hideUndoToast();
}

function queueCalendarEnterAnimation() {
    calendarEls.grid.classList.remove('fluid-enter');

    if (calendarAnimationFrameId) {
        cancelAnimationFrame(calendarAnimationFrameId);
    }

    calendarAnimationFrameId = requestAnimationFrame(() => {
        calendarEls.grid.classList.add('fluid-enter');
        calendarAnimationFrameId = null;
    });
}

function syncSelectedDayCell() {
    renderedDayEls.forEach((dayEl) => {
        const isSelected = Boolean(
            activeModalDate &&
            Number(dayEl.dataset.year) === activeModalDate.year &&
            Number(dayEl.dataset.month) === activeModalDate.month &&
            Number(dayEl.dataset.day) === activeModalDate.day
        );
        dayEl.classList.toggle('selected', isSelected);
    });
}

function createDayCell(year, month, day, dayStatus, isToday, holidayName, customStatus) {
    const dayEl = document.createElement('div');
    dayEl.className = `day ${isToday ? 'today' : ''}`;
    dayEl.dataset.status = dayStatus;
    dayEl.dataset.year = String(year);
    dayEl.dataset.month = String(month);
    dayEl.dataset.day = String(day);
    dayEl.dataset.manual = customStatus ? 'true' : 'false';
    dayEl.tabIndex = 0;
    dayEl.setAttribute('role', 'button');
    const dayAriaLabel = holidayName
        ? `${day} ${localeData.months[month]} ${year}. Свято: ${holidayName}.`
        : `${day} ${localeData.months[month]} ${year}`;
    dayEl.setAttribute('aria-label', dayAriaLabel);

    if (holidayName) {
        dayEl.dataset.holiday = holidayName;
    }

    const dateNum = document.createElement('span');
    dateNum.className = 'date-num';
    dateNum.textContent = String(day);
    dayEl.appendChild(dateNum);

    if (holidayName) {
        const holidayMarker = document.createElement('div');
        holidayMarker.className = 'holiday-marker';
        dayEl.appendChild(holidayMarker);
    }

    // --- Профілі колег: оверлей точки ---
    if (typeof getVisibleProfilesForDay === 'function') {
        const profileStatuses = getVisibleProfilesForDay(year, month, day);
        const workingProfiles = profileStatuses.filter(p => p.status === 'work');
        if (workingProfiles.length > 0) {
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'profile-dots';
            const maxVisibleSlots = 3;
            const hasOverflow = workingProfiles.length > maxVisibleSlots;
            const maxColoredDots = hasOverflow ? maxVisibleSlots - 1 : maxVisibleSlots;
            const toShow = workingProfiles.slice(0, maxColoredDots);
            toShow.forEach(p => {
                const dot = document.createElement('span');
                dot.className = 'profile-dot';
                dot.style.background = p.color;
                dot.title = p.name;
                dotsContainer.appendChild(dot);
            });
            if (hasOverflow) {
                const more = document.createElement('span');
                more.className = 'profile-dot profile-dot-more';
                more.textContent = '+';
                more.title = `Ще ${workingProfiles.length - (maxVisibleSlots - 1)} графік(и)`;
                dotsContainer.appendChild(more);
            }
            dayEl.appendChild(dotsContainer);
        }
    }

    dayEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        openModal(year, month, day, holidayName || '');
    });

    if (supportsInteractiveHover && window.innerWidth >= 1280) {
        setup3DTilt(dayEl);
    }

    renderedDayEls.push(dayEl);
    return dayEl;
}

function applyModalHolidayState(holidayName) {
    if (holidayName) {
        calendarEls.modalHoliday.textContent = holidayName;
        calendarEls.modalHoliday.classList.add('active');
        return;
    }

    calendarEls.modalHoliday.textContent = '';
    calendarEls.modalHoliday.classList.remove('active');
}

function updateLegendStats(stats) {
    calendarEls.statWork.textContent = String(stats.work);
    calendarEls.statOff.textContent = String(stats.off);
}

function applyActiveFilter() {
    calendarEls.legendItems.forEach((item) => {
        item.classList.toggle('is-active', item.dataset.status === activeFilter);
    });

    if (!activeFilter) {
        calendarEls.grid.classList.remove('grid-dim');
        renderedDayEls.forEach((dayEl) => dayEl.classList.remove('filtered'));
        return;
    }

    calendarEls.grid.classList.add('grid-dim');
    renderedDayEls.forEach((dayEl) => {
        dayEl.classList.toggle('filtered', dayEl.dataset.status === activeFilter);
    });
}

// --- Рендер Календаря ---
function renderCalendar(year, month) {
    ensureHolidayDataForYear(year);
    queueCalendarEnterAnimation();
    renderedDayEls.length = 0;
    calendarEls.monthTitle.textContent = `${localeData.months[month]} ${year}`;

    const fragment = document.createDocumentFragment();
    const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const stats = { work: 0, off: 0 };

    for (let i = 0; i < paddingDays; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'day empty';
        fragment.appendChild(emptyDiv);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayStatus = getDayStatus(year, month, day);
        const customStatus = getCustomDayStatus(year, month, day);
        stats[dayStatus]++;

        const isToday = (
            year === DEMO_TODAY.getFullYear() &&
            month === DEMO_TODAY.getMonth() &&
            day === DEMO_TODAY.getDate()
        );
        const holidayName = getHolidayName(year, month, day);

        fragment.appendChild(createDayCell(year, month, day, dayStatus, isToday, holidayName, customStatus));
    }

    calendarEls.grid.replaceChildren(fragment);
    updateLegendStats(stats);
    updateSubtitle();
    if (typeof updatePeriodStatsPanel === 'function') {
        updatePeriodStatsPanel();
    }
    applyActiveFilter();
    syncSelectedDayCell();

    if (activeModalDate && calendarEls.modal.classList.contains('active')) {
        applyModalHolidayState(getHolidayName(activeModalDate.year, activeModalDate.month, activeModalDate.day));
    }
}

// --- 3D Ефекти ---
function setup3DTilt(el) {
    let frameId = null;
    let resetTransitionTimer = null;

    el.addEventListener('mousemove', (e) => {
        if (window.innerWidth < 768) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -15;
        const rotateY = ((x - centerX) / centerX) * 15;
        const shadowX = rotateY * -0.5;
        const shadowY = rotateX * 0.5;

        if (frameId) {
            cancelAnimationFrame(frameId);
        }

        frameId = requestAnimationFrame(() => {
            el.style.transform = `scale(1.06) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
            el.style.boxShadow = `${shadowX}px ${shadowY}px 25px rgba(0,0,0,0.12)`;
            frameId = null;
        });
    });

    el.addEventListener('mouseleave', () => {
        if (frameId) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        if (resetTransitionTimer) {
            clearTimeout(resetTransitionTimer);
        }
        el.style.transition = 'transform var(--motion-duration-slow) var(--motion-ease-standard), box-shadow var(--motion-duration-slow) var(--motion-ease-standard)';
        el.style.transform = 'scale(1) rotateX(0) rotateY(0) translateZ(0)';
        el.style.boxShadow = 'none';
        resetTransitionTimer = window.setTimeout(() => {
            el.style.transition = 'box-shadow var(--motion-duration-base) var(--motion-ease-exit)';
            resetTransitionTimer = null;
        }, UI_TILT_RESET_DURATION_MS);
    });
}

// --- Фільтрація Легенди ---
const clearFilters = () => {
    activeFilter = null;
    applyActiveFilter();
};

calendarEls.legendItems.forEach((item) => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const status = item.dataset.status;
        activeFilter = activeFilter === status ? null : status;
        applyActiveFilter();
    });
});

window.addEventListener('click', (e) => {
    if (activeFilter && !e.target.closest('#stats-container')) clearFilters();
});

// --- Магнітні кнопки ---
calendarEls.magneticBtns.forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.4}px)`;
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0, 0)';
    });
});

// --- Модальне Вікно ---
function openModal(year, month, day, holidayName) {
    activeModalDate = { year, month, day };
    calendarEls.modal.dataset.year = String(year);
    calendarEls.modal.dataset.month = String(month);
    calendarEls.modal.dataset.day = String(day);
    calendarEls.modalDate.textContent = String(day);

    const dateObj = new Date(Date.UTC(year, month, day));
    const dayOfWeek = localeData.days[dateObj.getUTCDay()];
    calendarEls.modalDayWeek.textContent = `${dayOfWeek}, ${localeData.months[month].toLowerCase()} ${year}`;

    if (holidayName) {
        calendarEls.modalHoliday.textContent = holidayName;
        calendarEls.modalHoliday.classList.add('active');
    } else {
        calendarEls.modalHoliday.textContent = '';
        calendarEls.modalHoliday.classList.remove('active');
    }

    syncModalStatusMeta(year, month, day);
    updateModalWeather(year, month, day);
    activeModalSavedNote = getDayNote(year, month, day);
    modalNoteEls.input.value = activeModalSavedNote;
    updateModalNoteActions();
    renderModalProfiles(year, month, day);

    calendarEls.modal.classList.add('active');
    syncSelectedDayCell();
}

function renderModalProfiles(year, month, day) {
    const container = document.getElementById('m-profiles');
    if (!container) return;

    if (typeof getVisibleProfilesForDay !== 'function') {
        setModalSectionOpen(container, false);
        return;
    }

    const allProfiles = typeof getProfiles === 'function' ? getProfiles() : [];
    if (allProfiles.length === 0) {
        setModalSectionOpen(container, false);
        return;
    }

    const profileStatuses = allProfiles.map(p => ({
        ...p,
        status: getProfileDayStatus(p, year, month, day),
        isVisible: p.visible !== false
    }));

    setModalSectionOpen(container, true);
    container.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'modal-profiles-inner';

    const heading = document.createElement('div');
    heading.className = 'modal-profiles-heading';
    heading.textContent = 'Графіки';
    inner.appendChild(heading);

    profileStatuses.forEach(p => {
        const row = document.createElement('div');
        row.className = 'modal-profile-row';
        if (!p.isVisible) row.classList.add('dimmed');

        const dot = document.createElement('span');
        dot.className = 'modal-profile-dot';
        dot.style.background = p.color;

        const nameEl = document.createElement('span');
        nameEl.className = 'modal-profile-name';
        nameEl.textContent = p.name;

        const badge = document.createElement('span');
        badge.className = 'modal-profile-badge';
        badge.dataset.status = p.status;
        badge.textContent = p.status === 'work' ? 'Робочий' : 'Вихідний';

        row.appendChild(dot);
        row.appendChild(nameEl);
        row.appendChild(badge);
        inner.appendChild(row);
    });

    container.appendChild(inner);
}

function updateModalNoteActions() {
    const currentValue = modalNoteEls.input.value.trim();
    const hasText = currentValue.length > 0;
    const isChanged = currentValue !== activeModalSavedNote;

    modalNoteEls.actions.classList.toggle('active', hasText || isChanged);
}

function saveModalNote() {
    if (!activeModalDate) return;

    const note = modalNoteEls.input.value.trim();
    setDayNote(activeModalDate.year, activeModalDate.month, activeModalDate.day, note);
    activeModalSavedNote = note;
    modalNoteEls.input.value = note;
    updateModalNoteActions();
}

function clearModalNote() {
    modalNoteEls.input.value = '';
    saveModalNote();
    closeModal();
}

function resetModalNote() {
    modalNoteEls.input.value = activeModalSavedNote;
    updateModalNoteActions();
}

const closeModal = () => {
    resetModalNote();
    activeModalDate = null;
    activeModalStatusMeta = null;
    calendarEls.modal.classList.remove('active');
    syncSelectedDayCell();
};

calendarEls.grid.addEventListener('click', (event) => {
    const dayEl = event.target.closest('.day');
    if (!dayEl || dayEl.classList.contains('empty')) {
        return;
    }

    openModal(
        Number(dayEl.dataset.year),
        Number(dayEl.dataset.month),
        Number(dayEl.dataset.day),
        dayEl.dataset.holiday || ''
    );
});

calendarEls.modalClose.addEventListener('click', closeModal);
calendarEls.modal.addEventListener('click', (e) => {
    if (e.target === calendarEls.modal) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && calendarEls.modal.classList.contains('active')) {
        closeModal();
    }
});
modalNoteEls.input.addEventListener('input', updateModalNoteActions);
modalNoteEls.save.addEventListener('click', () => {
    saveModalNote();
    closeModal();
});
modalNoteEls.clear.addEventListener('click', clearModalNote);
modalStatusEls.setWork.addEventListener('click', () => applyDayStatusChange('work'));
modalStatusEls.setOff.addEventListener('click', () => applyDayStatusChange('off'));
modalStatusEls.reset.addEventListener('click', () => applyDayStatusChange(null));
undoEls.button.addEventListener('click', undoLastDayStatusChange);
modalNoteEls.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        saveModalNote();
        closeModal();
        e.preventDefault();
    }

    if (e.key === 'Escape') {
        resetModalNote();
        e.preventDefault();
    }
});

// --- Swipe Навігація ---
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 50;
const SWIPE_TIME = 500;

const calendarSection = document.querySelector('.calendar-section');

if (calendarSection) {
    calendarSection.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
    }, false);

    calendarSection.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const swipeDuration = Date.now() - touchStartTime;
        const swipeDistanceX = Math.abs(touchEndX - touchStartX);
        const swipeDistanceY = Math.abs(touchEndY - touchStartY);

        if (swipeDuration < SWIPE_TIME && swipeDistanceX > SWIPE_THRESHOLD && swipeDistanceX > swipeDistanceY * 1.5) {
            if (touchEndX < touchStartX) {
                calendarSection.classList.add('swipe-left');
                calendarSection.addEventListener('animationend', () => {
                    calendarSection.classList.remove('swipe-left');
                    changeMonth(1);
                }, { once: true });
            } else {
                calendarSection.classList.add('swipe-right');
                calendarSection.addEventListener('animationend', () => {
                    calendarSection.classList.remove('swipe-right');
                    changeMonth(-1);
                }, { once: true });
            }
        }
    }, false);
}

// --- Навігація ---
const changeMonth = (delta) => {
    currentState.month += delta;
    if (currentState.month > 11) {
        currentState.month = 0;
        currentState.year++;
    }
    if (currentState.month < 0) {
        currentState.month = 11;
        currentState.year--;
    }
    renderCalendar(currentState.year, currentState.month);
};

calendarEls.prevBtn.addEventListener('click', () => changeMonth(-1));
calendarEls.nextBtn.addEventListener('click', () => changeMonth(1));
calendarEls.todayBtn.addEventListener('click', () => {
    currentState.year = DEMO_TODAY.getFullYear();
    currentState.month = DEMO_TODAY.getMonth();
    renderCalendar(currentState.year, currentState.month);
});
