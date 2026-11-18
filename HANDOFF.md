# HANDOFF

Rules version: v1.14
Inventory: 2026-11-18
Project language: English (product text and README; default for new projects, the user has not chosen otherwise)

## What this is

A web page that cleans text from messy input into plain text ("tvätta text"). Runs entirely in the browser; the text never leaves the device.

## Current state

- 2026-11-18: Repo created empty. Project files (AGENTS.md, HANDOFF.md, BACKLOG.md) added. No product code yet.
- 2026-11-18: The user approved the whole first version (F-001 to F-007) with the recommendations. Build in progress.

## Next steps

1. Get the go-ahead for the proposed run in BACKLOG.md, including the open questions.
2. Build, verify (desktop, phone-sized screen, keyboard), publish, check the published page.

## Publishing

Not set up yet. Proposed: GitHub Pages straight from `main` (root folder), no build step. The repo is public, so Pages is free. Expected address: https://badbagel47.github.io/cleanup/

## Design reference: the glass theme

The user asked for "temat med glas". It is the look of the user's own page "Glaseffekt – exempel" (a private Claude artifact, so other agents may not be able to open it). What it consists of:

- Backdrop: fixed full-page layer, gradient `160deg, #0d1b2a 0%, #13293d 60%, #1b3a4b 100%`, four large round colour blobs that drift slowly (orange `#ff9f1c→#e85d04`, teal `#2ec4b6→#0a9396`, yellow `#ffd166→#f4a261`, pink `#ef476f→#b5179e`), and faint diagonal stripes. A light variant uses `#fdf0d5 → #f6e3c5 → #e9d5b5` with ink `#1d2433`.
- Glass panel: `background: rgba(tint, alpha)`; `backdrop-filter: blur(16px) saturate(160%)`; `border: 1px solid rgba(255,255,255,.35)`; `border-radius: 20px`; `box-shadow: 0 8px 32px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.25)`. Light glass tint `255,255,255` at alpha `.18`; dark glass tint `15,20,35`.
- Type: Bricolage Grotesque (headings and text), JetBrains Mono (code, numbers, labels). Both are under the SIL Open Font License.
- Details: pill-shaped sticky top bar, small uppercase section labels with wide letter spacing, buttons that lift on hover and shrink slightly when pressed, accent colour `#ff9f1c`.
- The example page also shows twenty background scenes taken from a plugin. Their licence is unknown, so they are not used here.

## Decisions

- 2026-11-18: The page remembers the settings in the visitor's own browser (settings only, never the text), with a reset button and a short note on the page. The user approved this after the legal note in F-007.
- 2026-11-18: Publishing is GitHub Pages straight from `main`.
- 2026-11-18: Product text in English (the rules' default; the user was told and did not choose Swedish).
- 2026-11-18: Fonts are served from the repo, not from Google Fonts. The background scenes from the example page are not used (unknown licence).

## One-time actions

- Pending: turn on GitHub Pages for the repo (Settings → Pages → Deploy from a branch → `main`, `/ (root)`). Needed once so the page gets a public address.

## Environment notes

- 2026-11-18 (Claude Code cloud session): GitHub access is limited to this repo. The shared rules are read over the public raw links. No `gh` CLI; GitHub is reached through the session's GitHub tools. Chromium with Playwright is available for checking the page, including phone-sized screens.

## Laws and regulations (brief review, 2026-11-18)

- Storage on the user's device (Swedish Electronic Communications Act, ch. 9 s. 28): only relevant if settings are remembered between visits. See F-007.
- Third-party services: none planned. Fonts are to be served from the repo itself, not from Google Fonts, so no visitor data goes to a third party.
- Personal data: pasted text may contain personal data, but it is processed only in the visitor's own browser and never sent or stored.
- Licences: fonts under SIL OFL (licence texts kept next to the font files).
