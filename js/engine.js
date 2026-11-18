// Text-cleaning engine. Pure logic, no DOM: runs in the browser and in Node.
//
// Every rule is a list of passes. A pass looks at the current text and returns
// edits: [start, end, replacement], sorted and non-overlapping. The engine
// applies the passes one after another and keeps track of which part of the
// ORIGINAL text every change came from, so the page can show where things
// were cleaned, by which rule, and map selections between before and after.

import { ENTITY_DATA } from './entities.js';

const ENTITIES = new Map(ENTITY_DATA.split(',').map((pair) => {
  const i = pair.indexOf(':');
  return [pair.slice(0, i), Number(pair.slice(i + 1))];
}));

// ---------------------------------------------------------------- helpers

/**
 * Builds a pass from a global regex. `rep` is a replacement string or a
 * function (match, text, options) returning a string, null (leave as is) or
 * an array of edits with absolute positions.
 */
function rx(re, rep) {
  return (text, options) => {
    const edits = [];
    for (const m of text.matchAll(re)) {
      const r = typeof rep === 'function' ? rep(m, text, options) : rep;
      if (r == null) continue;
      if (Array.isArray(r)) edits.push(...r);
      else edits.push([m.index, m.index + m[0].length, r]);
    }
    return edits;
  };
}

/** Pass that deletes `n` characters at both ends of every match (markers around text). */
function unwrap(re, n) {
  return rx(re, (m) => {
    const end = m.index + m[0].length;
    return [[m.index, m.index + n, ''], [end - n, end, '']];
  });
}

/** Pass that replaces single characters using a lookup table. */
function mapChars(re, table) {
  return rx(re, (m) => (Object.hasOwn(table, m[0]) ? table[m[0]] : null));
}

/** Code point that ends right before index i, or -1. */
function cpBefore(text, i) {
  if (i <= 0) return -1;
  const c = text.charCodeAt(i - 1);
  if (c >= 0xdc00 && c <= 0xdfff && i >= 2) {
    const h = text.charCodeAt(i - 2);
    if (h >= 0xd800 && h <= 0xdbff) return (h - 0xd800) * 0x400 + (c - 0xdc00) + 0x10000;
  }
  return c;
}

/** Code point that starts at index i, or -1. */
function cpAt(text, i) {
  return i < text.length ? text.codePointAt(i) : -1;
}

const str = (cp) => String.fromCodePoint(cp);

const PICTO = /\p{Extended_Pictographic}/u;
const EMOJI_PART = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F]/u;
// Scripts where zero-width joiners and non-joiners are part of correct spelling.
const JOINER_SCRIPT = /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Mongolian}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}\p{Script=Thaana}\p{Script=Nko}]/u;

// ------------------------------------------------------------ rule passes

const HTML_TAG_NAMES = 'a|abbr|address|area|article|aside|audio|b|base|bdi|bdo|big|blockquote|body|br|button|canvas|caption|center|cite|code|col|colgroup|data|datalist|dd|del|details|dfn|dialog|div|dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|h[1-6]|head|header|hgroup|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|link|main|map|mark|menu|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|param|picture|pre|progress|q|rp|rt|ruby|s|samp|script|search|section|select|slot|small|source|span|strike|strong|style|sub|summary|sup|svg|table|tbody|td|template|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|video|wbr|o:p';
const HTML_RE = new RegExp(
  String.raw`<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!doctype\b[^>]*>|<\/?(?:${HTML_TAG_NAMES})(?=[\s/>])[^<>]*>`,
  'gi',
);
const HTML_BREAK = /^<(?:br\b|\/(?:p|div|li|tr|h[1-6]|blockquote|pre|section|article|header|footer|ul|ol|table|dd|dt|figure|figcaption|address|details|summary|main|nav|aside)\b)/i;

const htmlTags = rx(HTML_RE, (m, text) => {
  if (!HTML_BREAK.test(m[0])) return '';
  // A closing block tag or <br> becomes a line break, unless one already follows.
  return text[m.index + m[0].length] === '\n' ? '' : '\n';
});

const htmlEntities = rx(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));/g, (m) => {
  let cp;
  if (m[1]) cp = parseInt(m[1], 10);
  else if (m[2]) cp = parseInt(m[2], 16);
  else cp = ENTITIES.get(m[3]);
  if (!cp || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
  return str(cp);
});

