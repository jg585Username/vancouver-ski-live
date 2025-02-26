async function getWeather() {
    const url =
        "https://www.onthesnow.com/_next/data/2.6.9_en-US/vancouver/open-resorts.json?region=vancouver";

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
        const url = 'https://www.grousemountain.com/current_conditions#runs';
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

scrapeGrouseRuns().then(data => {
    console.log("Grouse Lifts/Runs data:", JSON.stringify(data, null, 2));
}).catch(err => {
    console.error("Error testing Grouse:", err);
});


async function scrapeCypressUpdates(){
    try {
        const url = "https://www.cypressmountain.com/api/reportpal?resortName=cy";
        const { data } = await axios.get(url);

        // Safely access property using optional chaining:
        const text = data?.comments?.comment?.[0]?.text ?? null;
        const update = text.replace(/<br\s*\/?>/g, '\n')   // turn <br> into newlines
            .replace(/<[^>]+>/g, '')        // remove other tags like <b> or <p>
            .replace(/&bull;/g, '•')        // convert bullet entity
            .replace(/&nbsp;/g, ' ')        // convert non-breaking space if any
            .replace(/\s{2,}/g, ' ')        // multiple spaces => single space
            .trim();
        console.log("Update from Cypress Staff:", update);
        return update;
    } catch (err) {
        console.error("Did not receive Cypress Updates", err);
        return null;
    }
}

console.log(scrapeCypressUpdates());


async function scrapeGrouseUpdates() {
    try {
        // Replace with the actual Grouse Mountain updates URL
        const url = "https://www.grousemountain.com/";
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);

        // Select the element containing the update text.
        // Adjust the selector if needed based on the actual page structure.
        const updateText = $('.banner__subtitle.grid_editable').first().text().trim();

        console.log("Grouse Update:", updateText);
        return updateText || null;
    } catch (error) {
        console.error("Error scraping Grouse updates:", error);
        return null;
    }
}

console.log(scrapeGrouseUpdates());

async function scrapeSeymourUpdates() {
    try {
        // Replace with the actual Seymour Mountain updates URL
        const url = "https://mtseymour.ca/";  // You might need a more specific URL (e.g., /winter) if required.
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);

        // Adjust the selector to target the specific element(s) containing the update.
        const updateText = $('div.clearfix.text-formatted.field.field--name-field-copy.field--type-text-long.field--label-hidden.field__item p')
            .first()
            .text()
            .trim();

        console.log("Seymour Update:", updateText);
        return updateText || null;
    } catch (error) {
        console.error("Error scraping Seymour updates:", error);
        return null;
    }
}

console.log(scrapeSeymourUpdates());

async function scrapeEyeballReports() {
    const url = 'https://www.snow-forecast.com/resorts/Cypress-Mountain/6day/bot';

    try {
        // Fetch the HTML content from the URL
        const response = await fetch(url);
        const htmlText = await response.text();

        // Load the HTML into Cheerio
        const $ = cheerio.load(htmlText);

        // Select all paragraph elements with the class 'eyeball-reports__text'
        const reportParagraphs = $('p.eyeball-reports__text');
        // Select all elements with the class 'eyeball-reports__published'
        const publishedElements = $('.eyeball-reports__published');

        // Extract and combine the text content from each report and published element
        const reports = [];
        reportParagraphs.each((i, element) => {
            const reportText = $(element).text().trim();
            const publishedText = $(publishedElements[i]).text().trim();
            reports.push({
                reportText,
                publishedText
            });
        });

        // Remove duplicate entries (keeping only the first occurrence)
        const uniqueReports = reports.filter((report, index, self) =>
                index === self.findIndex(r =>
                    r.reportText === report.reportText && r.publishedText === report.publishedText
                )
        );

        return uniqueReports;
    } catch (error) {
        console.error('Error fetching or parsing the HTML:', error);
        return [];
    }
}


scrapeEyeballReports().then(reports => {
    console.log('Eyeball Reports:', reports);
});

