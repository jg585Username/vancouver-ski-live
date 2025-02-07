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
