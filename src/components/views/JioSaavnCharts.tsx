import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { CatalogChart } from '../../adapters/native';
import { Artwork } from '../common';

type Props = {
  charts: CatalogChart[];
  loading: boolean;
  onNavigateChart?: (chartId: string) => void;
};

export function JioSaavnCharts({ charts, loading, onNavigateChart }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const scrollCards = (direction: number) =>
    scroll.current?.scrollBy({ left: direction * Math.min(scroll.current.clientWidth * 0.8, 540), behavior: 'smooth' });

  return (
    <section className="discover-editorial-section" aria-label="Featured Charts">
      <div className="discover-editorial-header">
        <div><h2>Featured Charts</h2></div>
        <div className="discover-section-nav">
          <button className="discover-nav-arrow" aria-label="Previous charts" onClick={() => scrollCards(-1)}>
            <ChevronLeft size={14} />
          </button>
          <button className="discover-nav-arrow" aria-label="Next charts" onClick={() => scrollCards(1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      {loading && !charts.length && <p role="status">Loading charts…</p>}
      {!loading && !charts.length && <p role="status" className="subtitle">Charts are unavailable right now. Refresh Discover to retry.</p>}
      <div className="discover-release-row" ref={scroll}>
        {charts.map(chart => (
          <button
            type="button"
            className="album-card discover-album-card"
            key={chart.id}
            aria-label={`Open chart ${chart.title}`}
            onClick={() => onNavigateChart?.(chart.id)}
          >
            <div className="album-card-cover-wrap">
              <Artwork url={chart.artworkUrl} className="album-card-cover" />
              <span className="album-hover-play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
            </div>
            <div className="album-card-info">
              <div className="album-title" title={chart.title}>{chart.title}</div>
              <div className="album-year">{chart.subtitle}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
