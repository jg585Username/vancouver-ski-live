export function createResortCard(resort) {
    return `
    <div class="resort-card rounded-3xl p-5 shadow-lg mb-6 transition-all duration-300">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h2 class="text-2xl font-bold text-text-primary">${resort.name}</h2>
          <p class="text-sm font-medium text-text-secondary">Base Elevation: ${resort.elevation}</p>
        </div>
        <div class="text-xs font-medium text-text-secondary">
          Last updated: ${new Date().toLocaleTimeString()}
        </div>
      </div>
      
      <div class="overflow-x-auto">
        <div class="min-w-[1400px]">
          <table class="w-full border-separate border-spacing-4">
            <thead>
              <tr>
                <th class="w-12"></th>
                ${resort.days.map(day => {
        const pmPeriod = day.periods.find(p => p.time === 'PM');
        const nightPeriod = day.periods.find(p => p.time === 'Night');
        const displayCondition = pmPeriod?.condition || nightPeriod?.condition || day.weather;

        return `
                    <th class="px-5 py-2 bg-snow-blue rounded-2xl" style="min-width: 280px">
                      <div class="text-base font-bold text-text-primary flex items-center justify-center gap-2">
                        ${day.name}
                        <span class="inline-flex items-center">${getWeatherEmoji(displayCondition)}</span>
                      </div>
                      <div class="text-xs font-semibold text-text-secondary">${displayCondition}</div>
                    </th>
                  `;
    }).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="align-top pt-3">
                  <div class="flex flex-col gap-[42px] pl-3 pt-[60px] text-sm font-semibold text-text-secondary">
                    <div>Snow</div>
                    <div>Rain</div>
                    <div>Wind</div>
                    <div>Weather</div>
                  </div>
                </td>
                ${resort.days.map(day => `
                  <td class="px-3 py-2">
                    <div class="space-y-2">
                      <div class="grid grid-cols-3 gap-4">
                        ${day.periods.map((period, index) => {
        const temp = parseInt(period.temp);
        const tempStyle = getTemperatureStyle(temp);
        const snowAmount = parseFloat(period.snow) || 0;
        const snowStyle = snowAmount > 0 ? (
            snowAmount >= 5 ?
                'background: linear-gradient(209deg, #ea6044 39%, #dc5083 50%, #9a6df7 67%, #3f8def 81%); -webkit-background-clip: text; background-clip: text; color: transparent;' :
                'color: #007AFF'
        ) : '';
        const windSpeed = parseFloat(period.wind) || 0;

        return `
                            <div class="period-card p-3 rounded-2xl flex flex-col items-center text-center ${
            day.periods.length === 1 ? 'col-span-3' :
                day.periods.length === 2 && index === 1 ? 'col-span-2' : ''
        }">
                              <div class="text-sm font-bold text-text-primary mb-1">${period.time}</div>
                              <div class="text-lg font-bold mb-4" style="${tempStyle}">${period.temp}</div>
                              <div class="flex flex-col gap-[32px] text-sm w-full">
                                <div class="font-semibold ${snowAmount === 0 ? 'text-text-secondary' : ''}" style="${snowStyle}">${period.snow}</div>
                                <div class="text-text-secondary font-semibold">${period.rain}</div>
                                <div class="font-semibold ${windSpeed >= 20 ? 'text-text-blue' : 'text-text-secondary'}">${period.wind}</div>
                                <div class="text-text-secondary font-semibold">${period.condition}</div>
                              </div>
                            </div>
                          `;
    }).join('')}
                      </div>
                      <div class="p-2.5 bg-snow-blue rounded-2xl">
                        <div class="text-sm">
                          <div class="text-text-primary font-bold">Freezing Elevation: ${day.freezingLevel}</div>
                          <div class="${day.snowCondition.isRainbow ? 'rainbow-text' : 'text-text-blue'} font-semibold mt-0.5">${day.snowCondition.text}</div>
                        </div>
                      </div>
                    </div>
                  </td>
                `).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
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

function getTemperatureStyle(temp) {
    if (temp <= 0) {
        // For below zero temperatures, use the gradient
        return 'background: linear-gradient(209deg, #ea6044 39%, #dc5083 50%, #9a6df7 67%, #3f8def 81%); -webkit-background-clip: text; background-clip: text; color: transparent;';
    } else {
        // For above zero temperatures, use an exponential color transition
        // Colors: Blue (#007AFF) -> Yellow (#FFD60A) -> Orange (#FF9F0A) -> Red (#FF3B30)
        const t = Math.pow(temp / 10, 2); // Exponential curve
        let color;

        if (t <= 0.09) { // 0-3°C: Blue to Yellow
            const normalizedT = t / 0.09;
            color = {
                r: Math.round(lerp(0, 255, normalizedT)),
                g: Math.round(lerp(122, 214, normalizedT)),
                b: Math.round(lerp(255, 10, normalizedT))
            };
        } else if (t <= 0.25) { // 3-5°C: Yellow to Orange
            const normalizedT = (t - 0.09) / 0.16;
            color = {
                r: 255,
                g: Math.round(lerp(214, 159, normalizedT)),
                b: 10
            };
        } else { // 5-10°C: Orange to Red
            const normalizedT = (t - 0.25) / 0.75;
            color = {
                r: 255,
                g: Math.round(lerp(159, 59, normalizedT)),
                b: Math.round(lerp(10, 48, normalizedT))
            };
        }

        return `color: rgb(${color.r}, ${color.g}, ${color.b})`;
    }
}

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}