async function scrapesBackcountryInfo() {
    try {
        const url = 'https://opensnow.com/avalanche/2eed5e9c3bd0ef7958755c829723bd0d820795204ab91687e7c2005265f62e81';

        // Fetch the HTML content from the webpage
        const { data: html } = await axios.get(url);

        // Load into Cheerio
        const $ = cheerio.load(html);

        // 1) Scrape the avalanche rating image src
        //    This <img> is typically found under the ".AvalancheForecast__dangerHeader" selector.
        const ratingImg = $('.AvalancheForecast__dangerHeader img').attr('src') || '';

        // 2) Scrape all paragraphs that appear within '.AvalancheForecast__summaryText'
        const paragraphs = [];
        $('.AvalancheForecast__summaryText p').each((i, el) => {
            paragraphs.push($(el).text().trim());
        });
        const validityContainer = $('.tw-p-5 .tw-text-xs.tw-mb-2.5');

        const date = {};
        if (validityContainer.length > 0) {
            // The container typically has two <span> elements and one <small>
            const spanElements = validityContainer.find('span');
            const smallElement = validityContainer.find('small').first();

            date.validFrom = spanElements.eq(0).text().trim();  // "Valid Thu Feb 20 4:00pm PST"
            date.postedAgo = smallElement.text().trim();        // "19 hours ago"
            date.validUntil = spanElements.eq(1).text().trim();   // "Until Fri Feb 21 4:00pm PST"
        } else {
            // Fallback values if the container is not found
            date.validFrom = '';
            date.postedAgo = '';
            date.validUntil = '';
        }

        console.log(date);
        // Print out the results
        console.log('Avalanche Rating Image:', ratingImg);
        console.log('Paragraphs under Avalanche Forecast:');
        paragraphs.forEach((p, index) => {
            console.log(`Paragraph #${index + 1}: ${p}`);
        });

        // Optional: return the data if you want to use it elsewhere
        return {
            ratingImg,
            paragraphs,
        };
    } catch (err) {
        console.error('Error scraping backcountry info:', err);
        return null;
    }
}

// Example usage
scrapesBackcountryInfo();

// testFormatAttribute.js

/**
 * Strips "Blocks" from the key, converts "freezinglevel" to "Freezing Level",
 * appends units (cm, °C, km/h, mm, m) to numeric values, and labels arrays
 * as Morning, Afternoon, Night (or partial).
 */
function formatAttribute(key, value) {
    // 1. Remove "Blocks" suffix (case-insensitive)
    let label = key.replace(/Blocks$/i, '');
    // 2. Handle "freezinglevel" => "Freezing Level"
    if (label.toLowerCase() === 'freezinglevel') {
        label = 'Freezing Level';
    } else {
        // Capitalize first letter
        label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    // 3. Unit mapping
    const unitMap = {
        "Snow": " cm",
        "Temperature": " °C",
        "Wind": " km/h",
        "Rain": " mm",
        "Freezing Level": " m"
    };
    const unit = unitMap[label] || "";

    // 4. Helper to parse & append unit if numeric
    function parseAndAppendUnit(val) {
        if (val === "-" || val == null || val === "") {
            return val; // keep placeholder or empty values
        }
        const str = String(val).trim();
        const num = parseFloat(str);
        if (!isNaN(num)) {
            return num + unit;
        }
        return val;
    }

    // 5. Handle arrays => label them
    if (Array.isArray(value)) {
        let output = `<strong>${label}:</strong><br>`;
        const length = value.length;
        if (length === 3) {
            output += `Morning: ${parseAndAppendUnit(value[0])}<br>`;
            output += `Afternoon: ${parseAndAppendUnit(value[1])}<br>`;
            output += `Night: ${parseAndAppendUnit(value[2])}`;
        } else if (length === 2) {
            output += `Afternoon: ${parseAndAppendUnit(value[0])}<br>`;
            output += `Night: ${parseAndAppendUnit(value[1])}`;
        } else if (length === 1) {
            output += `Night: ${parseAndAppendUnit(value[0])}`;
        } else {
            output += value.map(parseAndAppendUnit).join(', ');
        }
        return output;
    }
    // If it's an object, not an array => just JSON.stringify
    else if (typeof value === 'object' && value !== null) {
        return `<strong>${label}:</strong> ${JSON.stringify(value)}`;
    }
    // Otherwise single value
    else {
        return `<strong>${label}:</strong> ${parseAndAppendUnit(value)}`;
    }
}

// -------------------------------------------------------------
// TESTING THE FUNCTION
// -------------------------------------------------------------

// Create an array of sample test cases to confirm the behavior:
const testCases = [
    { key: "temperatureBlocks", value: [ "7", "8.5", "2" ] },
    { key: "snowBlocks", value: [3, "-", 6] },
    { key: "windBlocks", value: ["10", "15", "5"] },
    { key: "rainBlocks", value: 2 },
    { key: "freezingLevelBlocks", value: [1600, 1300, 1450] },
    { key: "snowBlocks", value: "-" },
    { key: "temperatureBlocks", value: null },
    { key: "snowBlocks", value: [ "  6.2", "test", "4.1" ] },  // mixed array
    { key: "randomKeyBlocks", value: "123" },                  // no known unit
    { key: "randomObjBlocks", value: { foo: "bar" } },         // an object
    { key: "temperature", value: [5] },                        // no "Blocks" suffix
];

// We'll just loop over them and log out the result:
testCases.forEach(({ key, value }) => {
    const result = formatAttribute(key, value);
    console.log(`Key: "${key}"  Value:`, value, "\n=>", result, "\n");
});
