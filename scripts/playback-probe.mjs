// Read-only provider evidence from an isolated native session.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, cpSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
const data = path.resolve(`.test-data/playback-probe-${Date.now()}`);
const out = path.resolve("test-results/playback");
mkdirSync(out, { recursive: true });
const components = path.join(process.env.LOCALAPPDATA, "app.lumaire.player/components");
if (existsSync(components)) cpSync(components, path.join(data, "components"), { recursive: true });
const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const app = spawn(path.resolve("src-tauri/target/debug/lumaire.exe"), [], { windowsHide: true, env: { ...process.env, LUMAIRE_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: path.join(data, "webview"), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` } });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
const report = [];
try {
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await delay(250); }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages()[0];
  await page.getByRole("heading", { name: "Discover new music." }).waitFor().catch(async error => { console.log(page.url(), await page.locator("body").innerText()); throw error; });
  const invoke = (command, args) => page.evaluate(([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a), [command, args]);
  for (const title of ["Golden Sparrow", "Kadhal Fail", "Yedi", "Pulla", "Sensitive", "Boom Shaka"]) {
    const tracks = await invoke("search_catalog", { query: title, limit: 10 });
    const track = tracks.find(t => t.album.includes("Nilavuku")) || tracks[0];
    const query = `${track.artist.split(",")[0]} ${track.title}`;
    const shortQuery = `${title} ${track.album.includes("Nilavuku") ? "Dhanush" : track.artist.split(",")[0]}`;
    const row = { track, query, shortQuery };
    for (const [key, query] of [["current", row.query], ["short", shortQuery]]) {
      try { row[key] = await invoke("ytdlp_search", { query, maxResults: 15 }); } catch (error) { row[key] = { error: String(error) }; }
    }
    report.push(row);
    writeFileSync(path.join(out, "before.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(row));
  }
} finally { await browser?.close(); app.kill(); }
