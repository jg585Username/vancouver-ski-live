const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

const app = express();
const PORT = 3000;

// Serve static files (for index.html, images, etc.)
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

                // Gather runs (if any) for this area
                const runs = Array.isArray(trailsArr)
                    ? trailsArr.map(tr => ({
                        runName: tr.name,
                        runStatus: tr.status,
                        difficulty: tr.difficulty, // e.g. "Novice"
                        difficultyIconUrl: trailDifficultyIcons[tr.difficultyIcon]?.image || null
                    }))
                    : [];

                // open/closeTime (e.g. "09:00", "22:00")
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
 * 2) Scrape Cypress base depth
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

async function scrapeCypressUpdates(){
    try {
        const url = "https://www.cypressmountain.com/api/reportpal?resortName=cy";
        const { data } = await axios.get(url);

        // Safely access property using optional chaining:
        const update = data?.comments?.comment?.[0]?.text ?? null;
        console.log("Update from Cypress Staff:", update);
        return update;
    } catch (err) {
        console.error("Did not receive Cypress Updates", err);
        return null;
    }
}

/**
 * 3) Scrape Cypress ticket prices
 */
async function fetchCypressTicketPrices() {
    try {
        const url = "https://shop.cypressmountain.com/api/v1/product-variant";

        function getTodayISOString() {
            const now = new Date();
            return now.toISOString().split("T")[0] + "T00:00:00.000Z";
        }
        function getFutureISOString(daysAhead) {
            const future = new Date();
            future.setDate(future.getDate() + daysAhead);
            return future.toISOString().split("T")[0] + "T00:00:00.000Z";
        }

        const startDate = getTodayISOString();
        const endDate = getFutureISOString(7);

        const payload = {
            "ProductAttributeValueIds": [3969, 3964],
            "ProductId": 214,
            "StartDate": startDate,
            "EndDate": endDate
        };

        const response = await axios.post(url, payload, {
            headers: { "Content-Type": "application/json" }
        });

        // The response data should have the price lists
        const dayPriceLists = response?.data?.Variants?.[0]?.DayPriceLists || [];

        // Map to simpler format for front-end
        const results = dayPriceLists.map(dayObj => ({
            date: dayObj.Date,
            price: dayObj.Price
        }));

        return results;
    } catch (err) {
        console.error("Error fetching Cypress day price lists:", err);
        return [];
    }
}

/**
 * 4) Scrape Grouse RUNS (with manual mapping)
 */
function mapRunToLift(runName, dictionary) {
    const key = runName.toLowerCase();
    return dictionary[key] || "Olympic Express Chair"; // default
}

function cleanupRunName(text) {
    return text.replace(/\s+/g, " ").trim();
}

async function scrapeGrouseRuns() {
    try {
        const url = 'https://www.grousemountain.com/current_conditions#runs';
        const { data: html } = await axios.get(url);

        const $ = cheerio.load(html);

        // Our CSS selector
        const runItems = $("div#runs ul.data-table li");
        console.log("Found runItems count =>", runItems.length);

        let allRuns = [];

        runItems.each((_, li) => {
            const $li = $(li);
            let runName = $li.find("span").first().text().trim();
            runName = cleanupRunName(runName);

            let runStatus = "Closed";
            if ($li.find("span.open").length > 0) {
                runStatus = "Open";
            }

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

            allRuns.push({ runName, difficulty, runStatus });
        });

        // Map run => lift
        const runToLiftMap = {
            // Screaming Eagle Chair
            "the cut": "Screaming Eagle Chair",
            "side cut park": "Screaming Eagle Chair",
            "lower side cut": "Screaming Eagle Chair",
            "paper trail": "Screaming Eagle Chair",
            "skyline": "Screaming Eagle Chair",

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
        };

        const liftsMap = {};

        allRuns.forEach(run => {
            const { runName, difficulty, runStatus } = run;
            const liftName = mapRunToLift(runName, runToLiftMap);

            if (!liftsMap[liftName]) {
                liftsMap[liftName] = {
                    liftName,
                    liftStatus: "Open",
                    runs: []
                };
            }
            liftsMap[liftName].runs.push({ runName, difficulty, runStatus });
        });

        return Object.values(liftsMap);
    } catch (err) {
        console.error('Error scraping Grouse runs:', err);
        return [];
    }
}

