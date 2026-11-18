# BACKLOG

IDs: B- (bug), F- (feature), D- (planning/design), one running series. Priority: High, Medium, Low.

The user's original request (2026-11-18):

> Jag vill göra en webbsida där man kan tvätta text från konstig input och göra den till ren text. Vill ha inställningar för alla saker den kan rensa upp. Efteråt vill jag kunna se före- efter med ett sätt som gör det lätt att se skillnaden. Ta med radräknare. Man ska kunna se en logg där alla ändringar visas. Markerar man ett stycke text i någa av rutorna så ska man i förebilden se markeringar där det finns saker som rensas bort. Pekar man på markeringarna (även texten som normalt inte syns måste på något sätt visas här) så ser man vad det är för typ av tecken, och vilken regel som flaggade den. Använda temat med glas till sidan

The user's additions during the first run (2026-11-18):

> Aktivera alla rensningsval som standard. Ta med val för dubbla mellanslag i text. Extra mellanslag som ligger mellan riktiga tecken och retur för ny rad, t ex "detta är en mening. " Inställningar för fel sätt att hantera text ska också finnas "detta är en mening !".

## Proposed runs

Nothing ready to run. F-006 waits for the user's one-time action, D-008 for the user's answer.

## Open

### F-006 – Publishing
Priority: High
Status: waiting for the user (2026-11-18)
GitHub Pages straight from `main`, no build step. Everything is in place in the repo. The user has to turn on Pages once (HANDOFF.md, One-time actions). Then: check that https://badbagel47.github.io/cleanup/ shows the page and move this to Done.

### D-008 – Should the last four rules also be on by default?
Priority: Medium
The user asked for every rule to be on by default. Four were left off because, switched on for every text, they delete real letters or the paragraph structure:
- Everything outside basic ASCII: removes å, ä, ö and every other non-English letter.
- Accents: turns å, ä, ö into a, a, o.
- Remove all empty lines: paragraphs lose the empty line between them.
- Join broken lines: every paragraph becomes one long line.
They are one click away in the settings ("All on", or each switch). Question for the user: keep them off by default (recommended), or switch them on too?

## Done

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
