// Isolated presentation fixtures: never writes to the phone or its library.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert(executablePath, 'Chrome or Edge is required.');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-proxy-server'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
page.setDefaultTimeout(5000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
mkdirSync('.test-data/mobile-review', { recursive: true });
try {
  await page.goto((process.env.LUMAIRE_TEST_URL || 'http://127.0.0.1:5175') + '/tests/mobile/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.locator('.mobile-library-filters').waitFor();
  assert.equal(await page.locator('.mobile-tab-bar button').count(), 4);
  await page.screenshot({ path: '.test-data/mobile-review/library.png' });
  await page.getByRole('navigation', { name: 'Library sections' }).getByRole('button', { name: 'Songs', exact: true }).click();
  assert.equal(await page.locator('.track-row').count(), 3);
  await page.locator('.track-row .track-menu summary').first().click();
  const sheet = page.locator('details[open] .menu-popover');
  await sheet.waitFor();
  await sheet.evaluate(async n => { await Promise.all(n.getAnimations().map(animation => animation.finished)); });
  const bounds = await sheet.boundingBox();
  assert(bounds && bounds.width >= 389 && bounds.y + bounds.height <= 845, `Actions must be a bottom sheet: ${JSON.stringify(bounds)}`);
  await page.screenshot({ path: '.test-data/mobile-review/actions.png' });
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('details[open]'));
  async function swipe(selector, x, y) {
    const r=await page.locator(selector).first().boundingBox(); assert(r);
    const startX=r.x+r.width/2, startY=r.y+r.height/2;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y:startY}]});
    for(let step=1;step<=4;step++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX+x*step/4,y:startY+y*step/4}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  assert.equal(await page.locator('.transport [aria-label="Next track"]').count(),0);
  await swipe('.transport .now-playing-title-wrap strong', -90, 0);
  assert.equal(await page.evaluate(()=>window.lastSkip),1);
  await swipe('.transport .now-playing-title-wrap strong', 90, 0);
  assert.equal(await page.evaluate(()=>window.lastSkip),-1);
  await swipe('.transport .now-playing-title-wrap strong', 0, -120);
  await page.locator('.mobile-now-playing').waitFor();
  const historyLength = await page.evaluate(() => history.length);
  const elapsed = await page.locator('.mobile-np-time.elapsed').textContent();
  await page.waitForFunction(previous => document.querySelector('.mobile-np-time.elapsed')?.textContent !== previous, elapsed);
  assert.equal(await page.evaluate(() => history.length), historyLength, 'Playback renders must not push history.');
  await page.screenshot({ path: '.test-data/mobile-review/player.png' });
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.locator('.mobile-np-header').evaluate(n => n.scrollWidth <= n.clientWidth), 'Player header must fit a narrow phone.');
  await page.setViewportSize({ width: 390, height: 844 });
  await swipe('.mobile-np-artwork-container', 0, -160);
  await page.locator('.mobile-np-queue-tab.is-open').waitFor();
  await page.getByRole('button', { name: 'Remove from queue' }).last().click();
  assert.equal(await page.locator('.mobile-np-queue-item:not(.current)').count(), 1);
  await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
  await page.screenshot({ path: '.test-data/mobile-review/lyrics.png' });
  await page.getByRole('button', { name: 'Back to song', exact: true }).click();
  await swipe('.mobile-np-artwork-container', 0, 150);
  await page.locator('.mobile-now-playing').waitFor({state:'detached'});
  await page.getByRole('button', { name: 'App settings', exact: true }).click();
  assert(await page.locator('.settings-index .settings-sidebar').isVisible());
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  assert(await page.locator('.settings-detail .settings-content').isVisible());
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.screenshot({ path: '.test-data/mobile-review/settings.png' });
  await page.locator('.mobile-tab-bar').getByRole('button', { name: 'Library', exact: true }).click();
  for (const width of [360, 433]) {
    await page.setViewportSize({ width, height: 844 });
    const problems = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      oval: [...document.querySelectorAll('.mobile-header-btn,.transport .play-button,.track-menu summary')].some(n => { const r=n.getBoundingClientRect(); return r.width > 0 && (Math.abs(r.width-r.height)>1 || r.width<44); }) }));
    assert.deepEqual(problems, { overflow: false, oval: false });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => !document.querySelector('.app')?.classList.contains('android'));
  assert(!await page.locator('.mobile-library-navigation').isVisible());
  assert(!await page.locator('.mobile-tab-bar').isVisible());
  assert(await page.locator('.desktop-sidebar').isVisible());
  assert.deepEqual(errors, []);
  writeFileSync('.test-data/mobile-review/result.json', JSON.stringify({ passed: true, widths: [360, 390, 433, 1280], errors }, null, 2));
  console.log('Passed: navigation, library filters, bottom sheets, player history, queue, lyrics, settings, circles, overflow and desktop isolation.');
} catch (error) {
  console.error(error.message);
  await page.screenshot({ path: '.test-data/mobile-review/failure.png', animations: 'disabled', timeout: 2000 }).catch(() => {});
  console.log(JSON.stringify(await page.evaluate(() => ({ view: document.querySelector('h1')?.textContent, menu: [...document.querySelectorAll('details[open] .menu-popover')].map(n=>({rect:n.getBoundingClientRect().toJSON()})), errors: document.querySelector('vite-error-overlay')?.shadowRoot?.textContent?.slice(0,400) }))));
  throw error;
} finally { await browser.close(); }
