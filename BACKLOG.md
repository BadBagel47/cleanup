# BACKLOG

IDs: B- (bug), F- (feature), D- (planning/design), one running series. Priority: High, Medium, Low.

The user's original request (2026-11-18):

> Jag vill göra en webbsida där man kan tvätta text från konstig input och göra den till ren text. Vill ha inställningar för alla saker den kan rensa upp. Efteråt vill jag kunna se före- efter med ett sätt som gör det lätt att se skillnaden. Ta med radräknare. Man ska kunna se en logg där alla ändringar visas. Markerar man ett stycke text i någa av rutorna så ska man i förebilden se markeringar där det finns saker som rensas bort. Pekar man på markeringarna (även texten som normalt inte syns måste på något sätt visas här) så ser man vad det är för typ av tecken, och vilken regel som flaggade den. Använda temat med glas till sidan

The user's additions during the first run (2026-11-18):

> Aktivera alla rensningsval som standard. Ta med val för dubbla mellanslag i text. Extra mellanslag som ligger mellan riktiga tecken och retur för ny rad, t ex "detta är en mening. " Inställningar för fel sätt att hantera text ska också finnas "detta är en mening !".

## Proposed runs

Prioritised for: the user's latest wish.

- **A** – strong model, medium level – Own address cleanup.trythis.one – waits for the owner's one-time action
  - F-011 – Create the DNS record from a workflow with the owner's Cloudflare token, then point GitHub Pages at cleanup.trythis.one and check the page and HTTPS there
  - Approved 2026-11-19 with the recommendation ("Kör A rek"): DNS only (grey cloud); the owner's yes covers creating this one DNS record.

## Open

