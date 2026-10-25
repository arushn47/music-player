import type { Preferences } from "./domain/types";

export type ThemePreference = Pick<Preferences, "themeMode" | "accentColor">;

export const THEME_STORAGE_KEY = "lumaire:appearance:v1";
export const DEFAULT_ACCENT = "#A78BFA";

export const ACCENT_PALETTES = [
  {
    id: "sonora",
    name: "Sonora Lavender",
    description: "Muted lavender with deep violet audio glow.",
    color: DEFAULT_ACCENT,
    swatches: ["#EDE9FE", "#A78BFA", "#7C3AED", "#2E1065"],
  },
  {
    id: "lumaire",
    name: "Lumaire Sage",
    description: "The original, calm olive glow.",
    color: "#C4DCA3",
    swatches: ["#EDF2E8", "#C4DCA3", "#6F865B", "#263020"],
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "Crisp Apple-inspired ocean blue.",
    color: "#4F96FF",
    swatches: ["#E6F0FF", "#4F96FF", "#2563EB", "#1E3A8A"],
  },
  {
    id: "violet",
    name: "Electric Violet",
    description: "Dusky neon violet for late-night sessions.",
    color: "#A855F7",
    swatches: ["#F3E8FF", "#A855F7", "#7E22CE", "#3B0764"],
  },
  {
    id: "rose",
    name: "Sunset Rose",
    description: "Vibrant coral rose with warm audio energy.",
    color: "#FB7185",
    swatches: ["#FFE4E6", "#FB7185", "#E11D48", "#881337"],
  },
  {
    id: "amber",
    name: "Amber Glow",
    description: "Warm golden honey with a vintage vinyl feel.",
    color: "#F59E0B",
    swatches: ["#FEF3C7", "#F59E0B", "#D97706", "#78350F"],
  },
] as const;

export const RANDOM_ACCENT_CANDIDATES = [
  "#38BDF8", // Sky Blue
  "#2DD4BF", // Aurora Teal
  "#10B981", // Emerald
  "#4ADE80", // Neon Mint
  "#A3E635", // Lime
  "#FACC15", // Electric Gold
  "#FB923C", // Tangerine
  "#F43F5E", // Crimson Rose
  "#EC4899", // Magenta
  "#D946EF", // Orchid
  "#8B5CF6", // Lavender
  "#6366F1", // Indigo
  "#06B6D4", // Cyan
  "#E879F9", // Pink
  "#F472B6", // Bubblegum
  "#FBBF24", // Honey Amber
];

export function getRandomAccent(current?: string): string {
  const currentUpper = current?.toUpperCase();
  const pool = RANDOM_ACCENT_CANDIDATES.filter(
    (c) => c.toUpperCase() !== currentUpper,
  );
  const choice = pool[Math.floor(Math.random() * pool.length)] ?? "#2DD4BF";
  return choice;
}

type Rgb = { r: number; g: number; b: number };

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const short = /^#?([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  return full ? `#${full[1].toUpperCase()}` : null;
}

const hexToRgb = (hex: string): Rgb => ({
  r: Number.parseInt(hex.slice(1, 3), 16),
  g: Number.parseInt(hex.slice(3, 5), 16),
  b: Number.parseInt(hex.slice(5, 7), 16),
});

const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

const mix = (from: Rgb, to: Rgb, amount: number): Rgb => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
});

