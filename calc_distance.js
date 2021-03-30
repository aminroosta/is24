const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const asyncPool = require("tiny-async-pool");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

let browser;
const WORK = "Uberall, Hussitenstraße 32-33, 13355 Berlin, Germany";
const listings = JSON.parse(fs.readFileSync("./listings.json", "utf8"));

const TRANSIT = { x: 165, y: 30 };
const CYCLING = { x: 248, y: 30 };

let counter = listings.length;

async function distance([lst, context]) {
  const result = { ...lst };
  const from = lst.address.replace(/\s+/g, "+");
  const to = WORK.replace(/\s+/g, "+");
  const url = `https://www.google.com/maps/dir/${from}/${to}/`;
  const page = await context.newPage();

  const selector = ".section-directions-trip-duration";
  try {
    await page.goto(url);
    await page.mouse.click(TRANSIT.x, TRANSIT.y);
    await page.waitForSelector(selector);
    const transit = await page.evaluate(function (selector) {
      return Array.from(document.querySelectorAll(selector)).map(
        (d) => d.textContent
      );
    }, selector);

    await page.mouse.click(CYCLING.x, CYCLING.y);
    await page.waitForSelector(selector);
    const cycling = await page.evaluate(function (selector) {
      return Array.from(document.querySelectorAll(selector)).map(
        (d) => d.textContent
      );
    }, selector);

    result.transit = transit;
    result.cycling = cycling;
  } catch {
    /* do nothing */
  } finally {
    await page.close();
  }
  return result;
}

(async () => {
  browser = await puppeteer.launch({
    executablePath: "/opt/homebrew/bin/chromium",
    // headless: false,
    // slowMo: 250,
  });

  await asyncPool(
    2,
    listings.map((l, idx) => [l, idx]),
    async function ([listing, idx]) {
      --counter;
      console.log(counter);
      if (fs.existsSync(`./data/${idx}.json`)) {
        return;
      }
      const context = await browser.createIncognitoBrowserContext();
      const result = await asyncPool(
        5,
        listing.map((l) => [l, context]),
        distance
      );
      await context.close();
      fs.writeFileSync(
        `./data/${idx}.json`,
        JSON.stringify(result, null, 2),
        "utf8"
      );
    }
  );
})();
