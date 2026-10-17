// Tests the real Tauri WebView2, native commands, scoped asset transport and SQLite.
// Debug-only picker fixtures replace OS file dialogs; no browser storage mock is used.
import { chromium } from "playwright-core";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  renameSync,
} from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import net from "node:net";
const root = process.cwd(),
  results = path.resolve("test-results"),
  fixtures = path.resolve(".test-data/fixtures");
mkdirSync(results, { recursive: true });
spawnSync(process.execPath, ["scripts/fixtures.mjs"], { stdio: "inherit" });
const runId = Date.now().toString(),
  data = path.resolve(".test-data", `session-${runId}`);
const report = {
  startedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform },
  checks: [],
  limitations: [
    "OS file dialogs use debug-only deterministic selections.",
    "Audio decode and media-clock progression are measured; human audible output and screen-reader conformance need manual confirmation.",
  ],
};
const executable = path.resolve("src-tauri/target/debug/lumaire.exe");
assert(existsSync(executable), "Build the debug Tauri executable first.");
const pick = (kind, name) =>
  writeFileSync(path.join(fixtures, `next-${kind}`), name);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let app, browser, page, cdp;
async function launch(seed = false) {
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
  const endpointUrl = `http://127.0.0.1:${port}`;
  app = spawn(executable, [], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      LUMAIRE_DATA_DIR: data,
      LUMAIRE_TEST_PICKER: fixtures,
      ...(seed ? { LUMAIRE_TEST_FIXTURES: fixtures } : {}),
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
  });
  app.on("error", (e) => {
    console.error(e);
  });
  app.stderr.on("data", (chunk) => {
    report.nativeLog = ((report.nativeLog || "") + chunk.toString()).slice(
      -16000,
    );
  });
  let endpoint;
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(`${endpointUrl}/json/version`);
      if (response.ok) {
        endpoint = await response.json();
        break;
      }
    } catch {}
    await delay(250);
  }
  assert(endpoint, "WebView2 debugging endpoint did not open.");
  browser = await chromium.connectOverCDP(endpointUrl);
  for (let i = 0; i < 80; i++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find(
        (p) => p.url().includes("1420") || p.url().includes("tauri.localhost"),
      );
    if (page) break;
    await delay(250);
  }
  assert(page, "Lumaire WebView not found.");
  page.on("pageerror", (e) =>
    report.checks.push({
      name: "uncaught renderer error",
      error: e.message,
      passed: false,
    }),
  );
  await page
    .getByRole("heading", { name: "Your library." })
    .waitFor({ timeout: 30000 });
  cdp = await page.context().newCDPSession(page);
}
async function close() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  if (app) {
    app.kill();
    await delay(1200);
    app = null;
  }
}
async function check(name, fn) {
  const start = Date.now();
  await fn();
  report.checks.push({ name, passed: true, ms: Date.now() - start });
  console.log(`PASS ${name}`);
}
const invoke = (cmd, args = {}) =>
  page.evaluate(
    ([cmd, args]) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    [cmd, args],
  );
