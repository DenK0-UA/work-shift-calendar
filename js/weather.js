let weatherForecastCache = null;
let weatherForecastRange = null;
let weatherLastUpdatedAt = null;
let weatherState = 'idle';
let weatherLastError = null;
let weatherCachedCoords = null;

const WEATHER_FALLBACK_LAT = 50.35;
const WEATHER_FALLBACK_LON = 30.95;
const WEATHER_GEO_TIMEOUT_MS = 6000;
const WEATHER_AUTO_REFRESH_MS = 3 * 60 * 60 * 1000;
let weatherAutoRefreshTimer = null;

function scheduleWeatherAutoRefresh() {
    if (weatherAutoRefreshTimer) {
        clearTimeout(weatherAutoRefreshTimer);
    }
    weatherAutoRefreshTimer = setTimeout(() => {
        weatherAutoRefreshTimer = null;
        fetchTodayWeather();
    }, WEATHER_AUTO_REFRESH_MS);
}

function getWeatherCoords() {
    return new Promise((resolve) => {
        if (weatherCachedCoords) {
            resolve(weatherCachedCoords);
            return;
        }

        if (!navigator.geolocation) {
            resolve({ lat: WEATHER_FALLBACK_LAT, lon: WEATHER_FALLBACK_LON });
            return;
        }

        const timeoutId = setTimeout(() => {
            resolve({ lat: WEATHER_FALLBACK_LAT, lon: WEATHER_FALLBACK_LON });
        }, WEATHER_GEO_TIMEOUT_MS);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                clearTimeout(timeoutId);
                weatherCachedCoords = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                resolve(weatherCachedCoords);
            },
            () => {
                clearTimeout(timeoutId);
                resolve({ lat: WEATHER_FALLBACK_LAT, lon: WEATHER_FALLBACK_LON });
            },
            { timeout: WEATHER_GEO_TIMEOUT_MS, maximumAge: 60 * 60 * 1000 }
        );
    });
}

function getWeatherIcon(code, isDay = 1) {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code <= 3) return isDay ? '⛅' : '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    if (code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

function getWeatherLabel(code) {
    if (code === 0) return 'Ясно';
    if (code === 1) return 'Переважно ясно';
    if (code === 2) return 'Мінлива хмарність';
    if (code === 3) return 'Хмарно';
    if (code <= 48) return 'Туман';
    if (code <= 57) return 'Мряка';
    if (code <= 67) return 'Дощ';
    if (code <= 77) return 'Сніг';
    if (code <= 82) return 'Зливи';
    if (code <= 86) return 'Снігопад';
    if (code >= 95) return 'Гроза';
    return 'Без уточнення';
}

function formatWeatherUpdateTime(date = new Date()) {
    return new Intl.DateTimeFormat('uk-UA', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getWeatherRisk(entry) {
    if (!entry) return null;
    if (entry.weatherCode >= 95) return 'Гроза';
    if (entry.precipitationProbability >= 70) return 'Опади';
    if (entry.maxTemp >= 30) return 'Спека';
    if (entry.minTemp <= -2) return 'Холод';
    if (entry.weatherCode >= 71 && entry.weatherCode <= 86) return 'Сніг';
    return null;
}

function getWeatherFeel(entry) {
    if (!entry) return 'Немає даних';
    if (entry.weatherCode >= 95) return 'Нестабільно';
    if (entry.weatherCode >= 71 && entry.weatherCode <= 86) return 'Зимово';
    if (entry.precipitationProbability >= 70) return 'Мокро';
    if (entry.maxTemp >= 30) return 'Спекотно';
    if (entry.maxTemp >= 24 && entry.precipitationProbability < 35 && entry.weatherCode <= 2) return 'Комфортно';
    if (entry.minTemp <= 3) return 'Холодно';
    if (entry.weatherCode <= 2 && entry.maxTemp >= 16 && entry.maxTemp <= 23) return 'Приємно';
    if (entry.weatherCode === 3) return 'Похмуро';
    return 'Змінно';
}

function getWeatherDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildWeatherForecastMap(data) {
    const map = {};

    if (!data || !data.daily || !data.daily.time) {
        return map;
    }

    data.daily.time.forEach((dateKey, index) => {
        const weatherCode = data.daily.weather_code[index];
        map[dateKey] = {
            dateKey,
            weatherCode,
            icon: getWeatherIcon(weatherCode, 1),
            label: getWeatherLabel(weatherCode),
            maxTemp: Math.round(data.daily.temperature_2m_max[index]),
            minTemp: Math.round(data.daily.temperature_2m_min[index]),
            precipitationProbability: Math.round(data.daily.precipitation_probability_max[index] || 0)
        };
    });

    return map;
}

function getWeatherForDate(year, month, day) {
    if (!weatherForecastCache) {
        return null;
    }

    return weatherForecastCache[getWeatherDateKey(year, month, day)] || null;
}

const MODAL_REVEAL_DURATION_MS = 260;

function setModalRevealState(sectionEl, isOpen) {
    if (!sectionEl) {
        return;
    }

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
    }, MODAL_REVEAL_DURATION_MS);
}

