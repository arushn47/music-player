// Two isolated real WebView2 instances; no user profiles, credentials or cloud account access.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
const output = path.resolve('test-results/connected-desktop'); mkdirSync(output, { recursive: true });
const report = { checks: [], errors: [], limitations: ['Two instances on one Windows machine over real loopback TCP; the runner virtual-network address was unreachable, so physical cross-device Wi-Fi/firewall and installed Android behavior remain unverified.', 'Synthetic local audio verifies expanded-player continuity; live catalog import verifies metadata, not audio availability.'] };
const apps = []; const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function launch(name, reuseData) {
  const data = reuseData || path.resolve(`.test-data/connected-${name}-${Date.now()}`);
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); });
  const app = spawn(path.resolve('src-tauri/target/debug/lumaire.exe'), [], { windowsHide: true, env: { ...process.env, LUMAIRE_DATA_DIR: data, LUMAIRE_TEST_FIXTURES: path.resolve('.test-data/fixtures'), WEBVIEW2_USER_DATA_FOLDER: path.join(data, 'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
  apps.push({ app });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) { ready = true; break; } } catch {} await delay(200); }
  assert(ready, 'Native desktop debugging endpoint');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); const page = browser.contexts()[0].pages()[0];
  apps.at(-1).browser = browser; apps.at(-1).page = page;
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('heading', { name: 'Discover new music.' }).waitFor(); await delay(800);
  const invoke = (command, args) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
  return { page, invoke, app, data };
}
async function openHub(page) { await page.getByRole('button', { name: 'Import playlists · Connect devices', exact: true }).click(); }
async function seedCachedSource(instance, doc) {
  instance.app.kill(); await delay(300);
  const audio = path.join(instance.data, 'downloads', 'synthetic-paired.wav'); mkdirSync(path.dirname(audio), { recursive: true });
  cpSync(path.resolve('.test-data/fixtures/Lumaire - Morning light.wav'), audio);
  const track = { id: 'youtube:fixture0001', title: 'Synthetic paired audio', artist: 'Lumaire', album: 'Original test fixture', duration: 36, fileName: '', missing: false, format: 'YouTube', offline: true, source: { providerId: 'youtube', sourceId: 'fixture0001', pageUrl: 'https://www.youtube.com/watch?v=fixture0001', license: '', licenseUrl: '', attribution: 'Lumaire' } };
  const db = new DatabaseSync(path.join(instance.data, 'library.sqlite3'));
  db.prepare('INSERT OR REPLACE INTO tracks(id,path,metadata) VALUES(?,?,?)').run(track.id, audio, JSON.stringify(track));
  const stored = JSON.parse(db.prepare('SELECT data FROM app_state WHERE id=1').get().data);
  stored.lyrics[track.id] = doc; stored.settings.autoGemini = false; stored.settings.historyEnabled = false;
  db.prepare('UPDATE app_state SET data=? WHERE id=1').run(JSON.stringify(stored)); db.close();
}
try {
  let host = await launch('host'); let guest = await launch('guest');
  let snapshot = await host.invoke('load_library');
  const local = snapshot.tracks.find(track => track.format.toLowerCase() === 'flac') || snapshot.tracks.find(track => track.duration > 30);
  assert(local);
  const doc = { id: 'original-test-lyrics', origin: 'imported', raw: 'Original synthetic test lyrics', fileName: 'synthetic.lrc', lines: [0, 5000, 15000, 25000].map((time, i) => ({ id: `line-${i}`, time, text: ['Morning light arrives', 'A little closer to the music', 'Every quiet moment matters', 'Stay here for the melody'][i] })), fileOffset: 0, userOffset: 0, warnings: [], romanisation: {}, translation: {}, englishOnly: true, timingMode: 'synced' };
  await host.invoke('save_session', { session: { ...snapshot.session, queue: [{ id: 'local-test-entry', trackId: local.id }], currentId: 'local-test-entry', lyrics: { [local.id]: doc }, settings: { ...snapshot.session.settings, autoGemini: false, autoOpenLyrics: false, historyEnabled: false } } });
  const hostData = host.data, guestData = guest.data;
  await seedCachedSource(host, doc); await seedCachedSource(guest, doc);
  host = await launch('host', hostData); guest = await launch('guest', guestData);
  await host.page.getByRole('button', { name: 'Open expanded player' }).waitFor();
  await host.page.locator('footer.transport').getByRole('button', { name: 'Play', exact: true }).click();
  await host.page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]')?.textContent === 'playing');
  await host.page.getByRole('button', { name: 'Open expanded player' }).click();
  await host.page.getByRole('dialog', { name: 'Now playing' }).waitFor(); await delay(700);
  const before = await host.page.locator('[data-testid="elapsed"]').innerText(); await delay(1200);
  assert.notEqual(await host.page.locator('[data-testid="elapsed"]').innerText(), before);
  await host.page.screenshot({ path: path.join(output, 'expanded-desktop.png') });
  await host.page.getByRole('button', { name: /Seek to 0:15:/ }).click();
  await delay(350); assert.match(await host.page.locator('[data-testid="elapsed"]').innerText(), /0:1[56]/);
  await host.page.keyboard.press('Escape'); await host.page.getByRole('dialog', { name: 'Now playing' }).waitFor({ state: 'detached' });
  assert(await host.page.getByRole('button', { name: 'Open expanded player' }).evaluate(element => element === document.activeElement));
  report.checks.push('Expanded native player preserves live local audio, lyric seeking, Escape and focus restoration');
  await host.page.locator('footer.transport').getByRole('button', { name: 'Pause', exact: true }).click();
  const results = await host.invoke('search_catalog', { query: 'Naa Ready Anirudh', limit: 5 }); assert(results.length);
  const catalog = results[0]; report.catalog = { id: catalog.id, title: catalog.title };
  await openHub(host.page);
  const quote = text => '"' + text.replaceAll('"', '""') + '"';
  await host.page.getByLabel('Playlist name', { exact: true }).fill('Native imported mix');
  await host.page.getByLabel('Or paste playlist export').fill('Track Name,Artist Name,Album Name\n' + [catalog.title, catalog.artist, catalog.album].map(quote).join(',') + '\n' + [catalog.title, catalog.artist, catalog.album].map(quote).join(','));
  await host.page.getByRole('button', { name: 'Match tracks', exact: true }).click();
  await host.page.getByText(/2 checked/).waitFor({ timeout: 60000 });
  for (const select of await host.page.locator('.import-preview select').all()) {
    const option = await select.locator('option').nth(1).getAttribute('value'); assert(option); await select.selectOption(option);
  }
  await host.page.getByRole('button', { name: 'Import 1 tracks', exact: true }).click();
  await host.page.getByRole('dialog', { name: 'Playlists and devices' }).waitFor({ state: 'detached' }); await delay(700);
  snapshot = await host.invoke('load_library');
  const imported = snapshot.session.playlists.find(playlist => playlist.name === 'Native imported mix'); assert.equal(imported.items.length, 1);
  assert(snapshot.tracks.find(track => track.id === imported.items[0].trackId && !track.missing));
  await host.page.reload(); await delay(600);
  assert((await host.invoke('load_library')).session.playlists.some(playlist => playlist.id === imported.id));
  report.checks.push('Real catalog CSV preview, explicit matching, duplicate skip and persisted metadata-only playlist remain playable after SQLite reload');
  await openHub(host.page); await host.page.getByRole('button', { name: 'Devices & listening together', exact: true }).click();
  await host.page.getByRole('button', { name: 'Share from this device', exact: true }).click();
  const linkField = host.page.getByLabel('Pairing link (expires after 2 hours)'); await linkField.waitFor();
  const localLink = new URL(await linkField.inputValue()); localLink.hostname = '127.0.0.1'; const link = localLink.href;
  await delay(1900); // First publication must reach the native host before connection.
  await openHub(guest.page); await guest.page.getByRole('button', { name: 'Devices & listening together', exact: true }).click();
  await guest.page.getByPlaceholder('Paste a Lumaire pairing link').fill(link); await guest.page.getByRole('button', { name: 'Connect', exact: true }).click();
  await guest.page.getByRole('button', { name: 'Sync playlists now', exact: true }).waitFor();
  await guest.page.getByRole('button', { name: 'Sync playlists now', exact: true }).click(); await guest.page.locator('.collection-hub [role="status"]').getByText('Playlists synced.', { exact: false }).waitFor();
  await delay(800);
  let guestSnapshot = await guest.invoke('load_library'); assert(guestSnapshot.session.playlists.some(playlist => playlist.name === 'Native imported mix' && playlist.items.length === 1));
  await guest.page.getByRole('button', { name: 'Sync playlists now', exact: true }).click(); await delay(500);
  guestSnapshot = await guest.invoke('load_library'); assert.equal(guestSnapshot.session.playlists.filter(playlist => playlist.name === 'Native imported mix').length, 1);
  await guest.page.screenshot({ path: path.join(output, 'paired-playlists.png') });
  report.checks.push('Two real desktop profiles pair over TCP, transfer metadata to separate SQLite libraries and sync idempotently');
  await assert.rejects(guest.invoke('nearby_fetch', { link: link.replace(/#[a-f0-9]+$/, '#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') }));
  report.checks.push('Wrong pairing token cannot fetch shared metadata');
  await host.page.getByRole('button', { name: 'Close playlists and devices' }).click();
  await host.page.getByRole('button', { name: /Native imported mix/ }).first().click();
  await host.page.locator('.track-row').getByRole('button', { name: /^Favorite / }).click();
  await host.page.getByRole('button', { name: 'Discover', exact: true }).click();
  const picksButton = host.page.getByRole('button', { name: 'Find personal picks', exact: true });
  await picksButton.click();
  await host.page.waitForFunction(() => [...document.querySelectorAll('.personal-discovery button')].some(button => button.textContent.includes('Find personal picks') && !button.disabled), { timeout: 60000 });
  const pickIds = await host.page.locator('.personal-pick strong').allTextContents(); assert.equal(new Set(pickIds).size, pickIds.length);
  assert(await host.page.locator('.personal-discovery [role="status"]').isVisible());
  await host.page.screenshot({ path: path.join(output, 'personal-discovery.png') });
  report.checks.push('Personal discovery uses an explicit local favorite and returns actual catalog picks or a truthful empty/offline result, without duplicate cards');
  await host.page.getByRole('button', { name: /Library/, exact: false }).first().click();
  await host.page.getByRole('button', { name: /Downloads/ }).click();
  await host.page.getByRole('button', { name: 'Listen to Synthetic paired audio', exact: true }).click();
  await host.page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]')?.textContent === 'playing');
  await guest.page.getByRole('button', { name: 'Listen together', exact: true }).click();
  await guest.page.getByRole('button', { name: 'Close playlists and devices' }).click();
  await guest.page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]')?.textContent === 'playing', { timeout: 15000 });
  const position = page => page.getByLabel('Seek playback', { exact: true }).inputValue().then(Number);
  await delay(1700); assert(Math.abs(await position(host.page) - await position(guest.page)) <= 2.5);
  await host.page.locator('footer.transport').getByRole('button', { name: 'Pause', exact: true }).click();
  await guest.page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]')?.textContent === 'paused', { timeout: 12000 });
  report.checks.push('Listening together starts independently cached synthetic audio on the guest, aligns media clocks and follows host pause over actual TCP');
  await openHub(host.page); await host.page.getByRole('button', { name: 'Devices & listening together', exact: true }).click();
  await host.page.getByRole('button', { name: 'Disconnect & stop sharing', exact: true }).click();
  await delay(200); await assert.rejects(guest.invoke('nearby_fetch', { link }));
  report.checks.push('Stopping the host revokes the link and closes the listener');
  assert.deepEqual(report.errors, []);
} catch (error) { report.errors.push(error.stack || String(error)); for (let i = 0; i < apps.length; i++) await apps[i].page?.screenshot({ path: path.join(output, `failure-${i}.png`) }).catch(() => {}); process.exitCode = 1; }
finally { writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); for (const { app } of apps) app.kill(); for (const { browser } of apps) await browser?.close().catch(() => {}); }
