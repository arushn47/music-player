import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoryView, type HistoryViewProps } from "./HistoryView";
import type { ListeningRecord } from "../../domain/listening";

it("renders recent plays with combined metadata line, artwork wrap and action buttons", () => {
  const noop = () => {};
  const record: ListeningRecord = {
    id: "rec_1",
    trackId: "track_1",
    title: "Tiger Muthuvel Pandian",
    artist: "Anirudh Ravichander",
    album: "Jailer 2",
    listenedMs: 49000,
    startedAt: 1730000000000,
    updatedAt: 1730000049000,
    days: { "2026-10-27": 49000 },
    artworkUrl: "https://example.com/art.jpg",
    providerId: null,
    sourceId: null,
  };
  const props: HistoryViewProps = {
    initialTab: "history",
    records: [record],
    loading: false,
    error: "",
    mobile: true,
    enabled: true,
    favorites: [],
    onReplay: noop,
    onQueue: noop,
    onFavorite: noop,
    onRefresh: noop,
  };
  const html = renderToStaticMarkup(<HistoryView {...props} />);
  expect(html).toContain("listening-history-row");
  expect(html).toContain("listening-artwork-wrap");
  expect(html).toContain("track-title-button");
  expect(html).toContain("Tiger Muthuvel Pandian");
  expect(html).toContain("Anirudh Ravichander");
  expect(html).toContain("listening-history-meta");
  expect(html).toContain("49s listened");
  expect(html).toContain("listening-history-dot");
  expect(html).toContain("listening-history-actions");
  expect(html).toContain("listening-queue-action");
});
