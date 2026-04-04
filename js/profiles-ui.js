// --- Profiles UI (панель колег) ---
const profilesEls = {
    overlay: document.getElementById('profiles-overlay'),
    openBtn: document.getElementById('profiles-btn'),
    closeBtn: document.getElementById('profiles-overlay-close'),
    list: document.getElementById('profiles-list'),
    addForm: document.getElementById('profiles-add-form'),
    addToggle: document.getElementById('profiles-add-toggle'),
    addCollapse: document.getElementById('profiles-add-collapse'),
    nameInput: document.getElementById('profile-name'),
    colorPreview: document.getElementById('profile-color-preview'),
    templateBtns: document.querySelectorAll('[data-profile-schedule]'),
    customFields: document.getElementById('profile-custom-fields'),
    workDaysInput: document.getElementById('profile-work-days'),
    offDaysInput: document.getElementById('profile-off-days'),
    startDateInput: document.getElementById('profile-start-date'),
    colorInput: document.getElementById('profile-color'),
    addBtn: document.getElementById('profile-add-btn')
};

let selectedProfileSchedule = null;
let editingProfileId = null;
let isAddFormOpen = false;
const EXPANDABLE_SECTION_DURATION_MS = 260;

function setExpandableSectionOpen(sectionEl, isOpen) {
    if (!sectionEl) return;

    if (sectionEl._hideTimerId) {
        clearTimeout(sectionEl._hideTimerId);
        sectionEl._hideTimerId = null;
    }

    if (isOpen) {
        sectionEl.hidden = false;
        requestAnimationFrame(() => {
            sectionEl.classList.add('is-open');
        });
        return;
    }

    sectionEl.classList.remove('is-open');
    sectionEl._hideTimerId = window.setTimeout(() => {
        sectionEl.hidden = true;
        sectionEl._hideTimerId = null;
    }, EXPANDABLE_SECTION_DURATION_MS);
}

function setProfilesAddFormOpen(isOpen) {
    isAddFormOpen = Boolean(isOpen);

    if (profilesEls.addToggle) {
        profilesEls.addToggle.setAttribute('aria-expanded', String(isAddFormOpen));
    }

    if (profilesEls.addForm) {
        profilesEls.addForm.classList.toggle('is-expanded', isAddFormOpen);
    }
}

function setProfilesOverlayOpen(isOpen) {
    if (!profilesEls.overlay) return;
    if (isOpen) {
        renderProfilesList();
        resetAddForm();
        setProfilesAddFormOpen(getProfiles().length === 0);
        profilesEls.overlay.classList.add('active');
    } else {
        profilesEls.overlay.classList.remove('active');
    }
}

function syncProfileColorPreview(inputEl, previewEl) {
    if (!inputEl || !previewEl) return;
    previewEl.style.background = inputEl.value || '#8E8E93';
}

function getScheduleCaptionLabel(scheduleKey) {
    switch (scheduleKey) {
        case '5/5': return '5 роб. / 5 вих.';
        case '4/4': return '4 роб. / 4 вих.';
        case '5/2': return '5 роб. / 2 вих.';
        case '3/3': return '3 роб. / 3 вих.';
        case '2/2': return '2 роб. / 2 вих.';
        default: return 'Кастомний';
    }
}

function resetAddForm() {
    profilesEls.nameInput.value = '';
    selectedProfileSchedule = null;
    setExpandableSectionOpen(profilesEls.customFields, false);
    profilesEls.workDaysInput.value = '';
    profilesEls.offDaysInput.value = '';
    profilesEls.startDateInput.value = new Date().toISOString().slice(0, 10);
    profilesEls.colorInput.value = getNextProfileColor();
    syncProfileColorPreview(profilesEls.colorInput, profilesEls.colorPreview);
    syncProfileTemplateBtns();
}

function syncProfileTemplateBtns() {
    profilesEls.templateBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.profileSchedule === selectedProfileSchedule);
    });
}

function formatProfileScheduleLabel(schedule) {
    if (!schedule) return '';
    return `${schedule.workDays}/${schedule.offDays}`;
}

function formatProfileStartDate(startDate) {
    if (!startDate) return '';
    const d = new Date(startDate);
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}

