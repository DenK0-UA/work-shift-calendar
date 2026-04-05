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
    colorTrigger: document.getElementById('profile-color-trigger'),
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
const PROFILES_UI_REVEAL_DURATION_MS = 260;
const PROFILES_UI_OVERLAY_FADE_DURATION_MS = 320;
const EXPANDABLE_SECTION_DURATION_MS = PROFILES_UI_REVEAL_DURATION_MS;
const profileColorPickerState = {
    overlayEl: null,
    paletteGridEl: null,
    customInputEl: null,
    pendingColor: '#8E8E93',
    targetInputEl: null,
    targetPreviewEl: null
};

function getIconMarkup(name) {
    switch (name) {
        case 'close':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>';
        case 'chevron-right':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"></path></svg>';
        case 'gear':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.25"></circle><path d="M19.3 15.2 20.5 16.9 18.9 18.5 17.2 17.3"></path><path d="M4.7 15.2 3.5 16.9 5.1 18.5 6.8 17.3"></path><path d="M8.8 4.7 7.1 3.5 5.5 5.1 6.7 6.8"></path><path d="M15.2 4.7 16.9 3.5 18.5 5.1 17.3 6.8"></path><path d="M12 2.5v2.3"></path><path d="M12 19.2v2.3"></path><path d="M2.5 12h2.3"></path><path d="M19.2 12h2.3"></path></svg>';
        case 'eye':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.75"></circle></svg>';
        case 'eye-off':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 6.7A10.4 10.4 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a17 17 0 0 1-4.3 4.4"></path><path d="M8 8.1C5 9.5 2.5 12 2.5 12s3.5 5.5 9.5 5.5c1.5 0 2.9-.3 4.1-.8"></path><path d="M9.7 9.7A3.2 3.2 0 0 0 12 15.2"></path></svg>';
        case 'edit':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20Z"></path><path d="m12.8 7 4.2 4.2"></path></svg>';
        case 'trash':
            return '<svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5h15"></path><path d="M9.5 3.5h5"></path><path d="M7.5 7.5l1 12h7l1-12"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';
        default:
            return '';
    }
}

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

    document.body.classList.toggle('profiles-open', Boolean(isOpen));

    if (isOpen) {
        profilesEls.overlay.classList.add('active');
        try {
            renderProfilesList();
            resetAddForm();
            setProfilesAddFormOpen(getProfiles().length === 0);
        } catch (error) {
            console.error('[Profiles] Не вдалося відкрити панель графіків:', error);
            if (profilesEls.list) {
                profilesEls.list.innerHTML = '';
            }
            setProfilesAddFormOpen(true);
        }
    } else {
        closeProfileColorPicker();
        closeEditProfile();
        setProfilesAddFormOpen(false);
        profilesEls.overlay.classList.remove('active');
    }
}

function syncProfileColorPreview(inputEl, previewEl) {
    if (!inputEl || !previewEl) return;
    const nextColor = inputEl.value || '#8E8E93';
    previewEl.style.background = nextColor;
    const triggerEl = previewEl.closest('.profile-color-trigger');
    if (triggerEl && triggerEl.closest('.profile-color-picker-compact')) {
        triggerEl.style.background = nextColor;
    } else if (triggerEl) {
        triggerEl.style.background = '';
    }
}

function getSoftProfilePalette() {
    if (typeof getProfilePaletteColors === 'function') {
        return getProfilePaletteColors();
    }

    return ['#C8876B', '#6DA58B', '#7E8FC9', '#68B5BF', '#C47E9B', '#D0A45F'];
}

function closeProfileColorPicker() {
    if (!profileColorPickerState.overlayEl) return;

    profileColorPickerState.overlayEl.classList.remove('active');
    window.setTimeout(() => {
        if (profileColorPickerState.overlayEl && !profileColorPickerState.overlayEl.classList.contains('active')) {
            profileColorPickerState.overlayEl.hidden = true;
        }
    }, PROFILES_UI_OVERLAY_FADE_DURATION_MS);
}

