import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const npm = Object.entries(lock.packages)
  .filter(([key]) => key)
  .map(([key, p]) => ({
    name: key.slice(key.lastIndexOf("node_modules/") + 13),
    version: p.version,
    license: p.license ?? "See package LICENSE",
    integrity: p.integrity ?? null,
    dev: p.dev === true,
  }));
let text =
  "# Lumaire third-party software inventory\n\nGenerated from the resolved lockfiles. This inventory does not grant rights to audio, artwork or lyrics. No Nuclear, TuneScript or external media code/assets are included. The original application licensing decision remains with the project owner.\n\n";
text +=
  "## JavaScript dependencies\n\n| Package | Version | Licence | Build/test only |\n|---|---|---|---|\n" +
  npm
    .map(
      (p) =>
        `| ${p.name} | ${p.version} | ${p.license} | ${p.dev ? "Yes" : "No"} |`,
    )
    .join("\n") +
  "\n";
const licenses = [];
for (const [key, p] of Object.entries(lock.packages)) {
  if (!key) continue;
  let files = [];
  try {
    files = readdirSync(key).filter((f) =>
      /^(license|licence|copying|notice)(\.|$)/i.test(f),
    );
  } catch {}
  for (const f of files) {
    try {
      licenses.push(
        `\n\n===== ${key} ${p.version} / ${f} =====\n\n${readFileSync(path.join(key, f), "utf8")}`,
      );
    } catch {}
  }
}
writeFileSync("THIRD_PARTY_NOTICES.md", text);
writeFileSync("THIRD_PARTY_LICENSES.txt", licenses.join(""));
writeFileSync("test-results/npm-inventory.json", JSON.stringify(npm, null, 2));
console.log(
  `Recorded ${npm.length} npm packages and ${licenses.length} licence/notice files.`,
);
