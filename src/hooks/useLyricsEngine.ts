import { useEffect, useRef, useState } from "react";
import { lookupLyrics, type LookupState } from "../adapters/lrclib";
import { library } from "../adapters/native";
import type { LineAlignmentVariant } from "../components/modals";
import { clearFetchedLyrics } from "../domain/lyric-display";
import {
  activeLine,
  alignVariant,
  estimatedFollowLine,
  normalizeCachedLyrics,
  parseLyrics,
  synchronizedLyrics,
} from "../domain/lyrics";
import { romanizeDocument } from "../domain/romanization";
import type { LyricDocument, Session, Track } from "../domain/types";
import type { Playback } from "../player/controller";

const formatError = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

export interface UseLyricsEngineOptions {
  track?: Track | null;
  doc?: LyricDocument;
  playback: Playback;
  session: Session;
  update: (fn: (s: Session) => Session) => void;
  sessionRef: React.MutableRefObject<Session>;
  ready: boolean;
  view: string;
  notify: (msg: string) => void;
  action: (fn: () => Promise<void>) => Promise<void>;
  setError: (err: string) => void;
}

export function useLyricsEngine({
  track,
  doc,
  playback,
  session,
  update,
  sessionRef,
  ready,
  view,
  notify,
  action,
  setError,
}: UseLyricsEngineOptions) {
  const [lyricLookup, setLyricLookup] = useState<LookupState>({
    status: "idle",
  });
  const [lyricRetry, setLyricRetry] = useState(0);
  const [variant, setVariant] = useState<LineAlignmentVariant | null>(null);
  const [follow, setFollow] = useState(true);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const lyricDuration =
    playback.duration > 0 ? playback.duration : track?.duration || 0;
  const lyricSynced = doc ? synchronizedLyrics(doc, lyricDuration) : false;
  const active =
    doc && lyricSynced ? activeLine(doc, playback.time * 1000) : null;
  const followTarget =
    doc && (lyricSynced || session.settings.estimatedScroll)
      ? lyricSynced
        ? active
        : estimatedFollowLine(doc, playback.time, lyricDuration)
      : null;

  // Scroll active line into view
  useEffect(() => {
    if (follow && view === "lyrics") {
      activeRef.current?.scrollIntoView({
        block: "center",
        behavior: lyricSynced ? "instant" : "smooth",
      });
    }
  }, [followTarget, follow, view, lyricSynced]);

  // Background romanization
  useEffect(() => {
    if (!doc || !track || !session.settings.romanisation) return;
    let cancelled = false;
    const id = track.id;
    const original = doc.id;
    void romanizeDocument(doc)
      .then((romanisation) => {
        if (cancelled || !Object.keys(romanisation).length) return;
        update((currentSession) => {
          const current = currentSession.lyrics[id];
          return current?.id === original
            ? {
                ...currentSession,
                lyrics: {
                  ...currentSession.lyrics,
                  [id]: {
                    ...current,
                    romanisation: {
                      ...current.romanisation,
                      ...Object.fromEntries(
                        Object.entries(romanisation).filter(
                          ([lineId]) =>
                            current.romanisation[lineId] ===
                            doc.romanisation[lineId],
                        ),
                      ),
                    },
                  },
                },
              }
            : currentSession;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc?.id, doc?.raw, track?.id, session.settings.romanisation]);

  // Auto-lookup effect: fires whenever current track changes
  useEffect(() => {
    if (!ready || !track) {
      setLyricLookup({ status: "idle" });
      return;
    }
    const id = track.id;
    const originalCached = sessionRef.current.lyrics[id];
    const cached = originalCached
      ? normalizeCachedLyrics(originalCached, lyricDuration)
      : undefined;
    if (cached) {
      if (cached !== originalCached) {
        update((s) => ({ ...s, lyrics: { ...s.lyrics, [id]: cached } }));
      }
      setLyricLookup({ status: "found", doc: cached });
      return;
    }
    if (
      track.source &&
      playback.status === "loading" &&
      playback.duration <= 0
    ) {
      setLyricLookup({ status: "loading" });
      return;
    }
    let cancelled = false;
    setLyricLookup({ status: "loading" });
    lookupLyrics({ ...track, duration: lyricDuration }).then((result) => {
      if (cancelled) return;
      const attached = sessionRef.current.lyrics[id];
      setLyricLookup(attached ? { status: "found", doc: attached } : result);
      if (result.status === "found") {
        update((s) =>
          s.lyrics[id]
            ? s
            : { ...s, lyrics: { ...s.lyrics, [id]: result.doc } },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    track?.id,
    track?.title,
    track?.artist,
    track?.album,
    ready,
    lyricRetry,
    lyricDuration,
    playback.status,
  ]);

  async function attach(kind: "original" | "romanisation" | "translation") {
    const selected = track?.id;
    if (!selected) return;
    await action(async () => {
      const input = await library.lyrics();
      if (!input) return;
      const parsed = parseLyrics(input.text, input.fileName);
      if (
        sessionRef.current.queue.find(
          (i) => i.id === sessionRef.current.currentId,
        )?.trackId !== selected
      ) {
        throw new Error(
          "The selected track changed. Attach the lyrics again for this track.",
        );
      }
      if (kind === "original") {
        update((s) => ({ ...s, lyrics: { ...s.lyrics, [selected]: parsed } }));
        notify("Original lyrics attached locally");
      } else {
        if (!doc) throw new Error("Attach original lyrics first.");
        alignVariant(doc, parsed);
        setVariant({ doc: parsed, kind, trackId: selected, original: doc });
      }
    });
  }

  function confirmVariant() {
    if (!variant) return;
    if (
      !doc ||
      !track ||
      track.id !== variant.trackId ||
      doc.id !== variant.original.id
    ) {
      setVariant(null);
      setError(
        "The selected recording changed. Attach the supplied text again for this song.",
      );
      return;
    }
    try {
      const mapped = alignVariant(doc, variant.doc);
      update((s) => ({
        ...s,
        lyrics: { ...s.lyrics, [track.id]: { ...doc, [variant.kind]: mapped } },
      }));
      setVariant(null);
      notify("Supplied text attached to the original line IDs");
    } catch (e) {
      setError(formatError(e));
    }
  }

  function markInstrumental() {
    if (track) {
      update((s) => ({
        ...s,
        lyrics: {
          ...s.lyrics,
          [track.id]: {
            id: crypto.randomUUID(),
            raw: "",
            fileName: "Marked instrumental by you",
            lines: [],
            fileOffset: 0,
            userOffset: 0,
            warnings: [],
            romanisation: {},
            translation: {},
            instrumental: true,
          },
        },
      }));
    }
  }

  function clearCache() {
    update(clearFetchedLyrics);
    setLyricRetry((retry) => retry + 1);
    notify(
      "Cached lyrics cleared. Imported lyrics and your private key are preserved.",
    );
  }

  function regenerate() {
    if (!track || !doc) return;
    const id = track.id;
    const original = doc.id;
    void action(async () => {
      const romanisation = await romanizeDocument({
        ...doc,
        romanisation: {},
      });
      update((currentSession) =>
        currentSession.lyrics[id]?.id === original
          ? {
              ...currentSession,
              lyrics: {
                ...currentSession.lyrics,
                [id]: {
                  ...currentSession.lyrics[id],
                  romanisation,
                },
              },
            }
          : currentSession,
      );
      notify(
        "Romanization refreshed locally. Original lyrics and timing are preserved.",
      );
    });
  }

  function applyTranslation(id: string, values: Record<string, string>) {
    update((currentSession) => {
      const original = track && currentSession.lyrics[track.id];
      return track && original?.id === id
        ? {
            ...currentSession,
            lyrics: {
              ...currentSession.lyrics,
              [track.id]: {
                ...original,
                translation: values,
              },
            },
          }
        : currentSession;
    });
  }

  function updateOffset(offset: number) {
    if (!track || !doc) return;
    update((s) => ({
      ...s,
      lyrics: {
        ...s.lyrics,
        [track.id]: { ...doc, userOffset: offset },
      },
    }));
  }

  function retryLookup() {
    if (!track) return;
    setLyricRetry((n) => n + 1);
  }

  return {
    lyricLookup,
    variant,
    setVariant,
    follow,
    setFollow,
    activeRef,
    lyricDuration,
    lyricSynced,
    active,
    followTarget,
    attach,
    confirmVariant,
    markInstrumental,
    clearCache,
    regenerate,
    applyTranslation,
    updateOffset,
    retryLookup,
  };
}
