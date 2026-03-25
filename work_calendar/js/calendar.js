// --- DOM Елементи ---
const calendarEls = {
    grid: document.getElementById('calendar-grid'),
    monthTitle: document.getElementById('month-year-display'),
    statWork: document.getElementById('stat-work'),
    statOff: document.getElementById('stat-off'),
    modal: document.getElementById('modal'),
    legendItems: document.querySelectorAll('.stat-item'),
    magneticBtns: document.querySelectorAll('[data-magnetic]')
};

const modalNoteEls = {
    block: document.getElementById('m-note-block'),
    input: document.getElementById('m-note-input'),
    actions: document.getElementById('m-note-actions'),
    save: document.getElementById('m-note-save'),
    clear: document.getElementById('m-note-clear')
};

let activeModalDate = null;
let activeModalSavedNote = '';
const supportsInteractiveHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// --- Рендер Календаря ---
function renderCalendar(year, month) {
    calendarEls.grid.classList.remove('fluid-enter');
    void calendarEls.grid.offsetWidth;
    calendarEls.grid.classList.add('fluid-enter');

    calendarEls.grid.innerHTML = '';
    calendarEls.monthTitle.textContent = `${localeData.months[month]} ${year}`;
    const fragment = document.createDocumentFragment();

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    let stats = { work: 0, off: 0 };

    for (let i = 0; i < paddingDays; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'day empty';
        fragment.appendChild(emptyDiv);
    }

    const monthStr = String(month + 1).padStart(2, '0');

    for (let day = 1; day <= daysInMonth; day++) {
        const dayStatus = getDayStatus(year, month, day);
        stats[dayStatus]++;

        const isToday = (year === DEMO_TODAY.getFullYear() && month === DEMO_TODAY.getMonth() && day === DEMO_TODAY.getDate());
        const dayStr = String(day).padStart(2, '0');
        const holidayName = holidays[`${monthStr}-${dayStr}`];

        const dayEl = document.createElement('div');
        dayEl.className = `day ${isToday ? 'today' : ''}`;
        dayEl.dataset.status = dayStatus;

        // Формуємо вміст дня
        dayEl.innerHTML = `
            <span class="date-num">${day}</span>
            ${holidayName ? '<div class="holiday-marker"></div>' : ''}
        `;

        // Подвійний клік - переключає статус, звичайний - модаль
        dayEl.addEventListener('dblclick', () => {
            toggleDayStatus(year, month, day);
        });

        dayEl.addEventListener('click', () => openModal(year, month, day, dayStatus, holidayName));
        if (supportsInteractiveHover) {
            setup3DTilt(dayEl);
        }

        fragment.appendChild(dayEl);
    }

    calendarEls.grid.appendChild(fragment);

    calendarEls.statWork.textContent = stats.work;
    calendarEls.statOff.textContent = stats.off;
    updateSubtitle();
    if (typeof updatePeriodStatsPanel === 'function') {
        updatePeriodStatsPanel(window.activeStatsPeriod || 'month');
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
        el.style.transition = 'transform 0.4s ease, box-shadow 0.4s ease';
        el.style.transform = 'scale(1) rotateX(0) rotateY(0) translateZ(0)';
        el.style.boxShadow = 'none';
        resetTransitionTimer = window.setTimeout(() => {
            el.style.transition = 'box-shadow 0.3s ease';
            resetTransitionTimer = null;
        }, 400);
    });
}

// --- Фільтрація Легенди ---
let activeFilter = null;
const clearFilters = () => {
    activeFilter = null;
    calendarEls.grid.classList.remove('grid-dim');
    document.querySelectorAll('.day').forEach(d => d.classList.remove('filtered'));
    calendarEls.legendItems.forEach(i => i.style.background = '');
};

calendarEls.legendItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const status = item.dataset.status;
        if (activeFilter === status) {
            clearFilters();
        } else {
            clearFilters();
            activeFilter = status;
            calendarEls.grid.classList.add('grid-dim');
            document.querySelectorAll(`.day[data-status="${status}"]`).forEach(d => d.classList.add('filtered'));
            item.style.background = 'var(--accent-soft)';
        }
    });
});

window.addEventListener('click', (e) => {
    if (activeFilter && !e.target.closest('#stats-container')) clearFilters();
});

