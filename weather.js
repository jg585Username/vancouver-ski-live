export async function fetchAllData() {
    try {
        const response = await fetch('https://snow-scraper.azurewebsites.net/all');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error('Error fetching weather data:', err);
        throw err;
    }
}

export function processResortData(allData, resortName, elevation = 'botData') {
    try {
        const resortData = allData[elevation].resorts.find(r => r.resort === resortName);
        if (!resortData || !resortData.data) {
            throw new Error('Resort data not found');
        }

        const data = resortData.data;
        if (!data.success) {
            throw new Error('Data object is unsuccessful');
        }

        const days = [];
        const daysInWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        let currentDayIndex = today.getDay();

        // Check if first day has only one period and it's between 12 AM - 6 AM
        const currentHour = today.getHours();
        const isEarlyMorning = currentHour >= 0 && currentHour < 6;
        const firstDayHasOnePeriod = data.temperatureBlocks[0]?.length === 1;

        // If it's early morning and first day has one period, treat it as previous day's night forecast
        if (isEarlyMorning && firstDayHasOnePeriod) {
            currentDayIndex = (currentDayIndex - 1 + 7) % 7; // Go back one day
        }

        for (let i = 0; i < data.temperatureBlocks.length; i++) {
            const dayIndex = (currentDayIndex + i) % 7;
            const mainCondition = data.phrasesBlocks[i]?.[0] || '';
            const highestFreezingLevel = getHighestFreezingLevel(data.freezinglevelBlocks[i]);
            const snowCondition = getSnowCondition(highestFreezingLevel, data.bottomElevation);

            days.push({
                name: daysInWeek[dayIndex],
                weather: mainCondition,
                weatherEmoji: getWeatherEmoji(mainCondition),
                periods: createPeriods(
                    data.temperatureBlocks[i],
                    data.snowBlocks[i],
                    data.rainBlocks[i],
                    data.windBlocks[i],
                    data.phrasesBlocks[i]
                ),
                freezingLevel: `${highestFreezingLevel || '-'} m`,
                snowCondition
            });
        }

        if (days.length === 0) {
            throw new Error('No forecast days found');
        }

        return {
            name: resortName.replace(/-/g, ' '),
            elevation: data.bottomElevation ? `${data.bottomElevation}m` : 'N/A',
            days
        };
    } catch (err) {
        console.error('Error processing resort data:', err);
        throw err;
    }
}

function getHighestFreezingLevel(levels) {
    if (!levels || !levels.length) return null;
    const validLevels = levels.filter(level => typeof level === 'number' && !isNaN(level));
    return validLevels.length > 0 ? Math.max(...validLevels) : null;
}

function getWeatherEmoji(condition) {
    if (!condition) return '⛅';
    condition = condition.toLowerCase();

    if (condition.includes('snow')) return '❄️';
    if (condition.includes('rain')) return '🌧️';
    if (condition.includes('clear')) return '☀️';
    if (condition.includes('cloud')) return '☁️';
    return '⛅';
}

function getSnowCondition(freezingLevel, baseElevation) {
    if (!freezingLevel || !baseElevation) return { text: 'Mixed conditions', isRainbow: false };

    const difference = freezingLevel - baseElevation;

    if (freezingLevel < baseElevation) {
        return { text: 'Dry, Powder Snow!', isRainbow: true };
    } else if (difference <= 200) {
        return { text: 'Icy or Sticky Snow', isRainbow: false };
    } else {
        return { text: 'Wet, Slushy Snow', isRainbow: false };
    }
}

function createPeriods(tempBlock, snowBlock, rainBlock, windBlock, phraseBlock) {
    if (!tempBlock || !tempBlock.length) return [];

    const periods = [];
    const totalPeriods = tempBlock.length;

    for (let i = 0; i < totalPeriods; i++) {
        periods.push({
            time: getPeriodLabel(i, totalPeriods),
            temp: `${tempBlock[i]}°C`,
            snow: `${snowBlock?.[i] || '-'} cm`,
            rain: `${rainBlock?.[i] * 10 || '-'} mm`,
            wind: `${windBlock?.[i] || '-'} km/h`,
            condition: phraseBlock?.[i] || 'Unknown'
        });
    }

    return periods;
}

function getPeriodLabel(index, totalPeriods) {
    if (totalPeriods === 1) {
        return 'Night';
    } else if (totalPeriods === 2) {
        return index === 0 ? 'PM' : 'Night';
    } else if (totalPeriods === 3) {
        return ['AM', 'PM', 'Night'][index];
    }
    return `Period ${index + 1}`;
}