import './style.css';
import { fetchAllData, processResortData } from './weather.js';
import { createResortCard } from './templates.js';
import { createDefaultCard } from './defaultLayout.js';

const resortAliases = {
    // British Columbia
    "Apex Mountain": "Apex",
    "Mt Baldy": "Mt-Baldy-Ski-Area",
    "Big White": "Big-White",
    "Cypress Mountain": "Cypress-Mountain",
    "Fairmont Hot Springs": "Fairmont-Hot-Springs",
    "Fernie Alpine": "Fernie",
    "Grouse Mountain": "Grouse-Mountain",
    "Harper Mountain": "Harper-Mountain",
    "Hudson Bay Mountain": "Ski-Smithers",
    "Kicking Horse": "Kicking-Horse",
    "Kimberley Alpine": "Kimberley",
    "Manning Park": "Manning-Park-Resort",
    "Mount Cain": "MountCain",
    "Mount Timothy": "Mount-Timothy-Ski-Area",
    "Mount Washington": "Mount-Washington",
    "Mount Seymour": "Mount-Seymour",
    "Murray Ridge": "Murray-Ridge",
    "Panorama Mountain": "Panorama",
    "Powder King": "PowderKing",
    "Red Mountain": "Red-Mountain",
    "Revelstoke Mountain": "Revelstoke",
    "Sasquatch Mountain": "HemlockResort",
    "Shames Mountain": "ShamesMountain",
    "SilverStar Mountain": "Silver-Star",
    "Summit Lake Ski Area": "Summit-Lake-Ski-and-Snowboard-Area",
    "Sun Peaks": "Sun-Peaks",
    "Troll Resort": "Troll-Resort",
    "Whistler Blackcomb": "Whistler-Blackcomb",
    "Whitewater": "Whitewater",
    // Alberta
    "Lake Louise": "Lake-Louise",
    "Sunshine Village": "Sunshine",
    "Mt Norquay": "Banff-Norquay",
    "Marmot Basin": "Marmot-Basin",
    "Nakiska": "Nakiska",
    "Castle Mountain": "Castle-Mountain-Resort",
    "Pass Powderkeg": "Pass-Powderkeg",
    // Washington State
    "Mt Baker": "Mount-Baker",
    "Crystal Mountain WA": "Crystal-Mountain",
    "Stevens Pass" : "Stevens-Pass"
};

// Get API keys (resort IDs) from the aliases object
const skiResorts = Object.values(resortAliases);

// Get selected resorts from local storage or use defaults
const defaultSelectedResorts = ["Cypress-Mountain", "Mount-Seymour", "Grouse-Mountain"];
const savedResorts = localStorage.getItem('selectedResorts');
const initialSelectedResorts = savedResorts ? JSON.parse(savedResorts) : defaultSelectedResorts;

// Get selected elevation from local storage or use default
const defaultElevation = "bot";
const savedElevation = localStorage.getItem('selectedElevation');
const initialElevation = savedElevation || defaultElevation;

// Get selected sort option from local storage or use default
const defaultSort = "temperature";
const savedSort = localStorage.getItem('selectedSort');
const initialSort = savedSort || defaultSort;

// Get selected sort day from local storage or use default
const defaultSortDay = 0;
const savedSortDay = localStorage.getItem('selectedSortDay');
const initialSortDay = savedSortDay ? parseInt(savedSortDay) : defaultSortDay;

// Store all weather data
let allWeatherData = null;

// Loading controller
let loadingController = null;

// Get display order from local storage or use default
let isReversed = localStorage.getItem('reverseOrder') === 'true';

// Helper function to get display name from API ID
function getDisplayName(apiId) {
    return Object.entries(resortAliases).find(([name, id]) => id === apiId)?.[0] || apiId.replace(/-/g, ' ');
}

