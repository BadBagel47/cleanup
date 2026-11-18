// Describes single characters: a short label for the ones that cannot be
// seen, a plain-language type, the code point and (once loaded) the Unicode
// name. Pure logic, no DOM.

const C0 = 'NUL SOH STX ETX EOT ENQ ACK BEL BS TAB LF VT FF CR SO SI DLE DC1 DC2 DC3 DC4 NAK SYN ETB CAN EM SUB ESC FS GS RS US'.split(' ');
const C1 = 'PAD HOP BPH NBH IND NEL SSA ESA HTS HTJ VTS PLD PLU RI SS2 SS3 DCS PU1 PU2 STS CCH MW SPA EPA SOS SGCI SCI CSI ST OSC PM APC'.split(' ');

// Short labels for characters that are invisible or look like a space.
const LABELS = new Map([
  [0x00a0, 'NBSP'], [0x00ad, 'SHY'], [0x034f, 'CGJ'], [0x061c, 'ALM'], [0x1680, 'OGHAM SP'], [0x180e, 'MVS'],
  [0x2000, 'EN QUAD'], [0x2001, 'EM QUAD'], [0x2002, 'EN SP'], [0x2003, 'EM SP'], [0x2004, '1/3 EM SP'],
  [0x2005, '1/4 EM SP'], [0x2006, '1/6 EM SP'], [0x2007, 'FIGURE SP'], [0x2008, 'PUNCT SP'], [0x2009, 'THIN SP'],
  [0x200a, 'HAIR SP'], [0x200b, 'ZWSP'], [0x200c, 'ZWNJ'], [0x200d, 'ZWJ'], [0x200e, 'LRM'], [0x200f, 'RLM'],
  [0x2028, 'LS'], [0x2029, 'PS'], [0x202a, 'LRE'], [0x202b, 'RLE'], [0x202c, 'PDF'], [0x202d, 'LRO'],
  [0x202e, 'RLO'], [0x202f, 'NNBSP'], [0x205f, 'MATH SP'], [0x2060, 'WJ'], [0x2061, 'FUNC'], [0x2062, 'TIMES'],
  [0x2063, 'SEP'], [0x2064, 'PLUS'], [0x2066, 'LRI'], [0x2067, 'RLI'], [0x2068, 'FSI'], [0x2069, 'PDI'],
  [0x2800, 'BLANK'], [0x3000, 'WIDE SP'], [0x3164, 'FILLER'], [0xffa0, 'FILLER'], [0xfeff, 'BOM'],
  [0xfff9, 'IAA'], [0xfffa, 'IAS'], [0xfffb, 'IAT'], [0xfffc, 'OBJ'], [0xe0001, 'LANG TAG'], [0xe007f, 'END TAG'],
]);

const RE = {
  control: /\p{Cc}/u, format: /\p{Cf}/u, space: /\p{Zs}/u, lineSep: /[\p{Zl}\p{Zp}]/u, mark: /\p{M}/u,
  privateUse: /\p{Co}/u, surrogate: /\p{Cs}/u, unassigned: /\p{Cn}/u, emoji: /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}]/u,
  letter: /\p{L}/u, number: /\p{N}/u, dash: /\p{Pd}/u, quote: /[\p{Pi}\p{Pf}]/u, bracket: /[\p{Ps}\p{Pe}]/u,
  punct: /\p{P}/u, math: /\p{Sm}/u, currency: /\p{Sc}/u, symbol: /\p{S}/u,
};
const SCRIPTS = ['Latin', 'Cyrillic', 'Greek', 'Arabic', 'Hebrew', 'Han', 'Hiragana', 'Katakana', 'Hangul', 'Thai', 'Devanagari', 'Armenian', 'Georgian']
  .map((name) => [name, new RegExp(`\\p{Script=${name}}`, 'u')]);

export const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

const isVariationSelector = (cp) => (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef) || (cp >= 0x180b && cp <= 0x180d) || cp === 0x180f;
const isTag = (cp) => cp >= 0xe0020 && cp <= 0xe007e;

/**
 * How a character should be shown when it has to be made visible.
 * Returns null when the character can simply be shown as itself, otherwise
 * { label, kind } where kind is 'ws' (space, tab, line break), 'tag',
 * 'mark' (combining mark) or 'inv' (anything else that cannot be seen).
 */
export function chipFor(cp, showSpaces) {
  if (cp === 0x20) return showSpaces ? { label: '\u00B7', kind: 'ws' } : null;
  if (cp === 0x0a) return { label: '\u21B5', kind: 'ws' };
  if (cp === 0x09) return { label: 'TAB', kind: 'inv' };
  if (cp > 0x20 && cp < 0x7f) return null;
  if (cp < 0x20) return { label: C0[cp], kind: 'inv' };
  if (cp === 0x7f) return { label: 'DEL', kind: 'inv' };
  if (cp >= 0x80 && cp <= 0x9f) return { label: C1[cp - 0x80], kind: 'inv' };
  if (LABELS.has(cp)) return { label: LABELS.get(cp), kind: 'inv' };
  if (cp >= 0xfe00 && cp <= 0xfe0f) return { label: 'VS' + (cp - 0xfe00 + 1), kind: 'inv' };
  if (cp >= 0xe0100 && cp <= 0xe01ef) return { label: 'VS' + (cp - 0xe0100 + 17), kind: 'inv' };
  if (isTag(cp)) return { label: String.fromCharCode(cp - 0xe0000), kind: 'tag' };
  const ch = String.fromCodePoint(cp);
  if (RE.mark.test(ch)) return { label: '\u25CC' + ch, kind: 'mark' };
  if (RE.format.test(ch) || RE.space.test(ch) || RE.lineSep.test(ch) || RE.control.test(ch)
    || RE.privateUse.test(ch) || RE.surrogate.test(ch) || RE.unassigned.test(ch) || isVariationSelector(cp)) {
    return { label: hex(cp), kind: 'inv' };
  }
  return null;
}