const LINK_TARGET = String.raw`\((?:[^()\s]|\([^()\s]*\))*(?:[ \t]+"[^"\n]*")?\)`;
const markdown = [
  // Code fence lines (```lang), the code itself is kept.
  rx(/^[ \t]{0,3}(?:`{3,}|~{3,})[^\n`]*(?:\n|$)/gm, ''),
  // Images ![alt](url) keep the alt text.
  rx(new RegExp(String.raw`!\[([^\]\n]*)\]` + LINK_TARGET, 'g'), (m) => {
    const end = m.index + m[0].length;
    return [[m.index, m.index + 2, ''], [m.index + 2 + m[1].length, end, '']];
  }),
  // Links [text](url) keep the text.
  rx(new RegExp(String.raw`\[([^\]\n]+)\]` + LINK_TARGET, 'g'), (m) => {
    const end = m.index + m[0].length;
    return [[m.index, m.index + 1, ''], [m.index + 1 + m[1].length, end, '']];
  }),
  // Autolinks <https://…>
  unwrap(/<(?:https?:\/\/|mailto:)[^\s<>]+>/g, 1),
  // Headings: leading #'s and optional closing #'s.
  rx(/^([ \t]{0,3}#{1,6}[ \t]+)(.*?)([ \t]+#+[ \t]*)?$/gm, (m) => {
    const edits = [[m.index, m.index + m[1].length, '']];
    if (m[3]) edits.push([m.index + m[0].length - m[3].length, m.index + m[0].length, '']);
    return edits;
  }),
  // Underlined headings: the === or --- line under a text line.
  rx(/^(?=\S)(.+)\n[ \t]{0,3}(?:=+|-{2,})[ \t]*$/gm, (m) => [[m.index + m[1].length, m.index + m[0].length, '']]),
  // Horizontal rules.
  rx(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, ''),
  // Block quotes.
  rx(/^[ \t]{0,3}(?:>[ \t]?)+/gm, ''),
  // Bold and italic markers.
  unwrap(/\*\*\*(?=\S)[^\n]+?(?<=\S)\*\*\*/g, 3),
  unwrap(/\*\*(?=\S)[^\n]+?(?<=\S)\*\*/g, 2),
  unwrap(/(?<![\p{L}\p{N}_])__(?=\S)[^\n]+?(?<=\S)__(?![\p{L}\p{N}_])/gu, 2),
  unwrap(/~~(?=\S)[^\n]+?(?<=\S)~~/g, 2),
  unwrap(/(?<![*\p{L}\p{N}])\*(?=[^\s*])[^*\n]+?(?<=[^\s*])\*(?![*\p{L}\p{N}])/gu, 1),
  unwrap(/(?<![\p{L}\p{N}_])_(?=[^\s_])[^_\n]+?(?<=[^\s_])_(?![\p{L}\p{N}_])/gu, 1),
  // Inline code.
  unwrap(/(?<!`)`(?!`)[^`\n]+`(?!`)/g, 1),
  // List bullets written with * or + become -.
  rx(/^([ \t]*)[*+](?=[ \t]+\S)/gm, (m) => [[m.index + m[1].length, m.index + m[0].length, '-']]),
];

const TRACKING_PARAM = /^(?:utm_\w+|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|igsh|yclid|twclid|ttclid|li_fat_id|_hsenc|_hsmi|__hssc|__hstc|__hsfp|hsCtaTracking|mkt_tok|oly_anon_id|oly_enc_id|vero_id|vero_conv|s_cid|_ga|_gl|ref_src|ref_url|srsltid|rdt_cid|spm|scm|cmpid|ncid|si)$/i;

function urlTracking(text) {
  const edits = [];
  for (const m of text.matchAll(/https?:\/\/[^\s<>"'`]+/g)) {
    const url = m[0].replace(/[.,;:!?)\]}]+$/, '');
    const q = url.indexOf('?');
    if (q < 0) continue;
    const hash = url.indexOf('#', q);
    const queryEnd = hash < 0 ? url.length : hash;
    const parts = url.slice(q + 1, queryEnd).split('&');
    const drop = parts.map((p) => TRACKING_PARAM.test(p.split('=')[0]));
    if (!drop.includes(true)) continue;
    // Absolute start offset of every parameter.
    const starts = [];
    let at = m.index + q + 1;
    for (const p of parts) { starts.push(at); at += p.length + 1; }
    let i = 0;
    while (i < parts.length) {
      if (!drop[i]) { i++; continue; }
      let j = i;
      while (j + 1 < parts.length && drop[j + 1]) j++;
      const runStart = starts[i];
      const runEnd = starts[j] + parts[j].length;
      // Take the separator along: the one after the run, or the one before it at the end.
      if (j === parts.length - 1) edits.push([runStart - 1, runEnd, '']);
      else edits.push([runStart, runEnd + 1, '']);
      i = j + 1;
    }
  }
  return edits;
}

const ansi = rx(/\x1B(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\)|[@-Z\\-_])/g, '');

const lineEndings = rx(/\r\n|[\r\u0085\u2028\u2029\v\f]/g, (m) =>
  (m[0] === '\r\n' ? [[m.index, m.index + 1, '']] : '\n'));

const emoji = rx(
  /(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)(?:\p{Emoji_Modifier}|\uFE0F|[\u{E0020}-\u{E007F}])*(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)*)*)/gu,
  '',
);

const bullets = rx(
  /^([ \t]*)([\u2022\u25E6\u25AA\u25AB\u2023\u2043\u25CF\u25CB\u25A0\u25A1\u25B8\u25B9\u25BA\u25BB\u27A2\u27A4\u2794\u25C6\u25C7\u25FE\u25FD\u2219\u00B7\u2981\u29BF\uF0A7\uF0B7\uF0D8\uF0FC\uF076])/gm,
  (m, text) => {
    const at = m.index + m[1].length;
    const next = text[at + 1];
    const spaced = next === undefined || next === ' ' || next === '\t' || next === '\n';
    return [[at, at + 1, spaced ? '-' : '- ']];
  },
);

