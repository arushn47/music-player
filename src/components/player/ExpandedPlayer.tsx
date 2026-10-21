import { AmbientBackground } from "../common/AmbientBackground";
import { cloneElement, useEffect, useRef, useState, type ReactNode, type ReactElement } from "react";
import { X, FileText, Volume2, VolumeX, Languages, Subtitles, RefreshCw, Loader2 } from "lucide-react";
import { centerLyricLine } from "../lyrics/scroll-lyric";
import { Artwork } from "../common/Artwork";
import { type PlayerBarProps } from "./PlayerBar";
import type { LyricDocument, Preferences, Session } from "../../domain/types";
import type { LyricProcessingState } from "../../adapters/lyric-processing";
import "./expanded.css";

export function ExpandedPlayer({
  controls,
  lyrics,
  onClose,
  origin,
  doc,
  session: propSession,
  onSetting: propOnSetting,
  follow,
  setFollow,
  canFollow,
  translateLyrics,
  processingState,
  romanizing = false,
}: {
  controls: ReactElement<PlayerBarProps>;
  lyrics: ReactNode;
  onClose: () => void;
  origin: DOMRect | null;
  doc?: LyricDocument | null;
  session?: Session;
  onSetting?: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  canFollow: boolean;
  translateLyrics: (language: string) => Promise<void>;
  processingState?: LyricProcessingState;
  romanizing?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const session = propSession ?? controls.props.session;
  const onSetting = propOnSetting ?? controls.props.onSetting;
  const sessionVolume = session?.settings?.volume ?? 0.72;
  const [hoverVolume, setHoverVolume] = useState(false);
  const lastVol = useRef(sessionVolume > 0 ? sessionVolume : 0.72);

  const transform = () => {
    const rect = dialog.current?.querySelector(".expanded-cover")?.getBoundingClientRect();
    return rect && origin
      ? `translate(${origin.x - rect.x}px, ${origin.y - rect.y}px) scale(${origin.width / rect.width}, ${origin.height / rect.height})`
      : "scale(.96)";
  };

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const element = dialog.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    element.querySelector(".expanded-cover")?.animate(
      [
        { transform: "none", transformOrigin: "top left" },
        { transform: transform(), transformOrigin: "top left", opacity: 0 },
      ],
      { duration: 190, easing: "ease-in", fill: "forwards" },
    );
    void element
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 190, fill: "forwards" })
      .finished.then(onClose)
      .catch(onClose);
  };

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const targetLine = element.querySelector<HTMLElement>(".lyric-line.is-active") || element.querySelector<HTMLElement>(".lyric-line");
    centerLyricLine(targetLine, "instant");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.querySelector(".expanded-cover")?.animate(
        [
          { transform: transform(), transformOrigin: "top left" },
          { transform: "none", transformOrigin: "top left" },
        ],
        { duration: 350, easing: "cubic-bezier(.16,1,.3,1)" },
      );
      element.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 220 });
    }
    return () => element.close();
  }, []);

  const isPlaying = controls.props.playback?.status === "playing";
  const track = controls.props.track;

  return (
    <dialog
      ref={dialog}
      className="expanded-player"
      aria-label="Now playing"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <AmbientBackground artwork={track?.artworkUrl} />

      <header className="expanded-top-bar">
        <button
          autoFocus
          className="icon-button expanded-close"
          aria-label="Close expanded player"
          onClick={close}
        >
          <X size={20} />
        </button>

        <div id="expanded-lyrics-settings-slot" />
      </header>

      <div className={`expanded-layout ${showLyrics ? "has-lyrics" : "no-lyrics"}`}>
        <section className="expanded-record" aria-label="Current song">
          <div className={`expanded-cover-wrapper ${isPlaying ? "is-playing" : "is-paused"}`}>
            <Artwork url={track?.artworkUrl} className="expanded-cover" />
          </div>
          {cloneElement(controls, {
            expanded: true,
            onExpand: undefined,
            onNavigateArtist: (id) => {
              onClose();
              controls.props.onNavigateArtist?.(id);
            },
          })}
        </section>

        {showLyrics && (
          <section className="expanded-lyrics" aria-label="Song lyrics" onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)}>
            {lyrics}
          </section>
        )}
      </div>

      <div className="expanded-bottom-left">
        <button
          className={`expanded-lyrics-toggle ${showLyrics ? "is-active" : ""}`}
          aria-label={showLyrics ? "Hide lyrics" : "Show lyrics"}
          aria-pressed={showLyrics}
          onClick={() => setShowLyrics((prev) => !prev)}
        >
          <FileText size={17} />
        </button>
      </div>

      <div className="expanded-bottom-right">
        {showLyrics && canFollow && !follow && <button
          type="button"
          className="expanded-action-btn"
          title="Back to sync"
          aria-label="Back to sync"
          onClick={() => setFollow(true)}
        ><RefreshCw size={15} /></button>}
        {showLyrics && doc && !doc.instrumental && (() => {
          const isTranslating = Boolean(session?.settings?.translation && processingState?.status === "processing");
          const isRomanizing = Boolean(session?.settings?.romanisation && (romanizing || (processingState?.status === "processing" && !Object.keys(doc.romanisation || {}).length)));
          return (
            <>
              <button
                type="button"
                className={`expanded-action-btn ${session?.settings?.romanisation ? "is-active" : ""}`}
                aria-pressed={session?.settings?.romanisation}
                title={isRomanizing ? "Romanizing lyrics…" : session?.settings?.romanisation ? "Turn off romanization" : "Turn on romanization"}
                aria-label="Toggle romanization"
                onClick={() => onSetting?.("romanisation", !session?.settings?.romanisation)}
              >
                {isRomanizing ? <Loader2 size={15} className="spin" /> : <Languages size={15} />}
              </button>
              <button
                type="button"
                className={`expanded-action-btn ${session?.settings?.translation ? "is-active" : ""}`}
                aria-pressed={session?.settings?.translation}
                title={isTranslating ? "Translating lyrics…" : session?.settings?.translation ? "Turn off translation" : "Turn on translation"}
                aria-label="Toggle translation"
                onClick={() => {
                  onSetting?.("translation", !session?.settings?.translation);
                  if (!session?.settings?.translation) void translateLyrics("auto");
                }}
              >
                {isTranslating ? <Loader2 size={15} className="spin" /> : <Subtitles size={15} />}
              </button>
            </>
          );
        })()}

        <div
          className={`expanded-volume-control ${hoverVolume ? "is-hovered" : ""}`}
          onMouseEnter={() => setHoverVolume(true)}
          onMouseLeave={() => setHoverVolume(false)}
        >
          <div className="expanded-volume-slider-wrap">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sessionVolume}
              aria-label="Volume"
              style={{
                "--volume-percent": `${Math.min(100, Math.max(0, sessionVolume * 100))}%`,
              } as React.CSSProperties}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) lastVol.current = val;
                onSetting?.("volume", val);
              }}
            />
          </div>
          <button
            className="expanded-volume-btn"
            aria-label={sessionVolume === 0 ? "Unmute" : "Mute"}
            onClick={() => {
              if (sessionVolume > 0) {
                lastVol.current = sessionVolume;
                onSetting?.("volume", 0);
              } else {
                onSetting?.("volume", lastVol.current || 0.72);
              }
            }}
          >
            {sessionVolume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </div>
    </dialog>
  );
}

