// The page: settings, the two text boxes, the before/after view with marks,
// tooltips, the selection inspector and the change log.

import { RULES, GROUPS, ruleById, defaultSettings, clean, outputRangeToOriginal, countLines } from './engine.js';
import { buildModel, collapseUnchanged } from './diffmodel.js';
import { visualize, visualizeText, tally, typeOf, nameOf, hex, loadNames, namesReady } from './chars.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}
const fmt = (n) => n.toLocaleString('en-US');
const plural = (n, one, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;

const input = $('input');
const output = $('output');
const diff = $('diff');
const tip = $('tip');
const root = document.documentElement;

// ------------------------------------------------------- stored settings

const STORE_KEY = 'cleanup:settings:v1';
const narrow = () => matchMedia('(max-width: 760px)').matches;

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
}

/** Defaults, with any valid remembered choices on top. */
function loadSettings() {
  const s = defaultSettings();
  const stored = readStore();
  for (const r of RULES) {
    if (typeof stored.rules?.[r.id] === 'boolean') s.rules[r.id] = stored.rules[r.id];
    if (r.option) {
      const v = stored.options?.[r.option.key];
      if (r.option.choices.some(([value]) => value === v)) s.options[r.option.key] = v;
    }
  }
  return s;
}

let settings = loadSettings();
const ui = { view: null, onlyChanged: false, theme: null, motion: true, ...(readStore().ui || {}) };
if (ui.view !== 'side' && ui.view !== 'unified') ui.view = narrow() ? 'unified' : 'side';

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ rules: settings.rules, options: settings.options, ui }));
  } catch { /* storage unavailable: the page works without it */ }
}

// ------------------------------------------------------------ app state

let result = clean('', settings);
let model = null;
let display = [];             // rows currently shown in the before/after view
let renderedStart = 0;        // first and one-past-last row that are in the page:
let rendered = 0;             // long texts are shown a window at a time
let rowStart = [];            // row index -> offset in the original where it begins
let rowOfChange = [];         // change number -> index in display
const markEls = new Map();    // change number -> its mark elements
let beforeTokens = [];        // before-side token elements in text order
let focus = null;             // selected stretch of the original: { s, e, from }
let logFilter = null;
let logShown = 0;
let pinned = null;            // mark whose tooltip stays open
let tipFor = null;
const ROW_CHUNK = 600;
const LOG_CHUNK = 300;

// ------------------------------------------------------------- settings

const CHEVRON = '<svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function buildSettings() {
  const host = $('rules');
  host.textContent = '';
  const openAll = !narrow();
  GROUPS.forEach((group, gi) => {
    const details = el('details', 'group');
    details.open = openAll || gi === 0;
    const summary = el('summary');
    summary.append(el('span', 'g-name', group.label));
    const count = el('span', 'g-count');
    count.dataset.group = group.id;
    summary.append(count);
    summary.insertAdjacentHTML('beforeend', CHEVRON);
    details.append(summary);
    const body = el('div', 'group-body');
    for (const id of group.rules) body.append(ruleRow(ruleById(id)));
    details.append(body);
    host.append(details);
  });
  syncSettings();
}

function ruleRow(rule) {
  const row = el('div', 'rule');
  const main = el('label', 'rule-main');
  const box = el('input', 'sw');
  box.type = 'checkbox';
  box.dataset.rule = rule.id;
  const text = el('span', 'rule-text');
  text.append(el('span', 'rule-name', rule.label), el('span', 'rule-desc', rule.desc));
  const count = el('span', 'count');
  count.dataset.count = rule.id;
  count.hidden = true;
  main.append(box, text, count);
  row.append(main);
  if (rule.option) {
    const opt = el('label', 'rule-opt');
    opt.append(el('span', null, rule.option.label));
    const select = el('select');
    select.dataset.option = rule.option.key;
    for (const [value, label] of rule.option.choices) {
      const o = el('option', null, label);
      o.value = value;
      select.append(o);
    }
    opt.append(select);
    row.append(opt);
  }
  return row;
}

/** Makes the controls show the current settings. */
function syncSettings() {
  for (const box of document.querySelectorAll('[data-rule]')) box.checked = settings.rules[box.dataset.rule];
  for (const select of document.querySelectorAll('[data-option]')) select.value = settings.options[select.dataset.option];
  let on = 0;
  for (const group of GROUPS) {
    const n = group.rules.filter((id) => settings.rules[id]).length;
    on += n;
    document.querySelector(`[data-group="${group.id}"]`).textContent = `${n}/${group.rules.length}`;
  }
  $('rulesOn').textContent = `${on} of ${RULES.length} on`;
}

