// Isolated Windows/WebView2 playback. Live catalog metadata uses original synthetic audio.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
const output = path.resolve('test-results/overlay-desktop'); mkdirSync(output, { recursive: true });
const data = path.resolve(`.test-data/overlay-${Date.now()}`);
const report = { checks: [], errors: [], limitations: ['Autoplay uses real catalog metadata linked to original synthetic local audio, not a live copyrighted recording stream.', 'Spotify public playlist access may be refused; no login or browser cookies used.'] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let app, browser;
async function launch(seedFixtures = true) {
  const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
  const environment = { ...process.env, LUMAIRE_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: path.join(data, 'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` };
  if (seedFixtures) environment.LUMAIRE_TEST_FIXTURES = path.resolve('.test-data/fixtures'); else delete environment.LUMAIRE_TEST_FIXTURES;
  app = spawn(path.resolve('src-tauri/target/debug/lumaire.exe'), [], { windowsHide: true, env: environment });
  for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await delay(200); }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages()[0];
  page.on('pageerror', error => report.errors.push(error.message));
  await page.getByRole('heading', { name: 'Discover new music.' }).waitFor(); await delay(600);
  writeFileSync(path.join(output, 'live.json'), JSON.stringify({ port, pid: app.pid, data }));
  return page;
}
const invoke = (page, command, args) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
try {
  let page = await launch();
  const snapshot = await invoke(page, 'load_library');
  const liveCandidates = await invoke(page, 'search_catalog', { query: 'Lumaire', limit: 30 });
  const liveCandidate = liveCandidates.find(track => track.artist.split(/,| & /).some(name => name.trim().toLowerCase() === 'lumaire'));
  assert(liveCandidate, 'Live artist-related catalog candidate is available');
  const first = snapshot.tracks.find(track => track.format.toLowerCase() === 'flac');
  const second = snapshot.tracks.find(track => track.id !== first.id && track.duration > 30);
  const third = snapshot.tracks.find(track => ![first.id, second.id].includes(track.id) && track.duration > 30);
  assert(first && second, 'Original synthetic audio fixtures exist');
  app.kill(); await delay(500); await browser.close();
  const db = new DatabaseSync(path.join(data, 'library.sqlite3'));
  first.metadataSourceId = 'itunes:111'; second.metadataSourceId = 'itunes:222'; third.metadataSourceId = liveCandidate.id; first.artist = 'Lumaire'; second.artist = first.artist; third.artist = liveCandidate.artist;
  first.title = 'Morning signal'; second.title = 'Quiet steps'; third.title = liveCandidate.title;
  for (const track of [first, second, third]) db.prepare('UPDATE tracks SET metadata=? WHERE id=?').run(JSON.stringify(track), track.id);
  const originalAudio = db.prepare('SELECT path FROM tracks WHERE id=?').get(third.id).path;
  const autoplayAudio = path.join(data, 'autoplay-fixtures'); mkdirSync(autoplayAudio, { recursive: true });
  for (const candidate of liveCandidates) {
    if (candidate.id === third.metadataSourceId) continue;
    const id = randomUUID(), audio = path.join(autoplayAudio, `${id}${path.extname(originalAudio)}`); cpSync(originalAudio, audio);
    const track = { ...third, id, title: candidate.title, artist: candidate.artist, album: candidate.album, metadataSourceId: candidate.id };
    db.prepare('INSERT INTO tracks(id,path,metadata) VALUES(?,?,?)').run(id, audio, JSON.stringify(track));
  }
  const settings = { ...snapshot.session.settings, autoGemini: false, autoOpenLyrics: false, historyEnabled: false, autoplay: false };
  const doc = { id: 'overlay-original', origin: 'imported', raw: 'Original synthetic lyrics', fileName: 'test.lrc', lines: [0, 3000, 6000, 9000, 15000, 25000].map((time, i) => ({ id: `l${i}`, time, text: ['Follow the morning light', 'Every little moment', 'Music by your side', 'A quieter kind of day', 'Keep the melody close', 'Another song begins'][i] })), fileOffset: 0, userOffset: 0, warnings: [], romanisation: {}, translation: {}, timingMode: 'synced' };
  const session = { ...snapshot.session, settings, position: 0, currentId: 'first', queue: [{ id: 'first', trackId: first.id }, { id: 'second', trackId: second.id }], lyrics: { [first.id]: doc, [second.id]: { ...doc, id: 'second-doc' } }, playlists: [{ id: 'test-playlist', name: 'Overlay test playlist', items: [{ id: 'p1', trackId: first.id }, { id: 'p2', trackId: second.id }] }] };
  db.prepare('UPDATE app_state SET data=? WHERE id=1').run(JSON.stringify(session)); db.close();
  page = await launch(false);
  await page.getByRole('button', { name: 'Open floating lyrics', exact: true }).click();
  let overlay;
  for (let attempt = 0; attempt < 100; attempt++) { overlay = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url().includes('overlay=lyrics')); if (overlay) break; await delay(100); }
  assert(overlay, 'Separate native overlay window opens');
  assert.equal(await invoke(page, 'plugin:window|is_decorated', { label: 'lyrics-overlay' }), false);
  assert.equal(await invoke(page, 'plugin:window|is_always_on_top', { label: 'lyrics-overlay' }), true);
  overlay.on('pageerror', error => report.errors.push(error.message));
  await overlay.getByRole('main', { name: 'Floating lyrics' }).waitFor();
  assert.equal(await overlay.locator('audio').count(), 0);
  assert.equal(await overlay.locator('.app').count(), 0);
  const css = await overlay.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, panel: getComputedStyle(document.querySelector('main')).backgroundColor }));
  assert.equal(css.body, 'rgba(0, 0, 0, 0)'); assert(css.panel.includes('0.45'));
  await page.locator('footer.transport').getByRole('button', { name: 'Play', exact: true }).click();
  await overlay.locator('.floating-line.active').filter({ hasText: 'Follow the morning light' }).waitFor();
  await overlay.locator('.floating-line.active').filter({ hasText: 'Every little moment' }).waitFor({ timeout: 8000 });
  await overlay.getByRole('button', { name: 'Pause', exact: true }).click({ force: true });
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]').textContent === 'paused');
  await overlay.screenshot({ path: path.join(output, 'overlay.png') });
  report.checks.push('Separate transparent native overlay follows the real audio clock; pause returns through scoped IPC to the sole player');
  if (process.env.LUMAIRE_TEST_MINIMIZE === '1') {
    await page.getByLabel('Seek playback', { exact: true }).fill('0');
    await overlay.getByRole('button', { name: 'Play', exact: true }).click({ force: true });
    await invoke(page, 'plugin:window|minimize', { label: 'main' });
    assert.equal(await invoke(page, 'plugin:window|is_minimized', { label: 'main' }), true);
    await delay(10500);
    await overlay.locator('.floating-line.active').filter({ hasText: 'A quieter kind of day' }).waitFor({ timeout: 3000 });
    await overlay.screenshot({ path: path.join(output, 'minimized-overlay.png') });
    await overlay.getByRole('button', { name: 'Pause', exact: true }).click({ force: true });
    await invoke(page, 'plugin:window|unminimize', { label: 'main' });
    report.checks.push('Actual native minimize: overlay kept updating to the audio clock for 10 seconds while the main window was minimized');
  }
  const beforeMove = await invoke(page, 'plugin:window|outer_position', { label: 'lyrics-overlay' });
  await overlay.getByRole('button', { name: 'Move lyric window', exact: true }).focus(); await overlay.keyboard.press('ArrowRight'); await delay(150);
  const afterMove = await invoke(page, 'plugin:window|outer_position', { label: 'lyrics-overlay' }); assert(afterMove.x > beforeMove.x);
  const beforeSize = await invoke(page, 'plugin:window|inner_size', { label: 'lyrics-overlay' });
  await overlay.getByRole('button', { name: 'Resize lyric window', exact: true }).focus(); await overlay.keyboard.press('ArrowRight'); await delay(150);
  const afterSize = await invoke(page, 'plugin:window|inner_size', { label: 'lyrics-overlay' }); assert(afterSize.width > beforeSize.width);
  report.checks.push('Accessible move and resize controls change real native window geometry');
  if (process.env.LUMAIRE_KEEP_TEST_OPEN === '1') {
    await page.getByLabel('Seek playback', { exact: true }).fill('0');
    await overlay.getByRole('button', { name: 'Play', exact: true }).click({ force: true });
    writeFileSync(path.join(output, 'inspect-ready'), 'ready');
    for (let i = 0; i < 450 && !existsSync(path.join(output, 'inspection-complete')); i++) await delay(200);
    await overlay.getByRole('button', { name: 'Pause', exact: true }).click({ force: true });
  }
  await overlay.getByLabel('Background opacity').fill('0');
  assert.equal(await overlay.locator('main').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(15, 17, 14, 0)');
  await overlay.getByRole('button', { name: 'Enable click-through', exact: true }).click({ force: true });
  await page.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Unlock floating lyrics', exact: true }).click();
  await page.getByRole('button', { name: 'Close floating lyrics', exact: true }).waitFor();
  report.checks.push('Text-only background mode, click-through activation and recovery through the main player');
  await overlay.getByRole('button', { name: 'Next track', exact: true }).click({ force: true });
  await page.waitForFunction(title => document.querySelector('footer.transport')?.textContent?.includes(title), second.title);
  await overlay.getByRole('button', { name: 'Close floating lyrics', exact: true }).click({ force: true });
  await overlay.waitForEvent('close');
  await page.getByRole('button', { name: 'Open floating lyrics', exact: true }).waitFor();
  report.checks.push('Closing the overlay updates main controls without closing Lumaire');
  const playlistButton = page.getByRole('button', { name: /Overlay test playlist/ }); await playlistButton.click();
  await page.getByRole('heading', { name: 'Overlay test playlist', exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'playlist.png') });
  const hero = await page.locator('.collection-header').evaluate(element => ({ border: getComputedStyle(element).borderWidth, background: getComputedStyle(element).backgroundColor }));
  assert.equal(hero.border, '0px'); assert.equal(hero.background, 'rgba(0, 0, 0, 0)');
  report.checks.push('Playlist uses the unboxed album layout with its existing full-queue controls');
  const apple = await invoke(page, 'read_playlist_link', { link: 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb' });
  assert(apple.rows.length > 5); assert(apple.rows.every(row => row.track?.id.startsWith('itunes:')));
  report.appleTracks = apple.rows.length;
  if (await invoke(page, 'ytdlp_check_available')) {
    try {
      const youtube = await invoke(page, 'read_playlist_link', { link: 'https://www.youtube.com/playlist?list=PLt5yu3-wZAlSLRHmI1qNm0wjyVNWw1pCU' });
      assert(youtube.rows.length); assert(youtube.rows.every(row => row.track?.id.startsWith('youtube:') && row.track.source?.providerId === 'youtube'));
      report.youtube = `Live public playlist: ${youtube.rows.length} direct YouTube identities`;
    } catch (error) { report.youtube = `Live playlist unavailable: ${String(error)}`; }
  } else report.youtube = 'YouTube engine absent in the isolated profile; parser regression covers identities and unavailable entries.';
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await page.getByRole('button', { name: 'Import playlists · Connect devices', exact: true }).click();
  await page.getByLabel('Playlist link', { exact: true }).fill('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb');
  await page.getByRole('button', { name: 'Preview playlist', exact: true }).click();
  await page.getByRole('button', { name: `Import ${apple.rows.length} tracks`, exact: true }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(output, 'link-preview.png') });
  await page.getByRole('button', { name: `Import ${apple.rows.length} tracks`, exact: true }).click();
  assert((await invoke(page, 'load_library')).tracks.some(track => track.id === apple.rows[0].track.id));
  report.checks.push(`Live public Apple Music link preview and SQLite import (${apple.rows.length} ordered original catalog entries)`);
  try { const spotify = await invoke(page, 'read_playlist_link', { link: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' }); report.spotify = `Public metadata exposed: ${spotify.rows.length} entries`; }
  catch (error) { assert.match(String(error), /Spotify|service/); report.spotify = String(error); }
  for (const link of ['http://127.0.0.1/private', 'https://youtube.com.evil.test/playlist?list=PLabcdefghijk']) { await assert.rejects(() => invoke(page, 'read_playlist_link', { link })); }
  report.checks.push('Unsupported/private hosts rejected; Spotify public metadata or access refusal is handled explicitly');
  await page.getByRole('button', { name: /Overlay test playlist/ }).click();
  await page.getByRole('button', { name: 'Turn on Autoplay', exact: true }).click();
  // Play the collection first; trim the queue using normal UI so Autoplay starts only at its end.
  await page.getByRole('button', { name: 'Play playlist', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]').textContent === 'playing');
  await page.getByLabel('Seek playback', { exact: true }).fill((first.duration - 0.7).toFixed(1));
  await page.waitForFunction(title => document.querySelector('footer.transport')?.textContent?.includes(title), second.title);
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]').textContent === 'playing');
  await page.getByLabel('Seek playback', { exact: true }).fill((second.duration - 0.7).toFixed(1));
  await page.waitForFunction(titles => titles.includes(document.querySelector('.now-playing-title-wrap .title-hover-tooltip')?.textContent?.trim()), liveCandidates.map(track => track.title));
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]').textContent === 'playing');
  await delay(400);
  const saved = await invoke(page, 'load_library');
  assert.equal(saved.session.settings.autoplay, true);
  const selected = saved.session.queue.find(entry => entry.id === saved.session.currentId);
  assert(saved.tracks.some(track => track.id === selected.trackId && liveCandidates.some(candidate => candidate.id === track.metadataSourceId)));
  assert.equal(saved.session.queue.length, 3);
  await page.getByRole('button', { name: 'Turn off Autoplay', exact: true }).click();
  const actualDuration = Number(await page.getByLabel('Seek playback', { exact: true }).getAttribute('max'));
  await page.getByLabel('Seek playback', { exact: true }).fill((actualDuration - 0.7).toFixed(1));
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]').textContent === 'ended');
  writeFileSync(path.join(output, 'ready-for-inspection.json'), JSON.stringify({ first: first.id, second: second.id }));
  report.checks.push('Real local audio reaches the next queued track first, then Autoplay appends/resolves/plays a fresh recommendation; disabling Autoplay stops at queue end');
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser?.close().catch(() => {}); app?.kill();
}
