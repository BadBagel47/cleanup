// Turns the result of clean() into lines for the before/after views.
// Pure logic, no DOM.
//
// Token kinds:
//   u  unchanged text (same token object is used on both sides)
//   d  original text that was removed or replaced (before side)
//   i  text that was put in its place (after side)
//   g  a zero-width marker where something was removed (after side) or
//      added (before side)
// s and e are always offsets in the ORIGINAL text.

const newLine = (n) => ({ n, tokens: [], changed: false, link: 0 });

/**
 * Returns
 *   before, after  the lines of each text with their tokens
 *   rows           before and after lines paired for the side-by-side view;
 *                  a line with no counterpart gets null on the other side
 *   unified        visual lines for the combined view; bn/an are the line
 *                  numbers that start on that visual line (or null)
 */
export function buildModel(result) {
  const { input, segs } = result;
  const before = [newLine(1)];
  const after = [newLine(1)];
  let b = before[0];
  let a = after[0];
  let u = { bn: 1, an: null, tokens: [], changed: false };
  const unified = [u];
  // In the combined view an after line gets its number on the visual line
  // where its text begins (or, for an empty line, where it ends).
  let needAn = true;
  const giveAn = () => { if (needAn) { u.an = a.n; needAn = false; } };

  // Pair the current before and after line the first time they share text.
  const link = () => { if (!b.link && !a.link) { b.link = a.n; a.link = b.n; } };
  const nextBefore = () => { b = newLine(b.n + 1); before.push(b); };
  const nextAfter = () => { giveAn(); a = newLine(a.n + 1); after.push(a); needAn = true; };

  for (const seg of segs) {
    if (seg.t === null) {
      const text = input.slice(seg.os, seg.oe);
      let from = 0;
      for (;;) {
        const nl = text.indexOf('\n', from);
        const to = nl < 0 ? text.length : nl;
        if (to > from) {
          const tok = { k: 'u', text: text.slice(from, to), s: seg.os + from, e: seg.os + to };
          giveAn();
          b.tokens.push(tok); a.tokens.push(tok); u.tokens.push(tok);
          link();
        }
        if (nl < 0) break;
        link();
        nextBefore(); nextAfter();
        u = { bn: b.n, an: null, tokens: [], changed: false };
        unified.push(u);
        from = nl + 1;
      }
      continue;
    }
    const ci = seg.ci;
    const old = input.slice(seg.os, seg.oe);
    if (old) {
      let from = 0;
      while (from < old.length) {
        const nl = old.indexOf('\n', from);
        const to = nl < 0 ? old.length : nl + 1;
        const tok = { k: 'd', ci, text: old.slice(from, to), s: seg.os + from, e: seg.os + to };
        b.tokens.push(tok); b.changed = true;
        u.tokens.push(tok); u.changed = true;
        if (nl >= 0) {
          nextBefore();
          u = { bn: b.n, an: null, tokens: [], changed: true };
          unified.push(u);
        }
        from = to;
      }
    } else {
      b.tokens.push({ k: 'g', ci, s: seg.os, e: seg.oe }); b.changed = true;
    }
    if (seg.t) {
      let from = 0;
      while (from < seg.t.length) {
        const nl = seg.t.indexOf('\n', from);
        const to = nl < 0 ? seg.t.length : nl + 1;
        const tok = { k: 'i', ci, text: seg.t.slice(from, to), s: seg.os, e: seg.oe };
        giveAn();
        a.tokens.push(tok); a.changed = true;
        u.tokens.push(tok); u.changed = true;
        if (nl >= 0) {
          nextAfter();
          u = { bn: null, an: null, tokens: [], changed: true };
          unified.push(u);
        }
        from = to;
      }
    } else {
      a.tokens.push({ k: 'g', ci, s: seg.os, e: seg.oe }); a.changed = true;
    }
  }
  link();
  giveAn();

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    const bl = before[i];
    const al = after[j];
    if (bl && al && bl.link === al.n) { rows.push({ b: bl, a: al, changed: bl.changed || al.changed }); i++; j++; }
    else if (bl && (!bl.link || !al)) { rows.push({ b: bl, a: null, changed: true }); i++; }
    else { rows.push({ b: null, a: al, changed: true }); j++; }
  }
  return { before, after, rows, unified };
}

/**
 * Replaces runs of unchanged rows by a { skip: n } marker, keeping `context`
 * rows around every change.
 */
export function collapseUnchanged(rows, context = 1) {
  const keep = new Array(rows.length).fill(false);
  rows.forEach((row, idx) => {
    if (!row.changed) return;
    for (let k = Math.max(0, idx - context); k <= Math.min(rows.length - 1, idx + context); k++) keep[k] = true;
  });
  const out = [];
  let skipped = 0;
  rows.forEach((row, idx) => {
    if (keep[idx]) {
      if (skipped) { out.push({ skip: skipped }); skipped = 0; }
      out.push(row);
    } else skipped++;
  });
  if (skipped) out.push({ skip: skipped });
  return out;
}
