import { describe, expect, it } from "vitest";
import {
  DEFAULT_ACCENT,
  contrastRatio,
  createAccentTokens,
  normalizeHexColor,
} from "./theme";

describe("theme colour handling", () => {
  it("normalizes complete and shorthand HEX values", () => {
    expect(normalizeHexColor("c4dca3")).toBe(DEFAULT_ACCENT);
    expect(normalizeHexColor("#abc")).toBe("#AABBCC");
    expect(normalizeHexColor("not-a-colour")).toBeNull();
  });

  it.each([
    ["dark", "#2A2A2E"],
    ["light", "#EBEBF0"],
  ] as const)(
    "keeps custom accents readable in %s mode",
    (mode, background) => {
      for (const colour of ["#111111", "#FFFFFF", "#FFD400", "#7845A7"]) {
        const tokens = createAccentTokens(colour, mode);
        expect(contrastRatio(tokens.accent, background)).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(tokens.source).toBe(colour);
      }
    },
  );
});
