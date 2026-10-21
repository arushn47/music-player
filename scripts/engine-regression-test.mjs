// Isolated browser regression checks for React scheduling and controls. Native
// HTTP/SQLite/credential behavior is covered by Rust tests and native-engine-probe.
import { chromium } from "playwright-core";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const results = path.resolve("test-results/engine-regression");
const data = path.resolve(`.test-data/engine-${Date.now()}`);
const fixtures = path.resolve(".test-data/fixtures");
mkdirSync(results, { recursive: true });
mkdirSync(data, { recursive: true });
spawnSync(process.execPath, ["scripts/fixtures.mjs"], {
  stdio: "inherit",
  windowsHide: true,
});
const report = {
  checks: [],
  errors: [],
  limitations: [
    "Gemini UI scheduling uses synthetic responses; Rust tests exercise the actual HTTP contract. No user credentials or library are used.",
  ],
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, page;
const { readFileSync } = await import("node:fs");
const audio = `data:audio/wav;base64,${readFileSync(path.join(fixtures, "Lumaire - Morning light.wav")).toString("base64")}`;
async function launch() {
  browser = await chromium.launchPersistentContext(path.join(data, "browser"), {
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 920 },
  });
  page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.addInitScript(
    ({ audio }) => {
      window.isTauri = true;
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      let callback = 0;
      const tracks = ["Morning light", "Quiet orbit"].map((title, index) => ({
        id: `local-${index}`,
        title,
        artist: "Lumaire",
        album: "Original fixtures",
        duration: 36,
        format: "WAV",
        fileName: `${title}.wav`,
        missing: false,
      }));
      const native = async (command, args = {}) => {
        if (command === "discover_albums") {
          window.__qaHomeCalls = (window.__qaHomeCalls || 0) + 1;
          if (window.__qaHomeOffline) throw Error("Offline fixture");
          return [{ id: "saavn:album:42", title: "Fixture album", artist: "Fixture artist", artists: [] }];
        }
        if (command === "search_catalog") return [];
        if (command === "search_catalog_entities") return { artists: [], albums: [] };
        if (command === "load_library")
          return {
            tracks,
            session: JSON.parse(localStorage.getItem("qa-session") || "null"),
          };
        if (command === "save_session") {
          localStorage.setItem("qa-session", JSON.stringify(args.session));
          return;
        }
        if (command === "media_path") {
          window.__qaLoads.push(args.id);
          return "fixture";
        }
        if (command === "ytdlp_check_available") return localStorage.getItem("qa-engine") === "installed";
        if (command === "install_youtube_engine") {
          window.__qaInstallCalls = (window.__qaInstallCalls || 0) + 1;
          await new Promise(resolve => setTimeout(resolve, 1500));
          if (window.__qaEngineInstallFail) throw new Error("Fixture: download unavailable; retry later.");
          localStorage.setItem("qa-engine", "installed");
          return;
        }
        if (command === "get_listening_history")
          return { generation: 0, records: JSON.parse(localStorage.getItem("qa-recent-records") || "[]") };
        if (command === "checkpoint_listening") return true;
        if (command.startsWith("plugin:")) return;
        throw new Error(`Unexpected native command ${command}`);
      };
      window.__qaNative = native;
      window.__qaCalls = [];
      window.__qaLoads = [];
      window.__qaKey = true;
      const invoke = async (command, args, ...rest) => {
        if (command === "save_session" && window.__qaFreeze) return;
        if (command === "save_session") window.__qaSession = args.session;
        if (command === "gemini_key_status") return window.__qaKey;
        if (command === "fetch_lyrics")
          return {
            kind: "synced",
            lrc: "[00:00]காலை ஒளி\n[00:03]தமிழ்",
            matched: null,
          };
        if (command === "process_lyrics") {
          window.__qaCalls.push(args);
          await new Promise((resolve) => setTimeout(resolve, window.__qaSlow ? 800 : 120));
          if (window.__qaFail)
            throw new Error(
              "Gemini quota or rate limit reached. Try again later.",
            );
          return {
            romanisation: Object.fromEntries(
              args.lines.map((line) => [line.id, "Kaalai oli"]),
            ),
            translation: Object.fromEntries(
              args.lines.map((line) => [line.id, "Morning light"]),
            ),
          };
        }
        return native(command, args, ...rest);
      };
      window.__TAURI_INTERNALS__ = {
        invoke,
        transformCallback: () => ++callback,
        unregisterCallback() {},
        convertFileSrc: () => audio,
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main" },
        },
      };
    },
    { audio },
  );
  await page.goto("http://127.0.0.1:1420");
  await page.getByRole("button", { name: "Open library", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your library.", exact: true })
    .waitFor();
  await page.waitForFunction(() => !!window.__qaSession);
}
const invoke = (command, args = {}) =>
  page.evaluate(
    ([command, args]) => {
      if (command === "save_session") window.__qaFreeze = true;
      return window.__qaNative(command, args);
    },
    [command, args],
  );
async function close() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
async function session() {
  return page.evaluate(() => window.__qaSession);
}
async function persisted(predicate) {
  await page.waitForFunction(() => !!window.__qaSession);
  await page.waitForFunction(predicate);
  return session();
}
async function finishAudio() {
  const cdp = await page.context().newCDPSession(page);
  const prototype = await cdp.send("Runtime.evaluate", {
    expression: "HTMLAudioElement.prototype",
  });
  const objects = await cdp.send("Runtime.queryObjects", {
    prototypeObjectId: prototype.result.objectId,
  });
  await cdp.send("Runtime.callFunctionOn", {
    objectId: objects.objects.objectId,
    functionDeclaration:
      "async function(){const audio=Array.from(this).find(a=>a.src); if(!audio) throw new Error('No active audio'); audio.currentTime=audio.duration-.1; await audio.play();}",
    awaitPromise: true,
  });
  await cdp.send("Runtime.releaseObject", {
    objectId: objects.objects.objectId,
  });
  await cdp.detach();
}
try {
  await launch();
  const snapshot = await invoke("load_library");
  const tracks = snapshot.tracks.filter((track) => track.format === "WAV");
  assert(tracks.length >= 2);
  const initial = await session();
  await invoke("save_session", {
    session: {
      ...initial,
      queue: [],
      currentId: null,
      playlists: [
        {
          id: "qa-playlist",
          name: "Engine test",
          items: [tracks[0], tracks[1], tracks[0]].map((track, index) => ({
            id: `playlist-${index}`,
            trackId: track.id,
          })),
        },
      ],
      settings: {
        ...initial.settings,
        volume: 0,
        repeat: "off",
        shuffle: false,
        autoGemini: true,
      },
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "Open library", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your library.", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Open Engine test", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Play ${tracks[0].title}`, exact: true })
    .first()
    .click();
  await persisted(() =>
    Object.values(window.__qaSession.lyrics).some((doc) => doc.processedModel),
  );
  await check(
    "saved key automatically processes both layers once per song and reuses cached results",
    async () => {
      assert.equal(await page.evaluate(() => window.__qaCalls.length), 1);
      const first = await session();
      assert.equal(first.queue.length, 3);
      const document = first.lyrics[tracks[0].id];
      assert.equal(document.romanisationSource, "gemini");
      assert.equal(Object.values(document.translation)[0], "Morning light");
      await page
        .getByRole("button", { name: "Next track", exact: true })
        .click();
      await persisted(
        () =>
          window.__qaCalls.length === 2 &&
          Object.values(window.__qaSession.lyrics).filter(
            (doc) => doc.processedModel,
          ).length === 2,
      );
      await page
        .getByRole("button", { name: "Previous track", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Previous track", exact: true })
        .click();
      await delay(300);
      assert.equal(await page.evaluate(() => window.__qaCalls.length), 2);
    },
  );
  await check(
    "shuffle Up next matches playback, Previous follows history, and the sequence survives reload",
    async () => {
      await page.getByRole("button", { name: "Shuffle", exact: true }).click();
      await persisted(
        () =>
          window.__qaSession.settings.shuffle &&
          window.__qaSession.shuffleOrder.length === 3,
      );
      const before = await session();
      const order = before.shuffleOrder;
      const index = order.indexOf(before.currentId);
      if (index < order.length - 1) {
        await page
          .getByRole("button", { name: "Next track", exact: true })
          .click();
        await persisted(
          () =>
            window.__qaSession.currentId !== window.__qaSession.shuffleOrder[0],
        );
        assert.equal((await session()).currentId, order[index + 1]);
        await page
          .getByRole("button", { name: "Previous track", exact: true })
          .click();
        await delay(250);
        assert.equal((await session()).currentId, before.currentId);
      }
      await page.reload();
      await page.getByRole("button", { name: "Open library", exact: true }).click();
      await page
        .getByRole("heading", { name: "Your library.", exact: true })
        .waitFor();
      await page.waitForFunction(() => !!window.__qaSession);
      assert.deepEqual((await session()).shuffleOrder, order);
    },
  );
  await check(
    "repeat cycles Off, All, One and a manual Next leaves Repeat One",
    async () => {
      await page
        .getByRole("button", { name: "Repeat: off", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Repeat: all", exact: true })
        .click();
      const loads = await page.evaluate(() => window.__qaLoads.length);
      const before = await session();
      await finishAudio();
      await page.waitForFunction(
        (loads) => window.__qaLoads.length > loads,
        loads,
      );
      await delay(250);
      assert.equal((await session()).currentId, before.currentId);
      await page
        .getByRole("button", { name: "Next track", exact: true })
        .click();
      await delay(300);
      assert.notEqual((await session()).currentId, before.currentId);
      await page
        .getByRole("button", { name: "Repeat: one", exact: true })
        .click();
    },
  );
  await page
    .getByRole("button", { name: "Settings & sources", exact: true })
    .click();
  await check(
    "all palettes, custom HEX validation, and dark/light modes apply across navigation",
    async () => {
      for (const mode of ["Light mode", "Dark mode"]) {
        await page.getByRole("button", { name: mode, exact: true }).click();
        for (const [name, source] of [
          ["Lumaire Sage", "#C4DCA3"],
          ["Ocean Blue", "#4F96FF"],
          ["Electric Violet", "#A855F7"],
          ["Sunset Rose", "#FB7185"],
          ["Amber Glow", "#F59E0B"],
        ]) {
          await page.getByRole("button", { name, exact: true }).click();
          await delay(30);
          const accent = await page.evaluate(() =>
            document.documentElement.style.getPropertyValue("--accent"),
          );
          assert.match(accent, /^#[0-9A-F]{6}$/);
          assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent-source")), source);
        }
      }
      await page.screenshot({
        path: path.join(results, "appearance-dark.png"),
      });
      await page
        .getByRole("textbox", { name: "Hex color code", exact: true })
        .fill("#nope");
      await page
        .getByRole("button", { name: "Apply HEX color", exact: true })
        .click();
      await page
        .getByText("Use #RGB or #RRGGBB format.", { exact: true })
        .waitFor();
      await page
        .getByRole("textbox", { name: "Hex color code", exact: true })
        .fill("#75BDE8");
      await page
        .getByRole("button", { name: "Apply HEX color", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Light mode", exact: true })
        .click();
      await page.screenshot({
        path: path.join(results, "appearance-light.png"),
      });
      for (const name of ["Discover", "Favorites", "Tracker", "Lyric room"]) {
        await page
          .locator('nav[aria-label="Main navigation"]')
          .getByRole("button", { name, exact: true })
          .click();
        assert.equal(
          await page.evaluate(() => document.documentElement.dataset.theme),
          "light",
        );
        await page.screenshot({
          path: path.join(
            results,
            `${name.replaceAll(" ", "-").toLowerCase()}-light.png`,
          ),
        });
      }
      await page
        .getByRole("button", { name: "Lyrics settings", exact: true })
        .click();
      await page.screenshot({
        path: path.join(results, "lyrics-controls-light.png"),
      });
    },
  );
  await check(
    "Gemini quota failure is visible, keeps original/local lyrics, and does not retry in a render loop",
    async () => {
      await page.evaluate(() => {
        window.__qaFail = true;
      });
      const before = await page.evaluate(() => window.__qaCalls.length);
      await page
        .getByRole("button", {
          name: "Refresh pronunciation & translation",
          exact: true,
        })
        .click();
      await page
        .getByText("Gemini quota or rate limit reached. Try again later.", {
          exact: true,
        })
        .first()
        .waitFor();
      await delay(400);
      assert.equal(
        await page.evaluate(() => window.__qaCalls.length),
        before + 1,
      );
    },
  );
  await check(
    "without a key, local pronunciation stays available without a Gemini request",
    async () => {
      await page.evaluate(() => {
        window.__qaKey = false;
        window.dispatchEvent(new Event("lumaire:gemini-key-changed"));
      });
      await page
        .locator('nav[aria-label="Main navigation"]')
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      const lyricsSettings = page.getByRole("button", {
        name: "Lyrics settings",
        exact: true,
      });
      if ((await lyricsSettings.getAttribute("aria-expanded")) !== "true")
        await lyricsSettings.click();
      const calls = await page.evaluate(() => window.__qaCalls.length);
      await page.getByRole("button", { name: /Clear cached lyrics/ }).click();
      await persisted(() =>
        Object.values(window.__qaSession.lyrics).some(
          (doc) => doc.romanisationSource === "local",
        ),
      );
      assert.equal(await page.evaluate(() => window.__qaCalls.length), calls);
      assert(
        Object.values((await session()).lyrics).some((doc) =>
          Object.values(doc.romanisation).includes("kaalai oli"),
        ),
      );
    },
  );
  await check(
    "appearance and playback preferences survive a browser context restart",
    async () => {
      await delay(400);
      const before = await invoke("load_library");
      await close();
      await launch();
      const after = await invoke("load_library");
      assert.equal(after.session.settings.themeMode, "light");
      assert.equal(after.session.settings.accentColor, "#75BDE8");
      assert.deepEqual(after.session.shuffleOrder, before.session.shuffleOrder);
      assert.equal(
        await page.evaluate(() => document.documentElement.dataset.theme),
        "light",
      );
      assert.equal(
        await page.getByTestId("playback-state").textContent(),
        "paused",
      );
    },
  );
  await check("settings playback controls and bundled software notices work", async () => {
    await page.getByRole("button", { name: "Settings & sources", exact: true }).click();
    const categories = page.getByRole("navigation", { name: "Settings categories" });
    await categories.getByRole("button", { name: "Playback", exact: true }).click();
    await page.getByRole("button", { name: "Repeat mode", exact: true }).click();
    await page.getByRole("option", { name: "Current song", exact: true }).click();
    await persisted(() => window.__qaSession.settings.repeat === "one");
    for (const name of ["Library", "Online Sources", "Lyrics", "Keyboard Shortcuts", "History", "Storage", "About"])
      await categories.getByRole("button", { name, exact: true }).click();
    await page.locator(".software-notices summary").click();
    await page.waitForFunction(() => document.querySelector(".software-notices pre")?.textContent.includes("MIT License"));
  });
  await check("returning to a song during Gemini processing reuses its pending request and completes its UI state", async () => {
    await page.getByRole("navigation", { name: "Settings categories" }).getByRole("button", { name: "Playback", exact: true }).click();
    if (await page.getByRole("checkbox", { name: /^Shuffle/ }).isChecked())
      await page.getByText("Shuffle", { exact: true }).click();
    await page.getByRole("navigation", { name: "Playlists", exact: true }).getByRole("button", { name: /^Engine test/ }).click();
    await page.getByRole("button", { name: `Play ${tracks[0].title}`, exact: true }).first().click();
    await page.locator('nav[aria-label="Main navigation"]').getByRole("button", { name: "Lyric room", exact: true }).click();
    await page.getByRole("button", { name: "Lyrics settings", exact: true }).click();
    await page.locator(".lyric-model summary").click();
    await page.evaluate(() => { window.__qaSlow = true; });
    await page.getByRole("textbox", { name: "Gemini model", exact: true }).fill("slow-fixture");
    await page.getByRole("textbox", { name: "Gemini model", exact: true }).press("Tab");
    await page.waitForFunction(() => window.__qaCalls.some((call) => call.model === "slow-fixture"));
    await page.getByRole("button", { name: "Next track", exact: true }).click();
    await delay(80);
    await page.getByRole("button", { name: "Previous track", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Lyrics settings", exact: true });
    if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
    await page.getByRole("button", { name: "Refresh pronunciation & translation", exact: true }).waitFor();
    await persisted(() => window.__qaSession.lyrics["local-0"]?.processedModel === "slow-fixture");
    assert.equal(await page.evaluate(() => window.__qaCalls.filter((call) => call.model === "slow-fixture").length), 2);
  });
  await check("component state survives navigation/restart, retries failures, and resyncs native availability without duplicate downloads", async () => {
    await page.getByRole("button", { name: "Settings & sources", exact: true }).click();
    await page.getByRole("navigation", { name: "Settings categories" }).getByRole("button", { name: "Online Sources", exact: true }).click();
    await page.evaluate(() => { window.__qaEngineInstallFail = true; });
    await page.getByRole("button", { name: "Enable online playback", exact: true }).click();
    assert(await page.getByRole("button", { name: "Setting up…", exact: true }).isDisabled());
    await page.getByRole("alert").filter({ hasText: "Fixture: download unavailable" }).waitFor();
    await page.evaluate(() => { window.__qaEngineInstallFail = false; });
    await page.getByRole("button", { name: "Retry setup", exact: true }).click();
    await page.locator('nav[aria-label="Main navigation"]').getByRole("button", { name: /^Library/ }).click();
    await page.getByRole("button", { name: "Settings & sources", exact: true }).click();
    await page.getByRole("navigation", { name: "Settings categories" }).getByRole("button", { name: "Online Sources", exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("button", { name: "Installed", exact: true }).waitFor();
    assert(await page.getByRole("button", { name: "Installed", exact: true }).isDisabled());
    assert.equal(await page.getByRole("button", { name: "Enable online playback", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.__qaInstallCalls), 2);
    assert.equal(await page.getByRole("alert").count(), 0);
    await page.reload();
    await page.getByRole("button", { name: "Settings & sources", exact: true }).click();
    await page.getByRole("navigation", { name: "Settings categories" }).getByRole("button", { name: "Online Sources", exact: true }).click();
    await page.getByRole("button", { name: "Installed", exact: true }).waitFor();
    assert(await page.getByRole("button", { name: "Installed", exact: true }).isDisabled());
    await page.screenshot({ path: path.join(results, "engine-installed.png") });
    await page.evaluate(() => { localStorage.removeItem("qa-engine"); window.dispatchEvent(new Event("focus")); });
    await page.getByRole("button", { name: "Enable online playback", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__qaInstallCalls || 0), 0);
  });
  await check("Discover remembers searches and languages, reuses cache offline and clears searches when history is disabled", async () => {
    await page.evaluate(() => {
      const record = { id: "recent", trackId: "local-0", title: "Morning light", artist: "Lumaire", album: "Original fixtures", artworkUrl: null, providerId: null, sourceId: null, startedAt: Date.now(), updatedAt: Date.now(), listenedMs: 12000, days: {} };
      localStorage.setItem("qa-recent-records", JSON.stringify([record, { ...record, id: "older", title: "Older duplicate", startedAt: 1 }, { ...record, id: "missing", trackId: "missing", title: "Missing local file" }]));
    });
    await page.reload();
    const recent = page.getByRole("region", { name: "Recently played", exact: true });
    await recent.waitFor();
    assert.equal(await recent.getByRole("button").count(), 2);
    assert(await recent.getByRole("button", { name: "Missing local file Lumaire", exact: true }).isDisabled());
    await recent.getByRole("button", { name: "Morning light Lumaire", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="playback-state"]')?.textContent === "playing");
    await page.getByRole("button", { name: "Discovery language", exact: true }).click();
    await page.getByRole("option", { name: "Tamil", exact: true }).click();
    await page.getByRole("button", { name: "Open album Fixture album", exact: true }).waitFor();
    const search = page.getByRole("textbox", { name: "Search music", exact: true });
    await search.fill("Fixture search"); await search.press("Enter");
    await page.getByRole("region", { name: "Artists", exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await page.getByRole("region", { name: "Recent searches", exact: true }).getByRole("button", { name: "Fixture search", exact: true }).click();
    await page.getByRole("region", { name: "Artists", exact: true }).waitFor();
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await page.evaluate(() => { window.__qaHomeOffline = true; });
    await page.getByRole("button", { name: "Refresh discovery albums", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Showing saved catalogue results" }).waitFor();
    assert(await search.isEnabled());
    assert(await page.getByRole("button", { name: "Open album Fixture album", exact: true }).isEnabled());
    await page.screenshot({ path: path.join(results, "discover-offline.png") });
    await page.getByRole("button", { name: "Clear recent searches", exact: true }).click();
    assert.equal(await page.getByRole("region", { name: "Recent searches", exact: true }).count(), 0);
    await page.evaluate(() => { window.__qaFreeze = true; const state = window.__qaSession; state.settings.historyEnabled = false; localStorage.setItem("qa-session", JSON.stringify(state)); localStorage.setItem("lumaire-discovery", JSON.stringify({ language: "tamil", searches: ["Hidden query"] })); });
    await page.reload();
    await page.getByRole("heading", { name: "Discover new music.", exact: true }).waitFor();
    assert.equal(await page.getByRole("region", { name: "Recent searches", exact: true }).count(), 0);
    assert.equal(await page.getByRole("region", { name: "Recently played", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Discovery language", exact: true }).innerText(), "Tamil");
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.getByRole("textbox", { name: "Search music", exact: true }).isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(results, "discover-narrow.png") });
  });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack || String(error);
  console.error(report.failure);
  if (page) {
    await page
      .screenshot({ path: path.join(results, "failure.png") })
      .catch(() => {});
    report.visible = await page
      .locator("body")
      .innerText()
      .catch(() => "");
  }
  process.exitCode = 1;
} finally {
  writeFileSync(
    path.join(results, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await close();
}
