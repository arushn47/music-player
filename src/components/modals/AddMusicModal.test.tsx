import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddMusicModal } from "./AddMusicModal";
import { defaults, type Playlist, type Session } from "../../domain/types";

const dummyPlaylist: Playlist = {
  id: "mix-1",
  name: "MIX",
  items: [],
};

const dummySession: Session = defaults();

describe("AddMusicModal component", () => {
  it("renders online search as primary default and provides local import as secondary option", () => {
    const html = renderToStaticMarkup(
      <AddMusicModal
        playlist={dummyPlaylist}
        tracks={[]}
        session={dummySession}
        busy={false}
        onClose={() => {}}
        onAddTrack={() => {}}
        onImportLocal={() => {}}
      />
    );

    expect(html).toContain("Add to playlist");
    expect(html).toContain("Adding online music to “MIX”");
    expect(html).toContain('placeholder="Search songs, artists, albums online…"');
    expect(html).toContain("Discover music online");
    expect(html).toContain("Import local files");
    expect(html).toContain("Have local audio files?");
  });
});
