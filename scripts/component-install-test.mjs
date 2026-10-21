// Real native installation in an isolated profile; no user data or credentials.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

const data = path.resolve(`.test-data/components-${Date.now()}`);
const results = path.resolve('test-results/component-install');
mkdirSync(data, { recursive: true });
mkdirSync(results, { recursive: true });
const executable = path.join(data, 'Lumaire-component-test.exe');
copyFileSync(path.resolve('src-tauri/target/debug/lumaire.exe'), executable);
const report = { checks: [], errors: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = await new Promise(resolve => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
let app, browser;
try {
  const appEnv = { ...process.env };
  for (const key of Object.keys(appEnv)) if (key.toLowerCase() === 'path') delete appEnv[key];
  appEnv.PATH = `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`;
  app = spawn(executable, [], {
    windowsHide: true,
    env: { ...appEnv, LUMAIRE_DATA_DIR: data,
      WEBVIEW2_USER_DATA_FOLDER: path.join(data, 'webview'),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
  });
  app.on('exit', (code, signal) => { report.processExit = { code, signal }; });
  app.on('error', error => report.errors.push(error.message));
  app.stderr.on('data', chunk => { report.nativeLog = (report.nativeLog || '') + chunk.toString(); });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await delay(250);
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  let page;
  for (let i = 0; i < 80; i++) {
    page = browser.contexts().flatMap(c => c.pages()).find(p => /1420|tauri\.localhost/.test(p.url()));
    if (page) break;
    await delay(100);
  }
  report.initialUrls = browser.contexts().flatMap(c => c.pages()).map(p => p.url());
  page ||= browser.contexts().flatMap(c => c.pages())[0];
  assert(page, `No desktop WebView found: ${report.initialUrls}`);
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  const invoke = command => page.evaluate(command => window.__TAURI_INTERNALS__.invoke(command), command);
  await page.getByRole('heading', { name: 'Discover new music.', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enable online playback', exact: true }).waitFor();
  await page.screenshot({ path: path.join(results, 'first-use.png') });
  report.checks.push('Discover is the initial page and offers online setup before any search or playback error');
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  assert.equal(await page.getByRole('alert').count(), 0);
  assert(await page.getByRole('textbox', { name: 'Search music', exact: true }).isEnabled());
  await page.evaluate(() => {
    window.__setupEvents = [];
    new MutationObserver(() => {
      const card = document.querySelector('.engine-setup');
      if (!card) return;
      const bar = card.querySelector('progress');
      const event = { stage: card.dataset.stage, percent: bar?.getAttribute('value'), text: card.querySelector('.engine-install-progress')?.textContent };
      if (JSON.stringify(event) !== JSON.stringify(window.__setupEvents.at(-1))) window.__setupEvents.push(event);
    }).observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
  });
  await page.getByRole('button', { name: 'Enable online playback', exact: true }).click();
  await page.getByRole('progressbar', { name: 'Online playback setup progress' }).waitFor();
  assert(await page.getByRole('button', { name: 'Setting up…', exact: true }).isDisabled());
  await page.getByRole('button', { name: 'Cancel setup', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'cancelled' }).waitFor();
  assert.equal(await invoke('ytdlp_check_available'), false);
  assert.equal(readdirSync(path.join(data, 'components')).length, 0);
  report.checks.push('Native cancellation aborts installation, removes staging files and never marks incomplete components ready');
  console.log('Installing pinned components through the real setup UI in an isolated test profile…');
  await page.getByRole('button', { name: 'Retry setup', exact: true }).click();
  await page.getByRole('progressbar', { name: 'Online playback setup progress' }).waitFor();
  await page.waitForFunction(() => window.__setupEvents.some(event => event.stage === 'downloading' && Number(event.percent) > 0), null, { timeout: 120000 });
  await page.screenshot({ path: path.join(results, 'progress.png') });
  await page.getByRole('button', { name: 'Settings & sources', exact: true }).click();
  await page.getByRole('button', { name: 'Online Sources', exact: true }).click();
  await page.getByRole('region', { name: 'Online playback setup', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Installed', exact: true }).waitFor({ timeout: 700000 });
  const events = await page.evaluate(() => window.__setupEvents);
  assert(events.some(event => event.stage === 'downloading' && Number(event.percent) > 0));
  report.events = events;
  report.checks.push('Real download percentage is visible, duplicate setup is disabled and navigation preserves the operation through completion');
  const set = path.join(data, 'components', 'youtube-2026.08.19-quickjs-0.17.0');
  const expected = {
    'yt-dlp.exe': '66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a',
    'qjs.exe': '2aeabf0092c3262d6b2609824418f7dd7ed1f1df939f73b2b15645230cac0d77',
  };
  for (const [file, digest] of Object.entries(expected)) {
    assert.equal(createHash('sha256').update(readFileSync(path.join(set, file))).digest('hex'), digest);
  }
  assert.equal(await invoke('ytdlp_check_available'), true);
  report.checks.push('Real official downloads match both pinned checksums and become available to native playback');
  const version = spawnSync(path.join(set, 'yt-dlp.exe'), ['--version'], { encoding: 'utf8', windowsHide: true });
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /2026\.08\.19/);
  const runtime = spawnSync(path.join(set, 'qjs.exe'), ['-e', 'console.log(6*7)'], { encoding: 'utf8', windowsHide: true });
  assert.equal(runtime.status, 0, runtime.stderr);
  assert.equal(runtime.stdout.trim(), '42');
  report.checks.push('Both downloaded executables run successfully without system installation');
  await page.reload();
  await page.getByRole('button', { name: 'Settings & sources', exact: true }).click();
  await page.getByRole('button', { name: 'Online Sources', exact: true }).click();
  await page.getByRole('button', { name: 'Installed', exact: true }).waitFor();
  assert(await page.getByRole('button', { name: 'Installed', exact: true }).isDisabled());
  assert.equal(await page.getByRole('button', { name: 'Enable online playback', exact: true }).count(), 0);
  await page.screenshot({ path: path.join(results, 'installed.png') });
  await page.evaluate(async () => {
    const callback = window.__TAURI_INTERNALS__.transformCallback(() => {});
    try { await window.__TAURI_INTERNALS__.invoke('install_youtube_engine', { onProgress: `__CHANNEL__:${callback}` }); }
    finally { window.__TAURI_INTERNALS__.unregisterCallback(callback); }
  });
  assert.equal(readdirSync(path.join(data, 'components')).length, 1, 'Verification should reuse the existing installation');
  report.checks.push('Settings restores an inactive checkmarked Installed control after reload, with no download action; native verification reuses files');
  assert.deepEqual(report.errors, []);
  for (const check of report.checks) console.log(`PASS ${check}`);
} catch (error) {
  report.errors.push(String(error));
  process.exitCode = 1;
  console.error(error);
} finally {
  writeFileSync(path.join(results, 'report.json'), JSON.stringify(report, null, 2));
  if (browser) await browser.close().catch(() => {});
  if (app) app.kill();
}
