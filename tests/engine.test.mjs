import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clean, defaultSettings, RULES, GROUPS, outputRangeToOriginal, countLines } from '../js/engine.js';

/** Settings with only the named rules on. */
function only(...ids) {
  const s = defaultSettings();
  for (const id of Object.keys(s.rules)) s.rules[id] = ids.includes(id);
  return s;
}
const run = (text, ...ids) => clean(text, only(...ids)).output;

/** The bookkeeping must always be able to rebuild both texts. */
function checkInvariants(result) {
  const { input, output, segs, changes } = result;
  let at = 0;
  let out = '';
  for (const seg of segs) {
    assert.equal(seg.os, at, 'segments cover the original without gaps');
    at = seg.oe;
    assert.equal(seg.out, out.length, 'output offsets are right');
    out += seg.t === null ? input.slice(seg.os, seg.oe) : seg.t;
  }
  assert.equal(at, input.length);
  assert.equal(out, output, 'segments rebuild the output');
  for (const c of changes) {
    assert.equal(c.before, input.slice(c.os, c.oe));
    assert.notEqual(c.before, c.after, 'a change really changes something');
    assert.ok(c.rules.length > 0);
    assert.equal(output.slice(c.out, c.out + c.after.length), c.after);
  }
}

test('every rule is listed in exactly one group and has a label and description', () => {
  const listed = GROUPS.flatMap((g) => g.rules.map((id) => [id, g.id]));
  assert.equal(new Set(listed.map(([id]) => id)).size, listed.length, 'no rule is listed twice');
  assert.equal(listed.length, RULES.length, 'every rule is listed');
  const groupOf = new Map(listed);
  for (const r of RULES) {
    assert.equal(groupOf.get(r.id), r.group, r.id);
    assert.ok(r.label && r.desc, r.id);
  }
});

test('all rules are on by default except the four that delete real text', () => {
  const s = defaultSettings();
  const off = Object.keys(s.rules).filter((id) => !s.rules[id]).sort();
  assert.deepEqual(off, ['accents', 'asciiOnly', 'joinLines', 'removeBlankLines']);
});

test('empty input', () => {
  const r = clean('', defaultSettings());
  assert.equal(r.output, '');
  assert.deepEqual(r.changes, []);
  assert.equal(countLines(''), 0);
});

test('zero-width characters', () => {
  assert.equal(run('a\u200Bb\u2060c\uFEFFd', 'zeroWidth'), 'abcd');
  // joiner inside an emoji family and in Persian spelling is kept
  assert.equal(run('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', 'zeroWidth'), '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}');
  assert.equal(run('\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645', 'zeroWidth'), '\u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u0645');
  assert.equal(run('a\u200Db', 'zeroWidth'), 'ab');
});

test('soft hyphen, direction marks, other invisibles, control characters', () => {
  assert.equal(run('hy\u00ADphen', 'softHyphen'), 'hyphen');
  assert.equal(run('\u202Eevil\u202C \u200Ex\u2066y\u2069', 'bidi'), 'evil xy');
  assert.equal(run('a\u2061b\uFFFCc', 'otherInvisible'), 'abc');
  assert.equal(run('a\x00b\x07c\x1Bd\x7Fe\x9Ff\tg\nh', 'controlChars'), 'abcdef\tg\nh');
});

