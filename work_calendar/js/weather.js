let weatherForecastCache = null;

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

function setModalWeather({ icon, summary, meta, hidden = false }) {
    const weatherBlock = document.getElementById('m-weather');
    weatherBlock.hidden = hidden;

    if (hidden) {
        return;
    }

    document.getElementById('m-weather-icon').textContent = icon;
    document.getElementById('m-weather-summary').textContent = summary;
    document.getElementById('m-weather-meta').textContent = meta;
}

function updateModalWeather(year, month, day) {
    const weather = getWeatherForDate(year, month, day);

    if (!weather) {
        setModalWeather({ hidden: true });
        return;
    }

    const risk = getWeatherRisk(weather);
    const feel = getWeatherFeel(weather);
    const riskText = risk ? ` · ризик: ${risk}` : '';

    setModalWeather({
        icon: weather.icon,
        summary: `${feel} · ${weather.label}`,
        meta: `Бориспіль · ${weather.maxTemp}° / ${weather.minTemp}° · опади ${weather.precipitationProbability}%${riskText} · оновлено ${formatWeatherUpdateTime()}`
    });
}

async function fetchTodayWeather() {
    const refreshButtons = document.querySelectorAll('#modal-weather-refresh');
    refreshButtons.forEach((button) => {
        button.disabled = true;
    });

    try {
        const lat = 50.35;
        const lon = 30.95;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FKyiv&forecast_days=10`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Weather request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.daily || !data.daily.time || !data.daily.time.length) {
            throw new Error('Weather data is missing');
        }

        weatherForecastCache = buildWeatherForecastMap(data);
        const modal = document.getElementById('modal');
        if (modal.classList.contains('active')) {
            updateModalWeather(
                Number(modal.dataset.year),
                Number(modal.dataset.month),
                Number(modal.dataset.day)
            );
        }
    } catch (error) {
        weatherForecastCache = null;
        const modal = document.getElementById('modal');
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
