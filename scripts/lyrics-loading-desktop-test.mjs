// Native WebView2 verification. Delay only the search boundary; audio extraction/playback stay real.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, cpSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
const data = path.resolve(`.test-data/lyrics-loading-${Date.now()}`), out = path.resolve("test-results/lyrics-loading");
mkdirSync(out, { recursive: true });
const components = path.join(process.env.LOCALAPPDATA, "app.lumaire.player/components");
if (existsSync(components)) cpSync(components, path.join(data, "components"), { recursive: true });
const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const p = server.address().port; server.close(() => resolve(p)); }); });
const app = spawn(path.resolve("src-tauri/target/debug/lumaire.exe"), [], { windowsHide: true, env: { ...process.env, LUMAIRE_DATA_DIR: data, LUMAIRE_TEST_FIXTURES: path.resolve(".test-data/fixtures"), WEBVIEW2_USER_DATA_FOLDER: path.join(data, "webview"), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { checks: [], errors: [], data, limitations: ["No paid Gemini call: English bypass uses actual native command; mixed-language provider responses are covered by native HTTP fixture tests."] };
app.stderr.on("data", chunk => { report.nativeLog = (report.nativeLog || "") + chunk.toString(); });
let browser, page;
async function check(name, run) {
  try { await run(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: String(error) }); console.log(`FAIL ${name}: ${error}`); await page.screenshot({ path: path.join(out, "failure.png") }); throw error; }
  finally { writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
}
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await delay(250); }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = browser.contexts()[0].pages()[0];
  if (page.url() === "about:blank") await page.goto("http://127.0.0.1:1420");
  page.setDefaultTimeout(25000);
  page.on("pageerror", error => report.errors.push(error.message));
  await page.getByRole("heading", { name: "Discover new music." }).waitFor().catch(async error => {
    console.log(page.url(), await page.locator("body").innerText(), report.errors);
    await page.screenshot({ path: path.join(out, "startup.png"), timeout: 5000 }).catch(() => {});
    throw error;
  });
  const english = ["I will always be here when you need me", "There is nothing in the world that we cannot do", "You are the only one who knows the way back home"];
  await check("native English processing succeeds without an API key or network", async () => {
    const result = await page.evaluate(async texts => window.__TAURI_INTERNALS__.invoke("process_lyrics", { lines: texts.map((text, i) => ({ id: String(i), text })), model: "unused" }), english);
    assert.deepEqual(result.translation, {});
    assert.deepEqual(result.lineLanguages["0"], ["eng"]);
  });
  await page.evaluate(async english => {
    const { library } = await import("/src/adapters/native.ts");
    const { defaults, item } = await import("/src/domain/types.ts");
    const { parseLyrics } = await import("/src/domain/lyrics.ts");
    await library.importAudio(false);
    const { tracks } = await library.load();
    const track = tracks.find(t => t.title.toLowerCase().includes("morning"));
    if (!track) throw Error("Local fixture missing");
    window.fixtureTrackId = track.id;
    const current = item(track.id), state = defaults();
    state.queue = [current]; state.currentId = current.id; state.settings.autoGemini = true;
    state.lyrics[track.id] = parseLyrics(english.join("\n"));
    await library.save(state);
  }, english);
  await page.reload();
  await page.getByRole("heading", { name: "Discover new music." }).waitFor();
  await check("English language appears in Lyrics and automatic Gemini remains unused", async () => {
    await page.evaluate(() => {
      const original = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
      window.geminiCalls = 0;
      window.__TAURI_INTERNALS__.invoke = (command, args) => {
        if (command === "gemini_key_status") return Promise.resolve(true);
        if (command === "process_lyrics") { window.geminiCalls++; return Promise.reject("Unexpected Gemini request"); }
        return original(command, args);
      };
      window.dispatchEvent(new Event("lumaire:gemini-key-changed"));
    });
    await page.getByRole("button", { name: "Lyric room", exact: true }).click();
    await page.getByLabel("Song languages").filter({ hasText: "Languages: English" }).waitFor();
    await delay(500);
    assert.equal(await page.evaluate(() => window.geminiCalls), 0);
    await page.screenshot({ path: path.join(out, "english.png") });
  });
  await check("mixed song lists English and Tamil, hides English translation and preserves Tamil meaning", async () => {
    await page.evaluate(async english => {
      const { library } = await import("/src/adapters/native.ts");
      const { parseLyrics } = await import("/src/domain/lyrics.ts");
      const snapshot = await library.load();
      const state = snapshot.session, id = state.queue.find(q => q.id === state.currentId).trackId;
      const doc = parseLyrics(`${english[0]}\nஉன்னோடு நான் வாழ்ந்த காலங்கள் எல்லாம் என் நினைவில் இருக்கும்`);
      doc.translation = { [doc.lines[0].id]: "Redundant English paraphrase", [doc.lines[1].id]: "I remember all the time we spent together" };
      doc.translationSource = "imported";
      state.lyrics[id] = doc; state.settings.autoGemini = false;
      await library.save(state);
    }, english);
    await page.reload();
    await page.getByRole("button", { name: "Lyric room", exact: true }).click();
    await page.getByLabel("Song languages").filter({ hasText: "English, Tamil" }).waitFor();
    assert.equal(await page.getByText("Redundant English paraphrase", { exact: true }).count(), 0);
    await page.getByText("I remember all the time we spent together", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, "mixed.png") });
  });
  await check("catalog click stops current audio, immediately shows selection and spinner, and deduplicates clicks", async () => {
    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("button", { name: /Play Morning light/i, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="elapsed"]')?.textContent !== "0:00");
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    await page.getByRole("textbox", { name: "Search music" }).fill("Golden Sparrow");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const play = page.getByRole("button", { name: /^Play Golden Sparrow/ }).first();
    await play.waitFor();
    await page.evaluate(() => {
      const original = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
      window.searchCalls = 0; window.holdSearch = true;
      window.__TAURI_INTERNALS__.invoke = async (command, args) => {
        if (command === "ytdlp_search") { window.searchCalls++; while (window.holdSearch) await new Promise(r => setTimeout(r, 50)); }
        return original(command, args);
      };
    });
    await play.click();
    await page.getByRole("button", { name: "Loading song", exact: true }).waitFor();
    assert(await page.getByRole("button", { name: "Loading song", exact: true }).isDisabled());
    assert.match(await page.locator(".now-playing-title-wrap").innerText(), /Golden Sparrow/);
    assert(await page.evaluate(async () => (await import("/src/player/service.ts")).player.audio.paused));
    await play.click(); await play.click();
    const calls = await page.evaluate(() => window.searchCalls);
    assert.equal(calls, 2, "Only the original two-query discovery phase should run");
    await page.screenshot({ path: path.join(out, "loading.png") });
    await page.getByRole("button", { name: "Lyric room", exact: true }).click();
    await page.getByRole("heading", { name: "Listen a little closer." }).waitFor();
    await page.evaluate(() => { window.holdSearch = false; });
    await page.waitForFunction(() => { const time = document.querySelector('[data-testid="elapsed"]')?.textContent; return !!time && time !== "0:00" && time !== "0:01"; }, undefined, { timeout: 90000 });
    assert.match(await page.locator(".now-playing-title-wrap").innerText(), /Golden Sparrow/);
    await page.screenshot({ path: path.join(out, "playing.png") });
  });
  assert.deepEqual(report.errors, []);
} finally {
  writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  try { await page?.evaluate(async () => (await import("@tauri-apps/api/window")).getCurrentWindow().close()); } catch {}
  await delay(500); await browser?.close(); app.kill();
}