/** Plain-language type of a character. */
export function typeOf(cp) {
  if (cp === 0x20) return 'Space';
  if (cp === 0x0a) return 'Line break';
  if (cp === 0x0d) return 'Carriage return (line break)';
  if (cp === 0x09) return 'Tab';
  const ch = String.fromCodePoint(cp);
  if (RE.control.test(ch)) return 'Control character (invisible)';
  if (isTag(cp) || cp === 0xe0001 || cp === 0xe007f) return 'Tag character (invisible)';
  if (isVariationSelector(cp)) return 'Variation selector (invisible)';
  if (cp === 0x2800 || cp === 0x3164 || cp === 0xffa0) return 'Blank filler character';
  if (RE.format.test(ch)) return 'Invisible format character';
  if (RE.space.test(ch)) return 'Space character';
  if (RE.lineSep.test(ch)) return 'Line or paragraph separator';
  if (RE.mark.test(ch)) return 'Combining mark';
  if (RE.privateUse.test(ch)) return 'Private-use character';
  if (RE.surrogate.test(ch)) return 'Broken character half (invalid)';
  if (RE.unassigned.test(ch)) return 'Unassigned or invalid character';
  if (RE.emoji.test(ch) || (cp >= 0x1f1e6 && cp <= 0x1f1ff)) return 'Emoji or pictograph';
  if (RE.letter.test(ch)) {
    const script = SCRIPTS.find(([, re]) => re.test(ch));
    return script ? `Letter (${script[0]})` : 'Letter';
  }
  if (RE.number.test(ch)) return 'Number';
  if (RE.dash.test(ch)) return 'Dash';
  if (RE.quote.test(ch)) return 'Quotation mark';
  if (RE.bracket.test(ch)) return 'Bracket';
  if (RE.punct.test(ch)) return 'Punctuation';
  if (RE.math.test(ch)) return 'Maths symbol';
  if (RE.currency.test(ch)) return 'Currency symbol';
  if (RE.symbol.test(ch)) return 'Symbol';
  return 'Character';
}

// --------------------------------------------------------- Unicode names

let runs = null;
let loading = null;
const splitCache = new Map();

/** Loads the name table (about 260 kB) the first time it is needed. */
export function loadNames() {
  if (!loading) {
    loading = import('./charnames.js').then((m) => { runs = m.NAME_RUNS; return true; }, () => false);
  }
  return loading;
}
export const namesReady = () => runs !== null;

/** Official Unicode name, or null if it is not known (yet). */
export function nameOf(cp) {
  if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x20000 && cp <= 0x323af)) {
    return 'CJK UNIFIED IDEOGRAPH-' + cp.toString(16).toUpperCase();
  }
  if (cp >= 0xac00 && cp <= 0xd7a3) return 'HANGUL SYLLABLE';
  if (cp >= 0xe0100 && cp <= 0xe01ef) return 'VARIATION SELECTOR-' + (cp - 0xe0100 + 17);
  if ((cp >= 0xe000 && cp <= 0xf8ff) || cp >= 0xf0000) return 'PRIVATE USE CHARACTER';
  if (cp >= 0xd800 && cp <= 0xdfff) return 'UNPAIRED SURROGATE';
  if (!runs) return null;
  let lo = 0;
  let hi = runs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (runs[mid][0] <= cp) lo = mid; else hi = mid - 1;
  }
  const [start, joined] = runs[lo];
  if (cp < start) return null;
  let names = splitCache.get(start);
  if (!names) { names = joined.split('|'); splitCache.set(start, names); }
  return names[cp - start] ?? null;
}

// ------------------------------------------------------------- visualise

const PLAIN = /^[\x21-\x7E\u00A1-\u00AC\u00AE-\u02FF]*$/;
const BLANK_ONLY = /^[\s\p{Cf}\p{Cc}\p{Z}]*$/u;

/**
 * Splits text into parts for display: plain strings for what can be shown as
 * is, and { label, kind, raw } for characters that need a visible stand-in.
 * Normal spaces only get a stand-in when the text has nothing visible in it.
 */
export function visualize(text) {
  if (PLAIN.test(text)) return text ? [text] : [];
  const showSpaces = BLANK_ONLY.test(text);
  const parts = [];
  let plain = '';
  for (const ch of text) {
    const chip = chipFor(ch.codePointAt(0), showSpaces);
    if (!chip) { plain += ch; continue; }
    if (plain) { parts.push(plain); plain = ''; }
    parts.push({ label: chip.label, kind: chip.kind, raw: ch });
  }
  if (plain) parts.push(plain);
  return parts;
}

/** One-line plain-text version of the same, for copying the log. */
export function visualizeText(text) {
  return visualize(text).map((p) => (typeof p === 'string' ? p : `[${p.kind === 'ws' && p.raw === ' ' ? 'SPACE' : p.kind === 'ws' ? 'LF' : p.kind === 'mark' ? hex(p.raw.codePointAt(0)) : p.label}]`)).join('');
}

/** The distinct characters of a text with how often each occurs. */
export function tally(text) {
  const counts = new Map();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    counts.set(cp, (counts.get(cp) || 0) + 1);
  }
  return [...counts].map(([cp, n]) => ({ cp, n }));
}
