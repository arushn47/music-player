import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TopBar } from "./TopBar";

it("renders desktop topbar with small import button, connect button, and queue toggle", () => {
  const onToggleSidebar = vi.fn();
  const onToggleQueue = vi.fn();
  const onOpenCollectionHub = vi.fn();

  const html = renderToStaticMarkup(
    <TopBar
      view="discover"
      heading="Discover new music"
      sidebarCollapsed={false}
      queueOpen={false}
      onToggleSidebar={onToggleSidebar}
      onToggleQueue={onToggleQueue}
      onOpenCollectionHub={onOpenCollectionHub}
    />
  );

  expect(html).toContain('class="topbar-import-btn"');
  expect(html).toContain('Import');
  expect(html).toContain('class="topbar-connect-btn"');
  expect(html).toContain('Connect');
  expect(html).toContain('aria-label="Import playlists &amp; connect devices"');
  expect(html).toContain('aria-label="Connect devices &amp; listening together"');
  expect(html).toContain('aria-label="Show queue"');
});

it("omits import and connect buttons when onOpenCollectionHub callback is not provided", () => {
  const html = renderToStaticMarkup(
    <TopBar
      view="discover"
      heading="Discover new music"
      sidebarCollapsed={false}
      queueOpen={false}
      onToggleSidebar={vi.fn()}
      onToggleQueue={vi.fn()}
    />
  );

  expect(html).not.toContain('class="topbar-import-btn"');
  expect(html).not.toContain('class="topbar-connect-btn"');
});

it("renders sharing on Wi-Fi indicator when nearbySharing is true", () => {
  const onOpenCollectionHub = vi.fn();
  const html = renderToStaticMarkup(
    <TopBar
      view="discover"
      heading="Discover new music"
      sidebarCollapsed={false}
      queueOpen={false}
      onToggleSidebar={vi.fn()}
      onToggleQueue={vi.fn()}
      onOpenCollectionHub={onOpenCollectionHub}
      nearbySharing={true}
    />
  );

  expect(html).toContain('class="topbar-sharing-pill sharing"');
  expect(html).toContain('Sharing on Wi-Fi');
});


it("puts software updates immediately after Import only when an update is available", () => {
  const html=renderToStaticMarkup(<TopBar view="discover" heading="Discover" sidebarCollapsed={false} queueOpen={false} onToggleSidebar={()=>{}} onToggleQueue={()=>{}} onOpenImport={()=>{}} onOpenUpdates={()=>{}} onOpenConnect={()=>{}} updateLabel="Update v1.0.5" />);
  expect(html).toContain('aria-label="Software updates and release notes"');
  expect(html).toContain('class="topbar-import-btn topbar-update-btn"');
  expect(html.indexOf('>Import</span>')).toBeLessThan(html.indexOf('>Update v1.0.5</span>'));
  expect(html.indexOf('>Update v1.0.5</span>')).toBeLessThan(html.indexOf('>Connect</span>'));
});

it('hides the update shortcut without a pending update label', () => {
  const html = renderToStaticMarkup(<TopBar view="discover" heading="Discover" sidebarCollapsed={false} queueOpen={false} onToggleSidebar={()=>{}} onToggleQueue={()=>{}} onOpenUpdates={()=>{}} />);
  expect(html).not.toContain('Software updates and release notes');
});
