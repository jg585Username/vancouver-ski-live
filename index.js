//TODO: Make weather bar and nav bar resizing

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));


async function scrapeCypressLifts() {
    try {
        const url = 'https://www.cypressmountain.com/api/reportpal?resortName=cy';
        const { data } = await axios.get(url);

        // Top-level arrays
        const areas = data?.facilities?.areas?.area || [];
        const trailDifficultyIcons = data?.icons?.trailDifficultyIcons || {};

        const results = [];

        // Loop each "area" (e.g. "Eagle Express", "Lions Express", etc.)
        for (const areaObj of areas) {
            const liftsArr = areaObj?.lifts?.lift;   // e.g. [ { name: 'Eagle Express', status: 'Open', ... } ]
            const trailsArr = areaObj?.trails?.trail; // e.g. runs for that area

            if (!Array.isArray(liftsArr)) continue;

            // Some areas can have multiple lifts, we map each one
            for (const lift of liftsArr) {
                if (!lift?.name) continue;

                // Gather the runs (if any) for this area
                let runs = [];
                if (Array.isArray(trailsArr)) {
                    runs = trailsArr.map(tr => {
                        // Map each run to a simpler object
                        return {
                            runName: tr.name,
                            runStatus: tr.status,            // "Open", "Closed", etc.
                            difficulty: tr.difficulty,       // "Novice", "Intermediate", etc.
                            // We'll convert "beginner"/"intermediate"/... to the actual icon URL
                            difficultyIconUrl: trailDifficultyIcons[tr.difficultyIcon]?.image || null,
                            // Additional fields if you like, e.g. "nightStatus", "groomed", etc.
                        };
                    });
                }

                // Add this lift object to our results
                results.push({
                    liftName: lift.name,
                    liftStatus: lift.status,
                    runs
                });
            }
        }

        return results; // e.g. [ { liftName, liftStatus, runs: [...]}, ... ]
    } catch (err) {
        console.error('Error fetching Cypress lifts:', err);
        return [];
    }
}

/**
 * 2) Scrape Grouse lifts
 */
async function scrapeGrouseLifts() {
    try {
        const url = 'https://www.grousemountain.com/current_conditions';
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);

        // In the #lifts tab, there's <ul class="data-table"><li> for each lift
        const liftSelector = '#lifts ul.data-table li';
        const liftRows = $(liftSelector);

        if (!liftRows.length) {
            console.warn('No lift rows found. The HTML structure may have changed.');
            return [];
        }

        const results = [];
        liftRows.each((i, el) => {
            const $el = $(el);

            // The first <span> is the lift name
            const nameSpan = $el.find('> span').first();
            const liftName = nameSpan.text().trim();

            // The last <span> might show "Open", "Closed", "Scheduled to Open", etc.
            const statusSpan = $el.find('> span').last();
            const rawStatusText = statusSpan.text().trim();

            results.push({
                name: liftName,
                status: rawStatusText,
            });
        });

        return results;
    } catch (err) {
        console.error('Error scraping Grouse lifts:', err);
        return [];
    }
}

/**
 * 3) Seymour scraping function
 *    Returns an array of { name, status, rawHours }, one entry per lift.
 */
async function scrapeSeymourLifts() {
    try {
        const url = 'https://mtseymour.ca/the-mountain/todays-conditions-hours';
        const { data: html } = await axios.get(url);

        const $ = cheerio.load(html);
        const liftsTable = $('table:contains("Lifts") tbody');
        if (!liftsTable.length) {
            console.warn('No "Lifts" table found. The page structure may have changed.');
            return [];
        }

        const rows = liftsTable.find('tr.accordion-heading');
        const results = [];

        rows.each((i, row) => {
            const $row = $(row);
            const liftName = $row.find('th').first().text().trim();
            const statusCellText = $row.find('td').first().text().trim();

            const isClosed = /closed/i.test(statusCellText);
            const status = isClosed ? 'Closed' : 'Open';

            results.push({
                name: liftName,
                status: status,
                rawHours: statusCellText, // e.g. "9:30 AM - 9:30 PM" or "Closed"
            });
        });

        return results;
    } catch (err) {
        console.error('Error scraping Seymour lifts:', err);
        return [];
    }
}

/**
 * 4) Weather scraping
 */
