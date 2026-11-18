# Cleanup

A web page that washes messy text into plain text, and shows exactly what it did.

- Paste text, get the cleaned text next to it.
- A setting for every kind of clean-up (40 rules): spaces, lines, invisible characters, letters, typography, markup, symbols, plus a last group, "Stronger clean-up", with the rules that change real text and are off by default (emoji, accents, non-ASCII, empty lines, line joining).
- Before and after, side by side or combined, with line numbers and every difference marked.
- Select text in any box and the before view marks what gets cleaned in that stretch. Point at a mark to see what kind of character it is (name, code point, type) and which rule flagged it. Characters that cannot normally be seen get a visible stand-in.
- A log of every change: where, what it was, what it became, which rule.
- Everything runs in the browser. The text is never stored or sent anywhere. Only the settings are remembered, in the browser's own storage.

## Run it

There is no build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/ (the page uses JavaScript modules, so opening `index.html` straight from disk does not work).

## Test it

```bash
npm test
```

Needs only Node (20 or later), no packages. The tests cover the cleaning rules, the bookkeeping that maps every change back to the original text, and the line model behind the before/after view.

## How it is put together

| Path | What |
| --- | --- |
| `index.html`, `css/style.css` | The page and the glass theme |
| `js/engine.js` | The rules and the engine that applies them and tracks every change. No DOM, runs in Node too |
| `js/diffmodel.js` | Turns a result into lines for the side-by-side and combined views |
| `js/chars.js` | Describes characters: stand-in labels, type, Unicode name |
| `js/app.js` | Everything on the page: settings, views, tooltips, selection marks, log |
| `js/charnames.js`, `js/entities.js` | Generated data, see below |
| `tools/gen-data.py` | Regenerates the two data files from Python's Unicode database |
| `tools/escape-nonascii.py` | Keeps invisible characters in the source as `\uXXXX` escapes |
| `tests/` | Tests, run with `npm test` |

Adding a rule: add an entry to `RULES` in `js/engine.js` (its position decides when it runs), list its id in a group in `GROUPS`, and add a test. A rule that is off by default belongs in the last group, `extra`; a test checks this. The page picks it up by itself.

After editing JavaScript that contains unusual characters, run:

```bash
python3 tools/escape-nonascii.py js/*.js tests/*.mjs
```

## Licences of what is included

- Fonts: Bricolage Grotesque and JetBrains Mono, SIL Open Font License 1.1. The licence texts are in `fonts/`.
- Character names in `js/charnames.js` come from the Unicode Character Database, © Unicode, Inc., used under the [Unicode License v3](https://www.unicode.org/license.txt).
