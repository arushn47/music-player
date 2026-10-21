import { afterAll, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UpdaterCard } from "./UpdaterCard";
const state=vi.hoisted(()=>({ stage:"available",currentVersion:"1.0.4",version:"1.0.5",notes:"- Better lyrics\n- Playback fixes\n<script>unsafe</script>",installedRelease:{version:"1.0.4",notes:"Previous changes"} }));
const platform=vi.hoisted(()=>({android:false}));
vi.mock("../../adapters/updater",()=>({getUpdateState:()=>state,subscribeToUpdates:()=>()=>{},supportsWindowsUpdates:()=>!platform.android,supportsAndroidUpdates:()=>platform.android,checkForUpdates:vi.fn(),downloadUpdate:vi.fn(),restartAndUpdate:vi.fn()}));
afterAll(()=>vi.unstubAllGlobals());
it("shows release notes before download and keeps installed notes available, rendering provider text safely",()=>{
 const html=renderToStaticMarkup(<UpdaterCard />);
 expect(html.indexOf("Better lyrics")).toBeLessThan(html.indexOf("Download update"));
 expect(html).toContain("Previous changes");expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");
});
it("describes Android in-place APK updates without claiming a Windows-style installer",()=>{
 platform.android=true;const html=renderToStaticMarkup(<UpdaterCard />);platform.android=false;
 expect(html).toContain("Do not uninstall first");expect(html).toContain("signing certificate");expect(html).toContain("Releases &amp; APK downloads");expect(html).not.toContain("Restart &amp; Update");
});

it("formats headings, emphasis and lists without showing Markdown markers",()=>{
 const original=state.notes;
 state.notes="# Lumaire v1.0.5\n\n## Your music\n\n- **Better lyrics**\n- Playback fixes";
 const html=renderToStaticMarkup(<UpdaterCard />);state.notes=original;
 expect(html).toContain('<h5>Lumaire v1.0.5</h5>');
 expect(html).toContain('<strong>Better lyrics</strong>');
 expect(html).toContain('<ul><li>');expect(html).not.toContain('## ');expect(html).not.toContain('**');
});
