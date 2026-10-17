# Lumaire planning package

Prepared **17 October 2026, Asia/Kolkata**. Current user-confirmed direction: **Windows desktop first, Tauri 2 + Rust and React/TypeScript/Vite**. Proposed SQLite local persistence; optional replaceable yt-dlp through a controlled native bridge. Playback engine remains subject to actual WebView2 tests.

**Phase 1 documentation/environment audit only.** No application code, dependency installation, prototype or deployment. Review precedes Phase 2 local audio, then separate resolver and stream-playback experiments. Full application planning is Phase 3 only after successful tests.

| Document | Authority / scope |
|---|---|
| [14 Desktop transition audit](14-desktop-transition-audit.md) | Current reconciliation, environment observations, proposed changes, source/distribution review and blockers |
| [02 PRD](02-prd.md) | Current desktop outcomes and retained product acceptance hypotheses |
| [04 Architecture](04-architecture.md) | Current proposed adapters, controlled native bridge, playback and local persistence |
| [09 Roadmap](09-roadmap.md) | Current three-phase workflow and prototype gates |
| [10 Decisions](10-decisions.md) | Initial desktop → website-first → desktop return; explicit decisions versus proposals |
| [03 Priorities](03-feature-prioritization.md) | Retained product priorities, not authorization for full implementation |
| [05 Sources](05-source-feasibility.md) | Source-specific cost/permission gates; technical access is not clearance |
| [06 Lyrics](06-lyrics-system.md) | Preserved original/romanisation/translation synchronization design |
| [07 UI/UX](07-ui-ux.md) | Preserved Lumaire reading/shell direction, accessibility and native failure states |
| [08 Risks/licensing](08-licensing-risks.md) | Software, binary, media, lyric and service rights separately |
| [01 Research](01-research-report.md) | Historical reference website/repository observations |
| [11 Installed Nuclear](11-installed-nuclear-investigation.md) | Bounded installed-app/plugin/native UI findings |
| [12 Earlier validation](12-phase-1.5-validation.md) | Historical TuneScript/source/toolchain evidence and acceptance protocols |
| [13 Website investigation](13-lumaire-web-provider-architecture.md) | Preserved website-first findings, browser limitations and unexecuted WEB-01 |
| [Evidence index](evidence/README.md) | Original REA captures and subsequent dated audit evidence |

Review order: **14 → 04 → 09 → 10 → 02**. Current environment: Node/pnpm, MSVC/SDK files and WebView2 observed; Rust/Cargo unavailable in checked locations. No successful native build or Lumaire playback is established.

The core must remain usable offline with lawfully usable local files, playlists and authorized supplied lyric layers when every external adapter/resolver is disabled. No required backend, paid API, subscription or cloud model. ₹0 means no additional cash on existing hardware/connectivity/storage; no promise of zero resource or maintenance cost.

The synchronized Tamil original / supplied Latin romanisation / supplied English meaning direction remains. TuneScript v1.3.2 uses Gemini/browser APIs; reuse permission and automatic generation remain conditional, never required for local playback. No existing visual implementation was overwritten.

Prior research used the [reverse-engineer-anything skill](C:/Users/ARUSH/.agents/skills/reverse-engineer-anything/SKILL.md). Original evidence is preserved. The current task is documentation/public-source analysis; it did not repeat native runtime reverse engineering or certify audible playback. Nuclear code/SDK/components were not copied.

There is no verified authorized ₹0 route to unrestricted, ad-free access to every mainstream recording. The optional native resolver proposal does not settle provider terms, media rights or distribution obligations. [14](14-desktop-transition-audit.md) distinguishes those blockers from local-core feasibility.