/**
 * 1) Basic lifts (rawHours)
 */
async function scrapeSeymourLifts() {
    try {
        const url = "https://mtseymour.ca/the-mountain/todays-conditions-hours";
        const { data: html } = await axios.get(url);

        const $ = cheerio.load(html);
        const liftsTable = $('table:contains("Lifts") tbody');
        if (!liftsTable.length) {
            console.warn('No "Lifts" table found. The page structure may have changed.');
            return [];
        }

        const rows = liftsTable.find("tr.accordion-heading");
        const results = [];

        rows.each((i, row) => {
            const $row = $(row);
            const liftName = $row.find("th").first().text().trim();
            const statusCellText = $row.find("td").first().text().trim();

            const isClosed = /closed/i.test(statusCellText);
            const status = isClosed ? "Closed" : "Open";

            results.push({
                name: liftName,      // note: "name" here
                status,              // "Open"/"Closed"
                rawHours: statusCellText
            });
        });

        return results;
    } catch (err) {
        console.error("Error scraping Seymour lifts:", err);
        return [];
    }
}

/**
 * 2) Advanced runs
 */
async function scrapeSeymourRuns() {
    try {
        const url = "https://mtseymour.ca/the-mountain/todays-conditions-hours";
        const { data: html } = await axios.get(url);

        const $ = cheerio.load(html);
        const sections = $("tr.accordion-heading");

        const allRuns = [];

        sections.each((i, section) => {
            const $section = $(section);
            const liftName = $section.find("th").first().text().trim();
            const $runsRow = $section.next("tr.border-none");
            const runArticles = $runsRow.find("article.node--type-trail.node--view-mode-row");

            runArticles.each((j, article) => {
                const $article = $(article);
                const runName = $article.find(".cell.title").text().trim();

                const difficulty = $article.find(".f-icon.icon.level").attr("title") || "Unknown";

                const statusCells = $article.find(".cell.status");
                let dayStatus = "Closed";
                let nightStatus = "Closed";

                if (statusCells.length >= 1) {
                    const $dayIcon = $(statusCells[0]).find(".f-icon.icon.status");
                    dayStatus = $dayIcon.hasClass("status-open") ? "Open" : "Closed";
                }
                if (statusCells.length >= 2) {
                    const $nightIcon = $(statusCells[1]).find(".f-icon.icon.status");
                    nightStatus = $nightIcon.hasClass("status-open") ? "Open" : "Closed";
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

        /**
         * Build an array of lifts with runs
         */
        const liftsMap = {};
        allRuns.forEach((run) => {
            const { liftName, runName, difficulty, dayStatus, nightStatus } = run;

            if (!liftsMap[liftName]) {
                liftsMap[liftName] = {
                    liftName,
                    // We'll default all lifts to "Open" then possibly override below if needed
                    liftStatus: "Open",
                    runs: []
                };
            }

            // Decide run's combined status
            let combinedStatus = "Closed";
            if (dayStatus === "Open" && nightStatus === "Open") {
                combinedStatus = "Open";
            } else if (dayStatus === "Open" || nightStatus === "Open") {
                combinedStatus = "Partially Open";
            }

            liftsMap[liftName].runs.push({
                runName,
                difficulty,
                runStatus: combinedStatus
            });

            // If *every* run is closed, you might eventually set liftStatus=Closed,
            // but you would need extra logic for that. Right now we just say "Open".
        });

        return Object.values(liftsMap);
    } catch (err) {
        console.error("Error scraping Seymour runs:", err);
        return [];
    }
}

/**
 * 3) Combine the two so each lift has runs + rawHours
 */
async function scrapeSeymourAll() {
    // Grab both in parallel for performance
    const [basic, advanced] = await Promise.all([
        scrapeSeymourLifts(),
        scrapeSeymourRuns()
    ]);

    // Convert each array into a map keyed by the lift name (in lowercase for matching)
    const basicMap = {};
    basic.forEach(b => {
        const key = b.name.toLowerCase();
        basicMap[key] = {
            liftName: b.name,
            liftStatus: b.status,
            rawHours: b.rawHours
        };
    });

    const advancedMap = {};
    advanced.forEach(a => {
        const key = a.liftName.toLowerCase();
        advancedMap[key] = {
            liftName: a.liftName,
            liftStatus: a.liftStatus,
            runs: a.runs
        };
    });

    // Merge them
    const merged = [];
    const allKeys = new Set([...Object.keys(basicMap), ...Object.keys(advancedMap)]);

    for (const key of allKeys) {
        const fromBasic = basicMap[key] || {};
        const fromAdvanced = advancedMap[key] || {};

        // Use advanced liftName if it exists, else fallback
        const liftName = fromAdvanced.liftName || fromBasic.liftName || "Unknown Lift";

        // Decide lift status. If advanced says "Open" or "Closed", that can take precedence
        let liftStatus = fromAdvanced.liftStatus || fromBasic.liftStatus || "Unknown";

        // rawHours only from basic side
        const rawHours = fromBasic.rawHours || "";

        // runs only from advanced side
        const runs = fromAdvanced.runs || [];

        merged.push({
            liftName,
            liftStatus,
            rawHours,
            runs
        });
    }

    return merged;
}

module.exports = {
    scrapeSeymourLifts,
    scrapeSeymourRuns,
    scrapeSeymourAll
};

/**
 * 6) OnTheSnow Weather
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
 * 7) Combine routes
 */
const appRoutes = express.Router();

// 7a) Cypress
appRoutes.get('/cypress-lifts', async (req, res) => {
    const cypressData = await scrapeCypressLifts();
    res.json({ lifts: cypressData });
});
appRoutes.get('/cypress-base-depth', async (req, res) => {
    try {
        const baseDepthCm = await scrapeCypressBaseDepth();
        res.json({ baseDepthCm });
    } catch (error) {
        console.error("Error fetching Cypress base depth:", error);
        res.status(500).json({ error: "Failed to fetch Cypress base depth." });
    }
});
appRoutes.get('/cypress-prices', async (req, res) => {
    try {
        const cypressTicketData = await fetchCypressTicketPrices();
        res.json({ cypressTicketData });
    } catch (error) {
        console.error("Error fetching cypress ticket data:", error);
        res.status(500).json({ error: "Failed to fetch Cypress ticket data." });
    }
});

// 7b) Grouse (the one that returns runs => lift objects!)
appRoutes.get('/grouse-lifts', async (req, res) => {
    try {
        const grouseLiftsArray = await scrapeGrouseRuns();
        res.json({ lifts: grouseLiftsArray });
    } catch (err) {
        console.error('Error in /grouse-lifts route:', err);
        res.status(500).json({ error: 'Failed to scrape Grouse lifts' });
    }
});

// 7c) Seymour (simple version)
appRoutes.get("/seymour-lifts", async (req, res) => {
    try {
        const fullData = await scrapeSeymourAll();
        res.json({ lifts: fullData });
    } catch (err) {
        console.error("Error in /api/seymour-lifts route:", err);
        res.status(500).json({ error: "Failed to scrape seymour data" });
    }
});

// 7e) Weather
appRoutes.get('/weather', async (req, res) => {
    try {
        const weatherData = await getWeather();
        res.json({ weather: weatherData });
    } catch (error) {
        console.error('Error fetching weather data:', error);
        res.status(500).json({ error: 'Failed to fetch weather data.' });
    }
});

// 7f) Combined all-lifts
appRoutes.get('/all-lifts', async (req, res) => {
    const [cypressData, grouseData, seymourData] = await Promise.all([
        scrapeCypressLifts(),
        scrapeGrouseRuns(),
        scrapeSeymourLifts(),
    ]);
    res.json({
        cypress: cypressData,
        grouse: grouseData,
        seymour: seymourData,
    });
});

app.get('/api/cypress-updates', async (req, res) => {
    try {
        const updates = await scrapeCypressUpdates();
        res.json({ updates });
    } catch(err) {
        res.status(500).json({ error: 'Error scraping updates.' });
    }
});

// Use appRoutes under /api
app.use('/api', appRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

// Optional debug logs on startup
(async () => {
    const grouseData = await scrapeGrouseRuns();
    console.log("Grouse Lifts (on startup):", grouseData);
    const cypressData = await scrapeCypressLifts();
    console.log("Cypress Lifts (on startup):", cypressData);
    const seymourData = await scrapeSeymourLifts();
    console.log("Seymour Lifts (on startup):", seymourData);
})();





 