function renderProfilesList() {
    const profiles = getProfiles();
    profilesEls.list.innerHTML = '';

    profiles.forEach(profile => {
        const item = document.createElement('div');
        item.className = 'profile-item';
        if (profile.visible === false) item.classList.add('dimmed');

        const colorDot = document.createElement('div');
        colorDot.className = 'profile-item-color';
        colorDot.style.background = profile.color;

        const info = document.createElement('div');
        info.className = 'profile-item-info';

        const name = document.createElement('div');
        name.className = 'profile-item-name';
        name.textContent = profile.name;

        const schedule = document.createElement('div');
        schedule.className = 'profile-item-schedule';
        schedule.textContent = `${formatProfileScheduleLabel(profile.schedule)} · старт ${formatProfileStartDate(profile.schedule.startDate)}`;

        info.appendChild(name);
        info.appendChild(schedule);

        const actions = document.createElement('div');
        actions.className = 'profile-item-actions';

        const visBtn = document.createElement('button');
        visBtn.className = 'profile-action-btn';
        visBtn.type = 'button';
        visBtn.title = profile.visible === false ? 'Показати' : 'Сховати';
        visBtn.textContent = profile.visible === false ? '👁️‍🗨️' : '👁️';
        visBtn.addEventListener('click', () => {
            toggleProfileVisibility(profile.id);
            renderProfilesList();
            renderCalendar(currentState.year, currentState.month);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'profile-action-btn';
        editBtn.type = 'button';
        editBtn.title = 'Редагувати';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => {
            openEditProfile(profile);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'profile-action-btn danger';
        delBtn.type = 'button';
        delBtn.title = 'Видалити';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => {
            if (confirm(`Видалити профіль "${profile.name}"?`)) {
                removeProfile(profile.id);
                renderProfilesList();
                renderCalendar(currentState.year, currentState.month);
            }
        });

        actions.appendChild(visBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        item.appendChild(colorDot);
        item.appendChild(info);
        item.appendChild(actions);
        profilesEls.list.appendChild(item);
    });
}

function buildScheduleFromForm(isEdit) {
    const prefix = isEdit ? 'edit-' : '';
    const nameInput = isEdit ? document.getElementById('edit-profile-name') : profilesEls.nameInput;
    const name = nameInput.value.trim();

    if (!name) {
        alert('Введіть назву.');
        return null;
    }

    const selSchedule = isEdit ? editSelectedSchedule : selectedProfileSchedule;
    if (!selSchedule) {
        alert('Оберіть графік.');
        return null;
    }

    let workDays, offDays;
    if (selSchedule === 'custom') {
        const wInput = isEdit ? document.getElementById('edit-profile-work-days') : profilesEls.workDaysInput;
        const oInput = isEdit ? document.getElementById('edit-profile-off-days') : profilesEls.offDaysInput;
        workDays = parseInt(wInput.value, 10);
        offDays = parseInt(oInput.value, 10);
        if (Number.isNaN(workDays) || workDays < 1) workDays = 5;
        if (Number.isNaN(offDays) || offDays < 1) offDays = 5;
    } else {
        const parts = selSchedule.split('/').map(Number);
        workDays = parts[0] || 5;
        offDays = parts[1] || 5;
    }

    const sdInput = isEdit ? document.getElementById('edit-profile-start-date') : profilesEls.startDateInput;
    const colorInput = isEdit ? document.getElementById('edit-profile-color') : profilesEls.colorInput;
    const startDate = parseDateInputValueAsUtcIso(sdInput.value);
    const color = colorInput.value;

    return { name, workDays, offDays, startDate, type: selSchedule === 'custom' ? 'custom' : selSchedule, color };
}

// --- Add profile ---
profilesEls.templateBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        selectedProfileSchedule = btn.dataset.profileSchedule;
        setExpandableSectionOpen(profilesEls.customFields, selectedProfileSchedule === 'custom');
        syncProfileTemplateBtns();
    });
});

if (profilesEls.colorInput) {
    profilesEls.colorInput.addEventListener('input', () => {
        syncProfileColorPreview(profilesEls.colorInput, profilesEls.colorPreview);
    });
}

profilesEls.addBtn.addEventListener('click', () => {
    const data = buildScheduleFromForm(false);
    if (!data) return;

    const profile = addProfile(data.name, {
        type: data.type,
        workDays: data.workDays,
        offDays: data.offDays,
        startDate: data.startDate
    });
    updateProfile(profile.id, { color: data.color });

    resetAddForm();
    setProfilesAddFormOpen(false);
    renderProfilesList();
    renderCalendar(currentState.year, currentState.month);
});

if (profilesEls.addToggle) {
    profilesEls.addToggle.addEventListener('click', () => {
        setProfilesAddFormOpen(!isAddFormOpen);
    });
}

// --- Open / close ---
profilesEls.openBtn.addEventListener('click', () => setProfilesOverlayOpen(true));
profilesEls.closeBtn.addEventListener('click', () => setProfilesOverlayOpen(false));
profilesEls.overlay.addEventListener('click', (e) => {
    if (e.target === profilesEls.overlay) setProfilesOverlayOpen(false);
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && profilesEls.overlay.classList.contains('active')) {
        setProfilesOverlayOpen(false);
    }
});

// --- Edit profile (inline overlay) ---
let editSelectedSchedule = null;
let editOverlayEl = null;

