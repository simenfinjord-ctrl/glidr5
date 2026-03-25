import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
const OUT = 'client/public/images';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('[data-testid="input-email"]', 'admin@fastski.local');
  await page.fill('[data-testid="input-password"]', 'password');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(2000);
  console.log('Logged in');

  const shots = [
    { route: '/dashboard', file: 'glidr-hero.png', wait: 3000 },
    { route: '/tests', file: 'glidr-tests.png', wait: 2000 },
    { route: '/analytics', file: 'glidr-analytics.png', wait: 3000 },
    { route: '/weather', file: 'glidr-weather.png', wait: 2000 },
    { route: '/products', file: 'glidr-products.png', wait: 2000 },
    { route: '/testskis', file: 'glidr-testskis.png', wait: 2000 },
    { route: '/raceskis', file: 'glidr-raceskis.png', wait: 2000 },
    { route: '/admin', file: 'glidr-security.png', wait: 2000 },
  ];

  for (const s of shots) {
    await page.goto(`${BASE}${s.route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(s.wait);
    await page.screenshot({ path: `${OUT}/${s.file}` });
    console.log(`Screenshot: ${s.file}`);
  }

  // Test detail page (first test with data)
  await page.goto(`${BASE}/tests/3`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/glidr-runsheet.png` });
  console.log('Screenshot: glidr-runsheet.png');

  // Mobile view
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`${BASE}/login`);
  await mobilePage.fill('[data-testid="input-email"]', 'admin@fastski.local');
  await mobilePage.fill('[data-testid="input-password"]', 'password');
  await mobilePage.click('[data-testid="button-login"]');
  await mobilePage.waitForURL('**/dashboard');
  await mobilePage.waitForTimeout(2000);
  await mobilePage.goto(`${BASE}/tests`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${OUT}/glidr-offline.png` });
  console.log('Screenshot: glidr-offline.png (mobile)');

  // Watch mode mockup - screenshot the runsheet dialog if possible
  // For now, just use the test detail with bracket

  await browser.close();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