async function getWeather() {
    const url =
        "https://www.onthesnow.com/_next/data/2.6.8_en-US/vancouver/open-resorts.json?region=vancouver";

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Request failed with status: ${response.status}`);
        }
        const data = await response.json();

        // The main resort data array lives at data.pageProps.resorts.data
        const resortsData = data?.pageProps?.resorts?.data || [];

        // Map over each resort, pulling out the fields you need
        const results = resortsData.map((resort) => {
            return {
                name: resort.title,
                snow24: resort?.snow?.last24 ?? 0,
                snow48: resort?.snow?.last48 ?? 0,

                baseDepth: resort?.snow?.base ?? 0,

                openTrails: resort?.runs?.open ?? 0,
                totalTrails: resort?.runs?.total ?? 0,

                openLifts: resort?.lifts?.open ?? 0,
                totalLifts: resort?.lifts?.total ?? 0,

                windSpeed: resort?.currentWeather?.wind ?? 0,
                weatherType: resort?.currentWeather?.type ?? "N/A",
            };
        });

        return results;
    } catch (err) {
        console.error("Error fetching or parsing data:", err);
        return [];
    }
}

/**
 * 5) Scrape Cypress base depth (Nordic or Downhill)
 */
async function scrapeCypressBaseDepth() {
    try {
        const url = "https://www.cypressmountain.com/api/reportpal?resortName=cy";
        const { data } = await axios.get(url);

        // Safely access property using optional chaining:
        const cm = data?.currentConditions?.resortLocations?.location?.[0]?.base?.centimeters ?? null;
        console.log("Cypress base depth (cm):", cm);

        return cm;
    } catch (err) {
        console.error("Error scraping Cypress base depth:", err);
        return null;
    }
}

/**
 * 6) Scrape Cypress ticket prices
 */
async function fetchCypressTicketPrices() {
    try {
        const url = "https://shop.cypressmountain.com/api/v1/product-variant";
        const { data } = await axios.get(url);

        const dayPriceLists = data?.Variants?.[0]?.DayPriceLists || [];

        const results = dayPriceLists.map((dayObj) => ({
            date: dayObj.Date,
            price: dayObj.Price,
        }));

        return results; // e.g. [ { date: "2025-01-30", price: 108 }, ... ]
    } catch (err) {
        console.error("Error fetching Cypress day price lists:", err);
        return [];
    }
}

/**
 * 7) Express endpoints
 */
const appRoutes = express.Router();

// 7a) Cypress lifts
appRoutes.get('/cypress-lifts', async (req, res) => {
    const cypressData = await scrapeCypressLifts();
    res.json({ lifts: cypressData });
});

// 7b) Grouse
appRoutes.get('/grouse-lifts', async (req, res) => {
    const grouseData = await scrapeGrouseLifts();
    res.json({ lifts: grouseData });
});

// 7c) Seymour
appRoutes.get('/seymour-lifts', async (req, res) => {
    const seymourData = await scrapeSeymourLifts();
    res.json({ lifts: seymourData });
});

// Optional combined route
appRoutes.get('/all-lifts', async (req, res) => {
    const [cypressData, grouseData, seymourData] = await Promise.all([
        scrapeCypressLifts(),
        scrapeGrouseLifts(),
        scrapeSeymourLifts(),
    ]);
    res.json({
        cypress: cypressData,
        grouse: grouseData,
        seymour: seymourData,
    });
});

// Weather
appRoutes.get('/weather', async (req, res) => {
    try {
        const weatherData = await getWeather();
        res.json({ weather: weatherData });
    } catch (error) {
        console.error('Error fetching weather data:', error);
        res.status(500).json({ error: 'Failed to fetch weather data.' });
    }
});

// Cypress base depth
appRoutes.get('/cypress-base-depth', async (req, res) => {
    try {
        const baseDepthCm = await scrapeCypressBaseDepth();
        res.json({ baseDepthCm });
    } catch (error) {
        console.error("Error fetching Cypress base depth:", error);
        res.status(500).json({ error: "Failed to fetch Cypress base depth." });
    }
});

// Cypress prices
appRoutes.get('/cypress-prices', async (req, res) => {
    try {
        const cypressTicketData = await fetchCypressTicketPrices();
        res.json({ cypressTicketData });
    } catch (error) {
        console.error("Error fetching cypress ticket data:", error);
        res.status(500).json({ error: "Failed to fetch Cypress ticket data." });
    }
});

/**
 * 8) Register routes and start server
 */
app.use('/api', appRoutes);

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

// Debug logs on startup
scrapeGrouseLifts().then(data => console.log("Grouse Lifts:", data));
scrapeCypressLifts().then(data => console.log("Cypress Lifts:", data));
scrapeSeymourLifts().then(data => console.log("Seymour Lifts:", data));


 
