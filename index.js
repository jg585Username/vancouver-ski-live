//TODO: Add run status for Grouse and Seymour
//TODO: Add rental and lesson price analysis
//TODO: Videos tab

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname)); // Serves files like index.html, etc.

/**
 * 1) Scrape Cypress Lifts (including runs)
 */
async function scrapeCypressLifts() {
    try {
        const url = 'https://www.cypressmountain.com/api/reportpal?resortName=cy';
        const { data } = await axios.get(url);

        // Top-level arrays
        const areas = data?.facilities?.areas?.area || [];
        const trailDifficultyIcons = data?.icons?.trailDifficultyIcons || {};

        const results = [];

        for (const areaObj of areas) {
            const liftsArr = areaObj?.lifts?.lift || [];
            const trailsArr = areaObj?.trails?.trail || [];

            // Map each lift in this area
            for (const lift of liftsArr) {
                if (!lift?.name) continue;

                // Gather the runs (if any) for this area
                const runs = Array.isArray(trailsArr)
                    ? trailsArr.map(tr => ({
                        runName: tr.name,
                        runStatus: tr.status, // "Open", "Closed", etc.
                        difficulty: tr.difficulty,       // e.g. "Novice"
                        difficultyIconUrl:
                            trailDifficultyIcons[tr.difficultyIcon]?.image || null
                    }))
                    : [];

                // Pull out openTime & closeTime (e.g. "09:00", "22:00")
                const openTime = lift.openTime || null;
                const closeTime = lift.closeTime || null;

                results.push({
                    liftName: lift.name,
                    liftStatus: lift.status,
                    openTime,
                    closeTime,
                    runs
                });
            }
        }

        return results;
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

        const liftSelector = '#lifts ul.data-table li';
        const liftRows = $(liftSelector);

        if (!liftRows.length) {
            console.warn('No lift rows found. The HTML structure may have changed.');
            return [];
        }

        const results = [];
        liftRows.each((i, el) => {
            const $el = $(el);

            const nameSpan = $el.find('> span').first();
            const liftName = nameSpan.text().trim();

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
 * 3) Scrape Seymour lifts
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
                status,
                rawHours: statusCellText
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

        const resortsData = data?.pageProps?.resorts?.data || [];

        const results = resortsData.map((resort) => ({
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
        }));

        return results;
    } catch (err) {
        console.error("Error fetching or parsing data:", err);
        return [];
    }
}

/**
 * 5) Scrape Cypress base depth
 */
async function scrapeCypressBaseDepth() {
    try {
        const url = "https://www.cypressmountain.com/api/reportpal?resortName=cy";
        const { data } = await axios.get(url);

        const cm = data?.currentConditions?.resortLocations?.location?.[0]?.base?.centimeters ?? null;
        console.log("Cypress base depth (cm):", cm);
        return cm;
    } catch (err) {
        console.error("Error scraping Cypress base depth:", err);
        return null;
    }
}

async function scrapeCypressBaseDepth() {
    try {
        const url = "https://www.cypressmountain.com/api/reportpal?resortName=cy";
        const { data } = await axios.get(url);

        // Safely access property using optional chaining:
        const cm = data?.currentConditions?.resortLocations?.location?.[0]?.base?.centimeters ?? null;
        console.log("Cypress base depth (cm):", cm);     // see the base depth only

        return cm;
    } catch (err) {
        console.error("Error scraping Cypress base depth:", err);
        return null;
    }
}

(async function main() {
    const baseDepth = await scrapeCypressBaseDepth();
    console.log("Result returned:", baseDepth);
})();

async function scrapeSeymourRuns() {
    try {
        const url = 'https://mtseymour.ca/the-mountain/todays-conditions-hours';
        const { data: html } = await axios.get(url);

        const $ = cheerio.load(html);
        const sections = $('tr.accordion-heading');
        const allRuns = [];

        // Each 'accordion-heading' row = 1 Lift (e.g., "Lodge Chair")
        sections.each((i, section) => {
            const $section = $(section);

            // Extract the lift name from the <th>
            const liftName = $section.find('th').first().text().trim();

            // The next sibling <tr class="border-none"> holds the run details
            const $runsRow = $section.next('tr.border-none');

            // Inside that <tr>, the runs are in <article> with class "node--type-trail..."
            const runArticles = $runsRow.find('article.node--type-trail.node--view-mode-row');

            runArticles.each((j, article) => {
                const $article = $(article);

                // 1) Run Name
                const runName = $article.find('.cell.title').text().trim();

                // 2) Difficulty from the "title" attribute in: <div class="f-icon icon level level-beginner" title="Beginner">
                const difficulty = $article
                    .find('.f-icon.icon.level')
                    .attr('title') || 'Unknown';

                // 3) Day/Night status: each "cell.status" usually contains a <div class="f-icon icon status status-open" title="Open">
                const statusCells = $article.find('.cell.status');
                let dayStatus = 'Unknown';
                let nightStatus = 'Unknown';

                // If they have 2 cells: [0] = day, [1] = night
                if (statusCells.length === 2) {
                    const $dayIcon = $(statusCells[0]).find('.f-icon.icon.status');
                    const $nightIcon = $(statusCells[1]).find('.f-icon.icon.status');

                    // We check if it has .status-open or .status-closed
                    dayStatus = $dayIcon.hasClass('status-open') ? 'Open' : 'Closed';
                    nightStatus = $nightIcon.hasClass('status-open') ? 'Open' : 'Closed';

                } else if (statusCells.length === 1) {
                    // Possibly only a Day status
                    const $dayIcon = $(statusCells[0]).find('.f-icon.icon.status');
                    dayStatus = $dayIcon.hasClass('status-open') ? 'Open' : 'Closed';
                }

                // 4) Push into our result array
                allRuns.push({
                    liftName,
                    runName,
                    difficulty,
                    dayStatus,
                    nightStatus
                });
            });
        });

        return allRuns;
    } catch (err) {
        console.error('Error scraping Seymour runs:', err);
        return [];
    }
}

/**
 * 6) Scrape Cypress ticket prices
 */
async function fetchCypressTicketPrices() {
    try {
        const url = "https://shop.cypressmountain.com/api/v1/product-variant";

        // Helper function to get today's date as an ISO string in the format "YYYY-MM-DDT00:00:00.000Z"
        function getTodayISOString() {
            const now = new Date();
            // Split the ISO string to keep only the date part and append the fixed time.
            return now.toISOString().split("T")[0] + "T00:00:00.000Z";
        }

        // Optionally, if you also need an EndDate (for example, 7 days later), you can do:
        function getFutureISOString(daysAhead) {
            const future = new Date();
            future.setDate(future.getDate() + daysAhead);
            return future.toISOString().split("T")[0] + "T00:00:00.000Z";
        }

        const startDate = getTodayISOString();
        const endDate = getFutureISOString(7); // change 7 to whatever period you need

        const payload = {
            "ProductAttributeValueIds": [3969, 3964],
            "ProductId": 214,
            "StartDate": startDate,
            "EndDate": endDate
        };

        // Send a POST request with the payload and appropriate headers.
        const response = await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        // The response data should have the price lists
        const dayPriceLists = response?.data?.Variants?.[0]?.DayPriceLists || [];

        // Map the data to a simpler format for the front end
        const results = dayPriceLists.map(dayObj => ({
            date: dayObj.Date,
            price: dayObj.Price
        }));

        return results;  // e.g. [ { date: "2025-02-04", price: 108 }, ... ]
    } catch (err) {
        console.error("Error fetching Cypress day price lists:", err);
        return [];
    }
}


/**
 * 7) Define Express routes
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

appRoutes.get('/seymour-lifts', async (req, res) => {
    try {
        // This function scrapes lifts & runs, returning them in the shape:
        // [ { liftName, liftStatus, runs: [ { runName, difficulty, runStatus }, ... ] }, ... ]
        const seymourData = await scrapeSeymourLifts();

        // Return in the expected format: { lifts: [...] }
        res.json({ lifts: seymourData });
    } catch (error) {
        console.error('Error fetching Seymour lifts:', error);
        res.status(500).json({ error: 'Failed to fetch seymour lifts' });
    }
});

// Combined route
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
 * 8) Register routes & start the server
 */
app.use('/api', appRoutes);

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

// Debug logs on startup
scrapeGrouseLifts().then(data => console.log("Grouse Lifts:", data));
scrapeCypressLifts().then(data => console.log("Cypress Lifts:", data));
scrapeSeymourLifts().then(data => console.log("Seymour Lifts:", data));



 
