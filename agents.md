## Repository Identity Correction - 20 October 2026

This checkout is **Personal Wealth Planner**, the retired prototype: `bryancjw-debug/personal-wealth-planner`. It is NOT the maintained CommonCents app. Earlier instructions below misidentified it and are historical only wherever they conflict with this correction.

- Canonical CommonCents repository: `https://github.com/bryancjw-debug/common-cents.git`; live app: `https://bryancjw-debug.github.io/common-cents/`.
- Canonical checkout created here: `common-cents-canonical/`, with its own remote, source, tests and AGENTS.md. Check its identity before edits. It deploys its React **dist** through GitHub Actions, not this repository's standalone docs.
- This prototype's final Pages build is `docs`; its home is an archive notice and `docs/legacy.html` preserves retrieval of old saved plans. Keep legacy browser storage intact. Do not continue feature development here.
- Do not substitute the prototype's standalone app for CommonCents or claim one app's checks/deployment verify the other.

This was a Singapore wealth projection prototype.

- Preserve calculation logic unless explicitly requested.
- Use Notion/Apple-inspired UI.
- Prefer muted palette and semantic colors.
- Follow the shared finance-app hierarchy guidance in `C:/Users/Bryan/Documents/Codex/AGENTS.md`: retain established palettes, use category-coloured headers in dark mode, and clear card borders/surface separation in light mode. Keep input and chart category colours consistent.
- Do not publish unless user asks.
- Main deployed file is `docs/index.html`.
- Source lives on `main`; the verified GitHub Pages deployment serves `gh-pages` (checked 6 October 2026). Publish tracked `docs` content to that branch, not the unrelated React `dist`. Verify the live HTML after deployment.

## User Preferences and Step Motion (6 October 2026)

### Minimal Workspace and PWA (18 October 2026)

- Use a flat, restrained Notion/iOS/OneUI-inspired workspace: system sans-serif typography, thin borders, no raised-card shadows or hover lifts. Retain semantic chart colours and existing financial calculations.
- Use available desktop width with a compact persistent section sidebar; keep mobile forms full-width and section navigation in a drawer. Dock the live summary below inputs so it cannot cover fields.
- The standalone site's presentation lives in `docs/minimal.css`; do not confuse it with the React preview.
- Landing-page exception (20 October 2026): CommonCents's welcome must retain its expressive Singapore graphics, moving preview tiles, floating projection preview and animated bars. Keep these isolated in `docs/landing.css`; minimal workspace styling must not flatten the landing page. Home returns to this page without resetting the current plan, with an explicit Continue action. Starting a replacement plan must warn first. Respect reduced motion on the landing too.
- Keep the section rail, input page and docked summary in one continuous bordered workspace. Avoid decorative stripes and orphaned divider edges. The app header should not reserve a second blank header-height gap; install/update tools remain in document flow and use theme colours.
- PWA assets are scoped to this app's URL. Run `npm run build:standalone` before publishing docs to generate the content-versioned worker, then run its PWA checks. Never clear unrelated applications' caches or cache client exports/submitted data.
- Do not force a service-worker update/reload during entry. Offer an explicit update and warn about unsaved answers. Offline users see the last downloaded version; installation is not a backup. iOS uses its browser Add to Home Screen flow.
- Review both apps locally before publishing; PWA/browser checks do not replace native Android/Windows/iOS install testing.

- React tooling uses Tailwind 4 with `@tailwindcss/postcss`, explicit `src` scanning and the existing `tailwind.config.ts` loaded through `@config`. Keep v3-compatible control defaults in `src/styles.css` and Tailwind-4-compatible `tailwind-merge`. This build is separate from the published standalone `docs/index.html`; never substitute `dist` for the live calculator during tooling upgrades.
- After dependency changes, verify `npm ci`, `npm audit`, `npm test` and `npm run build`, plus browser checks in both themes and responsive widths. An audit with no advisories is not a penetration test or regulatory certification.

- Keep Common Cents comprehensive and distinct from the focused RetirementReadiness questionnaire. Preserve the established palette, financial calculations, saved profiles, input values and responsive charts during design changes.
- Aim for a simple, modern Apple-like feel and Samsung-like polish: readable type, clear selected controls, softer visual hierarchy and restrained semantic colour. Clarity for beginners and older users takes priority over decoration.
- Approved motion: Next moves the current step upward and brings the next step in from below; Back reverses direction. Use the gentle-drift preview's 1.1-second fading motion. The docked live summary moves with the form (18 October refinement); global navigation and profile actions stay stationary. Desktop step actions can move; the mobile bottom bar stays anchored to the viewport.

- Mobile uses Back / Sections / Next or Build actions with a separate Projection link in the section sheet. Preserve space below content and safe-area padding. Avoid backdrop-filter/transform on the wizard ancestor of fixed controls. Recheck fixed-bar positioning after resizing.
- Show an isolated interactive preview before applying or publishing broad transition changes. The 6 October preview is `output/step-transition-preview/index.html`; do not include it in deployed `docs`.
- Motion lasts 1100ms with smooth easing, 80px maximum vertical travel and a staggered fade; no bounce or zoom. Cancel unfinished animation and remove inert outgoing copies during rapid navigation. Never duplicate accessible IDs or interactive outgoing controls.
- Do not animate on field edits, calculation updates, chart tooltips or theme changes. Preserve focus, values and validation. On committed navigation, restore the next step's top and focus its heading without a second animated scroll.
- Respect `prefers-reduced-motion`; skip travel animation and navigation smooth scrolling. Verify long/short steps, rapid navigation, Back, mobile keyboard, light/dark themes, focus and overflow before release.