function settingsChanged() {
  syncSettings();
  save();
  process();
}

$('rules').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.rule) settings.rules[t.dataset.rule] = t.checked;
  else if (t.dataset.option) settings.options[t.dataset.option] = t.value;
  else return;
  settingsChanged();
});
$('presetDefault').addEventListener('click', () => { settings = defaultSettings(); settingsChanged(); });
$('presetAll').addEventListener('click', () => { for (const r of RULES) settings.rules[r.id] = true; settingsChanged(); });
$('presetNone').addEventListener('click', () => { for (const r of RULES) settings.rules[r.id] = false; settingsChanged(); });
$('forgetBtn').addEventListener('click', () => {
  settings = defaultSettings();
  syncSettings();
  try { localStorage.removeItem(STORE_KEY); } catch { /* nothing stored */ }
  process();
  toast('Settings forgotten and back to standard');
});

// ------------------------------------------------------------- cleaning

let timer = 0;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(process, input.value.length > 200000 ? 400 : 90);
}

function process() {
  clearTimeout(timer);
  const keepFocus = focus && result.input === input.value;
  result = clean(input.value, settings);
  if (output.value !== result.output) output.value = result.output;
  if (!keepFocus) focus = null;
  updateCounters();
  renderDiff();
  renderLog();
  applyFocus(false);
}

const charCount = (text) => { let n = 0; for (const _ of text) n++; return n; };

function updateCounters() {
  const li = countLines(result.input);
  const lo = countLines(result.output);
  const ci = charCount(result.input);
  const co = charCount(result.output);
  setCounter($('inputCount'), li, ci, null, null);
  setCounter($('outputCount'), lo, co, lo - li, co - ci);
  const n = result.changes.length;
  const lines = new Set(result.changes.map((c) => c.line)).size;
  $('summary').textContent = !result.input ? '' : n ? `${plural(n, 'change')} on ${plural(lines, 'line')}` : 'Nothing to clean';
  for (const badge of document.querySelectorAll('[data-count]')) {
    const c = result.counts[badge.dataset.count] || 0;
    badge.hidden = !c;
    badge.textContent = fmt(c);
    badge.title = `${plural(c, 'change')} in this text`;
  }
}

function setCounter(node, lines, chars, dLines, dChars) {
  node.textContent = '';
  const part = (n, word, delta) => {
    node.append(el('b', null, fmt(n)), ` ${n === 1 ? word : word + 's'}`);
    if (delta) node.append(` (${delta > 0 ? '+' : '\u2212'}${fmt(Math.abs(delta))})`);
  };
  part(lines, 'line', dLines);
  node.append(' \u00B7 ');
  part(chars, 'character', dChars);
}

// ------------------------------------------------ making text visible

/** Appends text to parent, with stand-ins for what cannot be seen. */
function appendVisual(parent, text) {
  for (const part of visualize(text)) {
    if (typeof part === 'string') { parent.append(part); continue; }
    const chip = el('span', 'chip ' + part.kind);
    chip.dataset.l = part.label;
    // The real character stays in the page (invisibly small) so that copying
    // and selecting work on the real text. A line break is left out: the
    // line ends there anyway.
    if (part.raw !== '\n') chip.append(el('span', 'raw', part.raw));
    parent.append(chip);
  }
}

const clip = (text, max) => (text.length > max ? text.slice(0, max) + '\u2026' : text);

// ----------------------------------------------------- before / after

function renderDiff() {
  hideTip(true);
  diff.textContent = '';
  markEls.clear();
  beforeTokens = [];
  renderedStart = 0;
  rendered = 0;
  display = [];
  rowOfChange = [];
  rowStart = [];
  model = null;
  diff.classList.toggle('uni', ui.view === 'unified');
  if (!result.input) {
    diff.append(el('div', 'empty', 'Nothing here yet. Paste some text above, or try the sample.'));
    return;
  }
  model = buildModel(result);
  const rows = ui.view === 'side' ? model.rows : model.unified;
  display = ui.onlyChanged ? collapseUnchanged(rows, 1) : rows;
  rowOfChange = new Array(result.changes.length).fill(-1);
  let at = 0;
  display.forEach((row, idx) => {
    if (!row.skip) {
      const tokens = rowTokens(row);
      if (tokens.length) at = Math.max(at, tokens[0].s);
      for (const tok of tokens) {
        if (tok.ci !== undefined && rowOfChange[tok.ci] < 0) rowOfChange[tok.ci] = idx;
      }
    }
    rowStart.push(at);
  });
  const digits = String(Math.max(model.before.length, model.after.length)).length;
  diff.style.setProperty('--numw', `calc(${digits}ch + 20px)`);

  const head = el('div', 'row head');
  if (ui.view === 'side') head.append(el('div'), el('div', null, 'Before'), el('div'), el('div', null, 'After'));
  else head.append(el('div'), el('div'), el('div', null, 'Before and after combined'));
  diff.append(head);

  if (ui.onlyChanged && !result.changes.length) {
    diff.append(el('div', 'empty', 'No lines were changed. The text is already clean with these settings.'));
    return;
  }
  renderMoreRows(ROW_CHUNK);
}

