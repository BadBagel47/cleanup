# HANDOFF

Rules version: v1.14
Inventory: 2026-11-18
Project language: English (product text and README; default for new projects, the user has not chosen otherwise)

## What this is

A web page that cleans text from messy input into plain text ("tvätta text"). Runs entirely in the browser; the text never leaves the device. How it is put together, how to run and test it: [README.md](README.md).

## Current state

- 2026-11-18: Repo created empty; project files added.
- 2026-11-18: First version built and on `main` (F-001 to F-005, F-007): 40 cleaning rules with a setting each, before/after view with line numbers, change log, selection marks with character details, glass theme, remembered settings.
- 2026-11-18: Verified with the tests (`npm test`) and in Chromium on desktop size, phone size (iPhone 13 emulation, touch) and with keyboard only. Not tried on a real phone, and not in Safari or Firefox.
- 2026-11-18: Not published yet. F-006 waits for the user to turn on GitHub Pages once (see One-time actions).

## Next steps

1. When the user has turned on GitHub Pages: check that https://badbagel47.github.io/cleanup/ shows the page, then move F-006 to Done.
2. Ask-backs from the first run are in BACKLOG.md (D-008).

## Publishing

GitHub Pages straight from `main` (root folder), no build step; `.nojekyll` is in place. The repo is public, so Pages is free. Address once turned on: https://badbagel47.github.io/cleanup/ (answered 404 on 2026-11-18, i.e. Pages not yet turned on).

The agent can push straight to `main` here, so the auto-merge workflow is not needed.

## Design reference: the glass theme

The user asked for "temat med glas". It is the look of the user's own page "Glaseffekt – exempel" (a private Claude artifact, so other agents may not be able to open it). What it consists of:

- Backdrop: fixed full-page layer, gradient `160deg, #0d1b2a 0%, #13293d 60%, #1b3a4b 100%`, four large round colour blobs that drift slowly (orange `#ff9f1c→#e85d04`, teal `#2ec4b6→#0a9396`, yellow `#ffd166→#f4a261`, pink `#ef476f→#b5179e`), and faint diagonal stripes. A light variant uses `#fdf0d5 → #f6e3c5 → #e9d5b5` with ink `#1d2433`.
- Glass panel: `background: rgba(tint, alpha)`; `backdrop-filter: blur(16px) saturate(160%)`; light border; `border-radius: 20px`; soft shadow plus a thin inner highlight. The example uses light glass (white at .18). This page uses the example's dark glass tint (about `13,20,36` at .52) in the dark theme and white at .58 in the light theme, because the panels hold a lot of text that has to stay readable over the bright blobs.
- Type: Bricolage Grotesque (headings and text), JetBrains Mono (text boxes, numbers, labels). Served from `fonts/`.
- Details: pill-shaped sticky top bar, small uppercase section labels with wide letter spacing, buttons that lift on hover and shrink slightly when pressed, accent colour `#ff9f1c`.
- The example page also shows twenty background scenes taken from a plugin. Their licence is unknown, so they are not used here.

## Decisions

- 2026-11-18: The page remembers the settings in the visitor's own browser (settings only, never the text), with a button to forget them and a short note on the page. The user approved this after the legal note in F-007.
- 2026-11-18: Publishing is GitHub Pages straight from `main`.
- 2026-11-18: Product text in English (the rules' default; the user was told and did not choose Swedish).
- 2026-11-18: Fonts are served from the repo, not from Google Fonts. The background scenes from the example page are not used (unknown licence).
- 2026-11-18: All cleaning rules are on by default (the user: "Aktivera alla rensningsval som standard"). Four are still off, waiting for the user's answer in D-008, because they delete real letters or the paragraph structure: everything outside basic ASCII, accents, remove all empty lines, join broken lines.
- 2026-11-18: The user asked for settings for double spaces, spaces between the last character and the line break, and spaces before punctuation ("detta är en mening !"). All three are separate rules.

## One-time actions

- Pending: turn on GitHub Pages for the repo: https://github.com/BadBagel47/cleanup/settings/pages → Source "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save. Needed once; after that every push to `main` is published automatically.

## Environment notes

- 2026-11-18 (Claude Code cloud session): GitHub access is limited to this repo; pushing to `main` works. The shared rules are read over the public raw links. No `gh` CLI; GitHub is reached through the session's GitHub tools, which have nothing for turning on Pages. Chromium with Playwright is available for checking the page, including phone-sized screens. https://badbagel47.github.io is reachable for checking the published page.
- 2026-11-18: The agent's file-writing tools may turn `\uXXXX` escapes into the real characters. Run `python3 tools/escape-nonascii.py js/*.js tests/*.mjs` after editing JavaScript so invisible characters stay readable escapes in the source.

## Laws and regulations (brief review, 2026-11-18)

- Storage on the user's device (Swedish Electronic Communications Act, ch. 9 s. 28): the page stores the chosen settings in the browser's local storage. The user was told about the rule and approved it (see Decisions, F-007). No cookies, no tracking.
- Third-party services: none. Fonts and all scripts are served from the repo, so no visitor data goes to a third party (GitHub, as the host, sees ordinary web requests).
- Personal data: pasted text may contain personal data, but it is processed only in the visitor's own browser and never sent or stored.
- Licences: fonts under SIL OFL 1.1 (licence texts in `fonts/`); character names from the Unicode Character Database under the Unicode License v3 (notice in `js/charnames.js` and README.md). The repo itself has no licence file; that is the user's choice to make.
