import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Banners } from "./Banners";

vi.mock("react-dom", () => ({
  createPortal: (children: unknown) => children,
}));

vi.mock("react", async importOriginal => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: (init: unknown) => [typeof init === "function" ? (init as () => unknown)() : init || { nodeType: 1 }, vi.fn()],
  };
});

describe("Banners notification actions", () => {
  it("renders action button in toast when messageAction is supplied", () => {
    const html = renderToStaticMarkup(
      <Banners
        message="Added to Telugu"
        messageAction={{ label: "Change", onClick: () => {} }}
        onDismissError={() => {}}
        onDismissMessage={() => {}}
      />
    );
    expect(html).toContain("Added to Telugu");
    expect(html).toContain("toast-action");
    expect(html).toContain("Change");
  });

  it("does not render action button when messageAction is omitted", () => {
    const html = renderToStaticMarkup(
      <Banners
        message="Saved to library"
        onDismissError={() => {}}
        onDismissMessage={() => {}}
      />
    );
    expect(html).toContain("Saved to library");
    expect(html).not.toContain("toast-action");
  });
});
