// --- Дані та Налаштування ---
const DEFAULT_SHIFT_START_DATE = new Date(Date.UTC(2026, 2, 27)); // 27 березня 2026
let shiftStartDateUTC = Date.UTC(2026, 2, 27);
const DEMO_TODAY = new Date();

function getDefaultScheduleConfig() {
    return {
        type: '5/5',
        workDays: 5,
        offDays: 5,
        startDate: DEFAULT_SHIFT_START_DATE.toISOString()
    };
}

function getShiftStartDateUTC() {
    const schedule = getScheduleConfig();
    try {
        if (schedule && schedule.startDate) {
            const parsed = new Date(schedule.startDate);
            if (!Number.isNaN(parsed.getTime())) {
                const utc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
                return utc;
            }
        }
    } catch (e) {
        console.warn('Помилка читання дати старту графіку', e);
    }
    return shiftStartDateUTC;
}

// якщо з localStorage приходить некоректна дата, нормалізуєм
function normalizeStartDate() {
    const schedule = getScheduleConfig();
    if (!schedule.startDate || Number.isNaN(new Date(schedule.startDate).getTime())) {
        schedule.startDate = DEFAULT_SHIFT_START_DATE.toISOString();
        setScheduleConfig(schedule);
    }
}

let currentState = {
    year: DEMO_TODAY.getFullYear(),
    month: DEMO_TODAY.getMonth()
};

const localeData = {
    months: ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"],
    days: ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"]
};

// Державні свята
const holidays = {
    "01-01": "Новий рік",
    "03-08": "Міжнародний жіночий день",
    "04-12": "Великдень",
    "05-01": "День праці",
    "05-08": "День пам'яті та перемоги",
    "06-28": "День Конституції",
    "07-15": "День Української Державності",
    "08-24": "День Незалежності",
    "10-01": "День захисників і захисниць",
    "12-25": "Різдво Христове"
};