const state = () => page.getByTestId("playback-state").textContent();
async function mediaState() {
  const prototype = await cdp.send("Runtime.evaluate", {
    expression: "HTMLAudioElement.prototype",
  });
  const objects = await cdp.send("Runtime.queryObjects", {
    prototypeObjectId: prototype.result.objectId,
  });
  const result = await cdp.send("Runtime.callFunctionOn", {
    objectId: objects.objects.objectId,
    functionDeclaration:
      "function(){return Array.from(this).map(a=>({time:a.currentTime,duration:a.duration,paused:a.paused,volume:a.volume,muted:a.muted,ready:a.readyState,error:a.error?.code??null}));}",
    returnByValue: true,
  });
  await cdp.send("Runtime.releaseObject", {
    objectId: objects.objects.objectId,
  });
  return result.result.value;
}
async function setRange(name, value) {
  await page
    .getByRole("slider", { name, exact: true })
    .evaluate((el, value) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
}
async function waitClock() {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="elapsed"]')?.textContent !== "0:00",
    null,
    { timeout: 10000 },
  );
}
const waitState = async (value) => {
  await page.waitForFunction(
    (value) =>
      document.querySelector('[data-testid="playback-state"]')?.textContent ===
      value,
    value,
    { timeout: 15000 },
  );
};
try {
  await launch(true);
  const original = await invoke("load_library");
  const first = original.tracks.find((t) =>
      t.fileName.includes("Morning light"),
    ),
    second = original.tracks.find((t) => t.fileName.includes("Quiet orbit"));
  assert(first && second);
  report.environment.webview = await page.evaluate(() => navigator.userAgent);
  await check("native metadata import and WAV duration", async () => {
    assert(first.duration >= 35.9);
    assert(second.duration >= 7.9);
    assert.equal(original.tracks.length >= 2, true);
  });
  await check(
    "native scoped media transport denies unknown asset IDs",
    async () => {
      await assert.rejects(invoke("media_path", { id: "not-a-track" }));
    },
  );
  await check(
    "native duplicate import preserves one asset and stays paused",
    async () => {
      pick("audio", first.fileName);
      await page
        .getByRole("button", { name: "Add music", exact: true })
        .click();
      await waitState("paused");
      const s = await invoke("load_library");
      assert.equal(s.tracks.length, original.tracks.length);
      assert.equal(
        s.tracks.find((t) => t.fileName === first.fileName).id,
        first.id,
      );
    },
  );
  await check("actual WAV playback, pause, seek and volume", async () => {
    await page
      .getByRole("button", { name: `Play ${first.title}`, exact: true })
      .click();
    await waitState("playing");
    await waitClock(); // poll until elapsed leaves 0:00 (up to 10 s)
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await waitState("paused");
    await setRange("Seek playback", 12);
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid="elapsed"]')?.textContent ===
        "0:12",
      null,
      { timeout: 6000 },
    );
    await setRange("Volume", 0.24);
    await delay(500);
    const s = await invoke("load_library");
    assert.equal(s.session.settings.volume, 0.24);
  });
  for (const format of ["MP3", "FLAC"]) {
    const codec = original.tracks.find((t) => t.format === format);
    if (!codec) {
      report.limitations.push(`${format} had no fixture and was not verified.`);
      continue;
    }
    await check(`actual ${format} decode, media clock and seek`, async () => {
      const index = original.tracks
        .filter((t) => t.title === codec.title)
        .findIndex((t) => t.id === codec.id);
      await page
        .getByRole("button", { name: `Play ${codec.title}`, exact: true })
        .nth(index)
        .click();
      await waitState("playing");
      await waitClock(); // poll until clock advances (up to 10 s)
      await setRange("Seek playback", 5);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await waitState("paused");
    });
  }
  await page
    .getByRole("button", { name: `Play ${first.title}`, exact: true })
    .click();
  await waitState("playing");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await check("search and favorites", async () => {
    await page
      .getByRole("textbox", { name: "Search local library" })
      .fill("Morning");
    assert.equal(await page.locator(".track-row").count(), 1);
    await page
      .getByRole("button", { name: `Favorite ${first.title}`, exact: true })
      .click();
    await page.getByRole("textbox", { name: "Search local library" }).fill("");
    await page.getByRole("button", { name: "Favorites", exact: true }).click();
    assert.equal(await page.locator(".track-row").count(), 1);
    await page
      .getByRole("button", { name: "Library", exact: false })
      .first()
      .click();
  });
  await check(
    "playlist create, add, rename and deliberate repeated entry",
    async () => {
      await page.getByRole("button", { name: "Create playlist" }).click();
      await page.locator("dialog input").fill("Evening collection");
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page
        .getByRole("button", { name: "Library", exact: false })
        .first()
        .click();
      await page
        .getByRole("group", { name: `Actions for ${first.title}` })
        .count()
        .catch(() => 0);
      const menu = page
        .locator(".track-row")
        .filter({
          has: page.getByRole("button", {
            name: `Play ${first.title}`,
            exact: true,
          }),
        })
        .locator("details");
      await menu.locator("summary").click();
      await menu
        .getByRole("button", { name: "Add to Evening collection", exact: true })
        .click();
      await menu
        .getByRole("button", { name: "Add to Evening collection", exact: true })
        .click();
      await menu.locator("summary").click();
      await page
        .getByRole("button", { name: /Evening collection/ })
        .first()
        .click();
      assert.equal(await page.locator(".track-row").count(), 2);
      await page.getByRole("button", { name: "Rename", exact: true }).click();
      await page.locator("dialog input").fill("Quiet hours");
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page.getByRole("heading", { name: "Quiet hours." }).waitFor();
    },
  );
  await check(
    "original Tamil, supplied Latin and English reader with confirmed line mapping",
    async () => {
      await page
        .getByRole("button", { name: "Lyric room", exact: false })
        .click();
      pick("lyrics", "Morning light.lrc");
      await page
        .getByRole("button", { name: "Attach original lyrics", exact: true })
        .click();
      await page.getByText("காலை ஒளி", { exact: true }).waitFor();
      pick("lyrics", "Morning light.latin.txt");
      await page
        .getByRole("button", { name: "Attach supplied Latin", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm matching lines" })
        .click();
      pick("lyrics", "Morning light.english.txt");
      await page
        .getByRole("button", { name: "Attach supplied English", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm matching lines" })
        .click();
      await page.getByText("Morning light", { exact: true }).waitFor();
      await page.getByText("Kaalai oli", { exact: true }).waitFor();
      await page
        .getByRole("spinbutton", {
          name: "Lyric timing offset in milliseconds",
        })
        .fill("150");
      await page.locator(".lyric-line").nth(2).click();
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="elapsed"]')?.textContent ===
          "0:08",
        null,
        { timeout: 6000 },
      );
      const active = await page.locator(".lyric-line.is-active").innerText();
      assert(
        active.includes("புதிய நாள்") &&
          active.includes("Puthiya naal") &&
          active.includes("A new day"),
      );
    },
  );
  await check("rapid switches and end-of-track advance only once", async () => {
    await page
      .getByRole("button", { name: "Library", exact: false })
      .first()
      .click();
    await page
      .getByRole("button", { name: `Play ${first.title}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `Play ${second.title}`, exact: true })
      .click();
    await waitState("playing");
    await setRange("Seek playback", 7.5);
    await delay(2600);
    await waitState("ended");
    const s = await invoke("load_library");
    assert.equal(
      s.session.history.filter((h) => h.trackId === second.id).length,
      1,
    );
    await page
      .getByRole("button", { name: `Play ${first.title}`, exact: true })
      .click();
    await waitState("playing");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await setRange("Seek playback", 15);
    await delay(2500);
  });
  await check(
    "continuous 30-second decode and media-clock progression",
    async () => {
      await setRange("Seek playback", 0);
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await waitState("playing");
      await delay(31000);
      assert.equal(await state(), "playing");
      const [eMins, eSecs] = (
        await page.getByTestId("elapsed").textContent()
      ).split(":");
      assert(Number(eMins) * 60 + Number(eSecs) >= 30);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await setRange("Seek playback", 15);
      await delay(2500);
    },
  );
  await check(
    "metadata export omits audio, paths, lyric text and history",
    async () => {
      await page.getByRole("button", { name: "Settings & sources" }).click();
      pick("export", "export.json");
      await page
        .getByRole("button", { name: "Export library", exact: true })
        .click();
      await delay(500);
      const backup = JSON.parse(
        readFileSync(path.join(fixtures, "export.json"), "utf8"),
      );
      assert.equal(backup.version, 1);
      assert.deepEqual(backup.session.lyrics, {});
      assert.deepEqual(backup.session.history, []);
      assert(!JSON.stringify(backup).includes("D:\\"));
      assert(backup.session.playlists.some((p) => p.name === "Quiet hours"));
    },
  );
  await check(
    "invalid backup preserves local data and valid metadata backup retains supplied lyrics",
    async () => {
      writeFileSync(path.join(fixtures, "invalid.json"), '{"format":"broken"}');
      pick("backup", "invalid.json");
      await assert.rejects(invoke("import_library"));
      let s = await invoke("load_library");
      assert(s.session.lyrics[first.id].translation);
      assert(s.session.playlists.some((p) => p.name === "Quiet hours"));
      pick("backup", "export.json");
      await page
        .getByRole("button", { name: "Import backup", exact: true })
        .click();
      await page.locator("dialog input").fill("IMPORT");
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await delay(600);
      s = await invoke("load_library");
      assert(s.session.lyrics[first.id].translation);
      assert(s.session.playlists.some((p) => p.name === "Quiet hours"));
      await waitState("paused");
    },
  );
  await page
    .getByRole("button", { name: "Library", exact: false })
    .first()
    .click();
  await page.screenshot({ path: path.join(results, "desktop-library.png") });
  await page.getByRole("button", { name: "Lyric room", exact: false }).click();
  await page.screenshot({ path: path.join(results, "desktop-lyrics.png") });
  await close();
  await launch(false);
  await check(
    "cold SQLite restore preserves collection, lyrics and position and stays paused",
    async () => {
      await waitState("paused");
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="elapsed"]')?.textContent ===
          "0:15",
        null,
        { timeout: 8000 },
      );
      const s = await invoke("load_library");
      assert(
        s.session.playlists.some(
          (p) => p.name === "Quiet hours" && p.items.length === 2,
        ),
      );
      assert(s.session.favorites.includes(first.id));
      assert(s.session.lyrics[first.id].translation);
      assert.equal(s.session.settings.volume, 0.24);
      await delay(1200);
      assert.equal(await state(), "paused");
    },
  );
  await check(
    "missing file survives restart and explicit relink recovers",
    async () => {
      const originalPath = path.join(fixtures, first.fileName),
        movedPath = path.join(fixtures, "Relocated morning.wav");
      await close();
      renameSync(originalPath, movedPath);
      try {
        await launch(false);
        const s = await invoke("load_library");
        assert(s.tracks.find((t) => t.id === first.id).missing);
        await waitState("error");
        pick("audio", "Relocated morning.wav");
        const menu = page
          .locator(".track-row")
          .filter({
            has: page.getByRole("button", {
              name: `Play ${first.title}`,
              exact: true,
            }),
          })
          .locator("details");
        await menu.locator("summary").click();
        await menu.getByRole("button", { name: "Relink file" }).click();
        await waitState("paused");
        assert(
          !(await invoke("load_library")).tracks.find((t) => t.id === first.id)
            .missing,
        );
        await page.getByRole("button", { name: "Play", exact: true }).click();
        await waitState("playing");
        await page.getByRole("button", { name: "Pause", exact: true }).click();
      } finally {
        if (existsSync(movedPath)) renameSync(movedPath, originalPath);
      }
    },
  );
  await check("narrow layout keeps controls and focus available", async () => {
    await page.setViewportSize({ width: 800, height: 650 });
    await page
      .getByRole("button", { name: "Hide queue", exact: true })
      .first()
      .click();
    assert.equal(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
      true,
    );
    await page.getByRole("button", { name: "Play", exact: true }).focus();
    assert(
      await page
        .getByRole("button", { name: "Play", exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await page.screenshot({ path: path.join(results, "desktop-narrow.png") });
  });
  report.completedAt = new Date().toISOString();
  report.passed = report.checks.every((c) => c.passed);
  console.log(`Passed ${report.checks.length} desktop checks.`);
} catch (e) {
  report.passed = false;
  report.failure = String(e.stack || e);
  console.error(e);
  if (page)
    await page
      .screenshot({ path: path.join(results, "failure.png") })
      .catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync(
    path.join(results, "desktop-report.json"),
    JSON.stringify(report, null, 2),
  );
  await close();
}
