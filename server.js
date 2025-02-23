// server.js
import axios from 'axios';
import cheerio from 'cheerio';
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

// --- Your scraping functions ---
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

// 3) Scrape Cypress ticket prices
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
    const dayPriceLists = response?.data?.Variants?.[0]?.DayPriceLists || [];
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

// 4) Scrape Grouse RUNS (with manual mapping)
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
      let runName = $li.find("span").first().text().trim();
      runName = cleanupRunName(runName);
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
      const { runName, difficulty, runStatus, difficultyIconUrl } = run;
      const liftName = mapRunToLift(runName, runToLiftMap);
      if (!liftsMap[liftName]) {
        liftsMap[liftName] = {
          liftName,
          liftStatus: "Open",
          runs: []
        };
      }
      liftsMap[liftName].runs.push({
        runName,
        difficulty,
        runStatus,
        difficultyIconUrl
      });
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

// 5) Seymour Lifts and Runs
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
        name: liftName,
        status,
        rawHours: statusCellText
      });
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
    const sections = $("tr.accordion-heading");
    const allRuns = [];
    sections.each((_, section) => {
      const $section = $(section);
      const liftName = $section.find("th").first().text().trim();
      const $runsRow = $section.next("tr.border-none");
      const runArticles = $runsRow.find("article.node--type-trail.node--view-mode-row");
      runArticles.each((_, article) => {
        const $article = $(article);
        let runNameRaw = $article.find(".cell.title").text().trim();
        const difficultyRaw = $article.find(".f-icon.icon.level").attr("title") || "Unknown";
        runNameRaw = runNameRaw.replace(/Level:\s*\S+/gi, '').trim();
        const knownDifficulties = ["Green", "Blue", "Intermediate", "Black Diamond", "Double Black Diamond"];
        knownDifficulties.forEach(diff => {
          const regex = new RegExp(diff, 'gi');
          runNameRaw = runNameRaw.replace(regex, '').trim();
        });
        let difficulty = difficultyRaw;
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
        let difficultyIconUrl = '';
        const diffLower = difficulty.toLowerCase();
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
          difficulty,
          difficultyIconUrl,
          dayStatus,
          nightStatus
        });
      });
    });
    const liftsMap = {};
    allRuns.forEach((run) => {
      const { liftName, runName, difficulty, difficultyIconUrl, dayStatus, nightStatus } = run;
      if (!liftsMap[liftName]) {
        liftsMap[liftName] = {
          liftName,
          liftStatus: "Open",
          runs: []
        };
      }
      let combinedStatus = "Closed";
      if (dayStatus === "Open" && nightStatus === "Open") {
        combinedStatus = "Open";
      } else if (dayStatus === "Open" || nightStatus === "Open") {
        combinedStatus = "Partially Open";
      }
      liftsMap[liftName].runs.push({
        runName,
        difficulty,
        difficultyIconUrl,
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
  const [basic, advanced] = await Promise.all([
    scrapeSeymourLifts(),
    scrapeSeymourRuns()
  ]);
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
  const merged = [];
  const allKeys = new Set([...Object.keys(basicMap), ...Object.keys(advancedMap)]);
  for (const key of allKeys) {
    const fromBasic = basicMap[key] || {};
    const fromAdvanced = advancedMap[key] || {};
    const liftName = fromAdvanced.liftName || fromBasic.liftName || "Unknown Lift";
    let liftStatus = fromAdvanced.liftStatus || fromBasic.liftStatus || "Unknown";
    const rawHours = fromBasic.rawHours || "";
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

// 6) OnTheSnow Weather
async function getWeather() {
  const url = "https://www.onthesnow.com/_next/data/2.6.9_en-US/vancouver/open-resorts.json?region=vancouver";
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

async function scrapeEyeballReports() {
  const url = 'https://www.snow-forecast.com/resorts/Cypress-Mountain/6day/bot';
  try {
    const response = await fetch(url);
    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);
    const reportParagraphs = $('p.eyeball-reports__text');
    const publishedElements = $('.eyeball-reports__published');
    const reports = [];
    reportParagraphs.each((i, element) => {
      const reportText = $(element).text().trim();
      const publishedText = $(publishedElements[i]).text().trim();
      reports.push({
        reportText,
        publishedText
      });
    });
    const uniqueReports = reports.filter((report, index, self) =>
      index === self.findIndex(r =>
        r.reportText === report.reportText && r.publishedText === report.publishedText
      )
    );
    if (uniqueReports.length === 0) {
      return [{ reportText: "No snow reports to show", publishedText: "" }];
    }
    return uniqueReports;
  } catch (error) {
    console.error('Error fetching or parsing the HTML:', error);
    return [];
  }
}

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
    paragraphs.forEach((p, index) => {
      console.log(`Paragraph #${index + 1}: ${p}`);
    });
    return {
      ratingImg,
      paragraphs,
    };
  } catch (err) {
    console.error('Error scraping backcountry info:', err);
    return null;
  }
}

async function getHtml() {
  const url = 'https://www.snow-forecast.com/resorts/Grouse-Mountain/6day/mid';
  const { data: html } = await axios.get(url);
  return html;
}

async function scrapeImagesFromSnowForecast() {
  const html = await getHtml();
  const $ = cheerio.load(html);
  const imageUrls = [];
  $('tr.forecast-table__row[data-row="maps"] img').each((i, el) => {
    const src = $(el).attr('src');
    if (src) imageUrls.push(src);
  });
  return imageUrls;
}

scrapeImagesFromSnowForecast().then(urls => {
  console.log('Found the following images:', urls);
});

// --- API Routes ---
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
    console.error("Error in /api/seymour-lifts route:", err);
    res.status(500).json({ error: "Failed to scrape seymour data" });
  }
});
appRoutes.get('/weather', async (req, res) => {
  try {
    const weatherData = await getWeather();
    res.json({ weather: weatherData });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
});
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
appRoutes.get('/cypress-updates', async (req, res) => {
  try {
    const updates = await scrapeCypressUpdates();
    res.json({ updates });
  } catch(err) {
    res.status(500).json({ error: 'Error scraping updates.' });
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
      if (src) {
        if (src.startsWith('/')) {
          src = 'https://www.snow-forecast.com' + src;
        }
        imageUrls.push(src);
      }
    });
    console.log('Scraped image URLs:', imageUrls);
    res.json({ images: imageUrls });
  } catch (err) {
    console.error('Error scraping images:', err);
    res.status(500).json({ error: 'Failed to scrape images' });
  }
});

// Mount API routes under /api
app.use('/api', appRoutes);

// --- Vite Middleware Integration --- 
async function startServer() {
  // Create Vite dev server in middleware mode.
  const vite = await createViteServer({
    server: { middlewareMode: 'html' }
  });

  // Use Vite's middleware for front-end requests.
  app.use(vite.middlewares);

  // Fallback: serve index.html via Vite's transform.
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
  const grouseData = await scrapeGrouseRuns();
  console.log("Grouse Lifts (on startup):", grouseData);
  const cypressData = await scrapeCypressLifts();
  console.log("Cypress Lifts (on startup):", cypressData);
  const seymourData = await scrapeSeymourLifts();
  console.log("Seymour Lifts (on startup):", seymourData);
})();