function applyProfileColorPickerSelection() {
    const { targetInputEl, targetPreviewEl, pendingColor } = profileColorPickerState;
    if (!targetInputEl) {
        closeProfileColorPicker();
        return;
    }

    targetInputEl.value = pendingColor;
    targetInputEl.dispatchEvent(new Event('input', { bubbles: true }));
    syncProfileColorPreview(targetInputEl, targetPreviewEl);
    closeProfileColorPicker();
}

function renderProfileColorPalette() {
    if (!profileColorPickerState.paletteGridEl) return;

    const palette = getSoftProfilePalette();
    profileColorPickerState.paletteGridEl.innerHTML = '';

    palette.forEach((color) => {
        const swatchBtn = document.createElement('button');
        swatchBtn.type = 'button';
        swatchBtn.className = 'profile-color-swatch';
        swatchBtn.dataset.color = color;
        const isSelected = color.toLowerCase() === profileColorPickerState.pendingColor.toLowerCase();
        swatchBtn.classList.toggle('is-selected', isSelected);
        swatchBtn.setAttribute('aria-label', `Колір ${color}`);
        swatchBtn.setAttribute('aria-pressed', String(isSelected));

        const chip = document.createElement('span');
        chip.className = 'profile-color-swatch-chip';
        chip.style.background = color;
        swatchBtn.appendChild(chip);

        swatchBtn.addEventListener('click', () => {
            profileColorPickerState.pendingColor = color;
            renderProfileColorPalette();
        });

        profileColorPickerState.paletteGridEl.appendChild(swatchBtn);
    });
}