// --- Магнітні кнопки ---
calendarEls.magneticBtns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.4}px)`;
    });
    btn.addEventListener('mouseleave', () => btn.style.transform = 'translate(0, 0)');
});

// --- Модальне Вікно ---
function openModal(year, month, day, status, holidayName) {
    activeModalDate = { year, month, day };
    calendarEls.modal.dataset.year = String(year);
    calendarEls.modal.dataset.month = String(month);
    calendarEls.modal.dataset.day = String(day);
    document.getElementById('m-date').textContent = day;

    const dateObj = new Date(Date.UTC(year, month, day));
    const dayOfWeek = localeData.days[dateObj.getUTCDay()];
    document.getElementById('m-day-week').textContent = `${dayOfWeek}, ${localeData.months[month].toLowerCase()} ${year}`;

    const holidayEl = document.getElementById('m-holiday');
    if (holidayName) {
        holidayEl.textContent = `🎈 ${holidayName}`;
        holidayEl.classList.add('active');
    } else {
        holidayEl.textContent = '';
        holidayEl.classList.remove('active');
    }

    const badge = document.getElementById('m-badge');
    const statusText = document.getElementById('m-status-text');

    // Налаштування кольору бейджика в модалці
    badge.style.background = status === 'work' ? 'var(--work-bg)' : 'var(--off-bg)';
    badge.style.color = status === 'work' ? 'var(--work-text)' : 'var(--off-text)';

    if (status === 'off') {
        badge.style.boxShadow = '0 4px 15px rgba(52, 199, 89, 0.3)';
    } else {
        badge.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.05)';
    }

    statusText.textContent = status === 'work' ? 'Робочий день' : 'Вихідний день';
    updateModalWeather(year, month, day);
    activeModalSavedNote = getDayNote(year, month, day);
    modalNoteEls.input.value = activeModalSavedNote;
    updateModalNoteActions();

    calendarEls.modal.classList.add('active');
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
    calendarEls.modal.classList.remove('active');
};

document.getElementById('modal-close').addEventListener('click', closeModal);
calendarEls.modal.addEventListener('click', (e) => { if (e.target === calendarEls.modal) closeModal(); });
modalNoteEls.input.addEventListener('input', updateModalNoteActions);
modalNoteEls.save.addEventListener('click', () => {
    saveModalNote();
    closeModal();
});
modalNoteEls.clear.addEventListener('click', clearModalNote);
modalNoteEls.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
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
let touchEndX = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 50; // Мінімальна відстань для свайпу
const SWIPE_TIME = 500; // Максимальний час для свайпу (мс)

const calendarSection = document.querySelector('.calendar-section');

if (calendarSection) {
    calendarSection.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartTime = Date.now();
    }, false);

    calendarSection.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const swipeDuration = Date.now() - touchStartTime;
        const swipeDistance = Math.abs(touchEndX - touchStartX);

        if (swipeDuration < SWIPE_TIME && swipeDistance > SWIPE_THRESHOLD) {
            if (touchEndX < touchStartX) {
                // Свайп вліво - наступний місяць
                calendarSection.classList.add('swipe-left');
                setTimeout(() => {
                    changeMonth(1);
                    calendarSection.classList.remove('swipe-left');
                }, 300);
            } else {
                // Свайп вправо - попередній місяць
                calendarSection.classList.add('swipe-right');
                setTimeout(() => {
                    changeMonth(-1);
                    calendarSection.classList.remove('swipe-right');
                }, 300);
            }
        }
    }, false);
}

// --- Навігація ---
const changeMonth = (delta) => {
    currentState.month += delta;
    if (currentState.month > 11) { currentState.month = 0; currentState.year++; }
    if (currentState.month < 0) { currentState.month = 11; currentState.year--; }
    renderCalendar(currentState.year, currentState.month);
    if (activeFilter) clearFilters();
};

document.getElementById('prev-btn').addEventListener('click', () => changeMonth(-1));
document.getElementById('next-btn').addEventListener('click', () => changeMonth(1));

document.getElementById('today-btn').addEventListener('click', () => {
    currentState.year = DEMO_TODAY.getFullYear();
    currentState.month = DEMO_TODAY.getMonth();
    renderCalendar(currentState.year, currentState.month);
    if (activeFilter) clearFilters();
});
