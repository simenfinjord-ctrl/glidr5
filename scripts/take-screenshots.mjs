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

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  await page.locator('input[type="email"]').first().fill('admin@fastski.local');
  await page.locator('input[type="password"]').first().fill('password');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  console.log('After login, URL:', page.url());

  const cookies = await context.cookies();
  const sid = cookies.find(c => c.name === 'connect.sid');
  if (!sid) {
    console.log('No session cookie! Cookies:', cookies.map(c => c.name));
    await page.screenshot({ path: `${OUT}/debug-check.png` });
    await browser.close();
    process.exit(1);
  }
  console.log('Got session cookie');

  const shots = [
    { route: '/dashboard', file: 'glidr-hero.png', wait: 4000 },
    { route: '/tests', file: 'glidr-tests.png', wait: 3000 },
    { route: '/analytics', file: 'glidr-analytics.png', wait: 4000 },
    { route: '/weather', file: 'glidr-weather.png', wait: 3000 },
    { route: '/testskis', file: 'glidr-testskis.png', wait: 3000 },
    { route: '/products', file: 'glidr-products.png', wait: 3000 },
    { route: '/raceskis', file: 'glidr-raceskis.png', wait: 3000 },
    { route: '/admin', file: 'glidr-security.png', wait: 3000 },
  ];

  for (const s of shots) {
    await page.goto(`${BASE}${s.route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(s.wait);
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log(`WARNING: Redirected to login for ${s.route}`);
      continue;
    }
    await page.screenshot({ path: `${OUT}/${s.file}` });
    console.log(`OK: ${s.file}`);
  }

  // Mobile view
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await mobileContext.addCookies(cookies);
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE}/tests`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(3000);
  if (!mobilePage.url().includes('/login')) {
    await mobilePage.screenshot({ path: `${OUT}/glidr-offline.png` });
    console.log('OK: glidr-offline.png (mobile)');
  }

  await browser.close();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
