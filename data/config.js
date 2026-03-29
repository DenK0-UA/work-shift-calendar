// --- Дані та Налаштування ---
const APP_RELEASE_VERSION = '1.0.22';
const APP_UPDATE_CHANNEL_DEFAULT = 'stable';
const APP_UPDATE_MANIFEST_URLS = {
    stable: 'https://denk0-ua.github.io/work-shift-calendar/stable/version.json',
    beta: 'https://denk0-ua.github.io/work-shift-calendar/beta/version.json'
};
const APP_UPDATE_BETA_ACCESS_URL = 'https://denk0-ua.github.io/work-shift-calendar/beta/access.json';
const APP_UPDATE_CHECK_ENABLED = true;
const APP_UPDATE_CHECK_TIMEOUT_MS = 5000;

const DEMO_TODAY = new Date();
const DEFAULT_SHIFT_START_DATE = new Date(Date.UTC(
    DEMO_TODAY.getFullYear(),
    DEMO_TODAY.getMonth(),
    DEMO_TODAY.getDate()
));
let shiftStartDateUTC = DEFAULT_SHIFT_START_DATE.getTime();

function getDefaultScheduleConfig() {
    return {
        type: '5/5',
        workDays: 5,
        offDays: 5,
        startDate: DEFAULT_SHIFT_START_DATE.toISOString()
    };
}

function isLegacyDefaultStartDate(startDate) {
    if (typeof startDate !== 'string' || !startDate) {
        return false;
    }

    return startDate.startsWith('2025-03-27T') || startDate.startsWith('2026-03-27T');
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
    if (
        !schedule.startDate ||
        Number.isNaN(new Date(schedule.startDate).getTime()) ||
        isLegacyDefaultStartDate(schedule.startDate)
    ) {
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
const fixedHolidays = {
    "01-01": "Новий рік",
    "03-08": "Міжнародний жіночий день",
    "05-01": "День праці",
    "05-08": "День пам'яті та перемоги",
    "06-28": "День Конституції",
    "07-15": "День Української Державності",
    "08-24": "День Незалежності",
    "10-01": "День захисників і захисниць",
    "12-25": "Різдво Христове"
};

const HOLIDAY_API_COUNTRY_CODE = 'UA';
const HOLIDAY_API_BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const HOLIDAY_CACHE_PREFIX = 'holidayData';
const HOLIDAY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HOLIDAY_RETRY_DELAY_MS = 30 * 60 * 1000;
const holidayStore = {
    byYear: {},
    isFreshByYear: {},
    nextRetryAtByYear: {},
    loadingYears: new Set()
};

function toMonthDayKey(month, day) {
    return `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getOrthodoxEasterDate(year) {
    const a = year % 4;
    const b = year % 7;
    const c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31) - 1;
    const day = ((d + e + 114) % 31) + 1;
    const calendarShiftDays = Math.floor(year / 100) - Math.floor(year / 400) - 2;

    return new Date(Date.UTC(year, month, day + calendarShiftDays));
}

function getMovableHolidays(year) {
    const orthodoxEaster = getOrthodoxEasterDate(year);
    const trinity = new Date(orthodoxEaster.getTime());
    trinity.setUTCDate(trinity.getUTCDate() + 49);

    return {
        [toMonthDayKey(orthodoxEaster.getUTCMonth(), orthodoxEaster.getUTCDate())]: 'Великдень',
        [toMonthDayKey(trinity.getUTCMonth(), trinity.getUTCDate())]: 'Трійця'
    };
}

function getFallbackHolidayName(year, month, day) {
    const key = toMonthDayKey(month, day);
    return getMovableHolidays(year)[key] || fixedHolidays[key] || '';
}

function getHolidayStorageKey(year) {
    return `${HOLIDAY_CACHE_PREFIX}:${HOLIDAY_API_COUNTRY_CODE}:${year}`;
}

function safeReadHolidayCache(year) {
    try {
        const rawValue = localStorage.getItem(getHolidayStorageKey(year));
        if (!rawValue) {
            return null;
        }

        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.holidays !== 'object') {
            return null;
        }

        return {
            holidays: parsed.holidays,
            fetchedAt: Number(parsed.fetchedAt) || 0
        };
    } catch (e) {
        return null;
    }
}

function safeWriteHolidayCache(year, holidays) {
    try {
        localStorage.setItem(
            getHolidayStorageKey(year),
            JSON.stringify({
                fetchedAt: Date.now(),
                holidays
            })
        );
    } catch (e) {
        console.warn('Не вдалося зберегти свята у кеш', e);
    }
}

function normalizeHolidayApiResponse(data) {
    if (!Array.isArray(data)) {
        return {};
    }

    return data.reduce((acc, holiday) => {
        if (!holiday || holiday.global === false || typeof holiday.date !== 'string') {
            return acc;
        }

        const name = typeof holiday.localName === 'string' && holiday.localName.trim()
            ? holiday.localName.trim()
            : (typeof holiday.name === 'string' ? holiday.name.trim() : '');

        if (!name) {
            return acc;
        }

        const [, monthStr, dayStr] = holiday.date.split('-');
        if (!monthStr || !dayStr) {
            return acc;
        }

        acc[`${monthStr}-${dayStr}`] = name;
        return acc;
    }, {});
}

function hydrateHolidayYear(year) {
    if (Object.prototype.hasOwnProperty.call(holidayStore.byYear, year)) {
        return holidayStore.byYear[year];
    }

    const cached = safeReadHolidayCache(year);
    if (!cached) {
        return null;
    }

    holidayStore.byYear[year] = cached.holidays;
    holidayStore.isFreshByYear[year] = (Date.now() - cached.fetchedAt) < HOLIDAY_CACHE_TTL_MS;
    return holidayStore.byYear[year];
}

function notifyHolidayYearUpdated(year) {
    if (
        typeof renderCalendar === 'function' &&
        typeof currentState !== 'undefined' &&
        currentState &&
        currentState.year === year
    ) {
        renderCalendar(currentState.year, currentState.month);
    }
}

async function ensureHolidayDataForYear(year) {
    hydrateHolidayYear(year);

    if (holidayStore.loadingYears.has(year) || holidayStore.isFreshByYear[year] === true) {
        return;
    }

    if (holidayStore.nextRetryAtByYear[year] && Date.now() < holidayStore.nextRetryAtByYear[year]) {
        return;
    }

    holidayStore.loadingYears.add(year);

    try {
        const response = await fetch(`${HOLIDAY_API_BASE_URL}/${year}/${HOLIDAY_API_COUNTRY_CODE}`);
        if (!response.ok) {
            throw new Error(`Holiday request failed: ${response.status}`);
        }

        const data = await response.json();
        const holidays = normalizeHolidayApiResponse(data);

        if (Object.keys(holidays).length > 0) {
            holidayStore.byYear[year] = holidays;
            holidayStore.isFreshByYear[year] = true;
            delete holidayStore.nextRetryAtByYear[year];
            safeWriteHolidayCache(year, holidays);
            notifyHolidayYearUpdated(year);
            return;
        }

        throw new Error('Holiday data is missing');
    } catch (e) {
        holidayStore.isFreshByYear[year] = false;
        holidayStore.nextRetryAtByYear[year] = Date.now() + HOLIDAY_RETRY_DELAY_MS;
        console.warn(`Не вдалося оновити свята для ${year}`, e);
    } finally {
        holidayStore.loadingYears.delete(year);
    }
}

function getHolidayName(year, month, day) {
    hydrateHolidayYear(year);
    const key = toMonthDayKey(month, day);
    return holidayStore.byYear[year]?.[key] || getFallbackHolidayName(year, month, day);
}