function openEditProfile(profile) {
    closeEditProfile();

    editingProfileId = profile.id;
    editSelectedSchedule = profile.schedule.type || 'custom';

    editOverlayEl = document.createElement('div');
    editOverlayEl.className = 'profile-edit-overlay';
    editOverlayEl.innerHTML = `
        <div class="profile-edit-card">
            <div class="modal-shell-header profile-edit-header">
                <h2 class="profile-edit-title">Редагувати: ${escapeHtml(profile.name)}</h2>
                <button class="schedule-close profile-edit-close" id="edit-profile-close" type="button" aria-label="Закрити">×</button>
            </div>
            <div class="custom-input-group">
                <label class="custom-input-label">Назва</label>
                <input type="text" id="edit-profile-name" class="custom-input control-input" maxlength="30" value="${escapeHtml(profile.name)}">
            </div>
            <div class="profiles-schedule-row profile-edit-schedule-row">
                <div class="profiles-schedule-templates profile-edit-schedule-templates" id="edit-profile-schedule-templates">
                    ${['5/5','4/4','5/2','3/3','2/2','custom'].map(t =>
                        `<button class="schedule-btn schedule-btn-sm profile-edit-schedule-btn${editSelectedSchedule === t ? ' active' : ''}" data-edit-schedule="${t}" type="button"><strong>${t === 'custom' ? '⚙️' : t}</strong><span class="schedule-btn-label profile-schedule-caption profile-edit-schedule-label">${getScheduleCaptionLabel(t)}</span></button>`
                    ).join('')}
                </div>
            </div>
            <div class="profiles-custom-fields" id="edit-profile-custom-fields" ${editSelectedSchedule !== 'custom' ? 'hidden' : ''}>
                <div class="custom-input-group">
                    <label class="custom-input-label">Дні роботи</label>
                    <input type="number" id="edit-profile-work-days" class="custom-input control-input" min="1" max="30" value="${profile.schedule.workDays}">
                </div>
                <div class="custom-input-group">
                    <label class="custom-input-label">Дні вихідних</label>
                    <input type="number" id="edit-profile-off-days" class="custom-input control-input" min="1" max="30" value="${profile.schedule.offDays}">
                </div>
            </div>
            <div class="custom-input-group profile-edit-date-group">
                <label class="custom-input-label">Початок зміни</label>
                <input type="date" id="edit-profile-start-date" class="custom-input control-input" value="${formatScheduleStartDateForInput(profile.schedule.startDate)}">
            </div>
            <div class="profile-edit-color-row">
                <div class="profile-edit-color-copy">
                    <label class="custom-input-label" for="edit-profile-color">Колір</label>
                    <span class="helper-text profile-edit-color-help">Колір зміни в календарі</span>
                </div>
                <div class="profile-color-picker profile-edit-inline-color-picker">
                    <input type="color" id="edit-profile-color" class="profile-color-input profile-edit-color-input" value="${profile.color}" aria-label="Колір календаря">
                    <div class="profile-color-preview" id="edit-profile-color-preview"></div>
                </div>
            </div>
            <div class="profile-edit-actions">
                <button class="schedule-btn-action secondary" id="edit-profile-cancel" type="button">Скасувати</button>
                <button class="schedule-btn-action primary" id="edit-profile-save" type="button">Зберегти</button>
            </div>
        </div>
    `;

    document.body.appendChild(editOverlayEl);
    requestAnimationFrame(() => editOverlayEl.classList.add('active'));

    const editColorInput = document.getElementById('edit-profile-color');
    const editColorPreview = document.getElementById('edit-profile-color-preview');
    syncProfileColorPreview(editColorInput, editColorPreview);
    if (editColorInput) {
        editColorInput.addEventListener('input', () => {
            syncProfileColorPreview(editColorInput, editColorPreview);
        });
    }

    // Template buttons
    editOverlayEl.querySelectorAll('[data-edit-schedule]').forEach(btn => {
        btn.addEventListener('click', () => {
            editSelectedSchedule = btn.dataset.editSchedule;
            editOverlayEl.querySelectorAll('[data-edit-schedule]').forEach(b =>
                b.classList.toggle('active', b.dataset.editSchedule === editSelectedSchedule)
            );
            const cf = document.getElementById('edit-profile-custom-fields');
            setExpandableSectionOpen(cf, editSelectedSchedule === 'custom');
        });
    });

    setExpandableSectionOpen(document.getElementById('edit-profile-custom-fields'), editSelectedSchedule === 'custom');

    // Cancel
    editOverlayEl.querySelector('#edit-profile-close').addEventListener('click', closeEditProfile);
    editOverlayEl.querySelector('#edit-profile-cancel').addEventListener('click', closeEditProfile);
    editOverlayEl.addEventListener('click', (e) => {
        if (e.target === editOverlayEl) closeEditProfile();
    });

    // Save
    editOverlayEl.querySelector('#edit-profile-save').addEventListener('click', () => {
        const data = buildScheduleFromForm(true);
        if (!data) return;

        updateProfile(editingProfileId, {
            name: data.name,
            color: data.color,
            schedule: {
                type: data.type,
                workDays: data.workDays,
                offDays: data.offDays,
                startDate: data.startDate
            }
        });

        closeEditProfile();
        renderProfilesList();
        renderCalendar(currentState.year, currentState.month);
    });
}

function closeEditProfile() {
    if (editOverlayEl) {
        editOverlayEl.classList.remove('active');
        editOverlayEl.remove();
        editOverlayEl = null;
    }
    editingProfileId = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
