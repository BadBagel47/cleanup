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
- 2026-11-18: Published on GitHub Pages: https://badbagel47.github.io/cleanup/ (F-006), checked in Chromium at desktop and phone size.
- 2026-11-18: Emoji are kept by default (F-009), and the five rules that are off by default have their own group last in the settings (D-010). Published and checked.

## Next steps

1. F-011: move the page to cleanup.trythis.one once the user says go (needs a DNS record from the user).

## Publishing

GitHub Pages straight from `main` (root folder), no build step; `.nojekyll` is in place. The repo is public, so Pages is free. Live address: https://badbagel47.github.io/cleanup/ (turned on by the user 2026-11-18). Every push to `main` is published within a minute or two.

The agent can push straight to `main` here, so the auto-merge workflow is not needed.

There is also an old private preview, a Claude artifact called "Cleanup – preview" (owner only), made before Pages was on. It is not updated; the user can delete it whenever they like.

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
- 2026-11-18: All cleaning rules are on by default (the user: "Aktivera alla rensningsval som standard"), except four that delete real letters or the paragraph structure: everything outside basic ASCII, accents, remove all empty lines, join broken lines. The user confirmed these stay off (D-008).
- 2026-11-18: The rules that are off by default get their own group last in the settings, "Stronger clean-up (off by default)", Emoji included (D-010, approved with the recommendation).
- 2026-11-18: Emoji are kept by default (the user: "Tillåt emojis som default"); the Emoji rule becomes off by default with F-009.
- 2026-11-18: The user asked for settings for double spaces, spaces between the last character and the line break, and spaces before punctuation ("detta är en mening !"). All three are separate rules.

## One-time actions

- Done 2026-11-18: GitHub Pages turned on (Deploy from a branch, `main`, root).
- Done (per the owner, 2026-11-19): the GitHub secret `CLOUDFLARE_API_TOKEN` is available to this repo ("finns redan sedan länge tillbaka"). Not yet seen in use here; the first DNS workflow run confirms it.
- Proposed 2026-11-19, waiting for the user: let agents turn on "Enforce HTTPS" for GitHub Pages in all the user's repos. Agents have no tool for Pages settings, and as far as known the Actions token cannot change them (the API needs the Administration and Pages permissions; GitHub's docs were not reachable from the session to confirm). Proposal: one fine-grained token (all repos, Pages + Administration read/write) stored as a secret in one central repo, and a scheduled workflow there that turns on "Enforce HTTPS" wherever a custom domain has its certificate. Risk: Administration write is a broad permission (repository settings, including deleting a repository). Where the workflow lives is for the user to decide; it concerns all repos, so it belongs with agent-rules rather than in this repo.

## Environment notes

- 2026-11-18 (Claude Code cloud session): GitHub access is limited to this repo; pushing to `main` works. The shared rules are read over the public raw links. No `gh` CLI; GitHub is reached through the session's GitHub tools, which have nothing for turning on Pages. Chromium with Playwright is available for checking the page, including phone-sized screens. https://badbagel47.github.io is reachable for checking the published page.
- 2026-11-19: The environment now allows `*.trythis.one`, so cleanup.trythis.one can be checked from the session once its DNS record exists (bare trythis.one, public DNS lookup services and api.cloudflare.com are still blocked). No Cloudflare access in this session: no Cloudflare tool, no saved key, api.cloudflare.com refused (checked 2026-11-19, after the user said Cloudflare DNS had been set up for Claude with another agent).
- 2026-11-18: The agent's file-writing tools may turn `\uXXXX` escapes into the real characters. Run `python3 tools/escape-nonascii.py js/*.js tests/*.mjs` after editing JavaScript so invisible characters stay readable escapes in the source.

## Laws and regulations (brief review, 2026-11-18)

- Storage on the user's device (Swedish Electronic Communications Act, ch. 9 s. 28): the page stores the chosen settings in the browser's local storage. The user was told about the rule and approved it (see Decisions, F-007). No cookies, no tracking.
- Third-party services: none. Fonts and all scripts are served from the repo, so no visitor data goes to a third party (GitHub, as the host, sees ordinary web requests).
- Personal data: pasted text may contain personal data, but it is processed only in the visitor's own browser and never sent or stored.
- Licences: fonts under SIL OFL 1.1 (licence texts in `fonts/`); character names from the Unicode Character Database under the Unicode License v3 (notice in `js/charnames.js` and README.md). The repo itself has no licence file; that is the user's choice to make.