const luminance = ({ r, g, b }: Rgb) => {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

export const contrastRatio = (a: string, b: string) => {
  const first = luminance(hexToRgb(a));
  const second = luminance(hexToRgb(b));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

export function createAccentTokens(color: string, mode: "dark" | "light") {
  const source = normalizeHexColor(color) ?? DEFAULT_ACCENT;
  // Use the least forgiving surface, including elevated cards and the sidebar.
  const background = mode === "dark" ? "#2A2A2E" : "#EBEBF0";
  const target =
    mode === "dark" ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  let accent = hexToRgb(source);
  let amount = 0;
  while (contrastRatio(toHex(accent), background) < 4.5 && amount < 0.8) {
    amount += 0.05;
    accent = mix(hexToRgb(source), target, amount);
  }

  const resolved = toHex(accent);
  const toward =
    mode === "dark" ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const away =
    mode === "dark" ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const resolvedRgb = hexToRgb(resolved);
  const whiteContrast = contrastRatio(resolved, "#FFFFFF");
  const blackContrast = contrastRatio(resolved, "#10130E");

  return {
    source,
    accent: resolved,
    accentHover: toHex(mix(resolvedRgb, toward, 0.14)),
    accentActive: toHex(mix(resolvedRgb, away, 0.12)),
    accentText:
      mode === "light"
        ? "#FFFFFF"
        : whiteContrast > blackContrast
          ? "#FFFFFF"
          : "#10130E",
    rgb: `${Math.round(resolvedRgb.r)}, ${Math.round(resolvedRgb.g)}, ${Math.round(resolvedRgb.b)}`,
  };
}

export function createThemeTokens(color: string, mode: "dark" | "light") {
  const accentTokens = createAccentTokens(color, mode);

  if (mode === "dark") {
    // Pure, refined Apple dark mode surfaces (neutral, high legibility)
    return {
      ...accentTokens,
      bg: "#121212",
      bgSidebar: "#0d0d0e",
      bgTransport: "rgba(20, 20, 22, 0.88)",
      bgQueue: "rgba(16, 16, 18, 0.92)",
      bgPanel: "rgba(30, 30, 34, 0.65)",
      bgPanelHover: "rgba(42, 42, 46, 0.8)",
      bgPopover: "rgba(28, 28, 30, 0.96)",
      bgDialog: "rgba(24, 24, 26, 0.98)",
    };
  } else {
    // Crisp Apple light mode surfaces (neutral, elegant)
    return {
      ...accentTokens,
      bg: "#f5f5f7",
      bgSidebar: "#ebebf0",
      bgTransport: "rgba(245, 245, 247, 0.92)",
      bgQueue: "rgba(242, 242, 247, 0.94)",
      bgPanel: "rgba(255, 255, 255, 0.85)",
      bgPanelHover: "rgba(255, 255, 255, 0.98)",
      bgPopover: "rgba(255, 255, 255, 0.98)",
      bgDialog: "#ffffff",
    };
  }
}

export function readStoredTheme(): ThemePreference {
  const fallback: ThemePreference = {
    themeMode: "dark",
    accentColor: DEFAULT_ACCENT,
  };
  try {
    const parsed = JSON.parse(
      localStorage.getItem(THEME_STORAGE_KEY) ?? "null",
    );
    if (!parsed || typeof parsed !== "object") return fallback;
    return {
      themeMode: parsed.themeMode === "light" ? "light" : "dark",
      accentColor: normalizeHexColor(parsed.accentColor) ?? DEFAULT_ACCENT,
    };
  } catch {
    return fallback;
  }
}

export function storeTheme(preference: ThemePreference) {
  try {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({
        themeMode: preference.themeMode === "light" ? "light" : "dark",
        accentColor:
          normalizeHexColor(preference.accentColor) ?? DEFAULT_ACCENT,
      }),
    );
  } catch {
    // SQLite remains authoritative when the webview store is unavailable.
  }
}

export function applyTheme(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mode = preference.themeMode === "light" ? "light" : "dark";
  const tokens = createThemeTokens(preference.accentColor, mode);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  root.style.setProperty("--accent-source", tokens.source);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-hover", tokens.accentHover);
  root.style.setProperty("--accent-active", tokens.accentActive);
  root.style.setProperty("--accent-text", tokens.accentText);
  root.style.setProperty("--accent-rgb", tokens.rgb);
  root.style.setProperty(
    "--accent-glow",
    `rgba(${tokens.rgb}, ${mode === "dark" ? "0.35" : "0.25"})`,
  );
  root.style.setProperty("--bg", tokens.bg);
  root.style.setProperty("--bg-sidebar", tokens.bgSidebar);
  root.style.setProperty("--bg-transport", tokens.bgTransport);
  root.style.setProperty("--bg-queue", tokens.bgQueue);
  root.style.setProperty("--bg-panel", tokens.bgPanel);
  root.style.setProperty("--bg-panel-hover", tokens.bgPanelHover);
  root.style.setProperty("--bg-popover", tokens.bgPopover);
  root.style.setProperty("--bg-dialog", tokens.bgDialog);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", tokens.bg);
}

export function initializeTheme() {
  applyTheme(readStoredTheme());
}
