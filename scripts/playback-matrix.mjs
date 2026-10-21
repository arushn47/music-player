// Actual WebView2, native providers, source extraction, decoder and media clock.
// The development executable/server allow importing the exact application modules.
import { chromium } from "playwright-core";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, existsSync, cpSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
const data = path.resolve(`.test-data/playback-matrix-${Date.now()}`), out = path.resolve("test-results/playback");
mkdirSync(out, { recursive: true });
spawnSync(process.execPath, ["scripts/fixtures.mjs"], { windowsHide: true, stdio: "ignore" });
const components = path.join(process.env.LOCALAPPDATA, "app.lumaire.player/components");
if (existsSync(components)) cpSync(components, path.join(data, "components"), { recursive: true });
const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const app = spawn(path.resolve("src-tauri/target/debug/lumaire.exe"), [], { windowsHide: true, env: { ...process.env, LUMAIRE_DATA_DIR: data, LUMAIRE_TEST_FIXTURES: path.resolve(".test-data/fixtures"), WEBVIEW2_USER_DATA_FOLDER: path.join(data, "webview"), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
const report = { startedAt: new Date().toISOString(), data, checks: [], events: [], errors: [], limitations: ["Real audio decode/clock measured; human audible output is not measured.", "Catalog samples are reproduction fixtures, never resolver special cases."] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const save = () => writeFileSync(path.join(out, "matrix.json"), JSON.stringify(report, null, 2));
let browser, page;
async function check(name, run) {
  const start = Date.now(), eventStart = report.events.length;
  try {
    const details = await run();
    const events = report.events.slice(eventStart);
    const metrics = { discovered: events.filter(e => e.stage === "discovered").reduce((sum, e) => sum + e.count, 0), rejected: {}, extracted: events.filter(e => e.stage === "source-resolved").length, extractionFailures: events.filter(e => e.stage === "extraction-failed").length, loaded: events.filter(e => e.stage === "audio-loaded").length, started: events.filter(e => e.stage === "playing").length };
    events.filter(e => e.stage === "rejected").forEach(e => { metrics.rejected[e.reason] = (metrics.rejected[e.reason] || 0) + 1; });
    report.checks.push({ name, passed: true, elapsedMs: Date.now() - start, ...details, metrics }); console.log(`PASS ${name}`);
  }
  catch (error) { report.checks.push({ name, passed: false, elapsedMs: Date.now() - start, error: String(error), events: report.events.slice(eventStart) }); console.log(`FAIL ${name}: ${error}`); await page.screenshot({ path: path.join(out, "failure.png") }); }
  save();
}
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await delay(250); }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(25000);
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => { const text = message.text(); if (text.startsWith("[Lumaire playback] ")) { try { report.events.push(JSON.parse(text.slice(19))); } catch {} } });
  await page.getByRole("heading", { name: "Discover new music." }).waitFor();
  assert(page.url().includes("1420"), "Use cargo build (development mode) and npm run dev for this suite");
  const invoke = (command, args = {}) => page.evaluate(([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a), [command, args]);
  const waitPlaying = async () => {
    for (let i = 0; i < 240; i++) {
      const state = await page.evaluate(async () => ({ ...(await import("/src/player/service.ts")).player.state }));
      if (state.status === "error") throw Error(state.error);
      if (state.status === "playing" && state.time >= 2) return state;
      await delay(250);
    }
    throw Error("Playback clock did not advance within 60 seconds");
  };
  const playCatalog = async catalog => {
    const result = await page.evaluate(async catalog => {
      const { library } = await import("/src/adapters/native.ts");
      const { resolveCatalogSource, canonicalTrack } = await import("/src/domain/catalog-track.ts");
      const { player, playbackTracks, prepareCatalogCandidate } = await import("/src/player/service.ts");
      player.stop();
      const source = await resolveCatalogSource(catalog, library.ytdlpSearch, { verify: prepareCatalogCandidate });
      const track = canonicalTrack(catalog, source);
      await library.saveOnline(track);
      return { catalogId: catalog.id, title: catalog.title, sourceId: source.id, trackId: track.id };
    }, catalog);
    await page.reload();
    await page.getByRole("heading", { name: "Discover new music." }).waitFor();
    for (let i = 0; i < 100; i++) {
      if (await page.evaluate(async id => (await import("/src/player/service.ts")).playbackTracks.has(id), result.trackId)) break;
      await delay(100);
    }
    await page.evaluate(async id => { const { player } = await import("/src/player/service.ts"); await player.load(id, true); }, result.trackId);
    await waitPlaying();
    const state = await page.evaluate(async () => { const { player } = await import("/src/player/service.ts"); const s = { ...player.state }; player.pause(); return s; });
    assert.equal(state.status, "playing", state.error || "Audio did not play");
    assert(state.time >= 2);
    return { ...result, time: state.time, duration: state.duration };
  };
  for (const [query, credit] of [["Golden Sparrow", "Dhanush"], ["Kadhal Fail", "Dhanush"], ["Yedi", "Dhanush"], ["Pulla", "Dhanush"], ["Sensitive", "KR$NA"], ["Boom Shaka", "KR$NA"], ["Darshana", "Hesham"], ["Wavy", "Karan Aujla"], ["Despacito", "Luis Fonsi"], ["Dynamite", "BTS"], ["Aarzu", "Madhurxo"]]) {
    if (process.env.LUMAIRE_MATRIX_FILTER && !query.includes(process.env.LUMAIRE_MATRIX_FILTER)) continue;
    await check(`Saavn: ${query}`, async () => {
      const rows = await invoke("search_catalog", { query: `${query} ${credit}`, limit: 15 });
      const catalog = rows.find(t => t.title.toLowerCase().startsWith(query.toLowerCase()) && t.id.startsWith("saavn:") && !/reprise|remix|instrumental|cover/i.test(t.title));
      assert(catalog, "Expected Saavn result was not available");
      return playCatalog(catalog);
    });
  }
  for (const [title, artist] of [["Snowman", "Sia"], ["Ocean Eyes", "Billie Eilish"], ["Easy On Me", "Adele"], ["Hoppípolla", "Sigur Rós"], ["夜に駆ける", "YOASOBI"]]) {
    if (process.env.LUMAIRE_MATRIX_FILTER && !title.includes(process.env.LUMAIRE_MATRIX_FILTER)) continue;
    await check(`iTunes: ${title}`, async () => {
      let row, lastStatus;
      for (const country of ["US", "JP", "IN"]) {
        for (const term of [`${title} ${artist}`, artist]) {
          const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term, entity: "song", limit: "30", country })}`);
          lastStatus = response.status;
          if (!response.ok) continue;
          const { results } = await response.json();
          row = results.find(t => t.artistName?.toLowerCase() === artist.toLowerCase() && t.trackName?.toLowerCase().includes(title.toLowerCase()));
          if (row) break;
        }
        if (row) break;
      }
      assert(row, `Apple result unavailable (last HTTP ${lastStatus})`);
      const catalog = await invoke("lookup_catalog", { id: `itunes:${row.trackId}` });
      return playCatalog(catalog);
    });
  }
  await check("Local WAV through scoped media protocol", async () => {
    const snapshot = await invoke("load_library");
    const track = snapshot.tracks.find(t => t.format?.toLowerCase() === "wav");
    assert(track, "Original local fixture missing");
    await page.evaluate(async track => { const { player, playbackTracks } = await import("/src/player/service.ts"); player.stop(); playbackTracks.set(track.id, track); await player.load(track.id, true); }, track);
    await waitPlaying();
    return { trackId: track.id };
  });
  await check("Licensed Commons recording plays through its own resolver", async () => {
    const rows = await invoke("search_commons_audio", { query: "piano" });
    assert(rows.length, "No licensed Commons audio currently available");
    let lastError;
    for (const track of rows.slice(0, 3)) {
      try {
        await page.evaluate(async track => { const { player, playbackTracks } = await import("/src/player/service.ts"); player.stop(); playbackTracks.set(track.id, track); await player.load(track.id, true); }, track);
        await waitPlaying();
        return { sourceId: track.id };
      } catch (error) { lastError = error; }
    }
    throw lastError;
  });
  await check("Genuine unavailable direct video reports extraction failure", async () => {
    await assert.rejects(invoke("ytdlp_get_stream", { videoId: "___________" }));
  });
  await check("Real extraction continues after an unavailable first candidate", async () => {
    return page.evaluate(async () => {
      const { library } = await import("/src/adapters/native.ts");
      const { resolveCatalogSource } = await import("/src/domain/catalog-track.ts");
      const { prepareCatalogCandidate } = await import("/src/player/service.ts");
      const saved = (await library.load()).tracks.find(track => track.metadataSourceId && track.source?.providerId === "youtube");
      if (!saved) throw Error("No real source from the preceding catalog tests");
      const catalog = await library.lookupCatalog(saved.metadataSourceId);
      const good = { id: saved.source.sourceId, title: `${catalog.artist} - ${catalog.title}`, duration: catalog.duration, channel: catalog.artist, thumbnail: null, track: catalog.title, artist: catalog.artist };
      const selected = await resolveCatalogSource(catalog, async () => [{ ...good, id: "___________" }, good], { verify: prepareCatalogCandidate });
      if (selected.id !== good.id) throw Error("The unavailable source prevented fallthrough");
      return { sourceId: selected.id, candidateOrderingFixture: true, nativeExtraction: true };
    });
  });
  await check("Provider failure, no match, and candidate extraction fallthrough remain distinct", async () => {
    return page.evaluate(async () => {
      const { resolveCatalogSource } = await import("/src/domain/catalog-track.ts");
      const song = { id: "itunes:123", title: "Original Test Recording", artist: "Original Test Artist", artists: [], album: "Original Test Album", duration: 100 };
      const outcomes = [];
      for (const search of [async () => [], async () => { throw Error("Network fixture"); }]) {
        try { await resolveCatalogSource(song, search); throw Error("Unexpected success"); } catch (error) { outcomes.push(String(error)); }
      }
      if (!outcomes[0].includes("No matching audio source") || !outcomes[1].includes("Audio search failed")) throw Error("Failure taxonomy lost");
      return { outcomes, syntheticNegativeCases: true };
    });
  });
  await check("Queue advances past a broken local source to the next playable track", async () => {
    const snapshot = await invoke("load_library");
    const wavs = snapshot.tracks.filter(t => t.format?.toLowerCase() === "wav").sort((a, b) => a.title.localeCompare(b.title));
    const [failed, track] = wavs;
    assert(failed, "Second local fixture missing");
    const filename = path.join(path.resolve(".test-data/fixtures"), failed.fileName);
    assert(existsSync(filename), `Fixture path missing: ${failed.fileName}`);
    await page.evaluate(async () => (await import("/src/player/service.ts")).player.stop());
    await page.getByRole("button", { name: /^Library/ }).first().click();
    await page.getByRole("button", { name: "Open Local", exact: true }).click();
    renameSync(filename, `${filename}.unavailable`);
    try {
    await page.getByRole("button", { name: `Play ${failed.title}`, exact: true }).click();
    await page.waitForFunction(() => {
      const [m, s] = (document.querySelector('[data-testid="elapsed"]')?.textContent || "0:00").split(":").map(Number);
      return document.querySelector('[data-testid="playback-state"]')?.textContent?.toLowerCase() === "playing" && m * 60 + s >= 2;
    });
    const playing = await page.locator(".now-playing").innerText();
    assert(playing.includes(track.title));
    return { nextTrack: track.id, visibleTitle: playing };
    } finally { renameSync(`${filename}.unavailable`, filename); }
  });
} finally {
  if (page) { await page.evaluate(async () => (await import("/src/player/service.ts")).player.stop()).catch(() => {}); await page.screenshot({ path: path.join(out, "matrix-final.png") }).catch(() => {}); }
  await browser?.close(); app.kill(); report.finishedAt = new Date().toISOString(); save();
}
if (report.errors.length || report.checks.some(t => !t.passed)) process.exitCode = 1;