function rowTokens(row) {
  if (row.tokens) return row.tokens;
  return [...(row.b ? row.b.tokens : []), ...(row.a ? row.a.tokens : [])];
}

function renderMoreRows(count) {
  diff.querySelector('.more.later')?.remove();
  const frag = document.createDocumentFragment();
  const end = Math.min(display.length, rendered + count);
  for (; rendered < end; rendered++) frag.append(rowEl(display[rendered]));
  diff.append(frag);
  if (rendered < display.length) {
    const more = el('button', 'gbtn small more later', `Show more lines (${fmt(display.length - rendered)} left)`);
    more.type = 'button';
    more.addEventListener('click', () => { renderMoreRows(ROW_CHUNK); applyFocus(false); });
    diff.append(more);
  }
  rovingMark();
}

/** Adds the rows before the ones shown, keeping what is on screen in place. */
function renderEarlierRows(count) {
  const heightBefore = diff.scrollHeight;
  diff.querySelector('.more.earlier')?.remove();
  const start = Math.max(0, renderedStart - count);
  const later = beforeTokens;
  beforeTokens = [];
  const frag = document.createDocumentFragment();
  for (let i = start; i < renderedStart; i++) frag.append(rowEl(display[i]));
  beforeTokens = beforeTokens.concat(later);
  renderedStart = start;
  diff.querySelector('.row.head').after(frag);
  earlierButton();
  diff.scrollTop += diff.scrollHeight - heightBefore;
}

function earlierButton() {
  if (renderedStart <= 0) return;
  const more = el('button', 'gbtn small more earlier', `Show earlier lines (${fmt(renderedStart)} before these)`);
  more.type = 'button';
  more.addEventListener('click', () => { renderEarlierRows(ROW_CHUNK); applyFocus(false); });
  diff.querySelector('.row.head').after(more);
}

/** Shows the part of a long text that starts at row `start`. */
function renderWindow(start) {
  hideTip(true);
  for (const node of [...diff.children]) if (!node.classList.contains('head')) node.remove();
  markEls.clear();
  beforeTokens = [];
  renderedStart = rendered = start;
  earlierButton();
  renderMoreRows(ROW_CHUNK);
}

// One mark is reachable with Tab; the arrow keys move between marks.
function rovingMark() {
  if (diff.querySelector('.m[tabindex="0"]')) return;
  const first = diff.querySelector('.m');
  if (first) first.tabIndex = 0;
}

/** Makes sure row `index` is in the page. */
function ensureRendered(index) {
  if (index < 0 || index >= display.length) return;
  if (index >= renderedStart && index < rendered) return;
  if (index >= rendered && index < rendered + 2 * ROW_CHUNK) renderMoreRows(index - rendered + ROW_CHUNK);
  else renderWindow(Math.max(0, index - 40));
}

