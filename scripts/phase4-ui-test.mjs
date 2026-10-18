// Frontend regression checks with a deterministic native bridge. This does not
// claim native WebView2, SQLite, external providers, or audible-output coverage.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

const audio = `data:audio/wav;base64,${readFileSync(".test-data/fixtures/Lumaire - Morning light.wav").toString("base64")}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const errors = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("https://i.ytimg.com/**", (route) =>
  route.fulfill({ status: 404, body: "missing image fixture" }),
);
await page.addInitScript(
  ({ audio }) => {
    const source = (id) => ({
      providerId: "youtube",
      sourceId: id,
      pageUrl: `https://www.youtube.com/watch?v=${id}`,
      license: "Fixture",
      licenseUrl: "",
      attribution: "Fixture artist",
    });
    const seeds = ["Slow fixture", "Quick fixture"].map((title, index) => ({
      id: `youtube:${index ? "lmnopqrstuv" : "abcdefghijk"}`,
      title,
      artist: "Fixture artist",
      album: "",
      duration: 36,
      format: "YouTube",
      missing: false,
      fileName: title,
      source: source(index ? "lmnopqrstuv" : "abcdefghijk"),
    }));
    seeds.push({
      ...seeds[0],
      id: "youtube:multilang01",
      title: "Aarzu",
      artist: "Noor, Khan, Madhurxo",
      duration: 226,
      fileName: "Aarzu",
      source: source("multilang01"),
    });
    seeds.push({
      ...seeds[0],
      id: "youtube:tamiltest01",
      title: "Lyric Video",
      artist: "Karuppa Kooda Va",
      duration: 258,
      fileName: "Karuppa Kooda Va - Lyric Video | Karuppu",
      source: source("tamiltest01"),
    });
    seeds.push({
      ...seeds[0],
      id: "youtube:structured1",
      title: "Structured song",
      artist: "Unknown artist",
      fileName: "Structured song - Lyric Video",
      source: source("structured1"),
    });
    seeds.push({
      ...seeds[0],
      id: "youtube:regional001",
      title: "Sai Abhyankkar",
      artist: "Radhimaa",
      duration: 260,
      fileName: "Radhimaa – Sai Abhyankkar",
      source: source("regional001"),
    });
    if (!sessionStorage.tracks) sessionStorage.tracks = JSON.stringify(seeds);
    window.isTauri = true;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    window.__calls = [];
    let callback = 0;
    window.__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      transformCallback: () => ++callback,
      unregisterCallback: () => {},
      convertFileSrc: () => audio,
      invoke: async (cmd, args = {}) => {
        window.__calls.push({ cmd, args });
        switch (cmd) {
          case "load_library":
            return {
              tracks: JSON.parse(sessionStorage.tracks),
              session: JSON.parse(sessionStorage.session || "null"),
            };
          case "save_session":
            sessionStorage.session = JSON.stringify(args.session);
            return;
          case "cached_artwork":
            throw new Error("No cached image fixture");
          case "import_audio": {
            const track = {
              id: "local-fixture",
              title: "Local fixture",
              artist: "Fixture artist",
              album: "Local",
              duration: 36,
              format: "WAV",
              fileName: "local.wav",
              missing: false,
            };
            sessionStorage.tracks = JSON.stringify([
              ...JSON.parse(sessionStorage.tracks).filter(
                (entry) => entry.id !== track.id,
              ),
              track,
            ]);
            return { tracks: [track], warnings: [] };
          }
          case "remove_track": {
            const tracks = JSON.parse(sessionStorage.tracks).filter(
              (track) => track.id !== args.id,
            );
            const session = structuredClone(args.session);
            session.queue = session.queue.filter(
              (entry) => entry.trackId !== args.id,
            );
            if (
              !session.queue.some((entry) => entry.id === session.currentId)
            ) {
              session.currentId = session.queue[0]?.id || null;
              session.position = 0;
            }
            session.playlists.forEach((playlist) => {
              playlist.items = playlist.items.filter(
                (entry) => entry.trackId !== args.id,
              );
            });
            session.favorites = session.favorites.filter(
              (id) => id !== args.id,
            );
            session.history = session.history.filter(
              (entry) => entry.trackId !== args.id,
            );
            delete session.lyrics[args.id];
            sessionStorage.tracks = JSON.stringify(tracks);
            sessionStorage.session = JSON.stringify(session);
            return { tracks, session };
          }
          case "search_commons_audio":
            return [
              {
                id: "wikimedia-commons:42",
                title: "Open audio fixture",
                artist: "Fixture composer",
                album: "Commons",
                duration: 36,
                format: "WAV",
                fileName: "open.wav",
                missing: false,
                source: {
                  providerId: "wikimedia-commons",
                  sourceId: "42",
                  pageUrl: "https://commons.wikimedia.org/?curid=42",
                  license: "CC0",
                  licenseUrl:
                    "https://creativecommons.org/publicdomain/zero/1.0/",
                  attribution: "Fixture composer",
                },
              },
            ];
          case "download_track": {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const tracks = JSON.parse(sessionStorage.tracks);
            const track = tracks.find((track) => track.id === args.id);
            track.offline = true;
            sessionStorage.tracks = JSON.stringify(tracks);
            return track;
          }
          case "media_path":
            return "fixture.wav";
          case "resolve_commons_audio":
            return { url: audio, mimeType: "audio/wav" };
          case "delete_download": {
            const tracks = JSON.parse(sessionStorage.tracks);
            const track = tracks.find((track) => track.id === args.id);
            track.offline = false;
            sessionStorage.tracks = JSON.stringify(tracks);
            return track;
          }
          case "translate_lyrics":
            if ("key" in args || sessionStorage.privateKeySaved !== "yes")
              throw new Error("Translation must use the backend's saved key");
            return Object.fromEntries(
              args.lines.map((line) => [line.id, `Meaning for ${line.id}`]),
            );
          case "gemini_key_status":
            return sessionStorage.privateKeySaved === "yes";
          case "save_gemini_key":
            sessionStorage.privateKeySaved = "yes";
            return;
          case "delete_gemini_key":
            delete sessionStorage.privateKeySaved;
            return;
          case "ytdlp_check_available":
            return true;
          case "ytdlp_get_stream":
            if (args.videoId === "structured1")
              return {
                streamUrl: audio,
                track: "Structured song",
                artist: "Extracted performer",
                album: "Source album",
              };
            return { streamUrl: audio };
          case "spotify_search_track":
            return null;
          case "lookup_metadata":
            if (args.title === "Radhimaa" && args.artist === "Sai Abhyankkar")
              return {
                title: "Radhimaa",
                artist: "Sai Abhyankkar",
                album: "Radhimaa",
                duration: 260,
                sourceId: "itunes:regional",
                artworkUrl: null,
              };
            if (args.title === "Karuppa Kooda Va") {
              await new Promise((resolve) => setTimeout(resolve, 100));
              return {
                title: "Karuppa Kooda Va",
                artist: "Sai Abhyankkar, V.M. Mahalingam & Pa Vijay",
                album: "Karuppu",
                duration: 250,
                sourceId: "itunes:42",
                artworkUrl: null,
              };
            }
            return null;
          case "ytdlp_search":
            if (args.query.startsWith("Temporary"))
              return [
                {
                  id: args.query.includes("other")
                    ? "temptrack02"
                    : "temptrack01",
                  title: `Fixture Artist - ${args.query} (Official Audio)`,
                  channel: "Fixture Artist",
                  duration: 36,
                },
              ];
            return [
              {
                id: "12345678901",
                title: "Fixture Artist - Saved song (Official Audio)",
                channel: "Fixture Artist",
                duration: 173,
                thumbnail: "https://i.ytimg.com/vi/12345678901/hqdefault.jpg",
              },
            ];
          case "save_online_track": {
            const tracks = JSON.parse(sessionStorage.tracks);
            sessionStorage.tracks = JSON.stringify([
              ...tracks.filter((t) => t.id !== args.track.id),
              args.track,
            ]);
            return args.track;
          }
          case "pick_lyrics":
            return {
              text: "[00:01]Manually attached fixture",
              fileName: "manual.lrc",
            };
          case "fetch_lyrics":
            await new Promise((resolve) =>
              setTimeout(resolve, args.title === "Slow fixture" ? 2000 : 50),
            );
            if (args.title === "Aarzu")
              return {
                kind: "plain",
                text: Array.from(
                  { length: 30 },
                  (_, index) => `पहली पंक्ति ${index + 1}`,
                ).join("\n"),
                matched: {
                  id: 35089772,
                  title: "Aarzu",
                  artist: "Noor",
                  album: "Fixture",
                  duration: 188,
                },
              };
            if (args.title === "Karuppa Kooda Va")
              return {
                kind: "synced",
                lrc: "[00:01]முதல் வரி\n[00:02]இரண்டாம் வரி",
                matched: {
                  id: 38509313,
                  title: "Karuppa Kooda Va",
                  artist: "Sai Abhyankkar",
                  album: "Fixture",
                  duration: 36,
                },
              };
            return { kind: "synced", lrc: `[00:01]Automatic ${args.title}` };
          default:
            if (cmd.startsWith("plugin:")) return 1;
            throw new Error(`Unexpected native fixture command: ${cmd}`);
        }
      },
    };
  },
  { audio },
);