### F-011 – Publish on cleanup.trythis.one
Status: waiting for the owner (2026-11-19): the secret `CLOUDFLARE_API_TOKEN` is missing in this repo, see HANDOFF.md Next steps. The DNS workflow is in place; no DNS record and no `CNAME` file yet.
Priority: High
The user (2026-11-19): "Vi lägger den på cleanup.trythis.one".
- Agent: add a `CNAME` file containing `cleanup.trythis.one` to the repo root. With "Deploy from a branch" that is what sets the custom domain for GitHub Pages; https://badbagel47.github.io/cleanup/ then redirects to the new address. Update the publishing section in HANDOFF.md and the link in README.md.
- User, at the DNS provider of trythis.one: a CNAME record `cleanup` → `badbagel47.github.io`. If the provider is Cloudflare, the record must be "DNS only" (grey cloud), otherwise GitHub cannot issue the certificate. Then tick "Enforce HTTPS" in the repo's Pages settings once GitHub offers it (can take up to about an hour after DNS is in place).
- Recommended, not required: verify trythis.one for the GitHub account (Settings → Pages → Add a domain, a TXT record), so no other GitHub account can ever take over a subdomain of it.
- How DNS is edited (from network-kit's HANDOFF.md, read 2026-11-19): the owner's Cloudflare token is the GitHub secret `CLOUDFLARE_API_TOKEN`, the same token in every repo that needs it; since 2026-11-19 it may edit DNS records (Zone DNS Edit + Zone Read) on the account's zones, so agents add subdomains of trythis.one from a workflow, with the owner's yes per change. Zone Edit is deliberately not included. trythis.one lets only connections from Sweden through (proxied records); checks from outside use the secret header `x-trythis-country-bypass` (secret `TRYTHIS_COUNTRY_BYPASS`).
- Plan: a workflow here that creates the record `cleanup` → `badbagel47.github.io` when a small DNS file in the repo changes (create or update only, never delete), run after the owner's yes; then the `CNAME` file. The secret `CLOUDFLARE_API_TOKEN` turned out to be missing in this repo (2026-11-19).
- Order: the moment the `CNAME` file is in, the github.io address redirects to cleanup.trythis.one, so the page is unreachable until the DNS record works. Recommended order: the user adds the DNS record first and says so, then the agent pushes the `CNAME` file right away (the short gap where the record points at GitHub without a site is harmless, and verifying the domain removes even that risk).
- The agent cannot do the DNS record (outside GitHub) and has no tool for the Pages settings page, so "Enforce HTTPS" may need one click from the user.
- Checking: the session's network does not reach trythis.one (blocked by the network policy, checked 2026-11-19). The run asks the user to allow cleanup.trythis.one in the environment's network settings, or the user checks the page themselves.

## Done

### F-009 – Keep emoji by default
Done 2026-11-18. The user (2026-11-18): "Tillåt emojis som default". The "Emoji" rule becomes off by default; it can still be switched on. Checked on 2026-11-18: with the emoji rule off, every common emoji survives the other default rules (faces, skin tones, families, flags, keycaps, hearts) except four that "Fancy letters" turns into letters: ℹ️ Ⓜ️ 🅰️ 🅿️. Fix: "Fancy letters" leaves a letter alone when it is written as an emoji (followed by the emoji selector). Update the test for the defaults, add tests for emoji surviving a standard wash, record the decision in HANDOFF.md. Also: the space between an emoji and the punctuation after it ("great 👍 !") is removed by "Spaces before punctuation".

### D-010 – Own group for the rules that are off by default
Done 2026-11-18. The user (2026-11-18): "De som är av ska vara av. Men frågan är om de ska lyftas ut och läggas separat? Så att de som normalt sätt är av får en egen grupp?"
Proposal: a new group last in the settings holding the rules that are off by default: Everything outside basic ASCII, Accents, Remove all empty lines, Join broken lines, and (after F-009) Emoji. A short line under the group heading says they change real text and are off unless switched on. The other groups then contain only rules that are on by default. "Standard", "All on" and "All off" work as before. Approved with the recommendation: named "Stronger clean-up (off by default)", Emoji included. Visitors' stored settings now keep only what they changed themselves, so later changes of a default reach them too; an emoji choice stored by the first version is ignored.

### D-008 – Should the last four rules also be on by default?
Decided 2026-11-18 by the user: no, they stay off ("De som är av ska vara av"). The four: Everything outside basic ASCII, Accents, Remove all empty lines, Join broken lines. Follow-up: D-010.

### F-006 – Publishing
Done 2026-11-18. GitHub Pages from `main` is on; https://badbagel47.github.io/cleanup/ shows the page, checked in Chromium at desktop and phone size (fonts load, no errors, sample, marks and tooltips work).

### F-001 – Page in the glass theme
Done 2026-11-18. Single page, no build step, look taken from the user's page "Glaseffekt – exempel": drifting colour blobs behind frosted glass panels, pill top bar, Bricolage Grotesque and JetBrains Mono served from the repo. Light and dark variant (follows the device, can be switched), button to pause the background motion, motion off for visitors who asked their device for reduced motion. Web basics from WEB.md are in from the start. Works on a phone-sized screen and with keyboard only.

### F-002 – Cleaning rules with a setting for each
Done 2026-11-18. 40 rules in seven groups (spaces and tabs, lines, invisible characters, letters, typography, markup and links, symbols and leftovers), each with its own switch, a short explanation and a counter showing how many changes it made in the current text. "Standard", "All on" and "All off" buttons. All rules are on by default except four (D-008). Includes the user's additions: repeated (double) spaces, spaces at line ends, spaces before punctuation, spaces inside brackets.

### F-003 – Before/after comparison with line numbers
Done 2026-11-18. Side by side (lines paired so both sides stay aligned) or combined, both with line numbers. Cleaned parts are marked in the before view and what they became in the after view; invisible characters are drawn as labelled stand-ins. Changed lines are marked in the margin, "Changed lines only" hides the rest. Line and character counters under both text boxes, number of changes in the heading. Long texts are shown a part at a time.

### F-004 – Change log
Done 2026-11-18. Every change with line and column, what it was, what it became and the rule. Filter per rule with totals, click an entry to jump to the place in the before/after view, copy or download the log.

### F-005 – Selection marks and character details
Done 2026-11-18. Selecting text in the messy box, the clean box or the before/after view marks every cleaned place in that stretch in the before view, dims the rest and says what was found. Pointing at a mark (tap on a phone, Tab and arrow keys on a keyboard) shows the character's name, code point and type, what it became, the rule that flagged it and where it is.

### F-007 – Remember settings between visits
Done 2026-11-18. The switches, the chosen layout and the theme are stored in the visitor's own browser, never the text. A note on the page says so and "Forget my settings" removes them.
