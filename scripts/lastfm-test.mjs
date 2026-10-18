// Load only the requested key into the Rust test process. Never print it.
import { parse } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const local = existsSync('.env') ? parse(readFileSync('.env')) : {};
const key = process.env.LASTFM_API_KEY || local.LASTFM_API_KEY;
if (!key?.trim()) throw Error('Configure LASTFM_API_KEY in the private .env file.');
const env = { ...process.env, LASTFM_API_KEY: key.trim(), CARGO_HOME: path.resolve('.tools/cargo'), RUSTUP_HOME: process.env.RUSTUP_HOME || 'D:/Rust/rustup' };
const cargo = existsSync('D:/Rust/cargo/bin/cargo.exe') ? 'D:/Rust/cargo/bin/cargo.exe' : 'cargo';
const result = spawnSync(cargo, ['+stable', 'test', '--manifest-path', 'src-tauri/Cargo.toml', '--lib', 'live_lastfm_regional_coverage', '--', '--ignored', '--nocapture'], { env, stdio:'inherit', windowsHide:true });
process.exit(result.status ?? 1);
