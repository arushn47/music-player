import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ACCENT,
  applyTheme,
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

  it("ensures light mode accent text is always pure white for high contrast on darkened accents", () => {
    for (const colour of [DEFAULT_ACCENT, "#4F96FF", "#A855F7", "#FB7185", "#F59E0B"]) {
      const tokens = createAccentTokens(colour, "light");
      expect(tokens.accentText).toBe("#FFFFFF");
    }
  });

  it("applies theme custom properties including --accent-glow to the root element", () => {
    const properties = new Map<string, string>();
    const fakeRoot = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: "",
        setProperty: (key: string, val: string) => properties.set(key, val),
        getPropertyValue: (key: string) => properties.get(key) ?? "",
      },
    };
    vi.stubGlobal("document", {
      documentElement: fakeRoot,
      querySelector: () => null,
    });
    try {
      applyTheme({ themeMode: "dark", accentColor: "#F59E0B" });
      expect(fakeRoot.style.getPropertyValue("--accent")).toBe("#F59E0B");
      expect(fakeRoot.style.getPropertyValue("--accent-glow")).toContain("0.35");
      expect(fakeRoot.dataset.theme).toBe("dark");

      applyTheme({ themeMode: "light", accentColor: "#F59E0B" });
      expect(fakeRoot.style.getPropertyValue("--accent-glow")).toContain("0.25");
      expect(fakeRoot.dataset.theme).toBe("light");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
