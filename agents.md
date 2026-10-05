This is a Singapore wealth projection app.

- Preserve calculation logic unless explicitly requested.
- Use Notion/Apple-inspired UI.
- Prefer muted palette and semantic colors.
- Follow the shared finance-app hierarchy guidance in `C:/Users/Bryan/Documents/Codex/AGENTS.md`: retain established palettes, use category-coloured headers in dark mode, and clear card borders/surface separation in light mode. Keep input and chart category colours consistent.
- Do not publish unless user asks.
- Main deployed file is `docs/index.html`.
- Source lives on `main`; the verified GitHub Pages deployment serves `gh-pages` (checked 6 October 2026). Publish tracked `docs` content to that branch, not the unrelated React `dist`. Verify the live HTML after deployment.

## User Preferences and Step Motion (6 October 2026)

- Keep Common Cents comprehensive and distinct from the focused RetirementReadiness questionnaire. Preserve the established palette, financial calculations, saved profiles, input values and responsive charts during design changes.
- Aim for a simple, modern Apple-like feel and Samsung-like polish: readable type, clear selected controls, softer visual hierarchy and restrained semantic colour. Clarity for beginners and older users takes priority over decoration.
- Approved motion (6 October 2026): Next moves the current step upward and brings the next step in from below. Back reverses the direction. Use the gentle-drift preview's 1.1-second fading motion, including step navigation buttons; keep global navigation, profile actions and summaries stationary.
- Show an isolated interactive preview before applying or publishing broad transition changes. The 6 October preview is `output/step-transition-preview/index.html`; do not include it in deployed `docs`.
- Motion lasts 1100ms with smooth easing, 80px maximum vertical travel and a staggered fade; no bounce or zoom. Cancel unfinished animation and remove inert outgoing copies during rapid navigation. Never duplicate accessible IDs or interactive outgoing controls.
- Do not animate on field edits, calculation updates, chart tooltips or theme changes. Preserve focus, values and validation. On committed navigation, restore the next step's top and focus its heading without a second animated scroll.
- Respect `prefers-reduced-motion`; skip travel animation and navigation smooth scrolling. Verify long/short steps, rapid navigation, Back, mobile keyboard, light/dark themes, focus and overflow before release.
