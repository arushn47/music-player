// Native lock UX regression; isolated data and synthetic lyric text, no audio/network dependency.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
const output = path.resolve('test-results/overlay-lock'); mkdirSync(output, { recursive: true });
const data = path.resolve(`.test-data/overlay-lock-${Date.now()}`);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const app = spawn(path.resolve(process.env.LUMAIRE_TEST_EXE || 'src-tauri/target/debug/lumaire.exe'), [], { windowsHide: true, env: { ...process.env, LUMAIRE_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: path.join(data, 'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
const report = { checks: [], errors: [] }; let browser;
const invoke = (page, command, args) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await delay(200); }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); const page = browser.contexts()[0].pages()[0];
  await page.getByRole('heading', { name: 'Discover new music.' }).waitFor(); await delay(400);
  await page.getByRole('button', { name: 'Open floating lyrics', exact: true }).click();
  let overlay;
  for (let i = 0; i < 100; i++) { overlay = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('overlay=lyrics')); if (overlay) break; await delay(100); }
  assert(overlay); overlay.on('pageerror', error => report.errors.push(error.message));
  await overlay.locator('.floating-lock-hint').filter({ hasText: 'Ctrl+Alt+L' }).waitFor({ state: 'attached' });
  await invoke(page, 'lyric_overlay_publish', { snapshot: { title: 'Original test lyrics', artist: 'Lumaire', status: 'paused', message: '', lines: [{ text: 'Music by your side', secondary: 'A little closer', active: true }] } });
  const scale = await invoke(page, 'plugin:window|scale_factor', { label: 'lyrics-overlay' });
  const size = await invoke(page, 'plugin:window|inner_size', { label: 'lyrics-overlay' });
  const cursor = (x, y) => invoke(page, 'plugin:window|set_cursor_position', { label: 'lyrics-overlay', value: { Physical: { x: Math.round(x * scale), y: Math.round(y * scale) } } });
  await overlay.getByRole('button', { name: 'Enable click-through', exact: true }).click({ force: true });
  await page.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).waitFor();
  await cursor(-30, -30);
  await overlay.waitForFunction(() => document.querySelector('main').classList.contains('is-locked') && document.querySelector('main').dataset.hovered === 'false');
  assert.equal(await overlay.locator('main').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await overlay.locator('header').evaluate(element => getComputedStyle(element).visibility), 'hidden');
  assert.equal(await overlay.locator('footer').evaluate(element => getComputedStyle(element).visibility), 'hidden');
  assert.equal(await overlay.locator('.floating-resize').count(), 0);
  await overlay.screenshot({ path: path.join(output, 'locked-lyrics-only.png') });
  report.checks.push('Lock immediately hides background, title, transport and resize handles even after button focus');
  await cursor(200, 100);
  await overlay.waitForFunction(() => document.querySelector('main').dataset.hovered === 'true');
  await delay(200);
  assert.equal(await overlay.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).evaluate(element => getComputedStyle(element).opacity), '1');
  await overlay.screenshot({ path: path.join(output, 'hover-unlock.png') });
  await cursor(size.width / scale - 30, 25);
  await delay(150);
  await overlay.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).click({ force: true });
  await page.getByRole('button', { name: 'Close floating lyrics', exact: true }).waitFor();
  await overlay.getByRole('button', { name: 'Enable click-through', exact: true }).waitFor();
  report.checks.push('Native cursor hover reveals the corner unlock; clicking restores controls without returning to the main player');
  await overlay.getByRole('button', { name: 'Enable click-through', exact: true }).click({ force: true });
  await page.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).waitFor();
  if (process.env.LUMAIRE_LOCK_SHORTCUT_WAIT === '1') {
    writeFileSync(path.join(output, 'shortcut-ready.json'), JSON.stringify({ port, pid: app.pid }));
    for (let i = 0; i < 600; i++) {
      if (existsSync(path.join(output, 'shortcut-sent.json')) && JSON.parse(readFileSync(path.join(output, 'shortcut-sent.json'), 'utf8')).pid === app.pid) break;
      if (i === 599) throw Error('Physical shortcut input was not supplied; registration alone is not an end-to-end shortcut test.');
      await delay(200);
    }
    await page.getByRole('button', { name: 'Close floating lyrics', exact: true }).waitFor({ timeout: 120000 });
    report.checks.push('Physical Ctrl+Alt+L unlocks through the native Windows hotkey while the main window has focus');
    writeFileSync(path.join(output, 'shortcut-done'), 'passed');
  } else {
    await page.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).click();
    report.checks.push('Native Windows shortcut registration succeeds and main-player unlock remains available');
  }
  await page.getByRole('button', { name: 'Close floating lyrics', exact: true }).click();
  await page.getByRole('button', { name: 'Open floating lyrics', exact: true }).click();
  let fresh;
  for (let i = 0; i < 100; i++) { fresh = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('overlay=lyrics')); if (fresh) break; await delay(100); }
  await fresh.locator('.floating-lock-hint').filter({ hasText: 'Ctrl+Alt+L' }).waitFor({ state: 'attached' });
  report.checks.push('Rapid close/reopen releases and re-registers the shortcut');
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally { writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); await browser?.close().catch(() => {}); app.kill(); }
