# BACKLOG

IDs: B- (bug), F- (feature), D- (planning/design), one running series. Priority: High, Medium, Low.

The user's original request (2026-11-18):

> Jag vill göra en webbsida där man kan tvätta text från konstig input och göra den till ren text. Vill ha inställningar för alla saker den kan rensa upp. Efteråt vill jag kunna se före- efter med ett sätt som gör det lätt att se skillnaden. Ta med radräknare. Man ska kunna se en logg där alla ändringar visas. Markerar man ett stycke text i någa av rutorna så ska man i förebilden se markeringar där det finns saker som rensas bort. Pekar man på markeringarna (även texten som normalt inte syns måste på något sätt visas här) så ser man vad det är för typ av tecken, och vilken regel som flaggade den. Använda temat med glas till sidan

## Proposed runs

Prioritised for: a complete, usable first version in one go.

- **A** – strong model, high level – The whole text-cleaning page, first version
  - F-001 – Build the page in the glass theme, usable on phone and with keyboard
  - F-002 – Cleaning rules, each with its own setting
  - F-003 – Before/after comparison with line numbers and highlighted differences
  - F-004 – Log listing every change
  - F-005 – Select text in either box to mark what gets cleaned in the before view; point at a mark to see the character type and the rule
  - F-006 – Publish the page on GitHub Pages
  - F-007 – Remember the settings between visits
  - Question (F-007): Should the page remember the settings in the visitor's browser? Recommendation: yes, settings only, never the text, with a reset button and a short note on the page.
  - Question (F-006): Publish with GitHub Pages straight from main? Recommendation: yes; free for a public repo, needs one click by the user once.

## Open

### F-001 – Page in the glass theme
Priority: High
Single page, no build step. Look taken from the user's page "Glaseffekt – exempel" (details in HANDOFF.md): drifting colour blobs behind frosted glass panels, pill top bar, Bricolage Grotesque and JetBrains Mono served from the repo. Light and dark variant. Motion pauses for visitors who have asked their device for reduced motion. Web basics from WEB.md included from the start (no blue tap highlight, focus ring only for keyboard users, pressed state on buttons, own arrow in dropdowns). Works on a phone-sized screen and with keyboard only.

### F-002 – Cleaning rules with a setting for each
Priority: High
Every kind of clean-up is its own rule that can be switched on or off, grouped so the list is easy to scan, with "all on / all off / reset" and a short explanation per rule. Planned rules:
- Invisible characters: zero-width characters, byte order mark, soft hyphens, direction marks (left-to-right/right-to-left controls), invisible "tag" characters, variation selectors, other invisible format characters.
- Control characters: everything below space except tab and line break, plus the delete character and the C1 range.
- Spaces: non-breaking and other unusual spaces to normal space, tabs to spaces (choice of width), several spaces in a row to one, spaces at the end of lines, spaces at the start of lines.
- Lines: unify line endings (Windows/old Mac/Unicode line separators), collapse several empty lines to one, remove all empty lines, trim empty lines at the start and end, join lines that were broken mid-sentence.
- Typography to plain: curly quotes to straight, long dashes to hyphen, ellipsis character to three dots, ligatures (ﬁ, ﬂ) to letters, fullwidth letters and digits to normal, "fancy" maths-alphabet letters (𝓯𝓪𝓷𝓬𝔂, 𝗯𝗼𝗹𝗱) to normal, stacked combining marks ("zalgo") removed, optional removal of accents.
- Look-alike letters: Cyrillic/Greek letters that look like Latin ones, inside otherwise Latin words (off by default, since it changes real text in those languages).
- Markup: HTML tags, HTML entities (`&amp;`, `&#8211;`), Markdown marks (bold, headings, links, lists), tracking parameters in links (utm_ and similar).
- Symbols: emoji, bullet characters to hyphen, other symbols outside plain text (off by default).
- Unicode normalisation form (NFC/NFKC) as a choice.
Safe rules on by default; rules that change the meaning or look of real text off by default.

### F-003 – Before/after comparison with line numbers
Priority: High
Before and after side by side (stacked on a phone), both with line numbers, scrolling together. Removed parts marked in the before view and added/replaced parts marked in the after view, with invisible characters drawn as visible symbols. Lines that changed are marked in the margin. A switch between side-by-side and one combined view. Counters for lines, characters and number of changes.

### F-004 – Change log
Priority: High
A list of every change: line and position, what was there (shown visibly even if it is an invisible character), what it became, and which rule did it. Grouped totals per rule, filter by rule, click an entry to jump to the place in the before view. Can be copied or downloaded.

### F-005 – Selection marks and character details
Priority: High
Selecting a stretch of text in either box marks, in the before view, every place within that stretch where something is cleaned away. Invisible characters get a visible placeholder there. Pointing at a mark (or tapping it on a phone, or reaching it with the keyboard) shows what kind of character it is (name and code), and which rule flagged it.

### F-006 – Publishing
Priority: High
GitHub Pages straight from `main`, no build step. Needs the user to turn on Pages once (see HANDOFF.md, one-time actions). After that every change is published automatically.

### F-007 – Remember settings between visits
Priority: Medium
Store which rules are on in the visitor's own browser, so the choices are still there next time. Only the settings, never the text. Reset button and a short note on the page.
Legal note: storing something on a visitor's device falls under the Swedish Electronic Communications Act (ch. 9 s. 28). Storage needed for a function the visitor has asked for is normally allowed without a consent banner, and remembered settings are usually seen as such, but that is not a legal guarantee; PTS is the authority to check with. Alternative: do not remember anything, the settings start from the defaults on every visit.

## Done

Nothing yet.