function ensureProfileColorPicker() {
    if (profileColorPickerState.overlayEl) {
        return profileColorPickerState.overlayEl;
    }

    const overlayEl = document.createElement('div');
    overlayEl.className = 'profile-color-modal';
    overlayEl.hidden = true;
    overlayEl.innerHTML = `
        <div class="profile-color-modal-card">
            <div class="modal-shell-header profile-color-modal-header">
                <h2 class="profile-edit-title">Колір графіка</h2>
                <button class="schedule-close" id="profile-color-modal-close" type="button" aria-label="Закрити">${getIconMarkup('close')}</button>
            </div>
            <div class="profile-color-swatch-grid" id="profile-color-swatch-grid"></div>
            <div class="profile-color-modal-actions">
                <button class="schedule-btn-action secondary" id="profile-color-cancel-btn" type="button">Скасувати</button>
                <button class="schedule-btn-action primary" id="profile-color-apply-btn" type="button">Застосувати</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlayEl);

    profileColorPickerState.overlayEl = overlayEl;
    profileColorPickerState.paletteGridEl = overlayEl.querySelector('#profile-color-swatch-grid');

    overlayEl.querySelector('#profile-color-modal-close').addEventListener('click', closeProfileColorPicker);
    overlayEl.querySelector('#profile-color-cancel-btn').addEventListener('click', closeProfileColorPicker);
    overlayEl.querySelector('#profile-color-apply-btn').addEventListener('click', applyProfileColorPickerSelection);
    overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) {
            closeProfileColorPicker();
        }
    });

    return overlayEl;
}

function openProfileColorPicker(targetInputEl, targetPreviewEl) {
    if (!targetInputEl || !targetPreviewEl) return;

    ensureProfileColorPicker();
    profileColorPickerState.targetInputEl = targetInputEl;
    profileColorPickerState.targetPreviewEl = targetPreviewEl;
    profileColorPickerState.pendingColor = targetInputEl.value || '#8E8E93';
    renderProfileColorPalette();
    profileColorPickerState.overlayEl.hidden = false;
    requestAnimationFrame(() => {
        profileColorPickerState.overlayEl.classList.add('active');
    });
}

function getScheduleCaptionLabel(scheduleKey) {
    switch (scheduleKey) {
        case '5/5': return '5 роб. / 5 вих.';
        case '4/4': return '4 роб. / 4 вих.';
        case '5/2': return '5 роб. / 2 вих.';
        case '3/3': return '3 роб. / 3 вих.';
        case '2/2': return '2 роб. / 2 вих.';
        default: return 'Свій';
    }
}

function resetAddForm() {
    if (profilesEls.nameInput) {
        profilesEls.nameInput.value = '';
    }
    selectedProfileSchedule = null;
    setExpandableSectionOpen(profilesEls.customFields, false);
    if (profilesEls.workDaysInput) {
        profilesEls.workDaysInput.value = '';
    }
    if (profilesEls.offDaysInput) {
        profilesEls.offDaysInput.value = '';
    }
    if (profilesEls.startDateInput) {
        profilesEls.startDateInput.value = new Date().toISOString().slice(0, 10);
    }
    if (profilesEls.colorInput) {
        profilesEls.colorInput.value = getNextProfileColor();
    }
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
    if (!profilesEls.list) return;

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
        visBtn.setAttribute('aria-label', profile.visible === false ? 'Показати профіль' : 'Сховати профіль');
        visBtn.setAttribute('aria-pressed', String(profile.visible !== false));
        visBtn.innerHTML = profile.visible === false ? getIconMarkup('eye-off') : getIconMarkup('eye');
        visBtn.addEventListener('click', () => {
            toggleProfileVisibility(profile.id);
            renderProfilesList();
            renderCalendar(currentState.year, currentState.month);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'profile-action-btn';
        editBtn.type = 'button';
        editBtn.title = 'Редагувати';
        editBtn.setAttribute('aria-label', 'Редагувати профіль');
        editBtn.innerHTML = getIconMarkup('edit');
        editBtn.addEventListener('click', () => {
            openEditProfile(profile);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'profile-action-btn danger';
        delBtn.type = 'button';
        delBtn.title = 'Видалити';
        delBtn.setAttribute('aria-label', 'Видалити профіль');
        delBtn.innerHTML = getIconMarkup('trash');
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

if (profilesEls.colorTrigger) {
    profilesEls.colorTrigger.addEventListener('click', () => {
        openProfileColorPicker(profilesEls.colorInput, profilesEls.colorPreview);
    });
}

if (profilesEls.addBtn) {
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
}

if (profilesEls.addToggle) {
    profilesEls.addToggle.addEventListener('click', () => {
        setProfilesAddFormOpen(!isAddFormOpen);
    });
}

// --- Open / close ---
function openProfilesOverlay(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (window.AppShellOverlays?.open) {
        window.AppShellOverlays.open('profiles', { event, reason: 'api' });
        return;
    }

    setProfilesOverlayOpen(true);
}

function closeProfilesOverlay(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (window.AppShellOverlays?.close) {
        window.AppShellOverlays.close('profiles', { event, reason: 'api' });
        return;
    }

    setProfilesOverlayOpen(false);
}

const profilesOverlayController = window.AppShellOverlays?.registerOverlay({
    id: 'profiles',
    overlay: profilesEls.overlay,
    openButtons: profilesEls.openBtn,
    closeButtons: profilesEls.closeBtn,
    onOpen: () => {
        setProfilesOverlayOpen(true);
        return true;
    },
    onClose: () => {
        setProfilesOverlayOpen(false);
        return true;
    },
    closeOnEscape: false
});

if (!profilesOverlayController) {
    if (profilesEls.openBtn) {
        profilesEls.openBtn.addEventListener('click', openProfilesOverlay);
    }
    if (profilesEls.closeBtn) {
        profilesEls.closeBtn.addEventListener('click', closeProfilesOverlay);
    }
    if (profilesEls.overlay) {
        profilesEls.overlay.addEventListener('click', (e) => {
            if (e.target === profilesEls.overlay) {
                closeProfilesOverlay(e);
            }
        });
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && profileColorPickerState.overlayEl?.classList.contains('active')) {
        closeProfileColorPicker();
        return;
    }

    if (e.key === 'Escape' && profilesEls.overlay?.classList.contains('active')) {
        closeProfilesOverlay(e);
    }
});

window.openProfilesOverlay = () => openProfilesOverlay();
window.closeProfilesOverlay = () => closeProfilesOverlay();
window.closeProfileEditOverlay = () => closeEditProfile();
window.isProfileEditOverlayOpen = () => Boolean(editOverlayEl?.classList.contains('active'));
window.closeProfileColorPalette = () => closeProfileColorPicker();
window.isProfileColorPaletteOpen = () => Boolean(profileColorPickerState.overlayEl?.classList.contains('active'));

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
                <button class="schedule-close profile-edit-close" id="edit-profile-close" type="button" aria-label="Закрити">${getIconMarkup('close')}</button>
            </div>
            <div class="custom-input-group">
                <label class="custom-input-label">Назва</label>
                <input type="text" id="edit-profile-name" class="custom-input control-input" maxlength="30" value="${escapeHtml(profile.name)}">
            </div>
            <div class="profiles-schedule-row profile-edit-schedule-row">
                <div class="profiles-schedule-templates profile-edit-schedule-templates" id="edit-profile-schedule-templates">
                    ${['5/5','4/4','5/2','3/3','2/2','custom'].map(t =>
                        `<button class="schedule-btn schedule-btn-sm profile-edit-schedule-btn${editSelectedSchedule === t ? ' active' : ''}" data-edit-schedule="${t}" type="button"><strong${t === 'custom' ? ' class="schedule-btn-icon" aria-hidden="true"' : ''}>${t === 'custom' ? getIconMarkup('gear') : t}</strong><span class="schedule-btn-label profile-schedule-caption profile-edit-schedule-label">${getScheduleCaptionLabel(t)}</span></button>`
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
            <div class="profiles-meta-row profile-edit-meta-row">
                <div class="custom-input-group profile-edit-date-group">
                    <label class="custom-input-label">Початок зміни</label>
                    <input type="date" id="edit-profile-start-date" class="custom-input control-input" value="${formatScheduleStartDateForInput(profile.schedule.startDate)}">
                </div>
                <div class="custom-input-group profile-color-group profile-edit-color-group">
                    <label class="custom-input-label" for="edit-profile-color">Колір</label>
                    <div class="profile-color-picker profile-color-picker-compact profile-edit-inline-color-picker">
                        <input type="color" id="edit-profile-color" class="profile-color-input profile-color-native-input profile-edit-color-input" value="${profile.color}" aria-label="Свій колір календаря">
                        <button class="profile-color-trigger profile-edit-color-trigger custom-input control-input" id="edit-profile-color-trigger" type="button" aria-haspopup="dialog">
                            <span class="profile-color-preview" id="edit-profile-color-preview"></span>
                            <span class="profile-color-trigger-copy">
                                <span class="profile-color-trigger-title">М'яка палітра</span>
                                <span class="helper-text profile-color-trigger-help">Або свій колір</span>
                            </span>
                        </button>
                    </div>
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
    const editColorTrigger = document.getElementById('edit-profile-color-trigger');
    syncProfileColorPreview(editColorInput, editColorPreview);
    if (editColorInput) {
        editColorInput.addEventListener('input', () => {
            syncProfileColorPreview(editColorInput, editColorPreview);
        });
    }
    if (editColorTrigger) {
        editColorTrigger.addEventListener('click', () => {
            openProfileColorPicker(editColorInput, editColorPreview);
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
        const overlayToClose = editOverlayEl;
        overlayToClose.classList.remove('active');
        editOverlayEl = null;
        window.setTimeout(() => {
            overlayToClose.remove();
        }, PROFILES_UI_OVERLAY_FADE_DURATION_MS);
    }
    editingProfileId = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
