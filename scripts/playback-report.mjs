import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = path.resolve("test-results/playback");
const current = JSON.parse(readFileSync(path.join(root, "matrix.json"), "utf8"));
const original = JSON.parse(readFileSync(path.join(root, "matrix-full-before-final-recheck.json"), "utf8"));
const checks = new Map(original.checks.map(check => [check.name, { ...check, evidence: "matrix-full-before-final-recheck.json" }]));
current.checks.forEach(check => checks.set(check.name, { ...check, evidence: "matrix.json" }));
const report = { ...current, checks: [...checks.values()], events: [...original.events, ...current.events], sourceReports: ["matrix-full-before-final-recheck.json", "matrix.json"], measurementNote: "The initial queue check read a second Vite module instance after hot updates; the supplemental check measures the UI-owned playback clock. Raw runs are preserved." };
const file = path.join(root, "combined.json");
const summary = { passed: report.checks.filter(c => c.passed).length, failed: report.checks.filter(c => !c.passed).length, providers: {}, stages: {}, rejections: {} };
for (const check of report.checks) {
  if (check.catalogId) {
    const provider = check.catalogId.split(":")[0];
    summary.providers[provider] ||= { played: 0, failed: 0 };
    summary.providers[provider][check.passed ? "played" : "failed"]++;
    const events = report.events.filter(e => e.trackId === check.catalogId || e.trackId === `youtube:${check.sourceId}`);
    check.stageCounts = {};
    events.forEach(event => { check.stageCounts[event.stage] = (check.stageCounts[event.stage] || 0) + 1; });
  }
}
for (const event of report.events) {
  summary.stages[event.stage] = (summary.stages[event.stage] || 0) + 1;
  if (event.stage === "rejected") summary.rejections[event.reason] = (summary.rejections[event.reason] || 0) + 1;
}
report.summary = summary;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
