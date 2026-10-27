import { useMemo, useState } from 'react';
import { Copy, Link2, Music2, Rss, ShieldCheck, StopCircle, Users } from 'lucide-react';
import qrcode from 'qrcode-generator';
import type { useJam } from '../../hooks/useJam';

export function JamParty({ jam }: { jam: ReturnType<typeof useJam> }) {
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');

  const qr = useMemo(() => {
    if (!jam.hostLink) return '';
    const code = qrcode(0, 'M'); code.addData(jam.hostLink); code.make();
    return code.createDataURL(6, 24);
  }, [jam.hostLink]);

  const now = jam.snapshot?.now;

  return (
    <section className="jam-party" aria-label="Jam Party">
      <header className="jam-heading">
        <span className="jam-mark"><Users size={22} /></span>
        <div>
          <h2>Jam Party</h2>
          <p>Listen to the same music together. Same Wi-Fi, no account needed.</p>
        </div>
      </header>

      {jam.error && (
        <div className="jam-error" role="alert">
          <p>{jam.error}</p>
        </div>
      )}

      {!jam.active && (
        <>
          {/* Host */}
          <section className="jam-card" aria-label="Start a jam">
            <span className="jam-card-icon"><Rss size={18} /></span>
            <div className="jam-card-body">
              <h3>Host a Jam</h3>
              <p>Start playing music on this device and let others follow along in real time.</p>
              <button
                type="button"
                className="primary jam-btn"
                disabled={jam.busy}
                onClick={() => { setMessage(''); void jam.startJam(); }}
              >
                {jam.busy ? 'Starting…' : 'Start Jam'}
              </button>
            </div>
          </section>

          <div className="jam-divider"><span>or join someone else's</span></div>

          {/* Guest */}
          <section className="jam-card" aria-label="Join a jam">
            <span className="jam-card-icon"><Music2 size={18} /></span>
            <div className="jam-card-body">
              <h3>Join a Jam</h3>
              <p>Paste the Jam link shared by the host.</p>
              <form
                className="jam-form"
                onSubmit={e => { e.preventDefault(); setMessage(''); void jam.joinJam(link.trim()); }}
              >
                <div className="jam-input-row">
                  <div className="jam-input"><Link2 size={16} /><input id="jam-join-link" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="http://192.168…" value={link} onChange={e => setLink(e.target.value)} /></div>
                  <button type="submit" className="primary" disabled={jam.busy || !link.trim()}>{jam.busy ? 'Joining…' : 'Join'}</button>
                </div>
              </form>
            </div>
          </section>
        </>
      )}

      {jam.isHost && (
        <>
          <section className="jam-card jam-active-card" aria-label="Jam is live">
            <div className="jam-live-dot" aria-hidden="true" />
            <div className="jam-card-body">
              <h3>Jam is live</h3>
              {now ? (
                <p>Playing <strong>{now.track.title}</strong> — <span>{now.track.artist}</span></p>
              ) : (
                <p>Play a track on this device to share it.</p>
              )}
            </div>
          </section>

          <section className="jam-card" aria-label="Share this jam">
            <div className="jam-qr-panel">
              {qr && <img className="jam-qr" src={qr} alt="QR code to join this Jam session" />}
              <div>
                <h3>Share with friends</h3>
                <ol>
                  <li>Scan this QR code with a friend's device.</li>
                  <li>Or copy the Jam link and share it in a chat.</li>
                  <li>They open Lumaire → Jam and paste the link.</li>
                </ol>
                <button
                  type="button"
                  className="primary"
                  onClick={() => void navigator.clipboard.writeText(jam.hostLink)
                    .then(() => setMessage('Jam link copied.'))
                    .catch(() => setMessage('Open "Show Jam link" below, then copy it.'))}
                >
                  <Copy size={16} /> Copy Jam link
                </button>
              </div>
            </div>
            <details className="jam-link-fallback">
              <summary>Show Jam link</summary>
              <label htmlFor="jam-host-link">Jam link</label>
              <input id="jam-host-link" readOnly value={jam.hostLink} onFocus={e => e.target.select()} />
            </details>
          </section>

          <button type="button" className="subtle jam-end-btn" onClick={() => { setMessage(''); void jam.endJam(); }}>
            <StopCircle size={16} /> End Jam
          </button>
        </>
      )}

      {jam.isGuest && (
        <>
          <section className="jam-card jam-active-card" aria-label="Following host">
            <div className="jam-live-dot jam-live-dot--guest" aria-hidden="true" />
            <div className="jam-card-body">
              <h3>Following host</h3>
              {now ? (
                <p>Playing <strong>{now.track.title}</strong> — <span>{now.track.artist}</span></p>
              ) : (
                <p>Waiting for the host to start playing…</p>
              )}
            </div>
          </section>
          <button type="button" className="subtle jam-end-btn" onClick={() => { setMessage(''); void jam.endJam(); }}>
            Leave Jam
          </button>
        </>
      )}

      <footer className="jam-privacy">
        <ShieldCheck size={16} />
        <p>Jam links work only on the same local Wi-Fi network. Traffic is unencrypted — keep your link private. Audio files stay on each device.</p>
      </footer>

      {message && <p className="jam-message" role="status">{message}</p>}
    </section>
  );
}
