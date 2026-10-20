import { library } from "../../adapters/native";
import type { Track } from "../../domain/types";
import { Artwork } from "../common/Artwork";
import { ArtistLinks } from "../common/ArtistLinks";

export interface CommonsDiscoveryState {
  query: string;
  results: Track[];
  loading: boolean;
  error: string;
}

export function CommonsDiscovery({
  onNavigateArtist,
  save,
  download,
  queue,
  playlist,
  pending,
  state,
  onStateChange,
}: {
  onNavigateArtist?: (id: string) => void;
  save: (track: Track, play: boolean) => void;
  download: (track: Track) => void;
  queue: (track: Track, next: boolean) => void;
  playlist: (track: Track) => void;
  pending: Record<string, string>;
  state: CommonsDiscoveryState;
  onStateChange: (
    update: (current: CommonsDiscoveryState) => CommonsDiscoveryState,
  ) => void;
}) {
  const { query, results, loading, error } = state;
  return (
    <section className="settings-card commons-discovery">
      <h2>Open music · Wikimedia Commons</h2>
      <p>
        Individually licensed audio. Save a source or download an offline copy
        with its credits.
      </p>
      <form
        className="button-row"
        onSubmit={(event) => {
          event.preventDefault();
          onStateChange((current) => ({
            ...current,
            loading: true,
            error: "",
          }));
          void library
            .searchCommons(query)
            .then((nextResults) =>
              onStateChange((current) => ({
                ...current,
                results: nextResults,
              })),
            )
            .catch((nextError) =>
              onStateChange((current) => ({
                ...current,
                error: String(nextError),
              })),
            )
            .finally(() =>
              onStateChange((current) => ({
                ...current,
                loading: false,
              })),
            );
        }}
      >
        <label className="search">
          <input
            aria-label="Search open music"
            value={query}
            onChange={(event) =>
              onStateChange((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder="Search licensed audio"
            minLength={2}
            required
          />
        </label>
        <button className="subtle" disabled={loading}>
          {loading ? "Searching…" : "Search open music"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="open-music-results">
        {results.map((track) => (
          <article key={track.id} className="open-music-result">
            <Artwork url={track.artworkUrl} />
            <div>
              <strong dir="auto">{track.title}</strong>
              <p dir="auto"><ArtistLinks artistString={track.artist} onNavigateArtist={onNavigateArtist} /></p>
              <small>
                {track.source?.attribution} ·{" "}
                <a
                  href={track.source?.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {track.source?.license}
                </a>
              </small>
            </div>
            <div className="button-row">
              <button onClick={() => save(track, true)}>Play</button>
              <button onClick={() => save(track, false)}>Save</button>
              <button onClick={() => playlist(track)}>Save to playlist</button>
              <button onClick={() => queue(track, true)}>Play next</button>
              <button onClick={() => queue(track, false)}>Add to queue</button>
              <button
                disabled={pending[track.id] === "downloading"}
                onClick={() => download(track)}
              >
                {pending[track.id] === "downloading"
                  ? "Downloading…"
                  : "Download"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
