// Use an existing Rust installation without changing the system PATH or rustup default.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const env = { ...process.env };
const localRust = path.resolve(".tools/rustup");
if (existsSync(path.join(localRust, "toolchains"))) env.RUSTUP_HOME = localRust;
else if (!env.RUSTUP_HOME && existsSync("D:/Rust/rustup/toolchains"))
  env.RUSTUP_HOME = "D:/Rust/rustup";
const cargoBin = existsSync("D:/Rust/cargo/bin/cargo.exe")
  ? "D:/Rust/cargo/bin"
  : path.join(env.USERPROFILE || "", ".cargo", "bin");
env.CARGO_HOME = path.resolve(".tools/cargo");
const inheritedPath = process.env.PATH || process.env.Path || "";
// Windows environment keys are case-insensitive; a plain JS spread is not.
for (const key of Object.keys(env))
  if (key.toLowerCase() === "path") delete env[key];
env.PATH = `${cargoBin}${path.delimiter}${inheritedPath}`;
// Explicit toolchain avoids modifying the user's default toolchain.
env.RUSTUP_TOOLCHAIN = env.RUSTUP_TOOLCHAIN || "stable";
const cli = path.resolve("node_modules/@tauri-apps/cli/tauri.js");
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});
process.exit(result.status ?? 1);
