//TODO: Add run status for Grouse and Seymour
//TODO: Add rental and lesson price analysis
//TODO: Videos tab

const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));

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

        // We'll still gather a flat array first
        const allRuns = [];

        // 1) Collect all run info
        sections.each((i, section) => {
            const $section = $(section);
            const liftName = $section.find('th').first().text().trim();
            const $runsRow = $section.next('tr.border-none');
            const runArticles = $runsRow.find('article.node--type-trail.node--view-mode-row');

            runArticles.each((j, article) => {
                const $article = $(article);
                const runName = $article.find('.cell.title').text().trim();

                // Difficulty from the div.f-icon.icon.level
                const difficulty = $article
                    .find('.f-icon.icon.level')
                    .attr('title') || 'Unknown';

                // Day/Night status
                const statusCells = $article.find('.cell.status');
                let dayStatus = 'Closed';
                let nightStatus = 'Closed';

                if (statusCells.length >= 1) {
                    const $dayIcon = $(statusCells[0]).find('.f-icon.icon.status');
                    dayStatus = $dayIcon.hasClass('status-open') ? 'Open' : 'Closed';
                }
                if (statusCells.length >= 2) {
                    const $nightIcon = $(statusCells[1]).find('.f-icon.icon.status');
                    nightStatus = $nightIcon.hasClass('status-open') ? 'Open' : 'Closed';
                }

                allRuns.push({
                    liftName,
                    runName,
                    difficulty,
                    dayStatus,
                    nightStatus
                });
            });
        });

        // 2) Now group runs by liftName into { liftName, liftStatus, runs: [] }
        const liftsMap = {};

        allRuns.forEach(run => {
            const { liftName, runName, difficulty, dayStatus, nightStatus } = run;

            // If we haven't seen this lift yet, create it
            if (!liftsMap[liftName]) {
                liftsMap[liftName] = {
                    liftName,
                    liftStatus: 'Open',  // default; you can adjust based on runs if you like
                    runs: []
                };
            }

            // Combine day & night statuses into one runStatus if you want:
            // e.g. if both are open => 'Open', if one is open => 'Partially Open'
            let combinedStatus = 'Closed';
            if (dayStatus === 'Open' && nightStatus === 'Open') {
                combinedStatus = 'Open';
            } else if (dayStatus === 'Open' || nightStatus === 'Open') {
                combinedStatus = 'Partially Open';
            }

            liftsMap[liftName].runs.push({
                runName,
                difficulty,
                runStatus: combinedStatus
            });
        });

        // 3) Return array of lifts
        const liftsArray = Object.values(liftsMap);
        return liftsArray;

    } catch (err) {
        console.error('Error scraping Seymour runs:', err);
        return [];
    }
}

