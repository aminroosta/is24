let puppeteer = require("puppeteer");
puppeteer = require("puppeteer-extra");
const asyncPool = require("tiny-async-pool");
const fs = require("fs");

// for berlin there are only 70 pages at the moment.
const PAGE_COUNT = 70;

// work around the capcha for robots
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

function pageurl(page_number) {
  const home = "https://www.immobilienscout24.de";
  return (
    home + "/Suche/de/berlin/berlin/wohnung-mieten?pagenumber=" + page_number
  );
}

let browser;

async function page_listings(idx) {
  const page = await browser.newPage();
  await page.goto(pageurl(idx));
  await page.waitForSelector("#searchHead");
  await page.addScriptTag({
    url: "https://code.jquery.com/jquery-3.2.1.min.js",
  });
  const listings = await page.evaluate(function () {
    let all = [];
    $(".result-list__listing").each(function () {
      const $this = $(this);
      const addr = $this.find(".result-list-entry__map-link");
      const addr_text = addr.text();
      const id = addr.attr("data-result-id");
      const result = $this.find("dl dd");
      const cold = result[0].textContent;
      const meter = result[1].textContent;
      all.push({ address: addr_text, id, cold, meter });
    });
    return all;
  });

  console.log(`got ${listings.length} listings on page ${idx}.`);
  await page.close();
  return listings;
}

(async () => {
  browser = await puppeteer.launch({
    executablePath: "/opt/homebrew/bin/chromium",
    slowMo: 250,
    headless: false,
  });

  const pageNumbers = [...Array(PAGE_COUNT)].map((_, idx) => idx + 1);
  const listings = await asyncPool(9, pageNumbers, page_listings);
  fs.writeFileSync("listings.json", JSON.stringify(listings, null, 2), "utf8");

  await browser.close();
})();