test('tag characters are removed but flag emoji survive', () => {
  const hidden = Array.from('hi', (c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('');
  assert.equal(run('a' + hidden + 'b', 'tagChars'), 'ab');
  const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
  assert.equal(run(england, 'tagChars'), england);
});

test('variation selectors', () => {
  assert.equal(run('a\uFE0Fb\u{E0100}', 'variationSelectors'), 'ab');
  assert.equal(run('\u2764\uFE0F', 'variationSelectors'), '\u2764\uFE0F');
  assert.equal(run('1\uFE0F\u20E3', 'variationSelectors'), '1\uFE0F\u20E3');
  // selectors stacked on an emoji to hide data: only the real one stays
  assert.equal(run('\u{1F600}\u{E0101}\u{E0102}', 'variationSelectors'), '\u{1F600}');
});

test('terminal colour codes go before control characters', () => {
  assert.equal(run('\x1B[31mred\x1B[0m', 'ansi', 'controlChars'), 'red');
});

test('spaces', () => {
  assert.equal(run('a\u00A0b\u2009c\u3000d', 'unusualSpaces'), 'a b c d');
  assert.equal(run('a\tb', 'tabs'), 'a    b');
  const s = only('tabs'); s.options.tabWidth = '2';
  assert.equal(clean('a\tb', s).output, 'a  b');
  assert.equal(run('a   b  c\n  indented  x', 'collapseSpaces'), 'a b c\n  indented x');
  assert.equal(run('detta \u00E4r en mening. \nn\u00E4sta\t\n', 'trailingSpaces'), 'detta \u00E4r en mening.\nn\u00E4sta\n');
  assert.equal(run('  a\n\tb', 'leadingSpaces'), 'a\nb');
});

test('spaces before punctuation', () => {
  const f = (t) => run(t, 'spaceBeforePunct');
  assert.equal(f('detta \u00E4r en mening !'), 'detta \u00E4r en mening!');
  assert.equal(f('one , two ; three : four . Five ?'), 'one, two; three: four. Five?');
  assert.equal(f('really ?!'), 'really?!');
  assert.equal(f('"quoted" .'), '"quoted".');
  // left alone: smileys, runs of dots, decimals, names starting with a dot
  assert.equal(f('hi :) ok ;)'), 'hi :) ok ;)');
  assert.equal(f('wait ... what'), 'wait ... what');
  assert.equal(f('about .5 and .NET'), 'about .5 and .NET');
});

test('spaces inside brackets', () => {
  const f = (t) => run(t, 'spaceInsideBrackets');
  assert.equal(f('a ( b ) c [ d ]'), 'a (b) c [d]');
  assert.equal(f('- [ ] todo'), '- [ ] todo');
  assert.equal(f('sad :( and happy : )'), 'sad :( and happy : )');
});

test('line endings', () => {
  assert.equal(run('a\r\nb\rc\u2028d\u2029e\u0085f\vg\fh', 'lineEndings'), 'a\nb\nc\nd\ne\nf\ng\nh');
  const r = clean('a\r\nb', only('lineEndings'));
  assert.equal(r.changes.length, 1);
  assert.equal(r.changes[0].before, '\r');
});

test('blank lines', () => {
  assert.equal(run('a\n\n\n\nb\n\nc', 'collapseBlankLines'), 'a\n\nb\n\nc');
  assert.equal(run('\n\n\na', 'collapseBlankLines'), '\na');
  assert.equal(run('a\n\n\nb\n\nc\n', 'removeBlankLines'), 'a\nb\nc\n');
  assert.equal(run('\n \n a \n\n', 'trimEdges'), ' a ');
  assert.equal(run('one\ntwo\n\nthree\n- item\n- item', 'joinLines'), 'one two\n\nthree\n- item\n- item');
});

test('typography', () => {
  assert.equal(run('\u201Chi\u201D \u2018x\u2019 \u00ABy\u00BB', 'quotes'), '"hi" \'x\' "y"');
  assert.equal(run('a\u2010b\u2011c\u2013d', 'hyphens'), 'a-b-c\u2013d');
  assert.equal(run('a\u2013b\u2014c\u2212d', 'dashes'), 'a-b-c-d');
  assert.equal(run('wait\u2026', 'ellipsis'), 'wait...');
  assert.equal(run('\u2022 one\n  \u25AAtwo', 'bullets'), '- one\n  - two');
});

test('letters', () => {
  assert.equal(run('\uFB01sh \uFB02y o\uFB03ce', 'ligatures'), 'fish fly office');
  assert.equal(run('\uFF21\uFF22\uFF43\uFF11\uFF01', 'fullwidth'), 'ABc1!');
  assert.equal(run('\u{1D5EF}\u{1D5FC}\u{1D5F9}\u{1D5F1} \u{1D4EF}\u{1D4EA}\u{1D4F7}\u{1D4EC}\u{1D502} \u24D2\u24D8', 'fancyLetters'), 'bold fancy ci');
  assert.equal(run('s\u1D0D\u1D00\u029F\u029F \u1D04\u1D00\u1D18s', 'fancyLetters'), 'small caps');
  assert.equal(run('/\u026A/ sound', 'fancyLetters'), '/\u026A/ sound'); // lone phonetic symbol kept
  assert.equal(run('a\u0308 e\u0301', 'normalize'), '\u00E4 \u00E9');
  const k = only('normalize'); k.options.normalizeForm = 'NFKC';
  assert.equal(clean('x\u00B2 \u2122', k).output, 'x2 TM');
  assert.equal(run('s\u0336t\u0336r\u0336 z\u0300\u0301\u0302\u0303a', 'combiningDecor'), 'str za');
  assert.equal(run('\u00E9 stays', 'combiningDecor'), '\u00E9 stays');
  assert.equal(run('p\u0430yp\u0430l \u043F\u0440\u0438\u0432\u0435\u0442', 'homoglyphs'), 'paypal \u043F\u0440\u0438\u0432\u0435\u0442');
  assert.equal(run('\u00E5\u00E4\u00F6 \u00E9 \u00DF \u00F8 \u00D7', 'accents'), 'aao e ss o \u00D7');
});

test('markup', () => {
  assert.equal(run('<p>Hello <b>world</b></p><p>Next</p> a < b and c > d', 'htmlTags'), 'Hello world\nNext\n a < b and c > d');
  assert.equal(run('x<script>alert(1)</script>y<!-- c -->z<br>w', 'htmlTags'), 'xyz\nw');
  assert.equal(run('a &amp; b &lt;c&gt; &#8211; &#x41; &nbsp;| &bogus; &', 'htmlEntities'), 'a & b <c> \u2013 A \u00A0| &bogus; &');
  assert.equal(run('# Title\n**bold** and *it* and _it_ `code` ~~no~~\n> quote\n* item\n[text](http://x.y/z) ![alt](i.png)', 'markdown'),
    'Title\nbold and it and it code no\nquote\n- item\ntext alt');
  assert.equal(run('snake_case_name 2 * 3 * 4 a*b*c', 'markdown'), 'snake_case_name 2 * 3 * 4 a*b*c');
  assert.equal(run('```js\ncode\n```\nafter', 'markdown'), 'code\nafter');
  assert.equal(run('see https://x.y/p?utm_source=a&id=7&fbclid=zz#top.', 'urlTracking'), 'see https://x.y/p?id=7#top.');
  assert.equal(run('https://x.y/?utm_source=a&utm_medium=b', 'urlTracking'), 'https://x.y/');
  assert.equal(run('https://x.y/?a=1&utm_x=2&b=3', 'urlTracking'), 'https://x.y/?a=1&b=3');
});

test('symbols', () => {
  assert.equal(run('hi \u{1F600} \u{1F44D}\u{1F3FD} \u{1F1F8}\u{1F1EA} 1\uFE0F\u20E3 \u2764\uFE0F \u{1F468}\u200D\u{1F469}\u200D\u{1F467} \u263A ok', 'emoji'), 'hi       \u263A ok');
  assert.equal(run('caf\uFFFD', 'replacementChar'), 'caf');
  assert.equal(run('a\uF0B7b\uD800c\uFFFEd', 'privateUse'), 'abcd');
  assert.equal(run('na\u00EFve caf\u00E9 \u2013 ok\n', 'asciiOnly'), 'nave caf  ok\n');
});

test('changes keep their place in the original', () => {
  const input = 'a \u200B b\u00A0\u00A0c  \nnext';
  const r = clean(input, defaultSettings());
  checkInvariants(r);
  assert.equal(r.output, 'a b c\nnext');
  // every removed character is attributed to a rule
  const zw = r.changes.find((c) => c.before === '\u200B');
  assert.deepEqual(zw.rules, ['zeroWidth']);
  assert.equal(zw.line, 1);
  assert.equal(zw.col, 3);
  const last = r.changes[r.changes.length - 1];
  assert.deepEqual(last.rules, ['trailingSpaces']);
});

test('a later rule can change what an earlier rule produced', () => {
  const r = clean('x&nbsp;&nbsp;y', only('htmlEntities', 'unusualSpaces', 'collapseSpaces'));
  checkInvariants(r);
  assert.equal(r.output, 'x y');
  assert.ok(r.changes.some((c) => c.rules.includes('htmlEntities') && c.rules.includes('unusualSpaces')));
  assert.ok(r.changes.some((c) => c.rules.includes('collapseSpaces')));
});

test('a change that is undone again is not reported', () => {
  // decoded to a non-breaking space, which is the same as what was there
  const r = clean('\u00A0', only('htmlEntities'));
  assert.deepEqual(r.changes, []);
});

test('selection in the cleaned text maps back to the original', () => {
  const input = 'ab\u200Bcd\u00A0ef';
  const r = clean(input, defaultSettings());
  assert.equal(r.output, 'abcd ef');
  assert.deepEqual(outputRangeToOriginal(r, 0, 2), [0, 3]);   // "ab" + the removed character at its edge
  assert.deepEqual(outputRangeToOriginal(r, 2, 4), [2, 5]);   // "cd", same edge
  assert.deepEqual(outputRangeToOriginal(r, 4, 5), [5, 6]);   // the replaced space
  assert.deepEqual(outputRangeToOriginal(r, 5, 7), [6, 8]);
  assert.deepEqual(outputRangeToOriginal(r, 0, 7), [0, 8]);
});

test('invariants hold on a messy sample with every rule on', () => {
  const s = defaultSettings();
  for (const id of Object.keys(s.rules)) s.rules[id] = true;
  const input = '\uFEFF<p>He\u200Bllo&nbsp;&amp; \u201Cwelcome\u201D \u2014 to **the** \uFB01rst   te\u00ADst !</p>\r\n\r\n\r\n\r\n'
    + '\u2022 \u{1D5EF}\u{1D5FC}\u{1D5F9}\u{1D5F1}\t(x )  \u{1F600}\u{E0068}\u{E0069} a\u0308 \u202Eabc\u202C\x07 https://a.b/?utm_source=x&q=1  \n\n  end  \n\n';
  for (const settings of [s, defaultSettings(), only('collapseSpaces', 'trimEdges')]) {
    const r = clean(input, settings);
    checkInvariants(r);
  }
  assert.equal(clean(input, s).output, 'Hello & "welcome" - to the first test!\n- bold (x) a abc https://a.b/?q=1 end');
});

test('random edits never break the bookkeeping', () => {
  const pool = ['a', 'b', ' ', '  ', '\n', '\n\n\n', '\t', '\u200B', '\u00A0', '\u201C', '&amp;', '<b>', '**', '\uFB01', ' !', '( ', '\u{1F600}', '\u0301', '\r\n', '\u2014'];
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const ids = RULES.map((r) => r.id);
  for (let i = 0; i < 400; i++) {
    let text = '';
    const n = 1 + Math.floor(rnd() * 40);
    for (let j = 0; j < n; j++) text += pool[Math.floor(rnd() * pool.length)];
    const s = defaultSettings();
    for (const id of ids) s.rules[id] = rnd() < 0.7;
    checkInvariants(clean(text, s));
  }
});
