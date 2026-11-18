import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean, defaultSettings } from '../js/engine.js';
import { buildModel, collapseUnchanged } from '../js/diffmodel.js';
import { chipFor, typeOf, nameOf, loadNames, visualize, visualizeText, hex, tally } from '../js/chars.js';

function only(...ids) {
  const s = defaultSettings();
  for (const id of Object.keys(s.rules)) s.rules[id] = ids.includes(id);
  return s;
}
const model = (text, ...ids) => buildModel(clean(text, only(...ids)));
const pairs = (m) => m.rows.map((r) => [r.b ? r.b.n : null, r.a ? r.a.n : null]);
const lineText = (line) => line.tokens.map((t) => t.text ?? '').join('');

test('unchanged text pairs line by line', () => {
  const m = model('a\n\nb\n', 'zeroWidth');
  assert.deepEqual(pairs(m), [[1, 1], [2, 2], [3, 3], [4, 4]]);
  assert.ok(m.rows.every((r) => !r.changed));
});

test('a removed empty line leaves a gap on the after side', () => {
  const m = model('a\n\nb', 'removeBlankLines');
  assert.deepEqual(pairs(m), [[1, 1], [2, null], [3, 2]]);
});

test('joined lines: the second before line has no partner', () => {
  const m = model('foo\nbar\n\nbaz', 'joinLines');
  assert.deepEqual(pairs(m), [[1, 1], [2, null], [3, 2], [4, 3]]);
  assert.equal(lineText(m.after[0]), 'foo bar');
});

test('a split line: the extra after line has no partner', () => {
  const m = model('one\u2028two\nthree', 'lineEndings');
  assert.deepEqual(pairs(m), [[1, 1], [null, 2], [2, 3]]);
});

test('line texts match the two texts', () => {
  const input = '  a\u200Bb  \n\n\n\nc\u00A0d\t\n';
  const r = clean(input, defaultSettings());
  const m = buildModel(r);
  assert.equal(m.before.map(lineText).join(''), input.replace(/\n/g, (x, i) => (r.changes.some((c) => c.os <= i && i < c.oe) ? '\n' : '')));
  assert.equal(m.after.map(lineText).join('\n'), r.output);
  assert.equal(m.before.length, input.split('\n').length);
  assert.equal(m.after.length, r.output.split('\n').length);
});

test('combined view numbers both sides', () => {
  const m = model('a\n\n\n\nb', 'collapseBlankLines');
  assert.deepEqual(m.unified.map((u) => [u.bn, u.an]), [[1, 1], [2, 2], [3, null], [4, null], [5, 3]]);
  const split = model('one\u2028two\nthree', 'lineEndings');
  assert.deepEqual(split.unified.map((u) => [u.bn, u.an]), [[1, 1], [null, 2], [2, 3]]);
  const plain = model('a\n\nb\n', 'zeroWidth');
  assert.deepEqual(plain.unified.map((u) => [u.bn, u.an]), [[1, 1], [2, 2], [3, 3], [4, 4]]);
  assert.equal(m.unified[4].tokens[0].text, 'b');
});

test('collapsing unchanged rows keeps context', () => {
  const m = model('1\n2\n3\n4\u200B\n5\n6\n7', 'zeroWidth');
  const c = collapseUnchanged(m.rows, 1);
  assert.deepEqual(c.map((r) => (r.skip ? 'skip' + r.skip : r.b.n)), ['skip2', 3, 4, 5, 'skip2']);
});

test('characters are described', async () => {
  assert.equal(hex(0x200b), 'U+200B');
  assert.equal(hex(0x1f600), 'U+1F600');
  assert.deepEqual(chipFor(0x200b), { label: 'ZWSP', kind: 'inv' });
  assert.deepEqual(chipFor(0x1b), { label: 'ESC', kind: 'inv' });
  assert.deepEqual(chipFor(0xe0068), { label: 'h', kind: 'tag' });
  assert.equal(chipFor(0xe000).label, 'U+E000');
  assert.equal(chipFor(0x41), null);
  assert.equal(chipFor(0x20, false), null);
  assert.equal(chipFor(0x20, true).kind, 'ws');
  assert.equal(typeOf(0x200b), 'Invisible format character');
  assert.equal(typeOf(0xa0), 'Space character');
  assert.equal(typeOf(0x430), 'Letter (Cyrillic)');
  assert.equal(typeOf(0x201c), 'Quotation mark');
  assert.equal(typeOf(0x1f600), 'Emoji or pictograph');
  assert.equal(typeOf(0x07), 'Control character (invisible)');
  assert.equal(nameOf(0x200b), null);
  assert.equal(await loadNames(), true);
  assert.equal(nameOf(0x200b), 'ZERO WIDTH SPACE');
  assert.equal(nameOf(0x00), 'NULL');
  assert.equal(nameOf(0xa0), 'NO-BREAK SPACE');
  assert.equal(nameOf(0x1f600), 'GRINNING FACE');
  assert.equal(nameOf(0xe0068), 'TAG LATIN SMALL LETTER H');
  assert.equal(nameOf(0xfb01), 'LATIN SMALL LIGATURE FI');
  assert.equal(nameOf(0x10ffff), 'PRIVATE USE CHARACTER');
  assert.deepEqual(visualize('abc'), ['abc']);
  assert.deepEqual(visualize('a\u200Bb'), ['a', { label: 'ZWSP', kind: 'inv', raw: '\u200B' }, 'b']);
  assert.equal(visualizeText('  \n'), '[SPACE][SPACE][LF]');
  assert.equal(visualizeText('<b class="x">'), '<b class="x">');
  assert.deepEqual(tally('aab'), [{ cp: 97, n: 2 }, { cp: 98, n: 1 }]);
});

test('the tables in the engine name the characters they claim to', async () => {
  await loadNames();
  const src = (await import('node:fs')).readFileSync(new URL('../js/engine.js', import.meta.url), 'utf8');
  const table = (name) => {
    const body = src.slice(src.indexOf(`const ${name} = {`), src.indexOf('};', src.indexOf(`const ${name} = {`)));
    return [...body.matchAll(/'\\u([0-9A-F]{4})': '(\w+)'/g)].map((m) => [parseInt(m[1], 16), m[2]]);
  };
  for (const [cp, letter] of table('SMALL_CAPS')) {
    const name = nameOf(cp);
    assert.ok(name.endsWith('SMALL CAPITAL ' + letter.toUpperCase()), `${hex(cp)} ${name} -> ${letter}`);
  }
  const glyphs = table('HOMOGLYPHS');
  assert.ok(glyphs.length > 40);
  for (const [cp] of glyphs) assert.match(nameOf(cp), /^(CYRILLIC|GREEK) (SMALL|CAPITAL) LETTER/, hex(cp));
});