const ligatures = mapChars(/[\uFB00-\uFB06]/g, {
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl', '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',
});

const fullwidth = rx(/[\uFF01-\uFF5E]/g, (m) => String.fromCharCode(m[0].charCodeAt(0) - 0xfee0));

// Small capitals used by "fancy text" generators. Several are also phonetic
// symbols, so they are only converted when they come in a group.
const SMALL_CAPS = {
  '\u1D00': 'a', '\u0299': 'b', '\u1D04': 'c', '\u1D05': 'd', '\u1D07': 'e', '\uA730': 'f', '\u0262': 'g',
  '\u029C': 'h', '\u026A': 'i', '\u1D0A': 'j', '\u1D0B': 'k', '\u029F': 'l', '\u1D0D': 'm', '\u0274': 'n',
  '\u1D0F': 'o', '\u1D18': 'p', '\uA7AF': 'q', '\u0280': 'r', '\uA731': 's', '\u1D1B': 't', '\u1D1C': 'u',
  '\u1D20': 'v', '\u1D21': 'w', '\u028F': 'y', '\u1D22': 'z',
};
const SC = Object.keys(SMALL_CAPS).join('');
const fancyLetters = [
  // Mathematical alphabets (bold, italic, script, fraktur, double-struck, monospace …).
  rx(/[\u{1D400}-\u{1D7FF}]/gu, (m) => m[0].normalize('NFKC')),
  // The same styles for the few letters that live among the letter-like symbols.
  rx(/[\u2102\u210A-\u2113\u2115\u2119-\u211D\u2124\u2128\u212C\u212D\u212F-\u2131\u2133\u2134\u2139\u2145-\u2149]/g, (m) => m[0].normalize('NFKC')),
  // Circled letters.
  rx(/[\u24B6-\u24E9]/g, (m) => m[0].normalize('NFKC')),
  // Squared and negative circled/squared capitals (optionally with an emoji selector).
  rx(/([\u{1F130}-\u{1F149}\u{1F150}-\u{1F169}\u{1F170}-\u{1F189}])\uFE0F?/gu, (m) => {
    const cp = m[1].codePointAt(0);
    const base = cp >= 0x1f170 ? 0x1f170 : cp >= 0x1f150 ? 0x1f150 : 0x1f130;
    return String.fromCharCode(65 + cp - base);
  }),
  // Small capitals, in groups only.
  rx(new RegExp(`(?<![\\p{L}])[${SC}]{2,}(?![\\p{L}])|[${SC}]{3,}`, 'gu'), (m) =>
    Array.from(m[0], (c) => SMALL_CAPS[c]).join('')),
];

function normalize(text, options) {
  const form = options.normalizeForm === 'NFKC' ? 'NFKC' : 'NFC';
  if (text.normalize(form) === text) return [];
  const edits = [];
  // One base character with its marks at a time, so each change stays small.
  const re = /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]+|[^\x00-\x7F]\p{M}*|[\x00-\x7F]\p{M}+/gu;
  for (const m of text.matchAll(re)) {
    const n = m[0].normalize(form);
    if (n !== m[0]) edits.push([m.index, m.index + m[0].length, n]);
  }
  return edits;
}

const combiningDecor = [
  // Strike-through, underline and overline made of combining marks.
  rx(/[\u0305\u0332\u0333\u0335\u0336\u033F]+/g, ''),
  // "Zalgo" text: three or more stacked marks on one letter.
  rx(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{3,}/g, ''),
];

