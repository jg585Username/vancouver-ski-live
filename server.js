// server.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import express from 'express';
import fetch from 'node-fetch';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// __dirname workaround for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

/***********************************************
 * Scraping Functions (Existing Ones)
 ***********************************************/
// 1) Scrape Cypress Lifts (including runs)
async function scrapeCypressLifts() {
  try {
    const url = 'https://www.cypressmountain.com/api/reportpal?resortName=cy';
    const { data } = await axios.get(url);
    const areas = data?.facilities?.areas?.area || [];
    const trailDifficultyIcons = data?.icons?.trailDifficultyIcons || {};
    const results = [];

    for (const areaObj of areas) {
      const liftsArr = areaObj?.lifts?.lift || [];
      const trailsArr = areaObj?.trails?.trail || [];
      for (const lift of liftsArr) {
        if (!lift?.name) continue;
        const runs = Array.isArray(trailsArr)
            ? trailsArr.map(tr => ({
              runName: tr.name,
              runStatus: tr.status,
              difficulty: tr.difficulty,
              difficultyIconUrl: trailDifficultyIcons[tr.difficultyIcon]?.image || null
            }))
            : [];
        results.push({
          liftName: lift.name,
          liftStatus: lift.status,
          openTime: lift.openTime || null,
          closeTime: lift.closeTime || null,
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

// 2) Scrape Cypress base depth
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

// 3) Scrape Cypress Updates
async function scrapeCypressUpdates() {
  try {
    const url = "https://www.cypressmountain.com/api/reportpal?resortName=cy";
    const { data } = await axios.get(url);
    const text = data?.comments?.comment?.[0]?.text ?? null;
    const update = text
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&bull;/g, '•')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .split("PARKING")[0]
        .trim();
    console.log("Update from Cypress Staff:", update);
    return update;
  } catch (err) {
    console.error("Did not receive Cypress Updates", err);
    return null;
  }
}

// 4) Scrape Cypress Ticket Prices
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
    const payload = {
      "ProductAttributeValueIds": [3969, 3964],
      "ProductId": 214,
      "StartDate": getTodayISOString(),
      "EndDate": getFutureISOString(7)
    };
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });
    const dayPriceLists = response?.data?.Variants?.[0]?.DayPriceLists || [];
    return dayPriceLists.map(dayObj => ({
      date: dayObj.Date,
      price: dayObj.Price
    }));
  } catch (err) {
    console.error("Error fetching Cypress day price lists:", err);
    return [];
  }
}

// 5) Scrape Grouse RUNS (with manual mapping)
function mapRunToLift(runName, dictionary) {
  const key = runName.toLowerCase();
  return dictionary[key] || "Olympic Express Chair";
}
function cleanupRunName(text) {
  return text.replace(/\s+/g, " ").trim();
}
async function scrapeGrouseRuns() {
  try {
    const url = 'https://www.grousemountain.com/current_conditions#runs';
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const runItems = $("div#runs ul.data-table li");
    console.log("Found runItems count =>", runItems.length);
    let allRuns = [];
    runItems.each((_, li) => {
      const $li = $(li);
      let runName = cleanupRunName($li.find("span").first().text());
      let runStatus = $li.find("span.open").length > 0 ? "Open" : "Closed";
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
      let difficultyIconUrl = '';
      if (difficulty === "Green") {
        difficultyIconUrl = 'images/beginner.svg';
      } else if (difficulty === "Blue") {
        difficultyIconUrl = 'images/intermediate.svg';
      } else if (difficulty === "Black Diamond") {
        difficultyIconUrl = 'images/advanced.svg';
      } else if (difficulty === "Double Black Diamond") {
        difficultyIconUrl = 'images/expert.svg';
      }
      allRuns.push({
        runName,
        difficulty,
        runStatus,
        difficultyIconUrl
      });
    });
    const runToLiftMap = {
      "the cut": "Screaming Eagle Chair",
      "side cut park": "Screaming Eagle Chair",
      "lower side cut": "Screaming Eagle Chair",
      "paper trail": "Screaming Eagle Chair",
      "skyline": "Screaming Eagle Chair",
      "paradise": "Greenway Quad Chair",
      "ski wee": "Magic Carpet",
      "peak": "Peak Quad Chair",
      "lower peak": "Peak Quad Chair",
      "heaven's sake": "Peak Quad Chair",
      "peak glades": "Peak Quad Chair",
      "no man's land": "Peak Quad Chair",
    };
    const liftsMap = {};
    allRuns.forEach(run => {
      const liftName = mapRunToLift(run.runName, runToLiftMap);
      if (!liftsMap[liftName]) {
        liftsMap[liftName] = { liftName, liftStatus: "Open", runs: [] };
      }
      liftsMap[liftName].runs.push(run);
    });
    return Object.values(liftsMap);
  } catch (err) {
    console.error('Error scraping Grouse runs:', err);
    return [];
  }
}
async function scrapeGrouseUpdates() {
  try {
    const url = "https://www.grousemountain.com/";
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const updateText = $('.banner__subtitle.grid_editable').first().text().trim();
    console.log("Grouse Update:", updateText);
    return updateText || null;
  } catch (error) {
    console.error("Error scraping Grouse updates:", error);
    return null;
  }
}
async function scrapeSeymourUpdates() {
  try {
    const url = "https://mtseymour.ca/";
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const updateText = $('div.clearfix.text-formatted.field.field--name-field-copy.field--type-text-long.field--label-hidden.field__item p')
        .first().text().trim();
    console.log("Seymour Update:", updateText);
    return updateText || null;
  } catch (error) {
    console.error("Error scraping Seymour updates:", error);
    return null;
  }
}
// 6) Seymour Lifts and Runs
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
    const results = [];
    liftsTable.find("tr.accordion-heading").each((i, row) => {
      const $row = $(row);
      const liftName = $row.find("th").first().text().trim();
      const statusCellText = $row.find("td").first().text().trim();
      const status = /closed/i.test(statusCellText) ? "Closed" : "Open";
      results.push({ name: liftName, status, rawHours: statusCellText });
    });
    return results;
  } catch (err) {
    console.error("Error scraping Seymour lifts:", err);
    return [];
  }
}
async function scrapeSeymourRuns() {
  try {
    const url = "https://mtseymour.ca/the-mountain/todays-conditions-hours";
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const allRuns = [];
    $("tr.accordion-heading").each((_, section) => {
      const liftName = $(section).find("th").first().text().trim();
      const $runsRow = $(section).next("tr.border-none");
      $runsRow.find("article.node--type-trail.node--view-mode-row").each((_, article) => {
        const $article = $(article);
        let runNameRaw = $article.find(".cell.title").text().trim();
        const difficultyRaw = $article.find(".f-icon.icon.level").attr("title") || "Unknown";
        runNameRaw = runNameRaw.replace(/Level:\s*\S+/gi, '').trim();
        const knownDifficulties = ["Green", "Blue", "Intermediate", "Black Diamond", "Double Black Diamond"];
        knownDifficulties.forEach(diff => {
          runNameRaw = runNameRaw.replace(new RegExp(diff, 'gi'), '').trim();
        });
        const statusCells = $article.find(".cell.status");
        let dayStatus = "Closed", nightStatus = "Closed";
        if (statusCells.length >= 1) {
          dayStatus = $(statusCells[0]).find(".f-icon.icon.status").hasClass("status-open") ? "Open" : "Closed";
        }
        if (statusCells.length >= 2) {
          nightStatus = $(statusCells[1]).find(".f-icon.icon.status").hasClass("status-open") ? "Open" : "Closed";
        }
        let difficultyIconUrl = '';
        const diffLower = difficultyRaw.toLowerCase();
        if (diffLower.includes("beginner")) {
          difficultyIconUrl = 'images/beginner.svg';
        } else if (diffLower.includes("intermediate")) {
          difficultyIconUrl = 'images/intermediate.svg';
        } else if (diffLower.includes("expert")) {
          difficultyIconUrl = 'images/expert.svg';
        } else if (diffLower.includes("advanced")) {
          difficultyIconUrl = 'images/advanced.svg';
        }
        allRuns.push({
          liftName,
          runName: runNameRaw,
          difficulty: difficultyRaw,
          difficultyIconUrl,
          dayStatus,
          nightStatus
        });
      });
    });
    const liftsMap = {};
    allRuns.forEach(run => {
      if (!liftsMap[run.liftName]) {
        liftsMap[run.liftName] = { liftName: run.liftName, liftStatus: "Open", runs: [] };
      }
      let combinedStatus = "Closed";
      if (run.dayStatus === "Open" && run.nightStatus === "Open") {
        combinedStatus = "Open";
      } else if (run.dayStatus === "Open" || run.nightStatus === "Open") {
        combinedStatus = "Partially Open";
      }
      liftsMap[run.liftName].runs.push({
        runName: run.runName,
        difficulty: run.difficulty,
        difficultyIconUrl: run.difficultyIconUrl,
        runStatus: combinedStatus
      });
    });
    return Object.values(liftsMap);
  } catch (err) {
    console.error("Error scraping Seymour runs:", err);
    return [];
  }
}
async function scrapeSeymourAll() {
  const [basic, advanced] = await Promise.all([ scrapeSeymourLifts(), scrapeSeymourRuns() ]);
  const basicMap = {};
  basic.forEach(b => { basicMap[b.name.toLowerCase()] = { liftName: b.name, liftStatus: b.status, rawHours: b.rawHours }; });
  const advancedMap = {};
  advanced.forEach(a => { advancedMap[a.liftName.toLowerCase()] = { liftName: a.liftName, liftStatus: a.liftStatus, runs: a.runs }; });
  const merged = [];
  const allKeys = new Set([...Object.keys(basicMap), ...Object.keys(advancedMap)]);
  allKeys.forEach(key => {
    const fromBasic = basicMap[key] || {};
    const fromAdvanced = advancedMap[key] || {};
    merged.push({
      liftName: fromAdvanced.liftName || fromBasic.liftName || "Unknown Lift",
      liftStatus: fromAdvanced.liftStatus || fromBasic.liftStatus || "Unknown",
      rawHours: fromBasic.rawHours || "",
      runs: fromAdvanced.runs || []
    });
  });
  return merged;
}

