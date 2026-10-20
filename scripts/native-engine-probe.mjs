// Real native command, SQLite and WebView2 checks with an isolated app profile.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const data = path.resolve(`.test-data/native-engine-${Date.now()}`);
const results = path.resolve("test-results/native-engine");
mkdirSync(data, { recursive: true });
mkdirSync(results, { recursive: true });
const report = { checks: [], errors: [] };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let app, browser, page;
async function launch(seed) {
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
  app = spawn(path.resolve("src-tauri/target/debug/lumaire.exe"), [], {
    windowsHide: true,
    env: {
      ...process.env,
      LUMAIRE_DATA_DIR: data,
      WEBVIEW2_USER_DATA_FOLDER: path.join(data, "webview"),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
      ...(seed
        ? { LUMAIRE_TEST_FIXTURES: path.resolve(".test-data/fixtures") }
        : {}),
    },
  });
  app.stderr.on("data", () => {});
  let ready = false;
  for (let index = 0; index < 100; index++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(200);
  }
  assert(ready, "Native debugging endpoint did not start");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  for (let index = 0; index < 80; index++) {
    page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((page) => /1420|tauri\.localhost/.test(page.url()));
    if (page) break;
    await delay(100);
  }
  assert(page);
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page
    .getByRole("heading", { name: "Your library.", exact: true })
    .waitFor();
}
const invoke = (command, args = {}) =>
  page.evaluate(
    ([command, args]) => window.__TAURI_INTERNALS__.invoke(command, args),
    [command, args],
  );
async function close() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  if (app) {
    app.kill();
    app = null;
    await delay(600);
  }
}
try {
  await launch(true);
  const snapshot = await invoke("load_library");
  assert(snapshot.tracks.length >= 2);
  const result = await invoke("fetch_lyrics", {
    title: "GUESS",
    artist: "Emiway",
    album: "",
    duration: 169,
  });
  assert.equal(result.kind, "synced");
  assert.equal(result.matched.id, 6555308);
  report.lookup = { kind: result.kind, matched: result.matched };
  report.checks.push(
    "Real native GUESS / Emiway lookup returns LRCLIB synced record 6555308",
  );
  console.log(`PASS ${report.checks.at(-1)}`);
  await page
    .getByRole("button", { name: "Settings & sources", exact: true })
    .click();
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await page.getByRole("button", { name: "Ocean Blue", exact: true }).click();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await delay(400);
  assert.equal(
    (await invoke("load_library")).session.settings.themeMode,
    "light",
  );
  await page.screenshot({
    path: path.join(results, "native-appearance-light.png"),
  });
  await close();
  await launch(false);
  const restored = await invoke("load_library");
  assert.equal(restored.session.settings.themeMode, "light");
  assert.equal(restored.session.settings.accentColor, "#4F96FF");
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    "light",
  );
  report.checks.push(
    "Real SQLite and WebView2 theme persistence survives app restart",
  );
  console.log(`PASS ${report.checks.at(-1)}`);
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack || String(error);
  console.error(report.failure);
  process.exitCode = 1;
  if (page)
    await page
      .screenshot({ path: path.join(results, "failure.png") })
      .catch(() => {});
} finally {
  writeFileSync(
    path.join(results, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await close();
}