const HOMOGLYPHS = {
  // Cyrillic
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0445': 'x', '\u0443': 'y',
  '\u0456': 'i', '\u0458': 'j', '\u0455': 's', '\u0501': 'd', '\u04BB': 'h', '\u051B': 'q', '\u051D': 'w',
  '\u0475': 'v', '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041A': 'K', '\u041C': 'M', '\u041D': 'H',
  '\u041E': 'O', '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0425': 'X', '\u0423': 'Y', '\u0406': 'I',
  '\u0408': 'J', '\u0405': 'S', '\u051A': 'Q', '\u051C': 'W',
  // Greek
  '\u03BF': 'o', '\u03BD': 'v', '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0396': 'Z', '\u0397': 'H',
  '\u0399': 'I', '\u039A': 'K', '\u039C': 'M', '\u039D': 'N', '\u039F': 'O', '\u03A1': 'P', '\u03A4': 'T',
  '\u03A5': 'Y', '\u03A7': 'X',
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join('')}]`, 'g');

function homoglyphs(text) {
  const edits = [];
  for (const m of text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
    const word = m[0];
    // Only words that mix look-alikes with real Latin letters; pure Greek or
    // Cyrillic words are left alone.
    if (!/[A-Za-z]/.test(word)) continue;
    for (const h of word.matchAll(HOMOGLYPH_RE)) {
      edits.push([m.index + h.index, m.index + h.index + 1, HOMOGLYPHS[h[0]]]);
    }
  }
  return edits;
}

const quotes = mapChars(/[\u2018\u2019\u201A\u201B\u2032\u2035\u00B4\u02BC\u2039\u203A\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB]/g, {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'", '\u2032': "'", '\u2035': "'", '\u00B4': "'",
  '\u02BC': "'", '\u2039': "'", '\u203A': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"', '\u2033': '"', '\u2036': '"', '\u00AB': '"', '\u00BB': '"',
});

const hyphens = rx(/[\u2010\u2011]/g, '-');
const dashes = rx(/[\u2012-\u2015\u2212\u2E3A\u2E3B\uFE58]/g, '-');
const ellipsis = mapChars(/[\u2026\u2025\u22EF]/g, { '\u2026': '...', '\u2025': '..', '\u22EF': '...' });

const ACCENT_SPECIAL = {
  '\u00DF': 'ss', '\u00C6': 'AE', '\u00E6': 'ae', '\u00D8': 'O', '\u00F8': 'o', '\u0110': 'D', '\u0111': 'd',
  '\u00D0': 'D', '\u00F0': 'd', '\u00DE': 'Th', '\u00FE': 'th', '\u0141': 'L', '\u0142': 'l', '\u0152': 'OE',
  '\u0153': 'oe', '\u0131': 'i', '\u0126': 'H', '\u0127': 'h', '\u0166': 'T', '\u0167': 't', '\u014A': 'N',
  '\u014B': 'n',
};
const accents = [
  rx(/[\u00C0-\u024F\u1E00-\u1EFF]/g, (m) => {
    const c = m[0];
    if (Object.hasOwn(ACCENT_SPECIAL, c)) return ACCENT_SPECIAL[c];
    const base = c.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
    return base !== c && /^[A-Za-z]+$/.test(base) ? base : null;
  }),
  rx(/(?<=[A-Za-z])[\u0300-\u036F]+/g, ''),
];

const zeroWidth = rx(/[\u200B\u200C\u200D\u2060\uFEFF\u180E\u034F]/g, (m, text) => {
  const c = m[0];
  if (c === '\u200D' || c === '\u200C') {
    const prev = cpBefore(text, m.index);
    const next = cpAt(text, m.index + 1);
    if (prev >= 0 && next >= 0) {
      const p = str(prev);
      const n = str(next);
      // Keep the joiner inside emoji such as family or profession emoji.
      if (c === '\u200D' && EMOJI_PART.test(p) && PICTO.test(n)) return null;
      // Keep joiners that are part of the spelling in Arabic and Indic scripts.
      if (JOINER_SCRIPT.test(p) && JOINER_SCRIPT.test(n)) return null;
    }
  }
  return '';
});

const softHyphen = rx(/\u00AD/g, '');
const bidi = rx(/[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, '');
// Tag characters, except in flag emoji that are built from them.
const tagChars = rx(/(?<!\u{1F3F4}[\u{E0020}-\u{E007E}]*)[\u{E0000}-\u{E007F}]+/gu, '');

const variationSelectors = rx(/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}\u180B-\u180D\u180F]/gu, (m, text) => {
  const cp = m[0].codePointAt(0);
  const prev = cpBefore(text, m.index);
  if (prev < 0) return '';
  const p = str(prev);
  if (cp === 0xfe0f || cp === 0xfe0e) {
    // Emoji or text style selector: keep after a symbol it can apply to.
    if (PICTO.test(p)) return null;
    if (/[0-9#*]/.test(p) && text.charCodeAt(m.index + 1) === 0x20e3) return null;
    return '';
  }
  if (cp >= 0x180b && cp <= 0x180f) return /\p{Script=Mongolian}/u.test(p) ? null : '';
  if ((cp <= 0xfe02 || cp >= 0xe0100) && /\p{Script=Han}/u.test(p)) return null;
  return '';
});

const otherInvisible = rx(/[\u2061-\u2064\u206A-\u206F\uFFF9-\uFFFC\u{1D173}-\u{1D17A}\u{13430}-\u{1343F}\u{1BCA0}-\u{1BCA3}]/gu, '');
const controlChars = rx(/[\x00-\x08\x0E-\x1F\x7F\x80-\x84\x86-\x9F]/g, '');
const replacementChar = rx(/\uFFFD/g, '');
const privateUse = rx(/[\p{Co}\p{Cs}\p{Noncharacter_Code_Point}]/gu, '');
const asciiOnly = rx(/[^\t\n\r\x20-\x7E]/gu, '');

const unusualSpaces = rx(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u3164\uFFA0\u2800]/g, (m, text) => {
  if (m[0] === '\u2800') {
    // A blank braille cell is a real space inside braille text.
    const isBraille = (cp) => cp > 0x2800 && cp <= 0x28ff;
    if (isBraille(cpBefore(text, m.index)) || isBraille(cpAt(text, m.index + 1))) return null;
  }
  return ' ';
});

// A space between a word and the punctuation that ends it: "a sentence !".
// Smileys such as :) and runs of dots are left alone.
const spaceBeforePunct = rx(
  /(?<=[\p{L}\p{N}"')\]\u00BB\u201D\u2019%])[ \t]+(?=(?:[!?]+|[,.](?![.,])|[;:])(?:\s|$|["'\u00BB\u201D\u2019]|(?<![;:])[)\]]))/gu,
  '',
);

// Spaces just inside brackets: "( like this )".
const spaceInsideBrackets = [
  rx(/(?<=(?:^|[^:;=\-])[(\[])[ \t]+(?=[^\s)\]])/gm, ''),
  rx(/(?<=[^\s:;=\-(\[])[ \t]+(?=[)\]])/g, ''),
];

const tabs = rx(/\t/g, (m, text, options) => ' '.repeat(Number(options.tabWidth) || 4));
const trailingSpaces = rx(/[ \t]+$/gm, '');
const leadingSpaces = rx(/^[ \t]+/gm, '');

// Blank lines beyond the first one in a run.
const collapseBlankLines = rx(/(^|\n)([ \t]*\n)((?:[ \t]*\n)+)/g, (m) => {
  const start = m.index + m[1].length + m[2].length;
  return [[start, start + m[3].length, '']];
});
const removeBlankLines = rx(/(^|\n)((?:[ \t]*\n)+)/g, (m) => {
  const start = m.index + m[1].length;
  return [[start, start + m[2].length, '']];
});

// A single line break between two text lines; lines that start a list are kept.
const joinLines = rx(/(?<=[^\n])\n(?=[^\n])(?![ \t]*(?:[-*+\u2022]|\d+[.)])[ \t])/g, (m, text) => {
  const prev = text[m.index - 1];
  const next = text[m.index + 1];
  return prev === ' ' || prev === '\t' || next === ' ' || next === '\t' ? '' : ' ';
});

// Extra spaces after the first one, inside a line (indentation is kept).
const collapseSpaces = rx(/(?<=[^\s] ) +/g, '');

const trimEdges = [
  rx(/^(?:[ \t]*\n)+/g, ''),
  rx(/(?:\n[ \t]*)+$/g, ''),
];

// ------------------------------------------------------------------ rules

/**
 * Rules in the order they run. `on` is the default. Order matters: markup
 * first, then characters, then spaces and lines.
 */
export const RULES = [
  { id: 'htmlTags', group: 'markup', on: true, label: 'HTML tags',
    desc: 'Removes tags such as <p>, <span …> and <br>, comments and script/style blocks. Paragraph ends and <br> become line breaks.',
    passes: [htmlTags] },
  { id: 'htmlEntities', group: 'markup', on: true, label: 'HTML entities',
    desc: 'Turns codes such as &amp;, &nbsp; and &#8211; into the characters they stand for.',
    passes: [htmlEntities] },
  { id: 'markdown', group: 'markup', on: true, label: 'Markdown marks',
    desc: 'Removes **bold**, _italic_, # headings, > quotes, `code` marks and code fences, and keeps only the text of [links](…).',
    passes: markdown },
  { id: 'urlTracking', group: 'markup', on: true, label: 'Tracking codes in links',
    desc: 'Removes tracking parameters such as utm_source, fbclid and gclid from web addresses.',
    passes: [urlTracking] },
  { id: 'ansi', group: 'invisible', on: true, label: 'Terminal colour codes',
    desc: 'Removes ANSI escape sequences left over from terminal output.',
    passes: [ansi] },
  { id: 'lineEndings', group: 'lines', on: true, label: 'Unusual line breaks',
    desc: 'Makes every line break a normal one: carriage returns, Unicode line and paragraph separators, form feeds and vertical tabs.',
    passes: [lineEndings] },
  { id: 'emoji', group: 'symbols', on: true, label: 'Emoji',
    desc: 'Removes emoji, including flags, skin tones and combined emoji.',
    passes: [emoji] },
  { id: 'bullets', group: 'typography', on: true, label: 'Bullet symbols',
    desc: 'Turns bullet symbols at the start of a line (•, ▪, ●, ➤ …) into a plain hyphen.',
    passes: [bullets] },
  { id: 'ligatures', group: 'letters', on: true, label: 'Ligatures',
    desc: 'Splits joined letters such as ﬁ and ﬂ (common in text copied from PDFs) into separate letters.',
    passes: [ligatures] },
  { id: 'fullwidth', group: 'letters', on: true, label: 'Full-width characters',
    desc: 'Turns wide letters, digits and punctuation (ＡＢＣ１２３) into normal ones.',
    passes: [fullwidth] },
  { id: 'fancyLetters', group: 'letters', on: true, label: 'Fancy letters',
    desc: 'Turns styled letters (𝗯𝗼𝗹𝗱, 𝑖𝑡𝑎𝑙𝑖𝑐, 𝓼𝓬𝓻𝓲𝓹𝓽, 𝕕𝕠𝕦𝕓𝕝𝕖, ⓒⓘⓡⓒⓛⓔⓓ, sᴍᴀʟʟ ᴄᴀᴘs) into normal letters.',
    passes: fancyLetters },
  { id: 'normalize', group: 'letters', on: true, label: 'Unicode normalisation',
    desc: 'Joins letters stored as a base letter plus a separate accent (a + ¨) into one character (ä). NFKC also flattens look-alike forms such as ², ™ and ½.',
    option: { key: 'normalizeForm', label: 'Form', def: 'NFC', choices: [['NFC', 'NFC (safe)'], ['NFKC', 'NFKC (flatten more)']] },
    passes: [normalize] },
  { id: 'combiningDecor', group: 'letters', on: true, label: 'Stacked and decorative marks',
    desc: 'Removes strike-through and underline effects made of combining marks, and piles of marks on one letter ("zalgo" text).',
    passes: combiningDecor },
  { id: 'homoglyphs', group: 'letters', on: true, label: 'Look-alike letters',
    desc: 'Replaces Cyrillic and Greek letters that look like Latin ones (а, е, о, Α, Β) inside words that otherwise use Latin letters.',
    passes: [homoglyphs] },
  { id: 'quotes', group: 'typography', on: true, label: 'Curly quotes',
    desc: 'Turns curly and angled quotation marks and apostrophes (“ ” ‘ ’ « ») into straight ones (" and \').',
    passes: [quotes] },
  { id: 'hyphens', group: 'typography', on: true, label: 'Special hyphens',
    desc: 'Turns the Unicode hyphen and the non-breaking hyphen into the normal hyphen on the keyboard.',
    passes: [hyphens] },
  { id: 'dashes', group: 'typography', on: true, label: 'Long dashes',
    desc: 'Turns en dashes, em dashes and the minus sign (– — −) into a plain hyphen.',
    passes: [dashes] },
  { id: 'ellipsis', group: 'typography', on: true, label: 'Ellipsis character',
    desc: 'Turns the single ellipsis character (…) into three dots.',
    passes: [ellipsis] },
  { id: 'accents', group: 'letters', on: false, label: 'Accents',
    desc: 'Removes accents from Latin letters: é becomes e, ñ becomes n. Also changes å, ä and ö.',
    passes: accents },
  { id: 'zeroWidth', group: 'invisible', on: true, label: 'Zero-width characters',
    desc: 'Removes zero-width spaces, joiners, word joiners and the byte order mark. Joiners that emoji or Arabic and Indic spelling need are kept.',
    passes: [zeroWidth] },
  { id: 'softHyphen', group: 'invisible', on: true, label: 'Soft hyphens',
    desc: 'Removes invisible hyphenation points.',
    passes: [softHyphen] },
  { id: 'bidi', group: 'invisible', on: true, label: 'Text direction marks',
    desc: 'Removes left-to-right and right-to-left marks, embeddings, overrides and isolates.',
    passes: [bidi] },
  { id: 'tagChars', group: 'invisible', on: true, label: 'Hidden tag characters',
    desc: 'Removes invisible "tag" characters that can carry hidden text. Flag emoji that use them are kept.',
    passes: [tagChars] },
  { id: 'variationSelectors', group: 'invisible', on: true, label: 'Variation selectors',
    desc: 'Removes invisible selectors that do nothing or can hide data. The ones that choose emoji style or a real glyph variant are kept.',
    passes: [variationSelectors] },
  { id: 'otherInvisible', group: 'invisible', on: true, label: 'Other invisible characters',
    desc: 'Removes invisible maths operators, obsolete formatting characters, annotation marks and object placeholders.',
    passes: [otherInvisible] },
  { id: 'controlChars', group: 'invisible', on: true, label: 'Control characters',
    desc: 'Removes control characters such as NUL, backspace and escape. Tabs and line breaks are kept.',
    passes: [controlChars] },
  { id: 'replacementChar', group: 'symbols', on: true, label: 'Replacement character',
    desc: 'Removes � marks left behind by encoding errors.',
    passes: [replacementChar] },
  { id: 'privateUse', group: 'symbols', on: true, label: 'Private-use and invalid characters',
    desc: 'Removes characters with no standard meaning (often icon-font symbols that show as boxes) and broken character halves.',
    passes: [privateUse] },
  { id: 'unusualSpaces', group: 'spaces', on: true, label: 'Unusual spaces',
    desc: 'Turns non-breaking spaces, thin spaces, wide spaces and blank filler characters into a normal space.',
    passes: [unusualSpaces] },
  { id: 'asciiOnly', group: 'symbols', on: false, label: 'Everything outside basic ASCII',
    desc: 'Removes every character that is left and is not a basic English letter, digit or keyboard symbol. This also removes å, ä, ö and other non-English letters.',
    passes: [asciiOnly] },
  { id: 'tabs', group: 'spaces', on: true, label: 'Tabs to spaces',
    desc: 'Replaces every tab with spaces.',
    option: { key: 'tabWidth', label: 'Spaces per tab', def: '4', choices: [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8']] },
    passes: [tabs] },
  { id: 'spaceBeforePunct', group: 'spaces', on: true, label: 'Spaces before punctuation',
    desc: 'Removes the space in "a sentence !" and "one , two". Smileys such as :) are left alone. French puts a space before ! ? : ; on purpose.',
    passes: [spaceBeforePunct] },
  { id: 'spaceInsideBrackets', group: 'spaces', on: true, label: 'Spaces inside brackets',
    desc: 'Removes the spaces in "( like this )" so it becomes "(like this)".',
    passes: spaceInsideBrackets },
  { id: 'trailingSpaces', group: 'spaces', on: true, label: 'Spaces at line ends',
    desc: 'Removes spaces and tabs between the last character of a line and the line break, as in "a sentence. ".',
    passes: [trailingSpaces] },
  { id: 'leadingSpaces', group: 'spaces', on: true, label: 'Spaces at line starts',
    desc: 'Removes indentation at the start of every line.',
    passes: [leadingSpaces] },
  { id: 'removeBlankLines', group: 'lines', on: false, label: 'Remove all empty lines',
    desc: 'Removes every empty line.',
    passes: [removeBlankLines] },
  { id: 'collapseBlankLines', group: 'lines', on: true, label: 'Repeated empty lines',
    desc: 'Keeps one empty line where there are several in a row.',
    passes: [collapseBlankLines] },
  { id: 'joinLines', group: 'lines', on: false, label: 'Join broken lines',
    desc: 'Joins lines that were broken in the middle of a paragraph. Empty lines between paragraphs and list items are kept.',
    passes: [joinLines] },
  { id: 'collapseSpaces', group: 'spaces', on: true, label: 'Repeated spaces',
    desc: 'Keeps one space where there are two or more in a row inside a line.',
    passes: [collapseSpaces] },
  { id: 'trimEdges', group: 'lines', on: true, label: 'Empty lines at start and end',
    desc: 'Removes empty lines before the first and after the last line of text.',
    passes: trimEdges },
];

/** Groups, and the rules inside them, in the order the settings show them. */
export const GROUPS = [
  { id: 'spaces', label: 'Spaces and tabs',
    rules: ['collapseSpaces', 'trailingSpaces', 'leadingSpaces', 'spaceBeforePunct', 'spaceInsideBrackets', 'unusualSpaces', 'tabs'] },
  { id: 'lines', label: 'Lines',
    rules: ['lineEndings', 'collapseBlankLines', 'trimEdges', 'removeBlankLines', 'joinLines'] },
  { id: 'invisible', label: 'Invisible characters',
    rules: ['zeroWidth', 'softHyphen', 'bidi', 'tagChars', 'variationSelectors', 'otherInvisible', 'controlChars', 'ansi'] },
  { id: 'letters', label: 'Letters',
    rules: ['normalize', 'ligatures', 'fullwidth', 'fancyLetters', 'combiningDecor', 'homoglyphs', 'accents'] },
  { id: 'typography', label: 'Typography',
    rules: ['quotes', 'hyphens', 'dashes', 'ellipsis', 'bullets'] },
  { id: 'markup', label: 'Markup and links',
    rules: ['htmlTags', 'htmlEntities', 'markdown', 'urlTracking'] },
  { id: 'symbols', label: 'Symbols and leftovers',
    rules: ['emoji', 'replacementChar', 'privateUse', 'asciiOnly'] },
];

const RULE_INDEX = new Map(RULES.map((r, i) => [r.id, i]));
export const ruleById = (id) => RULES[RULE_INDEX.get(id)];

export function defaultSettings() {
  const rules = {};
  const options = {};
  for (const r of RULES) {
    rules[r.id] = r.on;
    if (r.option) options[r.option.key] = r.option.def;
  }
  return { rules, options };
}

// ----------------------------------------------------------------- engine

// A segment covers original[os, oe). t is null while that stretch is
// untouched; otherwise t is what it has become and r lists the rules
// (indexes into RULES) that changed it, in order.

function applyEdits(segs, edits, rule) {
  const out = [];
  const n = edits.length;
  let ei = 0;
  let pos = 0; // offset of the current segment in the text the edits refer to
  let spanning = false; // the current edit began in an earlier segment
  for (const seg of segs) {
    const len = seg.t === null ? seg.oe - seg.os : seg.t.length;
    if (len === 0) { out.push(seg); continue; }
    const end = pos + len;
    if (ei >= n || edits[ei][0] >= end) { out.push(seg); pos = end; continue; }
    if (seg.t === null) {
      let cur = pos;
      while (ei < n && edits[ei][0] < end) {
        const [s, e, r] = edits[ei];
        const a = s > pos ? s : pos;
        const b = e < end ? e : end;
        if (a > cur) out.push({ os: seg.os + (cur - pos), oe: seg.os + (a - pos), t: null, r: null });
        out.push({ os: seg.os + (a - pos), oe: seg.os + (b - pos), t: spanning ? '' : r, r: [rule] });
        cur = b;
        if (e <= end) { ei++; spanning = false; } else { spanning = true; break; }
      }
      if (cur < end) out.push({ os: seg.os + (cur - pos), oe: seg.oe, t: null, r: null });
    } else {
      let cur = pos;
      let text = '';
      while (ei < n && edits[ei][0] < end) {
        const [s, e, r] = edits[ei];
        const a = s > pos ? s : pos;
        const b = e < end ? e : end;
        text += seg.t.slice(cur - pos, a - pos) + (spanning ? '' : r);
        cur = b;
        if (e <= end) { ei++; spanning = false; } else { spanning = true; break; }
      }
      text += seg.t.slice(cur - pos);
      out.push({ os: seg.os, oe: seg.oe, t: text, r: seg.r.includes(rule) ? seg.r : [...seg.r, rule] });
    }
    pos = end;
  }
  // Insertions at the very end of the text.
  for (; ei < n; ei++) {
    const r = edits[ei][2];
    if (!r) continue;
    const at = out.length ? out[out.length - 1].oe : 0;
    out.push({ os: at, oe: at, t: r, r: [rule] });
  }
  return out;
}

function applyToString(text, edits) {
  let out = '';
  let cur = 0;
  for (const [s, e, r] of edits) {
    out += text.slice(cur, s) + r;
    cur = e;
  }
  return out + text.slice(cur);
}

const sameRules = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function finalize(segs, input) {
  const out = [];
  for (const seg of segs) {
    let s = seg;
    // A change that ended up identical to the original is no change.
    if (s.t !== null && s.t === input.slice(s.os, s.oe)) {
      if (s.os === s.oe) continue;
      s = { os: s.os, oe: s.oe, t: null, r: null };
    }
    const last = out[out.length - 1];
    if (last && last.t === null && s.t === null) last.oe = s.oe;
    else if (last && last.t !== null && s.t !== null && sameRules(last.r, s.r)) {
      last.oe = s.oe;
      last.t += s.t;
    } else out.push({ ...s });
  }
  return out;
}

/** Offsets where each line of `text` starts. */
export function lineStarts(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

/** Zero-based index of the line containing `offset`. */
export function lineIndex(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export const countLines = (text) => (text.length ? lineStarts(text).length : 0);

/**
 * Cleans `input` with the given settings.
 *
 * Returns the cleaned text plus everything needed to explain it:
 *   segs     every stretch of the original in order, changed or not, with
 *            its position in the output (`out`) and change number (`ci`)
 *   changes  one entry per changed stretch: where (os, oe, line, col), what
 *            it was (before), what it became (after) and which rules did it
 *   counts   number of changes per rule id
 */
export function clean(input, settings) {
  let segs = input.length ? [{ os: 0, oe: input.length, t: null, r: null }] : [];
  let cur = input;
  for (let i = 0; i < RULES.length; i++) {
    const rule = RULES[i];
    if (!settings.rules[rule.id]) continue;
    for (const pass of rule.passes) {
      const edits = pass(cur, settings.options).filter(([s, e, r]) => cur.slice(s, e) !== r);
      if (!edits.length) continue;
      segs = applyEdits(segs, edits, i);
      cur = applyToString(cur, edits);
    }
  }
  segs = finalize(segs, input);

  const starts = lineStarts(input);
  const changes = [];
  const counts = {};
  let out = 0;
  for (const seg of segs) {
    seg.out = out;
    if (seg.t === null) {
      seg.ci = -1;
      out += seg.oe - seg.os;
      continue;
    }
    seg.ci = changes.length;
    const line = lineIndex(starts, seg.os);
    const rules = seg.r.map((ri) => RULES[ri].id);
    for (const id of rules) counts[id] = (counts[id] || 0) + 1;
    changes.push({
      ci: seg.ci, os: seg.os, oe: seg.oe, out,
      before: input.slice(seg.os, seg.oe), after: seg.t,
      rules, line: line + 1, col: seg.os - starts[line] + 1,
    });
    out += seg.t.length;
  }
  return { input, output: cur, segs, changes, counts };
}

/**
 * Maps a range in the cleaned text to the range of the original it came
 * from. Things removed right at the edges of the range are included.
 */
export function outputRangeToOriginal(result, start, end) {
  const { segs, input } = result;
  if (!segs.length) return [0, 0];
  let s = null;
  let e = null;
  for (const seg of segs) {
    const len = seg.t === null ? seg.oe - seg.os : seg.t.length;
    const segEnd = seg.out + len;
    if (seg.out > end) break;
    // Something removed counts when it sits inside the range or at its edge;
    // anything else has to overlap the range.
    const touches = len === 0 ? seg.out >= start : seg.out < end && segEnd > start;
    if (!touches) continue;
    if (seg.t === null) {
      if (s === null) s = seg.os + (Math.max(start, seg.out) - seg.out);
      e = seg.os + (Math.min(end, segEnd) - seg.out);
    } else {
      if (s === null) s = seg.os;
      e = seg.oe;
    }
  }
  if (s === null) return [input.length, input.length];
  return [s, Math.max(s, e)];
}
