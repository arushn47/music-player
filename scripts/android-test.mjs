// Own-app device smoke checks. No contacts, accounts, user media, or API keys.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const sdk =
  process.env.ANDROID_HOME ||
  path.join(process.env.LOCALAPPDATA || "", "Android/Sdk");
const adb = path.join(sdk, "platform-tools/adb.exe");
const pkg = "app.lumaire.player";
const results = path.resolve("test-results");
mkdirSync(results, { recursive: true });
const report = {
  checks: [],
  limitations: [
    "Original synthetic audio only; no YouTube or Gemini request.",
    "Real document-picker interaction, Bluetooth, interruptions and background queue handoff require separate verification.",
  ],
};
function device(...args) {
  const result = spawnSync(adb, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, page, port;
async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const pid = device("shell", "pidof", pkg).split(" ")[0];
      port = device(
        "forward",
        "tcp:0",
        `localabstract:webview_devtools_remote_${pid}`,
      );
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) throw new Error("WebView is starting");
      const meta = await response.json();
      browser = await chromium.connectOverCDP(meta.webSocketDebuggerUrl);
      page = browser.contexts()[0].pages()[0];
      await page.waitForFunction(() => !!window.__TAURI_INTERNALS__);
      return;
    } catch {
      if (port) device("forward", "--remove", `tcp:${port}`);
      await delay(500);
    }
  }
  throw new Error(
    "Android WebView debugging did not become ready. Keep the phone unlocked with Lumaire visible.",
  );
}
async function invoke(cmd, args = {}) {
  return page.evaluate(
    ({ cmd, args }) => window.__TAURI_INTERNALS__.invoke(cmd, args),
    { cmd, args },
  );
}
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
try {
  const apk = path.resolve(
    process.argv[2] ||
      "src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk",
  );
  assert(existsSync(apk), `Build the APK first: ${apk}`);
  report.apk = { bytes: statSync(apk).size, sha256: createHash("sha256").update(readFileSync(apk)).digest("hex") };
  assert(
    /\tdevice\b/.test(device("devices")),
    "Connect and authorize an unlocked Android phone.",
  );
  console.log(device("install", "-r", apk));
  device("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
  await connect();
  let track;
  await check(
    "Android app starts and SQLite stores a synthetic local track",
    async () => {
      const imported = await invoke("android_demo_track");
      track = imported.tracks[0];
      assert(track && track.duration >= 39);
      const duplicate = await invoke("android_demo_track");
      assert.equal(duplicate.tracks[0].id, track.id);
      assert(
        (await invoke("load_library")).tracks.some((t) => t.id === track.id),
      );
      await page.reload();
      await page
        .getByRole("button", { name: "Open Local", exact: true })
        .click();
      await page
        .getByRole("button", { name: `Play ${track.title}`, exact: true })
        .click();
    },
  );
  await check(
    "Media3 decodes audio and its native clock supports pause and seek",
    async () => {
      await invoke("android_playback", { action: "volume", value: 0.05 });
      await page.waitForFunction(async () => {
        const state = await window.__TAURI_INTERNALS__.invoke(
          "android_playback",
          { action: "state" },
        );
        return (
          state.status === "playing" && state.time >= 1 && state.duration >= 39
        );
      });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await delay(300);
      const paused = await invoke("android_playback", { action: "state" });
      assert.equal(paused.status, "paused");
      await invoke("android_playback", { action: "seek", value: 12 });
      const sought = await invoke("android_playback", { action: "state" });
      assert(Math.abs(sought.time - 12) < 1);
    },
  );
  await check(
    "original and romanized lyrics use the native playback position",
    async () => {
      const snapshot = await invoke("load_library");
      const session = snapshot.session;
      const lines = [
        "காலை ஒளி",
        "மெல்ல வரும்",
        "புதிய நாள்",
        "இங்கே தொடங்கும்",
        "ஒளியுடன் நடப்போம்",
      ].map((text, i) => ({ id: `android-line-${i}`, time: i * 8000, text }));
      session.lyrics[track.id] = {
        id: "android-original-fixture",
        origin: "imported",
        raw: "Original synthetic test lyric",
        fileName: "android-fixture.lrc",
        lines,
        fileOffset: 0,
        userOffset: 0,
        warnings: [],
        romanisation: {},
        translation: {},
      };
      session.settings.volume = 0.05;
      session.position = 12;
      await invoke("save_session", { session });
      // Kill directly after the committed fixture write so the old renderer's
      // lifecycle save cannot overwrite the injected test document.
      device("shell", "am", "force-stop", pkg);
      await browser.close().catch(() => {});
      browser = null;
      if (port) {
        device("forward", "--remove", `tcp:${port}`);
        port = null;
      }
      device("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
      await connect();
      await page
        .getByRole("button", { name: /^Lyric room/ })
        .first()
        .click();
      await page.getByText("காலை ஒளி", { exact: true }).waitFor();
      await page.locator(".lyric-roman").first().waitFor();
      // The renderer can show restored lyrics before Media3 finishes preparing
      // the restored file. Assert the settled native state, not its transient
      // buffering snapshot.
      const restoredState = await page.waitForFunction(async () => {
        const state = await window.__TAURI_INTERNALS__.invoke(
          "android_playback", { action: "state" },
        );
        return state.status === "paused" && state.duration >= 39 && Math.abs(state.time - 12) < 1
          ? state : false;
      }, null, { timeout: 15000 });
      const state = await restoredState.jsonValue();
      await restoredState.dispose();
      assert.equal(state.status, "paused");
      assert(Math.abs(state.time - 12) < 1);
      await page.screenshot({ path: path.join(results, "android-lyrics.png") });
    },
  );
  await check(
    "library and lyrics survive an actual app process restart",
    async () => {
      await browser.close();
      browser = null;
      if (port) {
        device("forward", "--remove", `tcp:${port}`);
        port = null;
      }
      device("shell", "am", "force-stop", pkg);
      device("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
      await connect();
      const snapshot = await invoke("load_library");
      assert(snapshot.tracks.some((t) => t.id === track.id));
      assert.equal(snapshot.session.lyrics[track.id].origin, "imported");
      await page.waitForFunction(
        async () =>
          (
            await window.__TAURI_INTERNALS__.invoke("android_playback", {
              action: "state",
            })
          ).status === "paused",
      );
    },
  );
  await check(
    "native media session keeps audio playing in the background with the screen off",
    async () => {
      await invoke("android_playback", {
        action: "load",
        id: track.id,
        position: 0,
        autoplay: false,
      });
      await invoke("android_playback", { action: "seek", value: 3 });
      await invoke("android_playback", { action: "play" });
      await delay(1000);
      const before = await invoke("android_playback", { action: "state" });
      device("shell", "input", "keyevent", "3");
      device("shell", "input", "keyevent", "223");
      try {
        await delay(6000);
        const after = await invoke("android_playback", { action: "state" });
        assert.equal(after.status, "playing");
        assert(
          after.time > before.time + 1,
          `Native clock did not advance in background: ${JSON.stringify({ before, after })}`,
        );
        const sessions = device("shell", "dumpsys", "media_session");
        assert(
          sessions.includes(pkg),
          "Media session must be visible to Android system controls",
        );
        await invoke("android_playback", { action: "pause" });
      } finally {
        device("shell", "input", "keyevent", "224");
      }
    },
  );
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (port) device("forward", "--remove", `tcp:${port}`);
  writeFileSync(
    path.join(results, "android-report.json"),
    JSON.stringify(report, null, 2),
  );
}
