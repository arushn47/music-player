import { describe, expect, it, vi } from "vitest";
import { centerLyricLine } from "./scroll-lyric";

describe("lyric scroll containment", () => {
  it.each([".expanded-lyrics", "#main"])("centers only the owning %s pane in either direction", () => {
    const scrollTo = vi.fn();
    const pane = { scrollTop: 500, clientHeight: 600, getBoundingClientRect: () => ({ top: 100 }), scrollTo };
    const closest = vi.fn(() => pane);
    let top = 700;
    const line = { closest, getBoundingClientRect: () => ({ top, height: 40 }) } as unknown as HTMLElement;
    centerLyricLine(line, "smooth");
    expect(closest).toHaveBeenCalledWith(".expanded-lyrics, #main");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 820, behavior: "smooth" });
    top = 0;
    centerLyricLine(line, "instant");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 120, behavior: "instant" });
    pane.scrollTop = 0;
    centerLyricLine(line, "instant");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
  });
  it("does nothing for an absent or detached lyric", () => {
    centerLyricLine(null, "instant");
    centerLyricLine({ closest: () => null } as unknown as HTMLElement, "instant");
  });
});
