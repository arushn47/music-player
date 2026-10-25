import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Play, RefreshCw } from "lucide-react";
import { library, type AppleChart, type CatalogTrack } from "../../adapters/native";
import { CHART_COUNTRIES, chartCountry, saveChartCountry, loadAppleChart, type ChartCountry } from "../../adapters/music-providers";
import { Artwork, Select, type SelectOption } from "../common";

const COUNTRY_OPTIONS: SelectOption<ChartCountry>[] = (
  Object.entries(CHART_COUNTRIES) as [ChartCountry, string][]
).map(([value, label]) => ({
  value,
  label,
}));

export function AppleCountryChart({ disabled, onPlay }: { disabled: boolean; onPlay: (track: CatalogTrack) => void }) {
  const [country, setCountry] = useState(chartCountry);
  const [chart, setChart] = useState<AppleChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollRow = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const distance = Math.min(scrollRef.current.clientWidth * 0.8, 540);
    scrollRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true); setChart(null); setError("");
    void loadAppleChart(country, revision > 0).then(value => { if (active) setChart(value); })
      .catch(() => { if (active) setError("Charts couldn't load right now. Refresh Discover to retry."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [country, revision]);

  return <section className="discover-editorial-section" aria-label="Countrywise Top 10">
    <div className="discover-editorial-header">
      <div>
        <h2>Countrywise Top 10</h2>
      </div>
      <div className="apple-chart-controls">
        <div className="apple-chart-country-picker">
          <span className="apple-chart-country-label">Country</span>
          <Select<ChartCountry>
            value={country}
            onChange={(value) => {
              setCountry(value);
              saveChartCountry(value);
              setRevision(0);
            }}
            options={COUNTRY_OPTIONS}
            ariaLabel="Chart country"
            className="apple-chart-select"
          />
        </div>
        <button
          className="subtle apple-chart-refresh-btn"
          disabled={loading}
          aria-label="Refresh chart"
          title={chart?.updatedAt ? `Refresh chart (Updated: ${chart.updatedAt})` : "Refresh chart"}
          onClick={() => setRevision(value => value + 1)}
        >
          {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
        </button>
        <div className="discover-section-nav">
          <button
            type="button"
            className="discover-nav-arrow"
            aria-label="Previous Countrywise Top 10"
            onClick={() => scrollRow("left")}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="discover-nav-arrow"
            aria-label="Next Countrywise Top 10"
            onClick={() => scrollRow("right")}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
    {loading && <p role="status">Loading chart…</p>}
    {error && <p role="status" className="subtitle">{error}</p>}
    {chart && <div className="discover-release-row" ref={scrollRef}>{chart.entries.map((song, index) => <button className="album-card discover-album-card" key={song.id} disabled={disabled || playing !== null} aria-label={`Play number ${index + 1}: ${song.title}`} onClick={() => {
      setPlaying(song.id); setError("");
      // Resolve the catalog identity only on play; loading a chart never triggers ten lookups.
      void library.lookupCatalog(song.id).then(onPlay).catch(() => setError("This chart track couldn't be resolved. Try another track or use search.")).finally(() => setPlaying(null));
    }}><div className="album-card-cover-wrap"><Artwork url={song.artworkUrl} className="album-card-cover" /><span className="discover-rank-badge">#{index + 1}</span><span className="album-hover-play" aria-hidden="true">{playing === song.id ? <Loader2 className="spin" size={18} /> : <Play size={18} fill="currentColor" />}</span></div><div className="album-card-info"><div className="album-title">{song.title}</div><div className="album-year">{song.artist}</div></div></button>)}</div>}
  </section>;
}
