import { expect, it } from "vitest";
import { downloadProgressText } from "./downloads";

it("shows real transfer progress and speed without inventing unknown totals", () => {
  const value = { stage: "transferring" as const, received: 1048576, total: 2097152, bytesPerSecond: 524288 };
  expect(downloadProgressText(value)).toBe("50% · 1.0 MB of 2.0 MB · 0.5 MB/s");
  expect(downloadProgressText({ ...value, total: null })).toBe("1.0 MB · 0.5 MB/s");
  expect(downloadProgressText({ ...value, stage: "resolving" })).toBe("Preparing audio download");
  expect(downloadProgressText({ ...value, stage: "validating" })).toBe("Checking downloaded audio");
});
