import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { SupportSection } from "./SupportSection";

describe("Support", () => {
  it("offers real project and social links without invented votes or enabled payments", () => {
    const html = renderToStaticMarkup(<SupportSection />);
    expect(html).toContain("Star on GitHub");
    expect(html).toContain('href="https://github.com/arushn47/music-player/stargazers"');
    expect(html).toContain('href="https://github.com/arushn47/music-player/issues"');
    expect(html).toContain('href="https://github.com/arushn47"');
    expect(html).toContain('href="https://www.instagram.com/_.arush.menon._/"');
    expect(html).toContain('href="https://www.linkedin.com/in/arushn47"');
    expect(html).toContain('href="https://arush.vercel.app/"');
    expect(html).not.toContain("Contribute");
    expect(html).not.toContain("Leave a tip");
    expect(html).toContain("doesn&#x27;t track support clicks");
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(7);
  });
  it("scopes external opening to the main window and public project pages", () => {
    const capability = JSON.parse(readFileSync("src-tauri/capabilities/support.json", "utf8"));
    expect(capability.windows).toEqual(["main"]);
    expect(capability.permissions).toHaveLength(1);
    expect(capability.permissions[0].identifier).toBe("opener:allow-open-url");
    const urls = capability.permissions[0].allow.map((entry: { url: string }) => entry.url);
    expect(urls).toEqual(["https://github.com/arushn47", "https://github.com/arushn47/music-player", "https://github.com/arushn47/music-player/*", "https://www.instagram.com/_.arush.menon._/", "https://www.linkedin.com/in/arushn47", "https://arush.vercel.app/"]);
    const html = renderToStaticMarkup(<SupportSection />);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) expect(urls.some((url: string) => url.endsWith("*") ? href.startsWith(url.slice(0, -1)) : href === url)).toBe(true);
  });
});
