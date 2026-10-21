import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Link2,
  ListMusic,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { library, mobile, type CatalogTrack } from "../../adapters/native";
import { collections } from "../../adapters/collections";
import { certainMatch, parsePlaylist, importConflicts, playlistSource, type PlaylistImportOptions, type ImportRow } from "../../domain/playlist-import";
import type { Playlist, Track } from "../../domain/types";
import { catalogQueueTrack } from "../../domain/catalog-track";

interface Preview {
  row: ImportRow;
  candidates: CatalogTrack[];
  selected: string;
  direct?: Track;
  error?: string;
}

export function PlaylistImport({
  onImport,
  playlists,
}: {
  playlists: Playlist[];
  onImport: (name: string, tracks: Track[], options: PlaylistImportOptions) => Promise<void>;
}) {
  const [step, setStep] = useState<"input" | "matching" | "review">("input");
  const [text, setText] = useState("");
  const [name, setName] = useState("Imported playlist");
  const [preview, setPreview] = useState<Preview[]>([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [done, setDone] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const generation = useRef(0);
  const [source, setSource] = useState<string>();
  const [duplicate, setDuplicate] = useState<"merge" | "separate">();
  const conflicts = importConflicts(playlists, name, source);
  const sameSource = Boolean(source && conflicts.some(p => p.importSources?.includes(source)));
  const needsChoice = conflicts.length > 0 && !sameSource;

  useEffect(() => () => { generation.current++; }, []);

  async function startMatching() {
    setError("");
    setSource(undefined);
    setDuplicate(undefined);
    setWarning("");
    setPreview([]);
    setDone(0);
    setTotalRows(0);
    const token = ++generation.current;
    setStep("matching");

    let rows: (ImportRow & { track?: Track | null })[];
    try {
      if (link.trim()) {
        const result = await collections.readPlaylistLink(link.trim());
        if (token !== generation.current) return;
        setSource(playlistSource(link.trim()));
        rows = result.rows;
        if (result.name) setName(result.name.slice(0, 100));
        setWarning(result.warning);
      } else {
        rows = parsePlaylist(text);
      }
      if (!rows.length) throw Error("No public tracks found in playlist link or text.");
      setTotalRows(rows.length);
    } catch (e) {
      if (token === generation.current) {
        setError(String(e));
        setStep("input");
      }
      return;
    }

    const matchedEntries: Preview[] = [];
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    for (const row of rows) {
      let entry: Preview;
      try {
        if (row.track) {
          entry = { row, candidates: [], direct: row.track, selected: row.track.id };
        } else {
          const candidates = await library.searchCatalog(`${row.title} ${row.artist}`.slice(0, 200), 5);
          const certain = certainMatch(row, candidates);
          let selectedId = certain?.id || "";
          if (!selectedId && candidates.length > 0) {
            const baseTitle = norm(row.title.replace(/\s*[-–(].*$/i, ""));
            const rowArtists = row.artist.split(/[,;&]|\band\b/i).map(norm).filter(Boolean);
            for (const cand of candidates) {
              const candTitle = norm(cand.title.replace(/\s*[-–(].*$/i, ""));
              const candArtist = norm(cand.artist);
              const titleMatch = candTitle === baseTitle || norm(cand.title) === norm(row.title) || norm(row.title).includes(candTitle);
              const artistMatch = rowArtists.some((a) => candArtist.includes(a) || a.includes(candArtist));
              if (titleMatch && artistMatch) {
                selectedId = cand.id;
                break;
              }
            }
            if (!selectedId && candidates.length === 1) {
              selectedId = candidates[0].id;
            } else if (!selectedId) {
              const first = candidates[0];
              const firstTitle = norm(first.title.replace(/\s*[-–(].*$/i, ""));
              if (firstTitle === baseTitle || rowArtists.some((a) => norm(first.artist).includes(a))) {
                selectedId = first.id;
              }
            }
          }
          entry = { row, candidates, selected: selectedId };
        }
      } catch {
        entry = { row, candidates: [], selected: "", error: "Search failed; retry matching" };
      }
      if (token !== generation.current) return;
      matchedEntries.push(entry);
      setPreview([...matchedEntries]);
      setDone(matchedEntries.length);
    }

    if (token === generation.current) {
      setStep("review");
    }
  }

  const cancelMatching = () => {
    generation.current++;
    setStep("input");
  };

  const autoMatchAll = () => {
    setPreview((prev) =>
      prev.map((entry) => {
        if (!entry.selected && entry.candidates.length > 0) {
          return { ...entry, selected: entry.candidates[0].id };
        }
        return entry;
      })
    );
  };

  const selected = preview.flatMap((entry) =>
    entry.direct && entry.selected === entry.direct.id
      ? [entry.direct]
      : entry.candidates.filter((track) => track.id === entry.selected).map(catalogQueueTrack)
  );

  const tracks = [...new Map(selected.map((track) => [track.id, track])).values()];

  const unmatchedWithCandidates = preview.filter((e) => !e.selected && e.candidates.length > 0);

  const handleImport = async () => {
    if (importing || !tracks.length || !name.trim()) return;
    setImporting(true);
    try {
      await onImport(name.trim(), tracks, { source, duplicate });
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="collection-import">
      {/* STEP 1: Enter link / source */}
      {step === "input" && (
        <div className="hub-step-view">
          <div className="hub-hero">
            <h2 className="hub-title">Bring your playlists</h2>
            <p className="hub-subtitle">
              Transfer public playlists from streaming services directly into Lumaire.
            </p>
            <div className="hub-badges">
              <span className="hub-badge">YouTube Music</span>
              <span className="hub-badge">Spotify</span>
              <span className="hub-badge">Apple Music</span>
              <span className="hub-badge">M3U / CSV</span>
            </div>
          </div>

          <div className="hub-form">
            <div className="hub-field">
              <label htmlFor="hub-link-input" className="hub-label">
                Playlist link
              </label>
              <div className="hub-input-wrap">
                <Link2 size={16} className="hub-input-icon" />
                <input
                  id="hub-link-input"
                  className="hub-input"
                  type="url"
                  value={link}
                  maxLength={2000}
                  placeholder="https://music.youtube.com/playlist?list=… or Spotify / Apple Music"
                  onChange={(event) => setLink(event.target.value)}
                />
              </div>
              <span className="hub-input-hint">
                Public playlists only. YouTube engine required for YouTube tracks.
              </span>
            </div>

            <div className="hub-field">
              <label htmlFor="hub-name-input" className="hub-label">
                Playlist name
              </label>
              <div className="hub-input-wrap">
                <ListMusic size={16} className="hub-input-icon" />
                <input
                  id="hub-name-input"
                  className="hub-input"
                  value={name}
                  maxLength={100}
                  placeholder="Imported playlist"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>

            <details className="hub-details">
              <summary className="hub-details-summary">
                <FileText size={15} />
                <span>Import an existing playlist file or text export instead</span>
                <ChevronDown size={14} className="hub-details-chevron" />
              </summary>
              <div className="hub-details-content">
                {!mobile && (
                  <button
                    type="button"
                    className="hub-file-btn"
                    onClick={() =>
                      void collections
                        .readPlaylistFile()
                        .then((value) => {
                          if (value !== null) {
                            setLink("");
                            setText(value);
                          }
                        })
                        .catch((e) => setError(String(e)))
                    }
                  >
                    <Upload size={14} />
                    <span>Choose playlist file (.m3u, .csv)</span>
                  </button>
                )}
                <div className="hub-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="hub-textarea-input" className="hub-label" style={{ fontSize: "11px" }}>
                    Or paste playlist export (CSV / track list)
                  </label>
                  <textarea
                    id="hub-textarea-input"
                    className="hub-textarea"
                    rows={4}
                    maxLength={1_000_000}
                    value={text}
                    placeholder={"Track Name,Artist Name,Album Name\nSong,Artist,Album"}
                    onChange={(event) => {
                      setLink("");
                      setText(event.target.value);
                    }}
                  />
                </div>
              </div>
            </details>
          </div>

          {error && (
            <div className="hub-alert error" role="alert">
              <AlertCircle size={15} className="hub-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <div className="hub-footer">
            <button
              type="button"
              className="primary hub-primary-btn"
              disabled={!text.trim() && !link.trim()}
              onClick={() => void startMatching()}
            >
              <Sparkles size={15} />
              <span>Continue to Match</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Matching progress */}
      {step === "matching" && (
        <div className="hub-step-view hub-matching-container">
          <div className="hub-matching-box">
            <Loader2 size={38} className="spin hub-spinner" />
            <h3 className="hub-matching-title">
              {link.trim() && !totalRows ? "Reading playlist link…" : "Matching tracks…"}
            </h3>
            <p className="hub-matching-subtitle">
              {totalRows > 0
                ? `Checked ${done} of ${totalRows} tracks against catalog`
                : "Fetching public playlist entries from streaming service"}
            </p>
            {totalRows > 0 && (
              <div className="hub-progress-track">
                <div
                  className="hub-progress-bar"
                  style={{ width: `${Math.max(5, Math.round((done / totalRows) * 100))}%` }}
                />
              </div>
            )}
            <button
              type="button"
              className="subtle hub-cancel-btn"
              onClick={cancelMatching}
            >
              Cancel matching
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review matched tracks */}
      {step === "review" && (
        <div className="hub-step-view">
          <div className="hub-review-header">
            <button
              type="button"
              className="hub-back-btn"
              onClick={() => setStep("input")}
              aria-label="Back to link entry"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
            <div className="hub-review-title-group">
              <h3 className="hub-review-title">{name}</h3>
              <span className="hub-review-subtitle">
                {selected.length} of {preview.length} tracks matched
              </span>
            </div>
          </div>

          {warning && (
            <div className="hub-alert warning" role="status">
              <AlertCircle size={15} className="hub-alert-icon" />
              <span>{warning}</span>
            </div>
          )}

          {error && (
            <div className="hub-alert error" role="alert">
              <AlertCircle size={15} className="hub-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <div className="hub-review-summary-bar">
            <div className="hub-summary-pills">
              <span className="hub-summary-chip matched">
                <Check size={13} strokeWidth={2.5} /> {selected.length} matched
              </span>
              {preview.length - selected.length > 0 && (
                <span className="hub-summary-chip unmatched">
                  {preview.length - selected.length} unmatched
                </span>
              )}
            </div>

            {unmatchedWithCandidates.length > 0 && (
              <button
                type="button"
                className="hub-auto-match-btn"
                onClick={autoMatchAll}
              >
                <Sparkles size={13} />
                <span>Match all top candidates ({unmatchedWithCandidates.length})</span>
              </button>
            )}
          </div>

          <div className="hub-track-list">
            {preview.map((entry, i) => {
              const isMatched = Boolean(entry.selected);
              return (
                <div
                  key={i}
                  className={`hub-track-item ${isMatched ? "is-matched" : "is-unmatched"}`}
                >
                  <div className="hub-track-left">
                    <span className="hub-track-num">{(i + 1).toString().padStart(2, "0")}</span>
                    <div className="hub-track-orig">
                      <span className="hub-track-title" title={entry.row.title}>
                        {entry.row.title}
                      </span>
                      <span className="hub-track-artist" title={entry.row.artist}>
                        {entry.row.artist}
                        {entry.error ? ` · ${entry.error}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="hub-track-right">
                    <select
                      className={`hub-track-select ${isMatched ? "matched" : "unmatched"}`}
                      aria-label={`Match for ${entry.row.title}`}
                      value={entry.selected}
                      onChange={(event) =>
                        setPreview((all) =>
                          all.map((row, index) =>
                            index === i ? { ...row, selected: event.target.value } : row
                          )
                        )
                      }
                    >
                      <option value="">
                        {entry.candidates.length > 0
                          ? `Choose match (${entry.candidates.length} options)…`
                          : "Skip track (no match)"}
                      </option>
                      {entry.direct && (
                        <option value={entry.direct.id}>
                          Direct: {entry.direct.title} — {entry.direct.artist}
                        </option>
                      )}
                      {entry.candidates.map((track) => (
                        <option key={track.id} value={track.id}>
                          Match: {track.title} — {track.artist} {track.album ? `(${track.album})` : ""}
                        </option>
                      ))}
                      <option value="">✕ Skip this track</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {sameSource && <p className="hub-alert" role="status">Already imported. Only new songs will be added; your existing songs and edits stay.</p>}
          {needsChoice && <fieldset className="hub-review-options">
            <legend>A playlist named “{name}” already exists</legend>
            <label><input type="radio" name="import-conflict" checked={duplicate === "merge"} onChange={() => setDuplicate("merge")} /> Merge songs{conflicts.length > 1 ? ` from all ${conflicts.length} matching playlists` : ""} (keep each song once)</label>
            <label><input type="radio" name="import-conflict" checked={duplicate === "separate"} onChange={() => setDuplicate("separate")} /> Import separately</label>
          </fieldset>}
          {selected.length > tracks.length && <p className="hub-review-options">{selected.length - tracks.length} repeated matches will be skipped.</p>}

          <div className="hub-footer hub-review-footer">
            <button
              type="button"
              className="subtle hub-cancel-btn"
              onClick={() => setStep("input")}
            >
              Back
            </button>
            <button
              type="button"
              className="primary hub-primary-btn"
              disabled={importing || !tracks.length || !name.trim() || (needsChoice && !duplicate)}
              onClick={() => void handleImport()}
            >
              {importing ? <Loader2 className="spin" size={15} /> : <Check size={15} strokeWidth={2.5} />}
              <span>Import {tracks.length} tracks</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
