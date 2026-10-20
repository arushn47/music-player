// Render the real component with delayed native replies and deterministic images.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';

const results = 'test-results/artwork';
mkdirSync(results, { recursive: true });
const harness = buildSync({ stdin: { contents: `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Artwork } from './src/components/common/Artwork';
const root = createRoot(document.getElementById('root')!);
window.showArtwork = url => root.render(url ? <Artwork url={url} /> : null);
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
  define: { 'process.env.NODE_ENV': '"production"' } }).outputFiles[0].text;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const origin = 'http://artwork.test';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
let remoteRequests = 0;
await page.route('https://lastfm-img.freetls.fastly.net/**', route => {
  remoteRequests++;
  return route.request().url().includes('fallback')
    ? route.fulfill({ contentType: 'image/png', body: png })
    : route.fulfill({ status: 404, body: 'unavailable' });
});
await page.route(`${origin}/artwork-*.png`, route => route.request().url().includes('broken')
  ? route.fulfill({ status: 404, body: 'missing cache' })
  : route.fulfill({ contentType: 'image/png', body: png }));
await page.route(`${origin}/artwork-harness`, route => route.fulfill({ contentType: 'text/html', body:
  '<div id="root"></div>' }));
await page.addInitScript(({ origin }) => {
  window.isTauri = true;
  window.cacheCalls = [];
  window.failCache = false;
  window.__TAURI_INTERNALS__ = {
    convertFileSrc: path => `${origin}/artwork-${path}.png`,
    invoke: async (command, { url }) => {
      if (command !== 'cached_artwork') throw Error(command);
      window.cacheCalls.push(url);
      await new Promise(resolve => setTimeout(resolve, 300));
      if (window.failCache) throw Error('Temporary cache failure');
      if (url === 'local:missing') throw Error('No embedded artwork');
      return url.includes('fallback') || url.includes('unavailable') ? 'broken' : 'good';
    },
  };
}, { origin });
const show = url => page.evaluate(url => window.showArtwork(url), url);
const loaded = () => page.waitForFunction(() => {
  const img = document.querySelector('.cover img');
  return img?.complete && img.naturalWidth > 0;
});
const checks = [];
try {
  await page.goto(`${origin}/artwork-harness`);
  await page.addScriptTag({ content: harness });
  await page.waitForFunction(() => !!window.showArtwork);
  await show('https://lastfm-img.freetls.fastly.net/race.png');
  await loaded();
  assert.equal(remoteRequests, 0, 'Native cache must be tried before the remote image');
  checks.push('Delayed native cache renders without an early remote failure hiding the cover');
  await show('https://lastfm-img.freetls.fastly.net/fallback.png');
  await loaded();
  assert.match(await page.locator('img').getAttribute('src'), /fallback/);
  checks.push('Unreadable cached image falls back to its remote source');
  await show('https://lastfm-img.freetls.fastly.net/unavailable.png');
  await page.locator('.cover svg').waitFor();
  await page.waitForFunction(() => window.cacheCalls.some(url => url.includes('unavailable')));
  await page.waitForTimeout(600);
  assert.equal(await page.locator('img').count(), 0);
  await show('local:embedded');
  await loaded();
  await show('local:missing');
  await page.locator('.cover svg').waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('img').count(), 0);
  checks.push('Missing images show a placeholder; embedded artwork uses the native cache');
  await page.evaluate(() => { window.failCache = true; });
  const retry = 'https://lastfm-img.freetls.fastly.net/retry.png';
  await show(retry);
  await page.waitForTimeout(700);
  await show(null);
  await page.locator('.cover').waitFor({ state: 'detached' });
  await page.evaluate(() => { window.failCache = false; });
  await show(retry);
  await loaded();
  assert.equal(await page.evaluate(url => window.cacheCalls.filter(call => call === url).length, retry), 2);
  checks.push('Temporary native cache failures retry when the cover mounts again');
  await page.screenshot({ path: `${results}/cached-cover.png` });
  for (const check of checks) console.log(`PASS ${check}`);
} finally {
  writeFileSync(`${results}/report.json`, JSON.stringify({ checks }, null, 2));
  await browser.close();
}