const check = async (name, run) => {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  await page.goto("http://127.0.0.1:1420");
  await page.getByRole("heading", { name: "Your library." }).waitFor();
  await check(
    "library opens with collections rather than scattered tracks",
    async () => {
      assert.equal(await page.locator(".track-row").count(), 0);
      mkdirSync("test-results", { recursive: true });
      await page.screenshot({
        path: path.resolve("test-results/phase4-collections.png"),
      });
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
    },
  );
  await check("manual lyrics beat a delayed automatic response", async () => {
    await page
      .getByRole("button", { name: "Play Slow fixture", exact: true })
      .click();
    await page.getByRole("button", { name: "Lyric room", exact: true }).click();
    await page
      .getByRole("button", { name: "Attach lyrics", exact: true })
      .click();
    await page
      .getByText("Manually attached fixture", { exact: true })
      .waitFor();
    await page.waitForTimeout(2200);
    assert.equal(
      await page.getByText("Automatic Slow fixture", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByText("Manually attached fixture", { exact: true })
        .count(),
      1,
    );
  });
  await check(
    "lyrics settings open contextually and close with Escape",
    async () => {
      const settings = page.getByRole("button", {
        name: "Lyrics settings",
        exact: true,
      });
      await settings.click();
      assert.equal(await settings.getAttribute("aria-expanded"), "true");
      await page
        .getByRole("checkbox", { name: "Romanization", exact: true })
        .focus();
      await page.keyboard.press("Escape");
      assert.equal(await settings.getAttribute("aria-expanded"), "false");
    },
  );
  await check(
    "explicit Discover Save persists library membership without changing the queue",
    async () => {
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search YouTube", exact: true })
        .fill("Saved song");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      const result = page
        .locator(".track-row")
        .filter({ hasText: "Saved song" });
      const before = await page.evaluate(
        () => JSON.parse(sessionStorage.session).queue,
      );
      await result.locator(".cover svg").waitFor();
      await result.locator("summary").click();
      await result
        .getByRole("button", { name: "Save to library", exact: true })
        .click();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .locator(".track-row")
        .filter({ hasText: "Saved song" })
        .waitFor();
      const calls = await page.evaluate(() => window.__calls);
      const saved = calls.find(
        (call) =>
          call.cmd === "save_online_track" &&
          call.args.track.id === "youtube:12345678901",
      );
      assert.equal(saved.args.track.album, "");
      assert.equal(saved.args.track.artist, "Fixture Artist");
      assert.equal(saved.args.track.duration, 173);
      await page.waitForTimeout(300);
      assert.deepEqual(
        await page.evaluate(() => JSON.parse(sessionStorage.session).queue),
        before,
      );
    },
  );
  await check(
    "saved online metadata and manual lyrics restore through the bridge",
    async () => {
      await page.waitForTimeout(500);
      await page.reload();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .locator(".track-row")
        .filter({ hasText: "Saved song" })
        .waitFor();
      const row = page.locator(".track-row").filter({ hasText: "Saved song" });
      assert((await row.innerText()).includes("Saved online"));
      await row.locator("summary").click();
      assert.equal(
        await row.getByRole("button", { name: "Relink file" }).count(),
        0,
      );
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page
        .getByText("Manually attached fixture", { exact: true })
        .waitFor();
    },
  );
  await check(
    "old presentation-label metadata repairs without changing its stable identity",
    async () => {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Karuppa Kooda Va", exact: true })
        .waitFor();
      const saved = await page.evaluate(() =>
        JSON.parse(sessionStorage.tracks).find(
          (track) => track.id === "youtube:tamiltest01",
        ),
      );
      assert.equal(saved.title, "Karuppa Kooda Va");
    },
  );
  await check(
    "saved unknown artists repair automatically without changing playback identity or duration",
    async () => {
      await page
        .getByRole("button", { name: "Play Karuppa Kooda Va", exact: true })
        .click();
      await page.waitForFunction(() =>
        JSON.parse(sessionStorage.tracks)
          .find((track) => track.id === "youtube:tamiltest01")
          ?.artist.startsWith("Sai Abhyankkar"),
      );
      const saved = await page.evaluate(() =>
        JSON.parse(sessionStorage.tracks).find(
          (track) => track.id === "youtube:tamiltest01",
        ),
      );
      assert.equal(saved.duration, 258);
      assert.equal(saved.album, "Karuppu");
      assert.equal(saved.source.sourceId, "tamiltest01");
      assert.equal(
        (await page.evaluate(() => window.__calls)).filter(
          (call) =>
            call.cmd === "spotify_search_track" &&
            call.args.title === "Karuppa Kooda Va",
        ).length,
        0,
      );
      await page.waitForTimeout(400);
      await page.reload();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Karuppa Kooda Va", exact: true })
        .waitFor();
      const calls = await page.evaluate(() => window.__calls);
      assert.equal(
        calls.filter(
          (call) =>
            call.cmd === "lookup_metadata" &&
            call.args.title === "Karuppa Kooda Va",
        ).length,
        0,
      );
      await page.screenshot({
        path: path.resolve("test-results/metadata-repaired.png"),
      });
    },
  );
  await check(
    "structured YouTube music credits update the saved track automatically",
    async () => {
      await page
        .getByRole("button", { name: "Play Structured song", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          JSON.parse(sessionStorage.tracks).find(
            (track) => track.id === "youtube:structured1",
          )?.artist === "Extracted performer",
      );
      const saved = await page.evaluate(() =>
        JSON.parse(sessionStorage.tracks).find(
          (track) => track.id === "youtube:structured1",
        ),
      );
      assert.equal(saved.album, "Source album");
      assert.equal(saved.duration, 36);
      assert.equal(saved.source.sourceId, "structured1");
    },
  );
  await check(
    "regional title/artist reversals repair automatically without changing saved identity",
    async () => {
      await page
        .getByRole("button", { name: "Play Sai Abhyankkar", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          JSON.parse(sessionStorage.tracks).find(
            (track) => track.id === "youtube:regional001",
          )?.title === "Radhimaa",
      );
      const saved = await page.evaluate(() =>
        JSON.parse(sessionStorage.tracks).find(
          (track) => track.id === "youtube:regional001",
        ),
      );
      assert.equal(saved.artist, "Sai Abhyankkar");
      assert.equal(saved.duration, 260);
      assert.equal(saved.source.sourceId, "regional001");
      assert(
        (await page.evaluate(() => window.__calls)).some(
          (call) =>
            call.cmd === "lookup_metadata" &&
            call.args.title === "Radhimaa" &&
            call.args.artist === "Sai Abhyankkar",
        ),
      );
    },
  );
  await check(
    "lyrics load automatically, show Not synced and scroll from playback progress",
    async () => {
      await page
        .getByRole("button", { name: "Play Aarzu", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page.getByText("पहली पंक्ति 1", { exact: true }).waitFor();
      await page
        .getByText("Not synced · Estimated autoscroll", { exact: true })
        .waitFor();
      assert.equal(
        await page.locator(".lyric-candidate, .lyric-search-panel").count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Find lyrics", exact: true })
          .count(),
        0,
      );
      assert.equal(await page.locator(".lyric-line.is-active").count(), 0);
      assert.equal(await page.locator(".lyric-line:not(:disabled)").count(), 0);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const before = await page
        .locator("main")
        .evaluate((element) => element.scrollTop);
      await page
        .getByRole("slider", { name: "Seek playback", exact: true })
        .evaluate((element) => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          ).set.call(element, "18");
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });
      await page.waitForFunction(
        (before) => document.querySelector("main").scrollTop > before + 100,
        before,
      );
      await page.waitForTimeout(650);
      const pausedPosition = await page
        .locator("main")
        .evaluate((element) => element.scrollTop);
      await page.waitForTimeout(300);
      assert(
        Math.abs(
          (await page
            .locator("main")
            .evaluate((element) => element.scrollTop)) - pausedPosition,
        ) < 2,
      );
      mkdirSync("test-results", { recursive: true });
      await page.screenshot({
        path: path.resolve("test-results/automatic-unsynced-lyrics.png"),
      });
      await page.waitForTimeout(500);
      await page.reload();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page
        .getByText("Not synced · Estimated autoscroll", { exact: true })
        .waitFor();
      const calls = await page.evaluate(() => window.__calls);
      assert.equal(
        calls.filter(
          (call) => call.cmd === "fetch_lyrics" && call.args.title === "Aarzu",
        ).length,
        0,
      );
    },
  );
  await check(
    "legacy mismatched cached LRC becomes unsynced without a prompt",
    async () => {
      await page.evaluate(() => {
        const session = JSON.parse(sessionStorage.session);
        const doc = session.lyrics["youtube:multilang01"];
        doc.timingMode = "synced";
        doc.lines = doc.lines.map((line, index) => ({
          ...line,
          time: index * 1000,
        }));
        doc.warnings = [
          "The selected lyric recording is 188 seconds; this audio is 226 seconds. Adjust timing if needed.",
        ];
        sessionStorage.session = JSON.stringify(session);
      });
      await page.reload();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page
        .getByText("Not synced · Estimated autoscroll", { exact: true })
        .waitFor();
      assert.equal(await page.locator(".lyric-line.is-active").count(), 0);
      assert.equal(await page.getByText(/Adjust timing if needed/).count(), 0);
    },
  );
  await check(
    "Tamil lyrics load automatically with synced timing and provenance",
    async () => {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Karuppa Kooda Va", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page.getByText("முதல் வரி", { exact: true }).waitFor();
      await page.getByText("Synced lyrics", { exact: true }).waitFor();
      assert.equal(
        await page
          .locator("a[href='https://lrclib.net/tracks/38509313']")
          .count(),
        1,
      );
      assert.equal(
        await page.locator(".lyric-candidate, .lyric-search-panel").count(),
        0,
      );
    },
  );
  await check(
    "romanization is local and translation reuses a private backend key without library exposure",
    async () => {
      await page.locator(".lyric-roman").first().waitFor();
      assert.equal(
        (await page.evaluate(() => window.__calls)).filter(
          (call) => call.cmd === "translate_lyrics",
        ).length,
        0,
      );
      await page
        .getByRole("button", { name: "Lyrics settings", exact: true })
        .click();
      await page
        .getByLabel("Gemini API key", { exact: true })
        .fill("fake-key-only-for-this-test");
      await page.getByRole("button", { name: "Save key", exact: true }).click();
      await page.getByText("Key saved", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Translate this song", exact: true })
        .click();
      await page.locator(".lyric-translation").first().waitFor();
      await page.waitForTimeout(300);
      assert(
        !(await page.evaluate(() => sessionStorage.session)).includes(
          "fake-key-only-for-this-test",
        ),
      );
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "TuneScript-style preferences and saved-key status survive song changes and reload without automatic AI requests",
    async () => {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Aarzu", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page.locator(".lyric-roman").first().waitFor();
      await page
        .getByRole("button", { name: "Lyrics settings", exact: true })
        .click();
      await page.getByText("Key saved", { exact: true }).waitFor();
      assert.equal(
        await page.getByLabel("Gemini API key", { exact: true }).inputValue(),
        "",
      );
      await page
        .getByRole("checkbox", { name: "Original first", exact: true })
        .uncheck();
      assert.equal(
        await page
          .locator(".lyric-line")
          .first()
          .locator("span")
          .first()
          .getAttribute("class"),
        "lyric-roman lyric-primary",
      );
      await page
        .getByRole("checkbox", { name: "Original script", exact: true })
        .uncheck();
      assert.equal(await page.locator(".lyric-original").count(), 0);
      assert(
        await page
          .getByRole("checkbox", { name: "Original first", exact: true })
          .isDisabled(),
      );
      await page
        .getByRole("checkbox", { name: "Translation", exact: true })
        .uncheck();
      await page
        .getByRole("checkbox", { name: "Estimated scroll", exact: true })
        .uncheck();
      await page
        .getByText("Not synced · Manual scrolling", { exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Increase lyric text size", exact: true })
        .click();
      await page
        .getByRole("checkbox", { name: "Auto-open lyrics", exact: true })
        .check();
      await page.screenshot({
        path: path.resolve("test-results/private-lyrics-settings.png"),
      });
      await page.keyboard.press("Escape");
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Quick fixture", exact: true })
        .click();
      await page.locator(".lyric-room").waitFor();
      await page.waitForTimeout(400);
      await page.reload();
      await page
        .getByRole("button", { name: "Lyric room", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lyrics settings", exact: true })
        .click();
      await page.getByText("Key saved", { exact: true }).waitFor();
      assert(
        !(await page
          .getByRole("checkbox", { name: "Original script", exact: true })
          .isChecked()),
      );
      assert(
        !(await page
          .getByRole("checkbox", { name: "Estimated scroll", exact: true })
          .isChecked()),
      );
      assert(
        await page
          .getByRole("checkbox", { name: "Auto-open lyrics", exact: true })
          .isChecked(),
      );
      const persisted = await page.evaluate(() =>
        JSON.parse(sessionStorage.session),
      );
      assert.equal(persisted.settings.lyricSize, 30);
      assert(
        !JSON.stringify(persisted).includes("fake-key-only-for-this-test"),
      );
      assert.equal(
        (await page.evaluate(() => window.__calls)).filter(
          (call) => call.cmd === "translate_lyrics",
        ).length,
        0,
      );
      for (const name of [
        "Original script",
        "Original first",
        "Translation",
        "Estimated scroll",
      ])
        await page.getByRole("checkbox", { name, exact: true }).check();
      await page
        .getByRole("checkbox", { name: "Auto-open lyrics", exact: true })
        .uncheck();
      await page
        .getByRole("button", { name: "Decrease lyric text size", exact: true })
        .click();
      await page.getByRole("button", { name: /^Clear cached lyrics/ }).click();
      await page.getByText("Key saved", { exact: true }).waitFor();
      await page.waitForTimeout(350);
      const cleared = await page.evaluate(() =>
        JSON.parse(sessionStorage.session),
      );
      assert.equal(
        cleared.lyrics["youtube:abcdefghijk"].fileName,
        "manual.lrc",
      );
      assert(!cleared.lyrics["youtube:multilang01"]);
      await page
        .getByRole("button", { name: "Remove key", exact: true })
        .click();
      await page.getByText("No key saved", { exact: true }).waitFor();
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "local imports form one collection and reference removal updates it immediately",
    async () => {
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Add music", exact: true })
        .click();
      await page.getByRole("heading", { name: "Local." }).waitFor();
      assert.equal(await page.locator(".track-row").count(), 1);
      await page
        .getByRole("button", { name: "Add music", exact: true })
        .click();
      assert.equal(await page.locator(".track-row").count(), 1);
      await page
        .getByRole("button", { name: "Actions for Local fixture", exact: true })
        .count();
      await page
        .locator("summary[aria-label='Actions for Local fixture']")
        .click();
      await page
        .getByRole("button", { name: "Remove from library", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          !JSON.parse(sessionStorage.tracks).some(
            (track) => track.id === "local-fixture",
          ),
      );
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Open Local", exact: true })
          .count(),
        0,
      );
    },
  );
  await check(
    "explicit Commons downloads persist and play through local media after reload",
    async () => {
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search open music", exact: true })
        .fill("open audio");
      await page
        .getByRole("button", { name: "Search open music", exact: true })
        .click();
      const result = page
        .locator(".open-music-result")
        .filter({ hasText: "Open audio fixture" });
      await result
        .getByRole("button", { name: "Download", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          JSON.parse(sessionStorage.tracks).find(
            (track) => track.id === "wikimedia-commons:42",
          )?.offline,
      );
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: /^Library/ })
        .click();
      await page
        .getByRole("button", { name: "Open Downloads", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Open audio fixture", exact: true })
        .click();
      await page.waitForTimeout(400);
      await page.reload();
      await page
        .getByRole("button", { name: "Open Downloads", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Play Open audio fixture", exact: true })
        .click();
      const calls = await page.evaluate(() => window.__calls);
      assert(
        calls.some(
          (call) =>
            call.cmd === "media_path" &&
            call.args.id === "wikimedia-commons:42",
        ),
      );
      assert(!calls.some((call) => call.cmd === "resolve_commons_audio"));
      await page.screenshot({
        path: path.resolve("test-results/phase4-downloads.png"),
      });
    },
  );
  await check(
    "offline-copy deletion requires confirmation and retains the online source",
    async () => {
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .locator("summary[aria-label='Actions for Open audio fixture']")
        .click();
      await page
        .getByRole("button", { name: "Delete offline copy", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("textbox").fill("DELETE");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          JSON.parse(sessionStorage.tracks).find(
            (track) => track.id === "wikimedia-commons:42",
          )?.offline === false,
      );
      assert(
        (await page.evaluate(() => JSON.parse(sessionStorage.tracks))).some(
          (track) => track.id === "wikimedia-commons:42",
        ),
      );
    },
  );
  await check(
    "search, play and explicit queue actions never save temporary tracks; session restore keeps them separate",
    async () => {
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      const search = async (title) => {
        await page
          .getByRole("textbox", { name: "Search YouTube", exact: true })
          .fill(title);
        await page.getByRole("button", { name: "Search", exact: true }).click();
        return page
          .locator(".track-row")
          .filter({ hasText: `Fixture Artist - ${title}` });
      };
      await page.waitForTimeout(300);
      const before = await page.evaluate(
        () => JSON.parse(sessionStorage.session).queue,
      );
      let result = await search("Temporary song");
      await result.waitFor();
      await page.waitForTimeout(300);
      assert.deepEqual(
        await page.evaluate(() => JSON.parse(sessionStorage.session).queue),
        before,
      );
      await result.locator(".track-play").click();
      await page
        .locator(".now-playing strong")
        .filter({ hasText: "Temporary song" })
        .waitFor();
      result = await search("Temporary other");
      await result.locator("summary").click();
      await result
        .getByRole("button", { name: "Play next", exact: true })
        .click();
      await page.waitForTimeout(400);
      const session = await page.evaluate(() =>
        JSON.parse(sessionStorage.session),
      );
      assert.deepEqual(
        session.queue.map((entry) => entry.trackId),
        ["youtube:temptrack01", "youtube:temptrack02"],
      );
      assert.equal(Object.keys(session.queueTracks).length, 2);
      assert(
        !(await page.evaluate(() => JSON.parse(sessionStorage.tracks))).some(
          (track) => track.id.includes("temptrack"),
        ),
      );
      assert(
        !(await page.evaluate(() => window.__calls)).some(
          (call) =>
            call.cmd === "save_online_track" &&
            call.args.track.id.includes("temptrack"),
        ),
      );
      await page.reload();
      await page
        .locator(".now-playing strong")
        .filter({ hasText: "Temporary song" })
        .waitFor();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      assert.equal(
        await page
          .locator(".track-row")
          .filter({ hasText: "Temporary" })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Next track", exact: true })
        .click();
      await page
        .locator(".now-playing strong")
        .filter({ hasText: "Temporary other" })
        .waitFor();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    },
  );
  await check(
    "now-playing Save is explicit, persists across restart, and never downloads audio",
    async () => {
      const controls = page.locator(".now-playing");
      await page.waitForTimeout(400);
      assert.equal(
        await controls
          .getByRole("button", { name: "Favorite current track", exact: true })
          .count(),
        0,
      );
      const before = await page.evaluate(() => ({
        queue: JSON.parse(sessionStorage.session).queue,
        downloads: window.__calls.filter(
          (call) => call.cmd === "download_track",
        ).length,
      }));
      await controls.getByRole("button", { name: "Save", exact: true }).click();
      await controls
        .getByRole("button", { name: "Favorite current track", exact: true })
        .waitFor();
      assert.equal(
        await controls
          .getByRole("button", { name: "Save", exact: true })
          .count(),
        0,
      );
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({
        queue: JSON.parse(sessionStorage.session).queue,
        downloads: window.__calls.filter(
          (call) => call.cmd === "download_track",
        ).length,
        tracks: JSON.parse(sessionStorage.tracks),
      }));
      assert.deepEqual(after.queue, before.queue);
      assert.equal(after.downloads, before.downloads);
      assert(
        after.tracks.some(
          (track) => track.id === "youtube:temptrack02" && !track.offline,
        ),
      );
      assert(!after.tracks.some((track) => track.id === "youtube:temptrack01"));
      await page.reload();
      await page
        .getByRole("button", { name: "Open Saved online", exact: true })
        .click();
      await page
        .locator(".track-row")
        .filter({ hasText: "Temporary other" })
        .waitFor();
      assert.equal(
        await page
          .locator(".track-row")
          .filter({ hasText: "Temporary song" })
          .count(),
        0,
      );
    },
  );
  await check(
    "Save to playlist promotes only the chosen track; cancel does not save or download",
    async () => {
      await page.getByRole("button", { name: "Discover", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search YouTube", exact: true })
        .fill("Temporary song");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      const result = page
        .locator(".track-row")
        .filter({ hasText: "Fixture Artist - Temporary song" });
      await result.locator(".track-play").click();
      await page
        .locator(".now-playing strong")
        .filter({ hasText: "Temporary song" })
        .waitFor();
      const menu = page.locator(".current-track-menu");
      await menu.locator("summary").click();
      await menu
        .getByRole("button", { name: "Save to playlist", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      assert(
        !(await page.evaluate(() => JSON.parse(sessionStorage.tracks))).some(
          (t) => t.id === "youtube:temptrack01",
        ),
      );
      await menu
        .getByRole("button", { name: "Save to playlist", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "New playlist name", exact: true })
        .fill("Road trip");
      await page
        .getByRole("button", { name: "Create and save", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForTimeout(400);
      const saved = await page.evaluate(() => ({
        tracks: JSON.parse(sessionStorage.tracks),
        session: JSON.parse(sessionStorage.session),
        calls: window.__calls,
      }));
      assert(
        saved.tracks.some((t) => t.id === "youtube:temptrack01" && !t.offline),
      );
      assert.deepEqual(
        saved.session.playlists
          .find((p) => p.name === "Road trip")
          .items.map((i) => i.trackId),
        ["youtube:temptrack01"],
      );
      assert(!saved.calls.some((call) => call.cmd === "download_track"));
      await menu.locator("summary").click();
    },
  );
  await check(
    "explicit YouTube Download persists offline audio routing across restart and copy deletion retains the playlist",
    async () => {
      await page
        .getByRole("button", {
          name: "Download current track for offline",
          exact: true,
        })
        .click();
      await page.waitForFunction(
        () =>
          JSON.parse(sessionStorage.tracks).find(
            (t) => t.id === "youtube:temptrack01",
          )?.offline,
      );
      await page.waitForTimeout(400);
      await page.reload();
      await page
        .locator(".now-playing strong")
        .filter({ hasText: "Temporary song" })
        .waitFor();
      await page.waitForTimeout(300);
      let calls = await page.evaluate(() => window.__calls);
      assert(
        calls.some(
          (call) =>
            call.cmd === "media_path" && call.args.id === "youtube:temptrack01",
        ),
      );
      assert(!calls.some((call) => call.cmd === "ytdlp_get_stream"));
      await page
        .getByRole("navigation", { name: "Playlists", exact: true })
        .getByRole("button", { name: /^Road trip/ })
        .click();
      await page.locator(".current-track-menu summary").click();
      await page.screenshot({
        path: path.resolve("test-results/youtube-offline-actions.png"),
      });
      await page
        .locator(".current-track-menu")
        .getByRole("button", { name: "Delete offline copy", exact: true })
        .click();
      await page.getByRole("dialog").getByRole("textbox").fill("DELETE");
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page.waitForFunction(
        () =>
          !JSON.parse(sessionStorage.tracks).find(
            (t) => t.id === "youtube:temptrack01",
          )?.offline,
      );
      const state = await page.evaluate(() => ({
        tracks: JSON.parse(sessionStorage.tracks),
        session: JSON.parse(sessionStorage.session),
      }));
      assert(state.tracks.some((t) => t.id === "youtube:temptrack01"));
      assert.equal(
        state.session.playlists.find((p) => p.name === "Road trip").items
          .length,
        1,
      );
    },
  );
  await check("no uncaught renderer exceptions", async () =>
    assert.deepEqual(errors, []),
  );
  mkdirSync("test-results", { recursive: true });
  await page.screenshot({
    path: path.resolve("test-results/phase4-lyrics.png"),
  });
  writeFileSync(
    "test-results/phase4-ui-report.json",
    JSON.stringify(
      {
        passed: true,
        checks,
        coverage: "Frontend with deterministic bridge; no native UI coverage",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