module.exports = { scrapeSeymourRuns };
async function scrapeGrouseRuns() {
    try {
        const url = 'https://www.grousemountain.com/ski-snowboard/runs';
        // or wherever your actual Grouse conditions page is
        const { data: html } = await axios.get(url);

        const $ = cheerio.load(html);

        // 1) We'll look inside the container for runs => <ul class='data-table'> <li> ...
        //    Adjust the selector as needed if the structure changes.
        const runItems = $("div#runs ul.data-table li");

        // We'll store a flat array first, like we did with Seymour
        let allRuns = [];

        runItems.each((_, li) => {
            const $li = $(li);

            // Run Name => inside the first <span> text (minus the difficulty icon)
            // e.g. "Chalet Road", "The Cut", "Paradise", etc.
            // Often the structure is: <span><span class='runs-blue'></span> The Cut</span>
            // We'll extract the text & trim
            let runName = $li.find("span").first().text().trim();
            // In some cases, that might include partial text from difficulty. We'll handle difficulty below
            // and just do a small cleanup.
            runName = cleanupRunName(runName);

            // Status => look for <span class='open'> or <span class='closed'>
            // The text might be "Open" or "Closed"
            let runStatus = "Closed";
            if ($li.find("span.open").length > 0) {
                runStatus = "Open";
            }

            // Difficulty => from classes like .runs-green, .runs-blue, .runs-diamond, .runs-double-diamond
            // We'll pick the first match we find
            let difficulty = "Unknown";
            if ($li.find(".runs-green").length) {
                difficulty = "Green";
            } else if ($li.find(".runs-blue").length) {
                difficulty = "Blue";
            } else if ($li.find(".runs-diamond").length && !$li.find(".runs-double-diamond").length) {
                difficulty = "Black Diamond";
            } else if ($li.find(".runs-double-diamond").length) {
                difficulty = "Double Black Diamond";
            }

            // We'll push into a flat array
            allRuns.push({
                runName,
                difficulty,
                runStatus
            });
        });

        // 2) Map each runName => a specific lift name (manually assigned)
        //    We'll create a dictionary that normalizes run names to lower case
        const runToLiftMap = {
            // Screaming Eagle Chair
            "the cut": "Screaming Eagle Chair",
            "side cut park": "Screaming Eagle Chair",
            "lower side cut": "Screaming Eagle Chair",
            "paper trail": "Screaming Eagle Chair",
            "skyline": "Screaming Eagle Chair",

            // Show tow handle cut (?)
            // You mentioned "Show tow handle cut" for "side cut park" also,
            // but let's keep the single-lift assignment or adapt as needed:
            // "side cut park": "Show tow handle cut", // conflict with above?

            // Greenway Quad Chair
            "paradise": "Greenway Quad Chair",

            // Magic Carpet
            "ski wee": "Magic Carpet",

            // Peak Quad Chair
            "peak": "Peak Quad Chair",
            "lower peak": "Peak Quad Chair",
            "heaven's sake": "Peak Quad Chair",
            "peak glades": "Peak Quad Chair",
            "no man's land": "Peak Quad Chair",

            // ... everything else => "Olympic Express Chair"
            // We'll handle that default below
        };

        // 3) Group runs => array of lifts
        const liftsMap = {};

        allRuns.forEach(run => {
            const { runName, difficulty, runStatus } = run;
            // We'll find the mapped lift, or default to "Olympic Express Chair"
            const liftName = mapRunToLift(runName, runToLiftMap);

            if (!liftsMap[liftName]) {
                liftsMap[liftName] = {
                    liftName,
                    liftStatus: "Open", // or some logic if you want to check if any run is open
                    runs: []
                };
            }

            // Add the run to the runs array
            liftsMap[liftName].runs.push({
                runName,
                difficulty,
                runStatus
            });
        });

        // convert liftsMap to array
        return Object.values(liftsMap);

    } catch (err) {
        console.error('Error scraping Grouse runs:', err);
        return [];
    }
}

/**
 * If the run name not found in runToLiftMap => default to "Olympic Express Chair".
 * We'll do a simple lower-case compare
 */
function mapRunToLift(runName, dictionary) {
    const key = runName.toLowerCase();
    if (dictionary[key]) {
        return dictionary[key];
    }
    return "Olympic Express Chair";
}

/**
 * Cleanup run name => e.g. "The Cut" might have extra whitespace or newlines.
 * Here we just do basic trimming. If you need more advanced logic, add it here.
 */
function cleanupRunName(text) {
    return text.replace(/\s+/g, " ").trim();
}

module.exports = { scrapeGrouseRuns };



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

app.get('/api/seymour-lifts', async (req, res) => {
    try {
        const seymourRunsData = await scrapeSeymourRuns();
        // seymourRunsData => [ { liftName, liftStatus, runs: [...] }, ... ]
        res.json({ lifts: seymourRunsData });
    } catch (err) {
        console.error('Error in /api/seymour-lifts route:', err);
        res.status(500).json({ error: 'Failed to scrape seymour' });
    }
});

const router = express.Router();
const { scrapeGrouseRuns } = require('../scrapers/scrapeGrouseRuns');

router.get('/grouse-lifts', async (req, res) => {
    try {
        // This returns an array of lifts => [ { liftName, liftStatus, runs: [ ... ] }, ... ]
        const grouseLiftsArray = await scrapeGrouseRuns();

        // Send in shape { lifts: [...] } to match your front-end
        res.json({ lifts: grouseLiftsArray });
    } catch (err) {
        console.error('Error in /grouse-lifts route:', err);
        res.status(500).json({ error: 'Failed to scrape Grouse lifts' });
    }
});

const grouseRoutes = require('./routes/grouse-lifts'); // the file above
const app = express();
app.use('/api', grouseRoutes); // => final path is /api/grouse-lifts

module.exports = router;

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



 
