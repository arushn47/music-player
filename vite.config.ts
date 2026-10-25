import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KUROMOJI_DICT_FILES, resolveKuromojiDictDir } from "lyric-romanizer/dict";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), {
    name: "offline-japanese-dictionary",
    generateBundle() {
      for (const file of KUROMOJI_DICT_FILES) this.emitFile({ type: "asset", fileName: `romanization/ja/${file}`, source: readFileSync(join(resolveKuromojiDictDir(), file)) });
    },
    configureServer(server) {
      server.middlewares.use("/romanization/ja", (request, response, next) => {
        const file = request.url?.split("?")[0].slice(1);
        if (!KUROMOJI_DICT_FILES.includes(file as typeof KUROMOJI_DICT_FILES[number])) { next(); return; }
        response.setHeader("Content-Type", "application/octet-stream");
        response.end(readFileSync(join(resolveKuromojiDictDir(), file!)));
      });
    },
  }],
  worker: { format: "es" },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: devHost ? "0.0.0.0" : "127.0.0.1",
    hmr: devHost
      ? {
          protocol: "ws",
          host: devHost,
          port: 1421,
        }
      : undefined,
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
});
