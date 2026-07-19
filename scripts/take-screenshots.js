import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/home/mariusz/.gemini/antigravity-ide/brain/7504ac78-4ca5-479c-a135-9f87d059d97c';
const SCREENSHOTS_DIR = path.resolve('./screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/snap/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });

  const routes = [
    { name: '01_timeline_light', url: 'http://localhost:5173/toskania/', dark: false },
    { name: '02_timeline_dark', url: 'http://localhost:5173/toskania/', dark: true },
    { name: '03_day_view_light', url: 'http://localhost:5173/toskania/#/dzien-2', dark: false },
    { name: '04_day_view_dark', url: 'http://localhost:5173/toskania/#/dzien-2', dark: true },
    { name: '05_interactive_map', url: 'http://localhost:5173/toskania/mapa/', dark: false },
    { name: '06_gallery', url: 'http://localhost:5173/toskania/galeria/', dark: false },
    { name: '07_practical', url: 'http://localhost:5173/toskania/praktyczne/', dark: false },
    { name: '08_short_overview', url: 'http://localhost:5173/toskania/short/', dark: false },
  ];

  for (const r of routes) {
    console.log(`Capturing ${r.name} (${r.url})...`);
    await page.goto(r.url, { waitUntil: 'networkidle2' });
    await new Promise((res) => setTimeout(res, 800)); // wait for animations & Leaflet tiles

    if (r.dark) {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await new Promise((res) => setTimeout(res, 300));
    } else {
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
      await new Promise((res) => setTimeout(res, 300));
    }

    const localPath = path.join(SCREENSHOTS_DIR, `${r.name}.png`);
    const artifactPath = path.join(ARTIFACTS_DIR, `${r.name}.png`);

    await page.screenshot({ path: localPath, fullPage: false });
    fs.copyFileSync(localPath, artifactPath);
    console.log(`Saved screenshot to ${localPath} and ${artifactPath}`);
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Error taking screenshots:', err);
  process.exit(1);
});
