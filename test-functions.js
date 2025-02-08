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
                // Adjust according to which depth you consider the “base depth.”
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

getWeather().then((weatherData) => {
    console.log("Weather Data:", weatherData);
});


const axios = require("axios");
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

const cheerio = require('cheerio');
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

(async () => {
    const runs = await scrapeSeymourRuns();
    console.log(runs);
})();


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

(async () => {
    const g = await scrapeGrouseRuns();
    console.log(g);
})();