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
        const areas = data?.facilities?.areas?.area || [];

        // We'll build a results array
        const results = [];

        for (const areaObj of areas) {
            const lifts = areaObj?.lifts?.lift;
            if (!Array.isArray(lifts)) continue;

            for (const lift of lifts) {
                if (!lift?.name) continue;
                // For example, "Raven Ridge" => "Closed" or "Open"
                results.push({
                    name: lift.name,
                    status: lift.status,
                });
            }
        }

        return results;
    } catch (err) {
        console.error('Error fetching Cypress lifts:', err);
        return []; // Return empty on error
    }
}

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
                name: resort.title, // e.g., "Cypress Mountain"
                snow24: resort?.snow?.last24 ?? 0,
                snow48: resort?.snow?.last48 ?? 0,

                // "base" may often be null, while "summit" has a value.
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
 * 4) Express endpoints
 *
 *    GET /api/cypress-lifts
 *    GET /api/grouse-lifts
 *    GET /api/seymour-lifts
 *
 *    Each endpoint calls the above scraping function, then returns JSON.
 */

// 4a) Cypress
app.get('/api/cypress-lifts', async (req, res) => {
    const cypressData = await scrapeCypressLifts();
    res.json({ lifts: cypressData });
});

// 4b) Grouse
app.get('/api/grouse-lifts', async (req, res) => {
    const grouseData = await scrapeGrouseLifts();
    res.json({ lifts: grouseData });
});

// 4c) Seymour
app.get('/api/seymour-lifts', async (req, res) => {
    const seymourData = await scrapeSeymourLifts();
    res.json({ lifts: seymourData });
});

// (Optional) Combined route: GET /api/all-lifts
// returns an object with { cypress: [...], grouse: [...], seymour: [...] }
app.get('/api/all-lifts', async (req, res) => {
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

app.get('/api/weather', async (req, res) => {
    try {
        const weatherData = await getWeather();
        res.json({ weather: weatherData });
    } catch (error) {
        console.error('Error fetching weather data:', error);
        res.status(500).json({ error: 'Failed to fetch weather data.' });
    }
});

// 5) Start the server
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

scrapeGrouseLifts().then(data => console.log("Grouse Lifts:", data));
scrapeCypressLifts().then(data => console.log("Cypress Lifts:", data));
scrapeSeymourLifts().then(data => console.log("Seymour Lifts:", data));

 
