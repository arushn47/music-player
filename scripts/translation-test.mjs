// Explicit live verification only. Never prints or persists the configured key.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

const env = {
  ...(existsSync(".env") ? parse(readFileSync(".env")) : {}),
  ...process.env,
};
if (!env.GEMINI_API_KEY?.trim()) {
  console.error(
    "Configure GEMINI_API_KEY in .env before running this explicit live test.",
  );
  process.exit(1);
}
env.CARGO_HOME = path.resolve(".tools/cargo");
env.RUSTUP_TOOLCHAIN ||= "stable";
if (!env.RUSTUP_HOME && existsSync("D:/Rust/rustup/toolchains"))
  env.RUSTUP_HOME = "D:/Rust/rustup";
const cargo = existsSync("D:/Rust/cargo/bin/cargo.exe")
  ? "D:/Rust/cargo/bin/cargo.exe"
  : "cargo";
const result = spawnSync(
  cargo,
  [
    "test",
    "--manifest-path",
    "src-tauri/Cargo.toml",
    "--offline",
    "--lib",
    "translation::tests::live_gemini_translation",
    "--",
    "--ignored",
    "--exact",
  ],
  { env, stdio: "inherit", windowsHide: true },
);
if (result.error)
  console.error("Could not start the configured Rust test runner.");
process.exit(result.status ?? 1);