// Create and mount the app
function createApp() {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    // Add SF Pro Display font
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.cdnfonts.com/css/sf-pro-display';
    document.head.appendChild(fontLink);

    // Add meta tags
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0';
    document.head.appendChild(meta);

    const metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    metaDesc.content = 'Get real-time snow forecasts for your favorite British Columbia ski resorts';
    document.head.appendChild(metaDesc);

    // Set title
    document.title = 'Ski BC';

    // Create initial layout
    app.innerHTML = `
    <div class="min-h-screen p-8">
      <header class="text-center mb-12">
        <h1 class="text-4xl font-bold mb-2 apple-rainbow-text">Snow Forecast BC</h1>
        <p class="text-gray-600 font-semibold">The best forecast website for BC ski/board!</p>
        <p class="text-xs text-gray-400 font-normal">* forecast is conservative. tends to underestimate interior mountains</p>

      </header>
      
      <div class="max-w-7xl mx-auto">
        <div class="mb-8 flex flex-wrap gap-4 items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="relative">
              <button id="dropdown-button" class="w-full md:w-64 bg-white border border-gray-300 rounded-lg px-4 py-2 text-left flex items-center justify-between shadow-sm hover:bg-gray-50">
                <span class="block truncate">Select Resorts</span>
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <div id="dropdown-menu" class="hidden absolute z-10 mt-1 w-full md:w-64 bg-white rounded-lg shadow-lg max-h-96 overflow-y-auto">
                <div class="sticky top-0 bg-white p-2 border-b border-gray-200">
                  <div class="relative">
                    <input
                      type="text"
                      id="resort-search"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md pl-9 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Search resorts..."
                    >
                    <svg class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div class="p-2 space-y-1">
                  <label class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input type="checkbox" id="select-all" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span id="select-all-text" class="ml-2 text-sm font-medium">Select All</span>
                  </label>
                  <div class="border-t border-gray-200 my-2"></div>
                  <div id="resort-list">
                    ${skiResorts.map(resort => `
                      <label class="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" value="${resort}" class="resort-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" ${initialSelectedResorts.includes(resort) ? 'checked' : ''}>
                        <span class="ml-2 text-sm">${getDisplayName(resort)}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <div class="relative">
              <button id="elevation-button" class="w-full md:w-48 bg-white border border-gray-300 rounded-lg px-4 py-2 text-left flex items-center justify-between shadow-sm hover:bg-gray-50">
                <span id="elevation-text" class="block truncate capitalize">Base Forecast</span>
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <div id="elevation-menu" class="hidden absolute right-0 z-10 mt-1 w-48 bg-white rounded-lg shadow-lg">
                <div class="p-2 space-y-1">
                  <button class="elevation-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="bot">Base Forecast</button>
                  <button class="elevation-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="mid">Mid Forecast</button>
                  <button class="elevation-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="top">Peak Forecast</button>
                </div>
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="more-info"
                class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <span class="text-sm font-bold text-gray-900">Full View</span>
            </label>
          </div>

          <div class="flex items-center gap-4">
            <button
              id="reverse-order"
              class="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              ${isReversed ? '↑ Reverse Order' : '↓ Normal Order'}
            </button>

            <div class="relative">
              <button id="sort-button" class="w-full md:w-48 bg-white border border-gray-300 rounded-lg px-4 py-2 text-left flex items-center justify-between shadow-sm hover:bg-gray-50">
                <span id="sort-text" class="block truncate capitalize">Sort by Temperature</span>
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <div id="sort-menu" class="hidden absolute right-0 z-10 mt-1 w-48 bg-white rounded-lg shadow-lg">
                <div class="p-2 space-y-1">
                  <button class="sort-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="temperature">Sort by Temperature</button>
                  <button class="sort-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="snowfall">Sort by Snowfall</button>
                  <button class="sort-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="wind">Sort by Wind</button>
                </div>
              </div>
            </div>

            <div class="relative">
              <button id="sort-day-button" class="w-full md:w-32 bg-white border border-gray-300 rounded-lg px-4 py-2 text-left flex items-center justify-between shadow-sm hover:bg-gray-50">
                <span id="sort-day-text" class="block truncate capitalize">Today</span>
                <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <div id="sort-day-menu" class="hidden absolute right-0 z-10 mt-1 w-32 bg-white rounded-lg shadow-lg">
                <div class="p-2 space-y-1" id="sort-day-options">
                  <!-- Day options will be populated dynamically -->
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div id="forecasts" class="space-y-8"></div>
      </div>
    </div>
  `;

    return app;
}

function sortResorts(resorts, sortBy) {
    const selectedDay = parseInt(localStorage.getItem('selectedSortDay') || '0');
    const selectedElevation = localStorage.getItem('selectedElevation') || 'bot';
    const elevation = selectedElevation === 'bot' ? 'botData' : selectedElevation === 'mid' ? 'midData' : 'topData';

    let sortedResorts = [...resorts].sort((a, b) => {
        const resortDataA = processResortData(allWeatherData, a, elevation);
        const resortDataB = processResortData(allWeatherData, b, elevation);

        if (!resortDataA || !resortDataB) return 0;

        const dayA = resortDataA.days[selectedDay];
        const dayB = resortDataB.days[selectedDay];

        if (!dayA || !dayB) return 0;

        const getMaxTemp = (day) => {
            return Math.max(
                ...day.periods.map(period => {
                    const temp = parseFloat(period.temp);
                    return isNaN(temp) ? -Infinity : temp;
                })
            );
        };

        const getTotalSnow = (day) => {
            return day.periods.reduce((sum, period) => {
                const snow = parseFloat(period.snow) || 0;
                return sum + snow;
            }, 0);
        };

        const getPMWind = (day) => {
            const pmPeriod = day.periods.find(p => p.time === 'PM');
            const nightPeriod = day.periods.find(p => p.time === 'Night');

            return pmPeriod !== undefined
                ? parseFloat(pmPeriod.wind)
                : (nightPeriod !== undefined ? parseFloat(nightPeriod.wind) : 0);
        };

        switch (sortBy) {
            case 'temperature':
                return getMaxTemp(dayA) - getMaxTemp(dayB);
            case 'snowfall':
                return getTotalSnow(dayB) - getTotalSnow(dayA);
            case 'wind':
                return getPMWind(dayB) - getPMWind(dayA);
            default:
                return 0;
        }
    });

    // Apply reverse order if enabled
    if (isReversed) {
        sortedResorts = sortedResorts.reverse();
    }

    return sortedResorts;
}

async function loadResort(resortName) {
    try {
        const selectedElevation = localStorage.getItem('selectedElevation') || 'bot';
        const elevation = selectedElevation === 'bot' ? 'botData' : selectedElevation === 'mid' ? 'midData' : 'topData';

        // Check if loading was cancelled
        if (loadingController?.signal.aborted) {
            return false;
        }

        const resortData = processResortData(allWeatherData, resortName, elevation);
        if (resortData) {
            resortData.name = getDisplayName(resortName); // Use display name instead of API ID
            displayResort(resortName, resortData);
        }
        return true;
    } catch (err) {
        console.warn(`Failed to load ${resortName}:`, err);
        return false;
    }
}

function displayResort(resortName, resortData) {
    const forecastsContainer = document.getElementById('forecasts');
    const existingForecast = document.getElementById(`forecast-${resortName}`);
    const moreInfo = document.getElementById('more-info').checked;

    const cardContent = moreInfo ? createResortCard(resortData) : createDefaultCard(resortData);

    if (existingForecast) {
        existingForecast.innerHTML = cardContent;
    } else {
        const forecastDiv = document.createElement('div');
        forecastDiv.id = `forecast-${resortName}`;
        forecastDiv.innerHTML = cardContent;
        forecastsContainer.appendChild(forecastDiv);
    }
}

async function loadSelectedResorts() {
    // Cancel any ongoing loading
    if (loadingController) {
        loadingController.abort();
    }

    // Create new loading controller
    loadingController = new AbortController();

    // Get currently selected resorts
    const selectedResorts = Array.from(document.querySelectorAll('.resort-checkbox:checked')).map(cb => cb.value);

    // Save to local storage
    localStorage.setItem('selectedResorts', JSON.stringify(selectedResorts));

    // Clear existing forecasts
    const forecastsContainer = document.getElementById('forecasts');
    forecastsContainer.innerHTML = '';

    // If no resorts are selected, just return
    if (selectedResorts.length === 0) {
        return;
    }

    // Sort resorts if needed
    const sortBy = localStorage.getItem('selectedSort') || 'temperature';
    const sortedResorts = sortResorts(selectedResorts, sortBy);

    // Load selected resorts
    await Promise.all(
        sortedResorts.map(resort => loadResort(resort))
    );
}

function updateSortDayOptions() {
    const sortDayOptions = document.getElementById('sort-day-options');
    const selectedResorts = Array.from(document.querySelectorAll('.resort-checkbox:checked')).map(cb => cb.value);

    if (selectedResorts.length === 0) {
        sortDayOptions.innerHTML = '<div class="text-sm text-gray-500 px-4 py-2">No resorts selected</div>';
        return;
    }

    const firstResort = selectedResorts[0];
    const selectedElevation = localStorage.getItem('selectedElevation') || 'bot';
    const elevation = selectedElevation === 'bot' ? 'botData' : selectedElevation === 'mid' ? 'midData' : 'topData';
    const resortData = processResortData(allWeatherData, firstResort, elevation);

    if (!resortData || !resortData.days.length) {
        sortDayOptions.innerHTML = '<div class="text-sm text-gray-500 px-4 py-2">Loading...</div>';
        return;
    }

    sortDayOptions.innerHTML = resortData.days.map((day, index) => `
    <button class="sort-day-option w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg" data-value="${index}">
      ${day.name}
    </button>
  `).join('');

    // Add event listeners to new options
    document.querySelectorAll('.sort-day-option').forEach(option => {
        option.addEventListener('click', async () => {
            const value = option.dataset.value;
            const text = option.textContent.trim();

            document.getElementById('sort-day-text').textContent = text;
            document.getElementById('sort-day-menu').classList.add('hidden');

            localStorage.setItem('selectedSortDay', value);
            await loadSelectedResorts();
        });
    });
}

function updateSelectAllText(isChecked) {
    const selectAllText = document.getElementById('select-all-text');
    selectAllText.textContent = isChecked ? 'Deselect All' : 'Select All';
}

function filterResorts(searchTerm) {
    const resortList = document.getElementById('resort-list');
    const labels = resortList.querySelectorAll('label');
    const normalizedSearch = searchTerm.toLowerCase();
    let visibleCount = 0;
    let visibleChecked = 0;

    labels.forEach(label => {
        const resortName = label.textContent.trim().toLowerCase();
        const isVisible = resortName.includes(normalizedSearch);
        label.style.display = isVisible ? '' : 'none';
        if (isVisible) {
            visibleCount++;
            if (label.querySelector('input[type="checkbox"]').checked) {
                visibleChecked++;
            }
        }
    });

    // Update select all checkbox based on visible items
    const selectAll = document.getElementById('select-all');
    selectAll.checked = visibleCount > 0 && visibleCount === visibleChecked;
    updateSelectAllText(selectAll.checked);
}

async function initialize() {
    createApp();

    // Fetch all weather data first
    try {
        allWeatherData = await fetchAllData();
    } catch (error) {
        console.error('Failed to fetch weather data:', error);
        return;
    }

    // Setup dropdowns functionality
    const dropdownButton = document.getElementById('dropdown-button');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const elevationButton = document.getElementById('elevation-button');
    const elevationMenu = document.getElementById('elevation-menu');
    const sortButton = document.getElementById('sort-button');
    const sortMenu = document.getElementById('sort-menu');
    const sortDayButton = document.getElementById('sort-day-button');
    const sortDayMenu = document.getElementById('sort-day-menu');
    const selectAll = document.getElementById('select-all');
    const searchInput = document.getElementById('resort-search');
    const moreInfo = document.getElementById('more-info');
    const reverseOrder = document.getElementById('reverse-order');

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
        if (!elevationButton.contains(e.target) && !elevationMenu.contains(e.target)) {
            elevationMenu.classList.add('hidden');
        }
        if (!sortButton.contains(e.target) && !sortMenu.contains(e.target)) {
            sortMenu.classList.add('hidden');
        }
        if (!sortDayButton.contains(e.target) && !sortDayMenu.contains(e.target)) {
            sortDayMenu.classList.add('hidden');
        }
    });

    // Toggle resort dropdown
    dropdownButton.addEventListener('click', () => {
        dropdownMenu.classList.toggle('hidden');
        elevationMenu.classList.add('hidden');
        sortMenu.classList.add('hidden');
        sortDayMenu.classList.add('hidden');
        if (!dropdownMenu.classList.contains('hidden')) {
            searchInput.focus();
        }
    });

    // Toggle elevation dropdown
    elevationButton.addEventListener('click', () => {
        elevationMenu.classList.toggle('hidden');
        dropdownMenu.classList.add('hidden');
        sortMenu.classList.add('hidden');
        sortDayMenu.classList.add('hidden');
    });

    // Toggle sort dropdown
    sortButton.addEventListener('click', () => {
        sortMenu.classList.toggle('hidden');
        dropdownMenu.classList.add('hidden');
        elevationMenu.classList.add('hidden');
        sortDayMenu.classList.add('hidden');
    });

    // Toggle sort day dropdown
    sortDayButton.addEventListener('click', () => {
        sortDayMenu.classList.toggle('hidden');
        dropdownMenu.classList.add('hidden');
        elevationMenu.classList.add('hidden');
        sortMenu.classList.add('hidden');
        updateSortDayOptions();
    });

    // Handle reverse order button
    reverseOrder.addEventListener('click', () => {
        isReversed = !isReversed;
        localStorage.setItem('reverseOrder', isReversed);
        reverseOrder.textContent = isReversed ? '↑ Reverse Order' : '↓ Normal Order';
        loadSelectedResorts();
    });

    // Handle sort selection
    document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', async () => {
            const value = option.dataset.value;
            const text = option.textContent;

            document.getElementById('sort-text').textContent = text;
            sortMenu.classList.add('hidden');

            // Save selection and reload forecasts
            localStorage.setItem('selectedSort', value);
            await loadSelectedResorts();
        });
    });

    // Handle elevation selection
    document.querySelectorAll('.elevation-option').forEach(option => {
        option.addEventListener('click', async () => {
            const value = option.dataset.value;
            const text = option.textContent;

            document.getElementById('elevation-text').textContent = text;
            elevationMenu.classList.add('hidden');

            // Save selection and reload forecasts
            localStorage.setItem('selectedElevation', value);
            await loadSelectedResorts();
        });
    });

    // Handle more info toggle
    moreInfo.addEventListener('change', () => {
        const selectedResorts = Array.from(document.querySelectorAll('.resort-checkbox:checked')).map(cb => cb.value);
        selectedResorts.forEach(resort => {
            const selectedElevation = localStorage.getItem('selectedElevation') || 'bot';
            const elevation = selectedElevation === 'bot' ? 'botData' : selectedElevation === 'mid' ? 'midData' : 'topData';
            const resortData = processResortData(allWeatherData, resort, elevation);
            if (resortData) {
                resortData.name = getDisplayName(resort);
                displayResort(resort, resortData);
            }
        });
    });

    // Handle search input
    searchInput.addEventListener('input', (e) => {
        filterResorts(e.target.value);
    });

    // Prevent dropdown from closing when clicking search input
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Handle select all
    selectAll.addEventListener('click', () => {
        const currentText = document.getElementById('select-all-text').textContent;
        const allCheckboxes = document.querySelectorAll('.resort-checkbox');

        // Cancel any ongoing loading before deselecting
        if (currentText === 'Deselect All') {
            if (loadingController) {
                loadingController.abort();
            }
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            selectAll.checked = false;

            // Clear forecasts immediately
            const forecastsContainer = document.getElementById('forecasts');
            forecastsContainer.innerHTML = '';

            // Update local storage
            localStorage.setItem('selectedResorts', JSON.stringify([]));
        } else {
            const visibleCheckboxes = Array.from(allCheckboxes)
                .filter(cb => cb.closest('label').style.display !== 'none');
            visibleCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            selectAll.checked = true;
            loadSelectedResorts();
        }

        updateSelectAllText(selectAll.checked);
    });

    // Add event listeners for checkboxes
    document.querySelectorAll('.resort-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.resort-checkbox'))
                .filter(cb => cb.closest('label').style.display !== 'none');
            const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
            const isAllSelected = checkedCount === visibleCheckboxes.length;
            selectAll.checked = isAllSelected;
            updateSelectAllText(isAllSelected);
            loadSelectedResorts();
        });
    });

    // Set initial select all text based on default selections
    const visibleCheckboxes = Array.from(document.querySelectorAll('.resort-checkbox'))
        .filter(cb => cb.closest('label').style.display !== ' none');
    const checkedCount = visibleCheckboxes.filter(cb => cb.checked).length;
    updateSelectAllText(checkedCount === visibleCheckboxes.length);

    // Set initial elevation text
    const savedElevation = localStorage.getItem('selectedElevation') || 'bot';
    const elevationOption = document.querySelector(`.elevation-option[data-value="${savedElevation}"]`);
    if (elevationOption) {
        document.getElementById('elevation-text').textContent = elevationOption.textContent;
    }

    // Set initial sort text
    const savedSort = localStorage.getItem('selectedSort') || 'temperature';
    const sortOption = document.querySelector(`.sort-option[data-value="${savedSort}"]`);
    if (sortOption) {
        document.getElementById('sort-text').textContent = sortOption.textContent;
    }

    // Set initial sort day text
    const savedSortDay = localStorage.getItem('selectedSortDay') || '0';
    const firstResort = initialSelectedResorts[0];
    if (firstResort) {
        const elevation = savedElevation === 'bot' ? 'botData' : savedElevation === 'mid' ? 'midData' : 'topData';
        const resortData = processResortData(allWeatherData, firstResort, elevation);
        if (resortData && resortData.days[savedSortDay]) {
            document.getElementById('sort-day-text').textContent = resortData.days[savedSortDay].name;
        }
    }

    // Load initial resorts
    loadSelectedResorts();
}

initialize();