function setModalWeather({ icon, summary, meta, hidden = false }) {
    const weatherBlock = document.getElementById('m-weather');
    setModalRevealState(weatherBlock, !hidden);

    if (hidden) {
        return;
    }

    document.getElementById('m-weather-icon').textContent = icon;
    document.getElementById('m-weather-summary').textContent = summary;
    document.getElementById('m-weather-meta').textContent = meta;
}

function getWeatherStateForDate(year, month, day) {
    const dateKey = getWeatherDateKey(year, month, day);
    const weather = getWeatherForDate(year, month, day);

    if (weather) {
        return { type: 'ready', weather };
    }

    if (weatherState === 'loading' || weatherState === 'idle') {
        return { type: 'loading' };
    }

    if (weatherForecastRange && (dateKey < weatherForecastRange.start || dateKey > weatherForecastRange.end)) {
        return {
            type: 'unavailable',
            start: weatherForecastRange.start,
            end: weatherForecastRange.end
        };
    }

    if (weatherState === 'error') {
        return { type: 'error', error: weatherLastError };
    }

    return {
        type: 'unavailable',
        start: weatherForecastRange?.start,
        end: weatherForecastRange?.end
    };
}

function updateModalWeather(year, month, day) {
    const weatherView = getWeatherStateForDate(year, month, day);

    if (weatherView.type === 'ready') {
        const { weather } = weatherView;
        const risk = getWeatherRisk(weather);
        const feel = getWeatherFeel(weather);
        const riskText = risk ? ` · ризик: ${risk}` : '';
        const updatedAt = weatherLastUpdatedAt
            ? formatWeatherUpdateTime(weatherLastUpdatedAt)
            : formatWeatherUpdateTime();

        setModalWeather({
            icon: weather.icon,
            summary: `${feel} · ${weather.label}`,
            meta: `Бориспіль · ${weather.maxTemp}° / ${weather.minTemp}° · опади ${weather.precipitationProbability}%${riskText} · оновлено ${updatedAt}`
        });
        return;
    }

    if (weatherView.type === 'loading') {
        setModalWeather({
            icon: '⏳',
            summary: 'Завантажуємо прогноз',
            meta: 'Бориспіль · отримуємо дані для обраної дати'
        });
        return;
    }

    if (weatherView.type === 'unavailable') {
        setModalWeather({ hidden: true });
        return;
    }

    setModalWeather({ hidden: true });
}

async function fetchTodayWeather() {
    const refreshButtons = document.querySelectorAll('#modal-weather-refresh');
    refreshButtons.forEach((button) => {
        button.disabled = true;
    });

    weatherState = 'loading';
    weatherLastError = null;

    const modal = document.getElementById('modal');
    if (modal.classList.contains('active')) {
        updateModalWeather(
            Number(modal.dataset.year),
            Number(modal.dataset.month),
            Number(modal.dataset.day)
        );
    }

    try {
        const { lat, lon } = await getWeatherCoords();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=10`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Weather request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.daily || !data.daily.time || !data.daily.time.length) {
            throw new Error('Weather data is missing');
        }

        weatherForecastCache = buildWeatherForecastMap(data);
        weatherForecastRange = {
            start: data.daily.time[0],
            end: data.daily.time[data.daily.time.length - 1]
        };
        weatherLastUpdatedAt = new Date();
        weatherState = 'ready';
        scheduleWeatherAutoRefresh();

        if (modal.classList.contains('active')) {
            updateModalWeather(
                Number(modal.dataset.year),
                Number(modal.dataset.month),
                Number(modal.dataset.day)
            );
        }
    } catch (error) {
        weatherState = 'error';
        weatherLastError = error;
        scheduleWeatherAutoRefresh();

        if (modal.classList.contains('active')) {
            updateModalWeather(
                Number(modal.dataset.year),
                Number(modal.dataset.month),
                Number(modal.dataset.day)
            );
        }
    } finally {
        refreshButtons.forEach((button) => {
            button.disabled = false;
        });
    }
}
