import { useState } from "react";
import { library } from "../adapters/native";
import type { Track } from "../domain/types";
import { Artwork } from "./Artwork";

export function CommonsDiscovery({
  save,
  download,
  queue,
  playlist,
  pending,
}: {
  save: (track: Track, play: boolean) => void;
  download: (track: Track) => void;
  queue: (track: Track, next: boolean) => void;
  playlist: (track: Track) => void;
  pending: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
          setLoading(true);
          setError("");
          void library
            .searchCommons(query)
            .then(setResults)
            .catch((error) => setError(String(error)))
            .finally(() => setLoading(false));
        }}
      >
        <label className="search">
          <input
            aria-label="Search open music"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
              <p dir="auto">{track.artist}</p>
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
