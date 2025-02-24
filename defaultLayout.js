export function createDefaultCard(resort) {
    const webcamUrls = {
        "Apex Mountain": "https://apexresort.com/weather/?1#live-webcams",
        "Mt Baldy": "https://baldyresort.com/baldy-mt-resort/webcams/",
        "Powder King": "https://www.powderking.com/mountain/ski-report",
        "Nakiska": "https://skinakiska.com/conditions/mountain-cam/",
        "Castle Mountain": "https://www.skicastle.ca/webcams/",
        "Pass Powderkeg": "https://www.passpowderkeg.com/home/snowcam/",
        "Fairmont Hot Springs": "https://www.fairmonthotsprings.com/resort-webcams",
        "Shames Mountain": "https://mymountaincoop.ca/shames-mountain/our-mountain/snow-report/#webcam",
        "Manning Park": "https://manningpark.com/weather-webcams-and-trail-status/",
        "Big White": "https://www.bigwhite.com/mountain-conditions/webcams",
        "Hudson Bay Mountain": "https://hudsonbaymountain.com/conditions/",
        "Cypress Mountain": "https://www.cypressmountain.com/mountain-report#downhill-webcams",
        "Fernie Alpine": "https://skifernie.com/conditions/snow-report/",
        "Grouse Mountain": "https://www.grousemountain.com/web-cams/",
        "Sasquatch Mountain" : "https://sasquatchmountain.ca/weather-and-conditions/webcams/",
        "Kicking Horse": "https://kickinghorseresort.com/conditions/mountain-cam/",
        "Kimberley Alpine": "https://skikimberley.com/conditions/mountain-cam/",
        "Mount Seymour": "https://mtseymour.ca/the-mountain/todays-conditions-hours#block-webcams",
        "Mount Washington": "https://www.mountwashington.ca/the-mountain/conditions/snow-report.html#section-id-1693592933213",
        "Panorama Mountain": "https://www.panoramaresort.com/panorama-today/daily-snow-report/#webcam10",
        "Red Mountain": "https://www.redresort.com/report/",
        "Revelstoke Mountain": "https://www.revelstokemountainresort.com/mountain/conditions/webcams/",
        "SilverStar Mountain": "https://www.skisilverstar.com/the-mountain/webcams",
        "Sun Peaks": "https://www.sunpeaksresort.com/ski-ride/weather-conditions-cams/webcams",
        "Whistler Blackcomb": "https://whistlerpeak.com/",
        "Whitewater": "https://skiwhitewater.com/webcams/",
        "Lake Louise": "https://www.skilouise.com/snow-conditions/",
        "Sunshine Village": "https://www.skibanff.com/conditions",
        "Mt Norquay": "https://banffnorquay.com/winter/conditions/",
        "Marmot Basin": "https://www.skimarmot.com/mountain/weather-conditions/",
        "Mt Baker": "https://www.mtbaker.us/snow-report/",
        "Crystal Mountain WA": "https://www.crystalmountainresort.com/the-mountain/mountain-report-and-webcams/webcams",
        "Stevens Pass": "https://www.stevenspass.com/the-mountain/mountain-conditions/mountain-cams.aspx"
    };

    let webcamUrl = webcamUrls[resort.name];

    return `
    <div class="resort-card rounded-2xl p-4 shadow-lg mb-6 backdrop-blur-md bg-white/80">
      <div class="mb-3 flex justify-between items-center">
        <div>
          <h2 class="text-xl font-semibold text-text-primary tracking-tight">${resort.name}</h2>
          <p class="text-xs text-text-secondary">${resort.elevation}</p>
        </div>
        ${webcamUrl ? `
          <a href="${webcamUrl}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="flex items-center gap-2 px-3 py-1.5 bg-snow-blue rounded-lg hover:bg-blue-50 transition-colors"
             ${resort.name === "Mount Seymour" ? `onclick="handleSeymourClick(event, this)"` : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-text-blue">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            <span class="text-sm font-medium text-text-blue">Webcams</span>
          </a>
        ` : ''}
      </div>
      <div class="relative">
        <button 
          onclick="this.parentElement.querySelector('.scroll-container').scrollBy({left: -200, behavior: 'smooth'})"
          class="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 bg-white/80 rounded-full p-2 shadow-lg hover:bg-white/90 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button 
          onclick="this.parentElement.querySelector('.scroll-container').scrollBy({left: 200, behavior: 'smooth'})"
          class="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 bg-white/80 rounded-full p-2 shadow-lg hover:bg-white/90 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
        <div class="scroll-container overflow-x-auto hide-scrollbar">
          <div class="flex gap-3 pb-2" style="width: max-content">
            ${resort.days.map(day => {
        const dayStats = calculateDayStats(day);
        const weatherText = formatWeatherText(day.periods);
        return `
                <div class="w-[180px]">
                  <div class="flex items-center gap-1 mb-1">
                    <h3 class="text-sm font-semibold text-text-primary tracking-tight">${day.name}</h3>
                    <span class="text-lg">${day.weatherEmoji}</span>
                  </div>
                  <div class="bg-snow-blue rounded-xl p-3 backdrop-blur-sm">
                    <div class="flex items-center gap-2">
                      <div class="text-2xl font-bold ${getTemperatureClass(dayStats.maxTemp)}">${dayStats.maxTemp}°C</div>
                      ${dayStats.snow > 0 ? `
                        <div class="text-sm font-bold ${dayStats.snow >= 20 ? 'rainbow-text' : (dayStats.snow >= 10 ? 'apple-rainbow-text' : 'text-text-blue')}">
                          ${dayStats.snow} cm snow
                        </div>
                      ` : ''}
                    </div>
                    <div class="text-sm text-text-primary mt-1 font-medium truncate" title="${weatherText}">${weatherText}</div>
                    <div class="text-xs font-medium ${dayStats.wind >= 20 ? 'text-text-blue' : 'text-text-secondary'} mt-1">
                      ${dayStats.wind} km/h wind
                    </div>
                    <div class="mt-2 pt-2 border-t border-black/5">
                      <div class="text-xs text-text-primary font-medium">
                        Freezing: ${day.freezingLevel}
                      </div>
                      <div class="text-xs font-medium mt-0.5 truncate ${day.snowCondition.isRainbow ? 'apple-rainbow-text' : 'text-text-blue'}" title="${day.snowCondition.text}">
                        ${day.snowCondition.text}
                      </div>
                    </div>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Add this script to handle Mount Seymour clicks
if (typeof window !== 'undefined') {
    let seymourClicks = 0;
    let lastClickTime = 0;

    window.handleSeymourClick = function(event, element) {
        seymourClicks++;

        if (seymourClicks >= 3) {
            event.preventDefault();
            window.location.href = "https://www.youtube.com/watch?v=CSD2J8yaMmM";
        }
    };
}

function formatWeatherText(periods) {
    if (!periods || periods.length === 0) return 'No data';

    const amPeriod = periods.find(p => p.time === 'AM');
    const pmPeriod = periods.find(p => p.time === 'PM');

    if (amPeriod && pmPeriod) {
        // If AM and PM conditions are the same, show just one
        if (amPeriod.condition === pmPeriod.condition) {
            return amPeriod.condition;
        }
        return `${amPeriod.condition} / ${pmPeriod.condition}`;
    } else if (pmPeriod) {
        return pmPeriod.condition;
    } else if (periods.length === 1) {
        return periods[0].condition;
    }

    return periods[0].condition;
}

function calculateDayStats(day) {
    const periods = day.periods;
    if (!periods.length) return { maxTemp: 0, snow: 0, wind: 0 };

    let maxTemp = -Infinity;
    let totalSnow = 0;

    // Get PM wind or fallback to available wind
    let wind = 0;
    const pmPeriod = periods.find(p => p.time === 'PM');
    if (pmPeriod) {
        wind = parseFloat(pmPeriod.wind.replace(' km/h', '')) || 0;
    } else if (periods.length > 0) {
        // If no PM period, take the first available wind value
        wind = parseFloat(periods[0].wind.replace(' km/h', '')) || 0;
    }

    periods.forEach(period => {
        // Temperature - find maximum
        const temp = parseFloat(period.temp.replace('°C', '')) || 0;
        maxTemp = Math.max(maxTemp, temp);

        // Snow - accumulate
        const snowAmount = parseFloat(period.snow.replace(' cm', '')) || 0;
        totalSnow += snowAmount;
    });

    return {
        maxTemp: Math.round(maxTemp * 10) / 10,
        snow: Math.round(totalSnow * 10) / 10,
        wind: Math.round(wind)
    };
}

function getTemperatureClass(temp) {
    const temperature = parseFloat(temp);
    if (temperature <= 0) return 'text-blue-600 font-semibold';
    if (temperature <= 5) return 'text-green-600 font-semibold';
    if (temperature <= 10) return 'text-orange-500 font-semibold';
    return 'text-red-500 font-semibold';
}