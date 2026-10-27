import { AmbientBackground } from "../common/AmbientBackground";
import { cloneElement, useEffect, useRef, useState, type ReactNode, type ReactElement } from "react";
import { X, FileText, Volume2, VolumeX, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { centerLyricLine } from "../lyrics/scroll-lyric";
import { Artwork } from "../common/Artwork";
import { type PlayerBarProps } from "./PlayerBar";
import type { LyricDocument, Preferences, Session } from "../../domain/types";
import type { LyricProcessingState } from "../../adapters/lyric-processing";
import "./expanded.css";
import "./immersive.css";
import { ImmersiveBackground } from "./ImmersiveBackground";
import { Select } from "../common/Select";

export function ExpandedPlayer({
  controls,
  lyrics,
  onClose,
  doc,
  session: propSession,
  onSetting: propOnSetting,
  follow,
  setFollow,
  canFollow,
  translateLyrics,
  processingState,
  romanizing = false,
  isFullscreen: propIsFullscreen,
  onToggleFullscreen: propOnToggleFullscreen,
}: {
  controls: ReactElement<PlayerBarProps>;
  lyrics: ReactNode;
  onClose: () => void;
  doc?: LyricDocument | null;
  session?: Session;
  onSetting?: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  follow: boolean;
  setFollow: (follow: boolean) => void;
  canFollow: boolean;
  translateLyrics: (language: string) => Promise<void>;
  processingState?: LyricProcessingState;
  romanizing?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [showLyrics, setShowLyrics] = useState(true);
  const session = propSession ?? controls.props.session;
  const onSetting = propOnSetting ?? controls.props.onSetting;
  const immersive = session.settings.fullscreenLayout !== "minimal";
  const visibleLyrics = showLyrics && (!immersive || Boolean(doc?.lines.some(line => line.text.trim()) && !doc.instrumental));
  const isFullscreen = propIsFullscreen ?? controls.props.isFullscreen;
  const onToggleFullscreen = propOnToggleFullscreen ?? controls.props.onToggleFullscreen;
  const sessionVolume = session?.settings?.volume ?? 0.72;
  const [hoverVolume, setHoverVolume] = useState(false);
  const lastVol = useRef(sessionVolume > 0 ? sessionVolume : 0.72);
  const isVolumeDragging = useRef(false);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerUp = () => {
      if (isVolumeDragging.current) {
        isVolumeDragging.current = false;
        if (!volumeContainerRef.current?.matches(":hover")) {
          if (volumeContainerRef.current?.contains(document.activeElement)) {
            (document.activeElement as HTMLElement)?.blur();
          }
        }
      }
    };
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const frame = requestAnimationFrame(() => {
      const targetLine = element.querySelector<HTMLElement>(".lyric-line.is-active") || element.querySelector<HTMLElement>(".lyric-line");
      centerLyricLine(targetLine, "instant");
    });
    return () => { cancelAnimationFrame(frame); element.close(); };
  }, []);

  const isPlaying = controls.props.playback?.status === "playing";
  const track = controls.props.track;

  return (
    <dialog
      ref={dialog}
      className={`expanded-player ${immersive ? "is-immersive" : "is-minimal"}`}
      aria-label="Now playing"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {immersive ? <ImmersiveBackground track={track} /> : <AmbientBackground artwork={track?.artworkUrl} />}

      <header className="expanded-top-bar">
        <button
          autoFocus
          className="icon-button expanded-close"
          aria-label="Close expanded player"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="expanded-top-actions">
          <Select ariaLabel="Fullscreen layout" className="fullscreen-layout-select" placement="down"
            value={immersive ? "immersive" : "minimal"}
            onChange={value => onSetting("fullscreenLayout", value)}
            options={[{value: "immersive", label: "Immersive"}, {value: "minimal", label: "Minimal"}]} />
          <div id="expanded-lyrics-settings-slot" />
        </div>
      </header>

      <div className={`expanded-layout ${visibleLyrics ? "has-lyrics" : "no-lyrics"}`}>
        <section className="expanded-record" aria-label="Current song">
          <div className={`expanded-cover-wrapper ${isPlaying ? "is-playing" : "is-paused"}`}>
            <Artwork url={track?.artworkUrl} className="expanded-cover" />
          </div>
          {cloneElement(controls, {
            expanded: true,
            titleCharacterLimit: immersive ? 40 : undefined,
            onExpand: undefined,
            onNavigateArtist: (id) => {
              onClose();
              controls.props.onNavigateArtist?.(id);
            },
          })}
        </section>

        {visibleLyrics && (
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
        {visibleLyrics && canFollow && !follow && <button
          type="button"
          className="expanded-action-btn"
          title="Back to sync"
          aria-label="Back to sync"
          onClick={() => setFollow(true)}
        ><RefreshCw size={15} /></button>}

        <div
          ref={volumeContainerRef}
          className={`expanded-volume-control ${hoverVolume ? "is-hovered" : ""}`}
          onMouseEnter={() => setHoverVolume(true)}
          onMouseLeave={() => {
            setHoverVolume(false);
            if (!isVolumeDragging.current) {
              if (volumeContainerRef.current?.contains(document.activeElement)) {
                (document.activeElement as HTMLElement)?.blur();
              }
            }
          }}
        >
          <button
            type="button"
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
            onPointerDown={() => {
              isVolumeDragging.current = true;
            }}
            onPointerUp={(e) => {
              isVolumeDragging.current = false;
              if (!volumeContainerRef.current?.matches(":hover")) {
                e.currentTarget.blur();
              }
            }}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 0) lastVol.current = val;
              onSetting?.("volume", val);
            }}
          />
        </div>

        {onToggleFullscreen && (
          <button
            type="button"
            className={`expanded-action-btn ${isFullscreen ? "is-active" : ""}`}
            title={isFullscreen ? "Exit full screen (F11)" : "Full screen (F11)"}
            aria-label={isFullscreen ? "Exit full screen (F11)" : "Full screen (F11)"}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
      </div>
    </dialog>
  );
}

