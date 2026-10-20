// Real WebView2, native catalog requests and an isolated SQLite session; no provider mocks.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, cpSync, writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const data = path.resolve(".test-data", `catalog-${Date.now()}`);
const output = path.resolve("test-results/catalog");
mkdirSync(output, { recursive: true });
const components = path.join(process.env.LOCALAPPDATA, "app.lumaire.player/components");
if (existsSync(components)) cpSync(components, path.join(data, "components"), { recursive: true });
const port = await new Promise(resolve => {
  const server = net.createServer();
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const endpoint = `http://127.0.0.1:${port}`;
console.log(`Catalog test endpoint: ${endpoint}`);
const app = spawn(path.resolve("src-tauri/target/debug/lumaire.exe"), [], {
  windowsHide: true,
  env: { ...process.env, LUMAIRE_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: path.join(data, "webview"),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` },
});
const report = { startedAt: new Date().toISOString(), data, checks: [], commands: [], errors: [], nativeLog: "" };
app.stderr.on("data", chunk => { report.nativeLog = (report.nativeLog + chunk).slice(-8000); });
app.on("error", error => report.errors.push(error.message));
let browser, page;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, run) {
  try { await run(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) {
    report.checks.push({ name, passed: false, error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
    report.visibleText = await page.locator("body").innerText();
    writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    await page.screenshot({ path: path.join(output, "failure.png") });
    if (report.checks.length <= 2) throw error;
  }
}
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${endpoint}/json/version`)).ok) break; } catch {}
    await delay(250);
  }
  browser = await chromium.connectOverCDP(endpoint);
  page = browser.contexts().flatMap(context => context.pages())[0];
  page.setDefaultTimeout(20000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.getByRole("heading", { name: "Your library." }).waitFor();
  const invoke = async (command, args) => {
    const request = { command, args };
    report.commands.push(request);
    try {
      const data = await page.evaluate(([command, args]) => window.__TAURI_INTERNALS__.invoke(command, args), [command, args]);
      request.info = data.info;
      request.trackCount = data.tracks?.length ?? data.topTracks?.length ?? data.length;
      return data;
    } catch (error) { request.error = String(error); throw error; }
  };
  await check("Discover KR$NA opens Lumaire artist page with a portrait", async () => {
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    assert.equal(await page.getByRole("region", { name: "Artists", exact: true }).count(), 0);
    assert.equal(await page.getByRole("region", { name: "Albums", exact: true }).count(), 0);
    await page.getByRole("textbox", { name: "Search music" }).fill("KR$NA");
    await page.getByRole("textbox", { name: "Search music" }).press("Enter");
    await page.getByRole("region", { name: "Artists", exact: true }).waitFor({ timeout: 90000 });
    await page.screenshot({ path: path.join(output, "search-dark.png") });
    await page.getByRole("region", { name: "Artists", exact: true }).getByRole("button", { name: "KR$NA", exact: true }).click({ timeout: 90000 });
    await page.locator(".artist-page h1").filter({ hasText: "KR$NA" }).waitFor();
    const artist = await invoke("lookup_artist", {id: "saavn:artist:3811097"});
    assert(artist.info.artworkUrl.includes("/artists/"));
    assert(await page.locator(".artist-page .track-row").count() > 0);
    await page.locator(".artist-cover img").waitFor();
    await page.screenshot({ path: path.join(output, "artist-dark.png") });
    assert(!page.url().includes("jiosaavn.com"));
  });
  await check("Yours Truly opens with all 15 tracks in provider order", async () => {
    await page.getByRole("button", { name: "Open album Yours Truly", exact: true }).click();
    await page.locator(".album-page h1").filter({ hasText: "Yours Truly" }).waitFor();
    assert.equal(await page.locator(".album-page .track-row").count(), 15);
    const titles = await page.locator(".album-page .track-meta strong").allTextContents();
    assert.deepEqual(titles.slice(0, 4), ["VOTP SKIT 1", "Nothing to Prove", "Knock Knock", "Sensitive"]);
    assert.match(await page.locator(".album-meta").textContent(), /2025/);
    await page.locator(".album-cover img").waitFor();
    await page.screenshot({ path: path.join(output, "album-dark.png") });
  });
  await check("Lyrics and Library tabs retain the open album and its data", async () => {
    await page.locator("main").evaluate(main => { main.scrollTop = 250; });
    await page.getByRole("button", { name: "Lyric room", exact: true }).click();
    assert.equal(await page.locator(".album-page").isVisible(), false);
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    assert.equal(await page.locator(".album-page h1").textContent(), "Yours Truly");
    assert.equal(await page.locator(".page-loading:visible").count(), 0);
    assert(Math.abs(await page.locator("main").evaluate(main => main.scrollTop) - 250) < 1);
    await page.getByRole("button", { name: /^Library/ }).first().click();
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    assert.equal(await page.locator(".album-page .track-row").count(), 15);
  });
  await check("Album Play starts audio and its clock advances", async () => {
    await page.getByRole("button", { name: "Play Sensitive", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]')?.textContent?.toLowerCase() === "playing", null, { timeout: 120000 });
    await page.waitForFunction(() => { const value = document.querySelector('[data-testid="elapsed"]')?.textContent || "0:00"; const [minutes, seconds] = value.split(":").map(Number); return minutes * 60 + seconds >= 11; }, null, { timeout: 30000 });
    assert.match(await page.locator(".now-playing").textContent(), /Sensitive/);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  });
  await check("Catalog rows offer Favorite and the complete action menu", async () => {
    const row = page.locator(".album-page .track-row").filter({ hasText: "Sensitive" });
    await row.getByRole("button", { name: "Favorite Sensitive", exact: true }).click();
    await row.getByRole("button", { name: "Unfavorite Sensitive", exact: true }).waitFor({ timeout: 120000 });
    await row.getByLabel("Actions for Sensitive", { exact: true }).click();
    for (const label of ["Remove from library", "Download for offline", "Play next", "Add to queue", "Refresh metadata", "Save to playlist"]) {
      assert(await row.getByRole("button", { name: label, exact: true }).isVisible());
    }
    await row.getByLabel("Actions for Sensitive", { exact: true }).click();
  });
  await check("Album queue action adds another track to the native session", async () => {
    const row = page.locator(".album-page .track-row").filter({ hasText: "Knock Knock" });
    await row.getByLabel("Actions for Knock Knock", { exact: true }).click();
    await row.getByRole("button", { name: "Add to queue", exact: true }).click();
    await page.getByRole("button", { name: "Play queued Knock Knock", exact: true }).waitFor({ timeout: 120000 });
    await delay(800);
    const snapshot = await invoke("load_library", {});
    assert(snapshot.session.queue.some(entry => snapshot.session.queueTracks[entry.trackId]?.title === "Knock Knock"));
    await page.locator(".queue-pane").getByRole("button", { name: "Hide queue", exact: true }).click();
  });
  await check("Album artist credit and Back preserve artist/album history", async () => {
    await page.locator(".album-by").getByRole("button", { name: "KR$NA", exact: true }).click();
    await page.locator(".artist-page h1").waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.locator(".album-page h1").waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.locator(".artist-page h1").waitFor();
  });
  await check("A collaboration opens its second credited artist", async () => {
    const row = page.locator(".artist-page .track-row").filter({ hasText: "Boom Shaka" });
    await row.getByRole("button", { name: "Dhanda Nyoliwala", exact: true }).click();
    await page.locator(".artist-page h1").filter({ hasText: "Dhanda Nyoliwala" }).waitFor();
    assert(await page.locator(".artist-page .track-row").count() > 0);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.locator(".artist-page h1").filter({ hasText: "KR$NA" }).waitFor();
  });
  await check("Unsupported IDs reject with specific recoverable errors", async () => {
    for (const command of ["lookup_artist", "lookup_album"]) {
      await assert.rejects(invoke(command, { id: "unsupported:missing" }), error => String(error).includes("Unsupported"));
    }
    const legacy = await invoke("lookup_artist", { id: "saavn:artist:KR%24NA" });
    assert.equal(legacy.info.name, "KR$NA");
  });
  await check("Artist and album pages render in Light and Dark themes", async () => {
    await page.getByRole("button", { name: "Settings & sources", exact: true }).click();
    await page.getByRole("button", { name: "Light mode", exact: true }).click();
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    await page.screenshot({ path: path.join(output, "artist-light.png") });
    await page.getByRole("button", { name: "Open album Yours Truly", exact: true }).click();
    await page.locator(".album-page h1").waitFor();
    await page.screenshot({ path: path.join(output, "album-light.png") });
    await page.getByRole("button", { name: "Settings & sources", exact: true }).click();
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.getByRole("button", { name: "Discover", exact: true }).click();
  });
  await check("Discover album search cards open albums; clearing search removes entity sections", async () => {
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.locator(".artist-page h1").waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    const albums = page.getByRole("region", { name: "Albums", exact: true });
    const card = albums.getByRole("button").first();
    const title = await card.locator(".album-title").textContent();
    await card.click();
    await page.locator(".album-page h1").filter({ hasText: title }).waitFor();
    assert(await page.locator(".album-page .track-row").count() > 0);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    assert.equal(await page.getByRole("region", { name: "Artists", exact: true }).count(), 0);
    assert.equal(await page.getByRole("region", { name: "Albums", exact: true }).count(), 0);
  });

  await check("Favorites and Tracker links navigate and Back returns to their origin", async () => {
    await page.getByRole("button", { name: "Favorites", exact: true }).click();
    const saved = page.locator(".track-row").filter({ hasText: "Sensitive" });
    await saved.getByRole("button", { name: "KR$NA", exact: true }).click();
    await page.locator(".artist-page h1").filter({ hasText: "KR$NA" }).waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("heading", { name: "Your favorites." }).waitFor();
    await page.getByRole("button", { name: "Tracker", exact: true }).click();
    const artistRow = page.getByRole("region", { name: "Top artists", exact: true }).locator("li").filter({ has: page.getByRole("button", { name: "KR$NA", exact: true }) });
    await artistRow.scrollIntoViewIfNeeded();
    await artistRow.locator("img").waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Top artists"] img')].some(img => img.complete && img.naturalWidth > 0));
    const trackerPortrait = await artistRow.locator("img").getAttribute("src");
    await page.screenshot({ path: path.join(output, "tracker-portraits.png") });
    await artistRow.getByRole("button", { name: "KR$NA", exact: true }).click();
    await page.locator(".artist-page h1").filter({ hasText: "KR$NA" }).waitFor();
    await page.locator(".artist-cover img").waitFor();
    assert.equal(await page.locator(".artist-cover img").getAttribute("src"), trackerPortrait, "Tracker and artist page must display the same portrait");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("region", { name: "Top albums", exact: true }).getByRole("button", { name: "Yours Truly", exact: true }).click();
    await page.locator(".album-page h1").filter({ hasText: "Yours Truly" }).waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("heading", { name: "Your listening recap." }).waitFor();
  });

  await check("Legacy Emiway links resolve to Emiway Bantai and saved online credits repair on startup", async () => {
    const artist = await invoke("lookup_artist", { id: "saavn:artist:name:Emiway" });
    assert.equal(artist.info.name, "Emiway Bantai");
    assert(artist.topTracks.length > 0);
    const snapshot = await invoke("load_library", {});
    const original = snapshot.tracks[0];
    assert(original?.source?.providerId === "youtube");
    await invoke("save_online_track", { track: { ...original, artist: "Emiway", metadataSourceId: null }, updateOnly: true });
    await page.reload();
    await page.getByRole("button", { name: "Discover", exact: true }).waitFor();
    await page.waitForFunction(async id => {
      const snapshot = await window.__TAURI_INTERNALS__.invoke("load_library");
      return snapshot.tracks.find(track => track.id === id)?.artist === "Emiway Bantai";
    }, original.id);
  });

  await check("Machayenge and Firse Machayenge resolve and play from the artist page", async () => {
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    const search = page.getByRole("textbox", { name: "Search music" });
    await search.fill("Emiway Bantai");
    await search.press("Enter");
    await page.getByRole("region", { name: "Artists", exact: true }).getByRole("button", { name: "Emiway Bantai", exact: true }).first().click({ timeout: 90000 });
    await page.locator(".artist-page h1").filter({ hasText: "Emiway Bantai" }).waitFor();
    for (const title of ["Machayenge", "Firse Machayenge"]) {
      await page.getByRole("button", { name: `Play ${title}`, exact: true }).click();
      await page.waitForFunction(title => document.querySelector(".now-playing")?.textContent?.includes(title) && document.querySelector('[data-testid="playback-state"]')?.textContent?.toLowerCase() === "playing", title, { timeout: 120000 });
      await page.waitForFunction(() => { const [m, s] = (document.querySelector('[data-testid="elapsed"]')?.textContent || "0:00").split(":").map(Number); return m * 60 + s >= 3; }, null, { timeout: 30000 });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.screenshot({ path: path.join(output, `${title.toLowerCase().replaceAll(" ", "-")}-playing.png`) });
    }
  });

  assert.equal(report.errors.length, 0, "Uncaught renderer errors");
} catch (error) { report.errors.push(error.stack); }
finally {
  if (page) await page.screenshot({ path: path.join(output, "final.png") }).catch(() => {});
  await browser?.close();
  app.kill();
  writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
}
if (report.errors.length || report.checks.some(check => !check.passed)) process.exitCode = 1;