// 7) OnTheSnow Weather (Existing)
async function getWeather() {
  const url = "https://www.onthesnow.com/_next/data/2.6.9_en-US/vancouver/open-resorts.json?region=vancouver";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed with status: ${response.status}`);
    const data = await response.json();
    const resortsData = data?.pageProps?.resorts?.data || [];
    return resortsData.map((resort) => ({
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
  } catch (err) {
    console.error("Error fetching or parsing weather data:", err);
    return [];
  }
}

// 8) Scrape Eyeball Reports
async function scrapeEyeballReports() {
  const url = 'https://www.snow-forecast.com/resorts/Cypress-Mountain/6day/bot';
  try {
    const response = await fetch(url);
    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);
    const reports = [];
    $('p.eyeball-reports__text').each((i, el) => {
      const reportText = $(el).text().trim();
      const publishedText = $($('.eyeball-reports__published')[i]).text().trim();
      reports.push({ reportText, publishedText });
    });

    // Filter out duplicate reports.
    const uniqueReports = reports.filter((report, index, self) =>
            index === self.findIndex(r =>
                r.reportText === report.reportText && r.publishedText === report.publishedText
            )
    );

    return uniqueReports.length ? uniqueReports : [{ reportText: "No snow reports to show", publishedText: "" }];
  } catch (error) {
    console.error('Error fetching/parsing Eyeball Reports:', error);
    return [];
  }
}


// 9) Scrape Backcountry Info
async function scrapesBackcountryInfo() {
  try {
    const url = 'https://opensnow.com/avalanche/2eed5e9c3bd0ef7958755c829723bd0d820795204ab91687e7c2005265f62e81';
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);
    const ratingImg = $('.AvalancheForecast__dangerHeader img').attr('src') || '';
    const paragraphs = [];
    $('.AvalancheForecast__summaryText p').each((i, el) => {
      paragraphs.push($(el).text().trim());
    });
    console.log('Avalanche Rating Image:', ratingImg);
    return { ratingImg, paragraphs };
  } catch (err) {
    console.error('Error scraping backcountry info:', err);
    return null;
  }
}

// 10) Scrape Images from Snow Forecast (for slideshow)
async function scrapeImagesFromSnowForecast() {
  const url = 'https://www.snow-forecast.com/resorts/Grouse-Mountain/6day/mid';
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);
  const imageUrls = [];
  $('tr.forecast-table__row[data-row="maps"] img').each((i, el) => {
    let src = $(el).attr('src');
    if (src) {
      if (src.startsWith('/')) src = 'https://www.snow-forecast.com' + src;
      imageUrls.push(src);
    }
  });
  return imageUrls;
}
scrapeImagesFromSnowForecast().then(urls => console.log('Found images:', urls));

/***********************************************
 * New Forecast Endpoint (/api/forecast)
 ***********************************************/
/***********************************************
 * New Forecast Endpoint (/api/forecast)
 ***********************************************/
/***********************************************
 * New Forecast Endpoint (/api/forecast)
 ***********************************************/
app.get('/api/forecast', async (req, res) => {
  try {
    // Fetch the three forecast datasets concurrently.
    const [botData, midData, topData] = await Promise.all([
      fetch('https://snow-scraper.azurewebsites.net/bot').then(r => r.json()),
      fetch('https://snow-scraper.azurewebsites.net/mid').then(r => r.json()),
      fetch('https://snow-scraper.azurewebsites.net/top').then(r => r.json())
    ]);

    // Ensure each contains a resorts array.
    if (!botData.resorts || !midData.resorts || !topData.resorts) {
      throw new Error('Missing resorts data in one of the responses.');
    }

    // Mapping of desired resort names to their index in the resorts array.
    const resortIndices = {
      "Cypress-Mountain": 3,
      "Grouse-Mountain": 6,
      "Mount-Seymour": 15  // Verify that this index exists in your data!
    };

    const forecastResult = {};

    // For each desired resort, build a 7-day forecast.
    for (const resortName in resortIndices) {
      const index = resortIndices[resortName];
      const botResort = botData.resorts[index];
      const midResort = midData.resorts[index];
      const topResort = topData.resorts[index];
      if (!botResort || !midResort || !topResort) continue;

      // Forecast arrays are nested inside the "data" property.
      // Process only keys whose values are arrays.
      const keys = Object.keys(botResort.data).filter(k => Array.isArray(botResort.data[k]));

      const daysForecast = [];
      for (let day = 0; day < 7; day++) {
        const dayData = { base: {}, mid: {}, top: {} };
        keys.forEach(key => {
          dayData.base[key] = botResort.data[key][day] ?? null;
          dayData.mid[key] = midResort.data[key][day] ?? null;
          dayData.top[key] = topResort.data[key][day] ?? null;
        });
        daysForecast.push(dayData);
      }

      // Do not rotate—the provider already supplies forecast starting with today's info at index 0.
      forecastResult[resortName] = { forecast: daysForecast };
    }

    res.json({ forecast: forecastResult });
  } catch (err) {
    console.error('Error fetching forecast data:', err);
    res.status(500).json({ error: 'Failed to fetch forecast data.' });
  }
});



/***********************************************
 * Existing API Routes (unchanged)
 ***********************************************/
const appRoutes = express.Router();

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
appRoutes.get('/grouse-lifts', async (req, res) => {
  try {
    const grouseLiftsArray = await scrapeGrouseRuns();
    res.json({ lifts: grouseLiftsArray });
  } catch (err) {
    console.error('Error in /grouse-lifts route:', err);
    res.status(500).json({ error: 'Failed to scrape Grouse lifts' });
  }
});
appRoutes.get("/seymour-lifts", async (req, res) => {
  try {
    const fullData = await scrapeSeymourAll();
    res.json({ lifts: fullData });
  } catch (err) {
    console.error("Error in /seymour-lifts route:", err);
    res.status(500).json({ error: "Failed to scrape seymour data" });
  }
});
// Preserve the original /weather endpoint
appRoutes.get('/weather', async (req, res) => {
  try {
    const weatherData = await getWeather();
    res.json({ weather: weatherData });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
});
appRoutes.get('/grouse-updates', async (req, res) => {
  const update = await scrapeGrouseUpdates();
  res.json({ update });
});
appRoutes.get('/seymour-updates', async (req, res) => {
  const update = await scrapeSeymourUpdates();
  res.json({ update });
});
appRoutes.get('/cypress-updates', async (req, res) => {
  try {
    const updates = await scrapeCypressUpdates();
    res.json({ updates });
  } catch(err) {
    res.status(500).json({ error: 'Error scraping updates.' });
  }
});
app.get('/api/snow-reports', async (req, res) => {
  const reports = await scrapeEyeballReports();
  res.json(reports);
});
app.get('/api/backcountry-info', async (req, res) => {
  const update = await scrapesBackcountryInfo();
  res.json(update);
});
app.get('/api/images', async (req, res) => {
  try {
    const url = 'https://www.snow-forecast.com/resorts/Grouse-Mountain/6day/mid';
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const imageUrls = [];
    $('tr.forecast-table__row[data-row="maps"] img').each((i, el) => {
      let src = $(el).attr('src');
      if (src && src.startsWith('/')) {
        src = 'https://www.snow-forecast.com' + src;
      }
      if (src) imageUrls.push(src);
    });
    console.log('Scraped image URLs:', imageUrls);
    res.json({ images: imageUrls });
  } catch (err) {
    console.error('Error scraping images:', err);
    res.status(500).json({ error: 'Failed to scrape images' });
  }
});

app.use('/api', appRoutes);

/***********************************************
 * Vite Middleware Integration
 ***********************************************/
async function startServer() {
  const vite = await createViteServer({ server: { middlewareMode: 'html' } });
  app.use(vite.middlewares);
  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (err) {
      vite.ssrFixStacktrace(err);
      res.status(500).end(err.message);
    }
  });
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}
startServer();

// Optional debug logs on startup.
(async () => {
  console.log("Grouse Lifts (on startup):", await scrapeGrouseRuns());
  console.log("Cypress Lifts (on startup):", await scrapeCypressLifts());
  console.log("Seymour Lifts (on startup):", await scrapeSeymourLifts());
})();