/** Row that contains the given offset of the original text. */
function rowAtOffset(offset) {
  let lo = 0;
  let hi = rowStart.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rowStart[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo;
}

function rowEl(row) {
  if (row.skip) return el('div', 'row skip', `${plural(row.skip, 'unchanged line')} hidden`);
  const node = el('div', 'row' + (row.changed ? ' chg' : ''));
  if (row.tokens) {
    node.append(numEl(row.bn, 'b', row.changed && row.bn), numEl(row.an, 'a', row.changed && row.an));
    node.append(cellEl(row.tokens, 'u'));
  } else {
    node.append(numEl(row.b?.n, 'b', row.b?.changed), cellEl(row.b?.tokens, 'b'));
    node.append(numEl(row.a?.n, 'a', row.a?.changed), cellEl(row.a?.tokens, 'a'));
  }
  return node;
}

function numEl(n, side, changed) {
  return el('div', `num ${side}${changed ? ' chg' : ''}`, n || '');
}

function cellEl(tokens, side) {
  const cell = el('div', `cell ${side}${tokens ? '' : ' void'}`);
  if (tokens) for (const tok of tokens) cell.append(tokenEl(tok, side));
  return cell;
}

function tokenEl(tok, side) {
  let node;
  if (tok.k === 'u') {
    node = el('span', 'u', tok.text);
  } else {
    node = el('span', tok.k === 'd' ? 'm del' : tok.k === 'i' ? 'm ins' : side === 'b' ? 'm gap added' : 'm gap');
    node.dataset.c = tok.ci;
    node.tabIndex = -1;
    const change = result.changes[tok.ci];
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${changeKind(change)} by ${ruleLabel(change.rules[0])}, line ${change.line}`);
    if (tok.text) appendVisual(node, tok.text);
    let list = markEls.get(tok.ci);
    if (!list) markEls.set(tok.ci, list = []);
    list.push(node);
  }
  node.dataset.s = tok.s;
  node.dataset.e = tok.e;
  if (side !== 'a' && tok.k !== 'i' && tok.k !== 'g') beforeTokens.push({ s: tok.s, e: tok.e, el: node, k: tok.k });
  return node;
}

function setView(view) {
  ui.view = view;
  $('viewSide').setAttribute('aria-pressed', String(view === 'side'));
  $('viewUnified').setAttribute('aria-pressed', String(view === 'unified'));
  save();
  renderDiff();
  applyFocus(false);
}
$('viewSide').addEventListener('click', () => setView('side'));
$('viewUnified').addEventListener('click', () => setView('unified'));
$('onlyChanged').addEventListener('change', (e) => {
  ui.onlyChanged = e.target.checked;
  save();
  renderDiff();
  applyFocus(false);
});

// ------------------------------------------------------------ tooltips

const ruleLabel = (id) => ruleById(id).label;
const groupLabel = (id) => GROUPS.find((g) => g.id === ruleById(id).group).label;

/** Rows describing the characters of a short text, or a snippet for a long one. */
function describeText(text, frag) {
  const kinds = tally(text);
  const total = kinds.reduce((sum, k) => sum + k.n, 0);
  const visible = kinds.filter((k) => !visualize(String.fromCodePoint(k.cp)).some((p) => typeof p !== 'string')).reduce((sum, k) => sum + k.n, 0);
  if (total > 12 && visible * 2 >= total) {
    const snip = el('div', 't-snip');
    appendVisual(snip, clip(text, 160));
    frag.append(snip, el('div', 't-meta', plural(total, 'character')));
    return;
  }
  for (const { cp, n } of kinds.slice(0, 6)) {
    const row = el('div', 't-char');
    const glyph = el('span', 't-glyph');
    appendVisual(glyph, cp === 0x20 ? ' ' : String.fromCodePoint(cp));
    if (cp === 0x20) { glyph.textContent = ''; const c = el('span', 'chip ws'); c.dataset.l = '\u00B7'; glyph.append(c); }
    const info = el('div');
    info.append(el('div', 't-name', nameOf(cp) || (namesReady() ? 'Unnamed character' : 'Looking up the name\u2026')));
    info.append(el('div', 't-meta', `${hex(cp)} \u00B7 ${typeOf(cp)}${n > 1 ? ` \u00B7 ${fmt(n)} times` : ''}`));
    row.append(glyph, info);
    frag.append(row);
  }
  if (kinds.length > 6) frag.append(el('div', 't-meta', `and ${plural(kinds.length - 6, 'more kind')} of character`));
}

const changeKind = (change) => (!change.before ? 'Added' : change.after ? 'Replaced' : 'Removed');

function tipContent(change) {
  const frag = document.createDocumentFragment();
  const kind = changeKind(change);
  frag.append(el('div', `t-kind ${change.before ? 'del' : 'ins'}`, kind));
  if (change.before) describeText(change.before, frag);
  if (change.after) {
    const row = el('div', 't-row');
    const body = el('div');
    describeText(change.after, body);
    row.append(el('div', null, 'Becomes'), body);
    frag.append(row);
  }
  const rule = el('div', 't-row');
  const names = el('div');
  change.rules.forEach((id, i) => {
    const line = el('div', 't-rule', (i ? 'then ' : '') + ruleLabel(id));
    line.append(el('span', 't-group', groupLabel(id)));
    names.append(line);
  });
  rule.append(el('div', null, change.rules.length > 1 ? 'Rules' : 'Rule'), names);
  frag.append(rule);
  const where = el('div', 't-row');
  where.append(el('div', null, 'Where'), el('div', null, `Line ${fmt(change.line)}, column ${fmt(change.col)} of the original`));
  frag.append(where);
  return frag;
}

function showTip(mark, point) {
  const change = result.changes[Number(mark.dataset.c)];
  if (!change) return;
  if (!namesReady()) loadNames().then(() => { if (tipFor === mark && !tip.hidden) showTip(mark, point); });
  tipFor = mark;
  tip.textContent = '';
  tip.append(tipContent(change));
  tip.hidden = false;
  mark.setAttribute('aria-describedby', 'tip');
  // Anchor to the piece of the mark nearest the pointer (marks can wrap).
  const rects = [...mark.getClientRects()];
  let r = rects[0] || mark.getBoundingClientRect();
  if (point) {
    r = rects.find((q) => point.y >= q.top - 2 && point.y <= q.bottom + 2 && point.x >= q.left - 6 && point.x <= q.right + 6) || r;
  }
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const vw = root.clientWidth;
  const vh = root.clientHeight;
  let top = r.top - h - 10;
  if (top < 8) top = r.bottom + 10;
  if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), Math.max(8, vw - w - 8));
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function hideTip(force) {
  if (pinned && !force) return;
  pinned = null;
  if (tipFor) tipFor.removeAttribute('aria-describedby');
  tipFor = null;
  tip.hidden = true;
}

const markAt = (target) => (target instanceof Element ? target.closest('.m') : null);

diff.addEventListener('pointerover', (e) => {
  const mark = markAt(e.target);
  if (!mark || e.pointerType !== 'mouse' || mark === pinned) return;
  pinned = null;
  showTip(mark, { x: e.clientX, y: e.clientY });
});
diff.addEventListener('pointerout', (e) => {
  if (markAt(e.target) && e.pointerType === 'mouse') hideTip(false);
});
diff.addEventListener('click', (e) => {
  const mark = markAt(e.target);
  if (!mark) { hideTip(true); return; }
  if (!getSelection().isCollapsed) return; // the user is selecting text, not tapping
  if (pinned === mark) { hideTip(true); return; }
  showTip(mark, { x: e.clientX, y: e.clientY });
  pinned = mark;
});
diff.addEventListener('focusin', (e) => {
  const mark = markAt(e.target);
  if (!mark) return;
  for (const other of diff.querySelectorAll('.m[tabindex="0"]')) other.tabIndex = -1;
  mark.tabIndex = 0;
  if (mark.matches(':focus-visible')) { pinned = null; showTip(mark); }
});
diff.addEventListener('focusout', (e) => { if (markAt(e.target)) hideTip(false); });
diff.addEventListener('keydown', (e) => {
  const mark = markAt(e.target);
  if (!mark) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (pinned === mark) hideTip(true); else { showTip(mark); pinned = mark; }
    return;
  }
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step && e.key !== 'Home' && e.key !== 'End') return;
  e.preventDefault();
  const all = [...diff.querySelectorAll('.m')];
  const at = all.indexOf(mark);
  const next = e.key === 'Home' ? all[0] : e.key === 'End' ? all[all.length - 1] : all[at + step];
  if (next) { hideTip(true); next.focus(); }
});
diff.addEventListener('scroll', () => hideTip(true), { passive: true });
addEventListener('scroll', () => hideTip(true), { passive: true });
addEventListener('resize', () => hideTip(true));
document.addEventListener('pointerdown', (e) => {
  if (pinned && !diff.contains(e.target) && !$('logList').contains(e.target)) hideTip(true);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!tip.hidden) hideTip(true);
  else if (focus) clearFocus();
});

// ------------------------------------------------- selection inspector

function setFocus(s, e, from) {
  if (focus && focus.s === s && focus.e === e && focus.from === from) return;
  focus = { s, e, from };
  applyFocus(from !== 'diff');
}

function clearFocus() {
  if (!focus) return;
  focus = null;
  applyFocus(false);
}
$('clearFocus').addEventListener('click', clearFocus);

/** The changes inside the selected stretch (or touching its edges). */
function focusHits() {
  return result.changes.filter((c) => (c.os === c.oe
    ? c.os >= focus.s && c.os <= focus.e
    : c.os < focus.e && c.oe > focus.s));
}

function applyFocus(scroll) {
  for (const node of diff.querySelectorAll('.m.hit')) node.classList.remove('hit');
  if (globalThis.CSS?.highlights) CSS.highlights.delete('cleanup-focus');
  const box = $('inspector');
  const text = $('inspectorText');
  diff.classList.toggle('has-focus', !!focus);
  box.classList.toggle('on', !!focus);
  $('clearFocus').hidden = !focus;
  if (!focus) {
    text.textContent = 'Select some text in any of the boxes to mark what gets cleaned there. Point at a mark to see what it is.';
    return;
  }
  const hits = focusHits();
  // A new selection brings its part of the text into the page.
  if (scroll && display.length) ensureRendered(hits.length ? rowOfChange[hits[0].ci] : rowAtOffset(focus.s));
  for (const c of hits) for (const node of markEls.get(c.ci) || []) node.classList.add('hit');

  // Tint the selected stretch itself in the before view.
  let firstToken = null;
  if (globalThis.CSS?.highlights && typeof Highlight === 'function') {
    const ranges = [];
    for (const tok of beforeTokens) {
      if (tok.e <= focus.s) continue;
      if (tok.s >= focus.e) break;
      if (!firstToken) firstToken = tok.el;
      if (tok.k !== 'u' || !tok.el.firstChild) continue;
      const range = document.createRange();
      range.setStart(tok.el.firstChild, Math.max(focus.s, tok.s) - tok.s);
      range.setEnd(tok.el.firstChild, Math.min(focus.e, tok.e) - tok.s);
      ranges.push(range);
      if (ranges.length > 4000) break;
    }
    if (ranges.length) CSS.highlights.set('cleanup-focus', new Highlight(...ranges));
  } else {
    firstToken = beforeTokens.find((tok) => tok.e > focus.s && tok.s < focus.e)?.el || null;
  }

  // Say what was found.
  const fromLine = lineOfOriginal(focus.s);
  const toLine = lineOfOriginal(Math.max(focus.s, focus.e - 1));
  const where = fromLine === toLine ? `line ${fmt(fromLine)}` : `lines ${fmt(fromLine)}\u2013${fmt(toLine)}`;
  text.textContent = '';
  text.append('Selected text, ', where, ' of the original: ');
  if (!hits.length) {
    text.append(el('b', null, 'nothing is cleaned here.'));
  } else {
    text.append(el('b', null, `${plural(hits.length, 'place')} cleaned`));
    const perRule = new Map();
    for (const c of hits) for (const id of c.rules) perRule.set(id, (perRule.get(id) || 0) + 1);
    const parts = [...perRule].sort((x, y) => y[1] - x[1]).map(([id, n]) => `${ruleLabel(id)} \u00D7 ${fmt(n)}`);
    text.append(' \u2014 ', clip(parts.join(', '), 400), '. Point at the marks to see each one.');
  }

  if (scroll) {
    const target = (hits.length && (markEls.get(hits[0].ci) || [])[0]) || firstToken;
    if (target) scrollDiffTo(target);
  }
}

function lineOfOriginal(offset) {
  let line = 1;
  for (let i = result.input.indexOf('\n'); i >= 0 && i < offset; i = result.input.indexOf('\n', i + 1)) line++;
  return line;
}

/** Scrolls inside the before/after view only; the page itself stays put. */
function scrollDiffTo(node) {
  const box = diff.getBoundingClientRect();
  const r = node.getBoundingClientRect();
  if (r.top < box.top + 44 || r.bottom > box.bottom - 12) diff.scrollTop += r.top - box.top - box.height / 3;
}

function readTextareaSelection(area, from) {
  const s = area.selectionStart;
  const e = area.selectionEnd;
  if (s === e) {
    if (focus && focus.from === from) clearFocus();
    return;
  }
  if (from === 'input') setFocus(s, e, from);
  else {
    const [os, oe] = outputRangeToOriginal(result, s, e);
    setFocus(os, oe, from);
  }
}

/** Offset in the original text for a position inside the before/after view. */
function originalOffsetAt(node, offset, isEnd) {
  const holder = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  let tok = holder.closest('[data-s]');
  if (!tok && node.nodeType === Node.ELEMENT_NODE) {
    // The position is between elements: use the nearest token on that side.
    const near = isEnd ? node.childNodes[offset - 1] : node.childNodes[offset];
    const walker = document.createTreeWalker(diff, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.dataset.s !== undefined ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    if (near instanceof Element) {
      if (near.dataset.s !== undefined) tok = near;
      else {
        const inside = near.querySelectorAll('[data-s]');
        tok = inside.length ? inside[isEnd ? inside.length - 1 : 0] : null;
      }
    }
    if (!tok) {
      walker.currentNode = near instanceof Element ? near : node;
      tok = isEnd ? walker.previousNode() : walker.nextNode();
    }
    if (!tok) return null;
    return isEnd ? Number(tok.dataset.e) : Number(tok.dataset.s);
  }
  if (!tok || !diff.contains(tok)) return null;
  const s = Number(tok.dataset.s);
  const e = Number(tok.dataset.e);
  if (!tok.classList.contains('u')) return isEnd ? e : s; // a mark counts as a whole
  const range = document.createRange();
  range.setStart(tok, 0);
  range.setEnd(node, offset);
  return Math.min(e, s + range.toString().length);
}

function readDiffSelection() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return; // a click keeps the current marks
  const range = sel.getRangeAt(0);
  if (!diff.contains(range.commonAncestorContainer)) return;
  const s = originalOffsetAt(range.startContainer, range.startOffset, false);
  const e = originalOffsetAt(range.endContainer, range.endOffset, true);
  if (s !== null && e !== null && e > s) setFocus(s, e, 'diff');
}

let selFrame = 0;
function selectionMoved() {
  cancelAnimationFrame(selFrame);
  selFrame = requestAnimationFrame(() => {
    const active = document.activeElement;
    if (active === input) readTextareaSelection(input, 'input');
    else if (active === output) readTextareaSelection(output, 'output');
    else readDiffSelection();
  });
}
document.addEventListener('selectionchange', selectionMoved);
for (const area of [input, output]) {
  for (const type of ['select', 'selectionchange', 'keyup', 'mouseup', 'touchend']) area.addEventListener(type, selectionMoved);
}

// ----------------------------------------------------------------- log

function logText(parent, text) {
  if (!text) { parent.append(el('em', null, 'removed')); return; }
  appendVisual(parent, clip(text, 70));
}

function renderLog() {
  const list = $('logList');
  const filters = $('logFilters');
  list.textContent = '';
  filters.textContent = '';
  logShown = 0;
  const total = result.changes.length;
  $('logSummary').textContent = total ? plural(total, 'change') : '';
  $('copyLogBtn').disabled = $('downloadLogBtn').disabled = !total;
  if (!total) {
    list.append(el('div', 'empty', result.input ? 'Nothing was changed. The text is already clean with these settings.' : 'Every change will be listed here: where it is, what it was, what it became and which rule did it.'));
    return;
  }
  if (logFilter && !result.counts[logFilter]) logFilter = null;
  const chip = (id, label, n) => {
    const b = el('button', null, label);
    b.type = 'button';
    b.append(el('span', 'n', fmt(n)));
    b.setAttribute('aria-pressed', String(logFilter === id));
    b.addEventListener('click', () => { logFilter = id; renderLog(); });
    filters.append(b);
  };
  chip(null, 'All', total);
  for (const group of GROUPS) for (const id of group.rules) if (result.counts[id]) chip(id, ruleLabel(id), result.counts[id]);

  const head = el('div', 'log-row head');
  head.append(el('span', null, 'Line:col'), el('span', null, 'Was'), el('span', null, 'Became'), el('span', null, 'Rule'));
  list.append(head);
  renderMoreLog();
}

const logEntries = () => (logFilter ? result.changes.filter((c) => c.rules.includes(logFilter)) : result.changes);

function renderMoreLog() {
  const list = $('logList');
  list.querySelector('.more')?.remove();
  const entries = logEntries();
  const frag = document.createDocumentFragment();
  const end = Math.min(entries.length, logShown + LOG_CHUNK);
  for (; logShown < end; logShown++) {
    const c = entries[logShown];
    const row = el('button', 'log-row');
    row.type = 'button';
    row.dataset.c = c.ci;
    const was = el('span', 'log-what');
    const became = el('span', 'log-to');
    if (c.before) { const m = el('span', 'm del'); logText(m, c.before); was.append(m); } else was.append(el('em', null, 'nothing'));
    if (c.after) { const m = el('span', 'm ins'); logText(m, c.after); became.append(m); } else logText(became, '');
    row.append(el('span', 'log-pos', `${fmt(c.line)}:${fmt(c.col)}`), was, became, el('span', 'log-rule', c.rules.map(ruleLabel).join(', then ')));
    frag.append(row);
  }
  list.append(frag);
  if (logShown < entries.length) {
    const more = el('button', 'gbtn small more', `Show more (${fmt(entries.length - logShown)} left)`);
    more.type = 'button';
    more.addEventListener('click', renderMoreLog);
    list.append(more);
  }
}

$('logList').addEventListener('click', (e) => {
  const row = e.target.closest('.log-row[data-c]');
  if (row) goToChange(Number(row.dataset.c));
});

/** Shows a change in the before/after view and opens its details. */
function goToChange(ci) {
  const index = rowOfChange[ci];
  if (index === undefined || index < 0) return;
  ensureRendered(index);
  const mark = (markEls.get(ci) || [])[0];
  if (!mark) return;
  $('compare').scrollIntoView({ block: 'nearest' });
  scrollDiffTo(mark);
  mark.classList.remove('flash');
  void mark.offsetWidth;
  mark.classList.add('flash');
  // Wait for the scrolling to settle; it closes any open tooltip.
  setTimeout(() => { showTip(mark); pinned = mark; }, 80);
}

function logAsText() {
  const lines = ['Line\tColumn\tWas\tBecame\tRule'];
  for (const c of result.changes) {
    lines.push([c.line, c.col, c.before ? visualizeText(c.before) : '(nothing)', c.after ? visualizeText(c.after) : '(removed)', c.rules.map(ruleLabel).join(', then ')].join('\t'));
  }
  return lines.join('\n') + '\n';
}

// ------------------------------------------------- buttons and helpers

let toastTimer = 0;
function toast(message) {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    // Older browsers and pages without clipboard permission.
    const area = el('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    toast(ok ? done : 'Could not copy. Select the text and copy it yourself.');
  }
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = el('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function setInput(text) {
  input.value = text;
  input.scrollTop = 0;
  process();
}

const tagged = (word) => Array.from(word, (c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('');
const SAMPLE = [
  '\uFEFFThe  quick\u00A0brown fox \u2014 it\u2019s \u201Cfast\u201D !  ',
  'Zero\u200Bwidth and soft\u00ADhyphen marks hide in here\u2026   ',
  '',
  '',
  '',
  '\u2022 The \uFB01rst item ( with odd spaces )',
  '\u2022 \u{1D5EF}\u{1D5FC}\u{1D5F9}\u{1D5F1} claims &amp; <b>markup</b> \u{1F600}',
  'A hidden message:' + tagged('secret') + ' and a re\u202Eversed\u202C word.',
  'Stored as two characters: a\u0308 , and a tab at the end.\t',
  'Link: https://example.com/page?utm_source=news&id=42',
  '',
  '',
].join('\n');

$('sampleBtn').addEventListener('click', () => setInput(SAMPLE));
$('clearBtn').addEventListener('click', () => { setInput(''); input.focus(); });
if (navigator.clipboard?.readText) {
  $('pasteBtn').addEventListener('click', async () => {
    try { setInput(await navigator.clipboard.readText()); } catch { toast('The browser did not allow pasting. Paste into the box instead.'); }
  });
} else {
  $('pasteBtn').hidden = true;
}
$('copyBtn').addEventListener('click', () => copyText(result.output, 'Clean text copied'));
$('downloadBtn').addEventListener('click', () => download('clean-text.txt', result.output));
$('copyLogBtn').addEventListener('click', () => copyText(logAsText(), 'Log copied'));
$('downloadLogBtn').addEventListener('click', () => download('cleanup-log.txt', logAsText()));

input.addEventListener('input', schedule);

function syncChrome() {
  const light = root.classList.contains('light');
  const paused = root.classList.contains('paused');
  $('themeBtn').setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  $('motionBtn').setAttribute('aria-pressed', String(paused));
  $('motionBtn').setAttribute('aria-label', paused ? 'Start background motion' : 'Pause background motion');
  $('motionBtn').title = paused ? 'Start background motion' : 'Pause background motion';
}
$('themeBtn').addEventListener('click', () => {
  ui.theme = root.classList.toggle('light') ? 'light' : 'dark';
  save();
  syncChrome();
});
$('motionBtn').addEventListener('click', () => {
  ui.motion = !root.classList.toggle('paused');
  save();
  syncChrome();
});

// ---------------------------------------------------------------- start

buildSettings();
$('onlyChanged').checked = !!ui.onlyChanged;
$('viewSide').setAttribute('aria-pressed', String(ui.view === 'side'));
$('viewUnified').setAttribute('aria-pressed', String(ui.view === 'unified'));
syncChrome();
process();
// Fetch the character names in the background so the first tooltip has them.
(globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 600)))(() => loadNames());
