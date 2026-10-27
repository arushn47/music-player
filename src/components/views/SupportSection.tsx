import { useState, type JSX, type MouseEvent } from "react";
import { ExternalLink, Github, Globe, Instagram, Linkedin, MessageCircle, Star, Users } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

const repo = "https://github.com/arushn47/music-player";
const links = [
  { title: "Star Lumaire", detail: "Enjoying the app? Leave a public star on GitHub.", label: "Star on GitHub", url: repo, icon: Star },
  { title: "Our supporters", detail: "See the people who have starred the project.", label: "View supporters", url: `${repo}/stargazers`, icon: Users },
  { title: "Share feedback", detail: "Report a bug or suggest something you would love to see.", label: "Give feedback", url: `${repo}/issues`, icon: MessageCircle },
  { title: "Follow the developer", detail: "Find Arush and more projects on GitHub.", label: "GitHub profile", url: "https://github.com/arushn47", icon: Github },
  { title: "Instagram", detail: "Follow Arush on Instagram.", label: "Instagram profile", url: "https://www.instagram.com/_.arush.menon._/", icon: Instagram },
  { title: "LinkedIn", detail: "Connect with Arush on LinkedIn.", label: "LinkedIn profile", url: "https://www.linkedin.com/in/arushn47", icon: Linkedin },
  { title: "More from Arush", detail: "Explore the developer's website and other work.", label: "Visit website", url: "https://arush.vercel.app/", icon: Globe },
];

export function SupportSection(): JSX.Element {
  const [error, setError] = useState("");
  async function follow(event: MouseEvent<HTMLAnchorElement>, url: string) {
    if (!isTauri()) return;
    event.preventDefault();
    setError("");
    try { await openUrl(url); }
    catch { setError("Couldn't open your browser. You can copy the link and open it yourself."); }
  }
  return <div className="settings-category support-section">
    <h2>Support</h2>
    <p className="category-subtitle">Enjoying Lumaire? Help more people find it or share your ideas.</p>
    <div className="settings-card-group">
      {links.map(({ title, detail, label, url, icon: Icon }) => <div className="settings-row" key={title}>
        <Icon className="support-icon" size={20} aria-hidden="true" />
        <div className="row-text"><strong>{title}</strong><small>{detail}</small></div>
        <a className="subtle support-link" href={url} target="_blank" rel="noopener noreferrer" onClick={event => void follow(event, url)}>{label}<ExternalLink size={14} aria-hidden="true" /></a>
      </div>)}
    </div>
    {error && <p className="support-error" role="alert">{error}</p>}
    <p className="settings-footnote">Stars are counted publicly on GitHub, where an account is needed to star or post feedback. Lumaire doesn't track support clicks or your listening activity. These links open in your browser.</p>
  </div>;
}
