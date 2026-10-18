// Original synthetic audio and original lyric text. No external music is bundled.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
const root = path.resolve(".test-data/fixtures");
mkdirSync(root, { recursive: true });
function wav(name, seconds, hz) {
  const rate = 44100,
    count = rate * seconds,
    bytes = Buffer.alloc(44 + count * 2);
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / rate,
      fade = Math.min(1, t / 0.08, (seconds - t) / 0.1);
    bytes.writeInt16LE(
      Math.round(Math.sin(2 * Math.PI * hz * t) * 0.12 * 32767 * fade),
      44 + i * 2,
    );
  }
  writeFileSync(path.join(root, name), bytes);
}
wav("Lumaire - Morning light.wav", 36, 330);
wav("Lumaire - Quiet orbit.wav", 8, 440);
// A small original raster fixture, embedded by the test encoder below.
function chunk(kind, bytes) {
  const label = Buffer.from(kind),
    input = Buffer.concat([label, bytes]);
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, input, checksum]);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(32);
header.writeUInt32BE(32, 4);
header[8] = 8;
header[9] = 2;
const pixels = Buffer.alloc(32 * 97);
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++)
    pixels.set([120 + x * 3, 130 + y * 3, 90], y * 97 + 1 + x * 3);
writeFileSync(
  path.join(root, "artwork.png"),
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
// Use an already installed encoder for test fixtures only; it is never bundled or needed by the player.
for (const [extension, args] of [
  ["mp3", ["-c:a", "libmp3lame", "-b:a", "128k"]],
  ["flac", ["-c:a", "flac"]],
]) {
  const converted = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.join(root, "Lumaire - Morning light.wav"),
      "-i",
      path.join(root, "artwork.png"),
      "-map",
      "0:a",
      "-map",
      "1:v",
      "-c:v",
      "copy",
      "-disposition:v:0",
      "attached_pic",
      ...args,
      path.join(root, `Lumaire - Codec check.${extension}`),
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (converted.status !== 0)
    console.log(
      `${extension.toUpperCase()} fixture skipped: no working existing ffmpeg encoder.`,
    );
}
writeFileSync(
  path.join(root, "Morning light.lrc"),
  "[ti:Morning light]\n[by:Lumaire original test fixture]\n[00:00.00]காலை ஒளி\n[00:04.00]மெல்ல வரும்\n[00:08.00]புதிய நாள்\n[00:12.00]இங்கே தொடங்கும்\n[00:20.00]ஒளியுடன் நடப்போம்\n[00:30.00]அமைதியில் கேட்போம்\n",
);
writeFileSync(
  path.join(root, "Morning light.latin.txt"),
  "Kaalai oli\nMella varum\nPuthiya naal\nInge thodangum\nOliyudan nadappom\nAmaithiyil ketpom\n",
);
writeFileSync(
  path.join(root, "Morning light.english.txt"),
  "Morning light\nArrives softly\nA new day\nBegins here\nLet us walk with light\nLet us listen in quiet\n",
);
console.log(`Created original synthetic fixtures in ${root}`);
