// --- Профілі колег (оверлей на календарі) ---
const PROFILES_STORAGE_KEY = 'colleagueProfiles';

const DEFAULT_PROFILE_COLORS = [
    '#c97b63', '#d39a52', '#a7a05f', '#739b74',
    '#5fa59b', '#6ea9c7', '#7e90cc', '#8d7bc3',
    '#b779a2', '#c97886', '#8c96a3', '#b78d73'
];

const profilesState = {
    profiles: null
};

function sanitizeProfilesCollection(rawProfiles) {
    if (!Array.isArray(rawProfiles)) {
        return [];
    }

    return rawProfiles
        .map((profile, index) => normalizeProfileRecord(profile, index))
        .filter(Boolean);
}

function generateProfileId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeProfileName(name, index = 0) {
    if (typeof name === 'string' && name.trim()) {
        return name.trim();
    }
    return `Графік ${index + 1}`;
}

function normalizeProfileColor(color) {
    if (typeof color !== 'string' || !color.trim()) {
        return DEFAULT_PROFILE_COLORS[0];
    }
    return color.trim().toLowerCase();
}

function normalizeProfileSchedule(scheduleConfig) {
    return getNormalizedScheduleConfig(scheduleConfig || {});
}

function normalizeProfileRecord(profile, index = 0) {
    if (!profile || typeof profile !== 'object') {
        return null;
    }

    return {
        id: typeof profile.id === 'string' && profile.id.trim() ? profile.id : generateProfileId(),
        name: normalizeProfileName(profile.name, index),
        color: normalizeProfileColor(profile.color),
        schedule: normalizeProfileSchedule(profile.schedule),
        visible: profile.visible !== false
    };
}

function ensureProfilesState() {
    if (!profilesState.profiles) {
        profilesState.profiles = safeReadJson(
            PROFILES_STORAGE_KEY,
            [],
            { sanitize: sanitizeProfilesCollection }
        );
    }
    return profilesState.profiles;
}

function persistProfiles() {
    const profiles = sanitizeProfilesCollection(ensureProfilesState());
    profilesState.profiles = profiles;

    const persisted = safeWriteJson(PROFILES_STORAGE_KEY, profiles, {
        removeWhenEmpty: true,
        isEmpty: (items) => !Array.isArray(items) || items.length === 0
    });

    if (!persisted) {
        console.warn('Не вдалось зберегти профілі');
    }
}

function getProfiles() {
    return ensureProfilesState().map((profile, index) => normalizeProfileRecord(profile, index));
}

function getVisibleProfiles() {
    return ensureProfilesState().filter((profile) => profile?.visible !== false);
}

function getNextProfileColor() {
    const profiles = ensureProfilesState();
    const usedColors = new Set(profiles.map(p => normalizeProfileColor(p.color)));
    return DEFAULT_PROFILE_COLORS.find(c => !usedColors.has(normalizeProfileColor(c))) || DEFAULT_PROFILE_COLORS[profiles.length % DEFAULT_PROFILE_COLORS.length];
}

function getProfilePaletteColors() {
    return [...DEFAULT_PROFILE_COLORS];
}

function addProfile(name, scheduleConfig) {
    const profiles = ensureProfilesState();
    const profile = {
        id: generateProfileId(),
        name: name.trim(),
        color: normalizeProfileColor(getNextProfileColor()),
        schedule: getNormalizedScheduleConfig(scheduleConfig),
        visible: true
    };
    profiles.push(profile);
    persistProfiles();
    return profile;
}

function updateProfile(id, updates) {
    const profiles = ensureProfilesState();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;

    if (updates.name !== undefined) {
        profiles[idx].name = updates.name.trim();
    }
    if (updates.color !== undefined) {
        profiles[idx].color = normalizeProfileColor(updates.color);
    }
    if (updates.schedule !== undefined) {
        profiles[idx].schedule = getNormalizedScheduleConfig(updates.schedule);
    }
    if (updates.visible !== undefined) {
        profiles[idx].visible = updates.visible;
    }

    persistProfiles();
    return { ...profiles[idx] };
}

function removeProfile(id) {
    const profiles = ensureProfilesState();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    profiles.splice(idx, 1);
    persistProfiles();
    return true;
}

function toggleProfileVisibility(id) {
    const profiles = ensureProfilesState();
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    profile.visible = profile.visible === false ? true : false;
    persistProfiles();
}

function getProfileDayStatus(profile, year, month, day) {
    const schedule = profile.schedule;
    const cycleDays = schedule.workDays + schedule.offDays;
    if (cycleDays <= 0) return 'off';

    const targetDateUtc = Date.UTC(year, month, day);
    const startDateUtc = new Date(schedule.startDate).getTime();
    const diffDays = Math.floor((targetDateUtc - startDateUtc) / (1000 * 60 * 60 * 24));
    const cycleDay = ((diffDays % cycleDays) + cycleDays) % cycleDays;
    return cycleDay < schedule.workDays ? 'work' : 'off';
}

function getVisibleProfilesForDay(year, month, day) {
    return getVisibleProfiles().map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        status: getProfileDayStatus(p, year, month, day)
    }));
}

function clearAllProfiles() {
    profilesState.profiles = [];
    persistProfiles();
}
