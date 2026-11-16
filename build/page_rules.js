/* The page's own snapshot rules, taken from the original page text (reference/index.original.html) and run as they are.
   Nothing is rewritten here: buildSnapshot (all-time high, cycle low, levels, rounding, which candles are kept) is the
   page's function, with the two small helpers it uses. If the page text ever stops containing them, the build stops.
   usage: require('./page_rules.js').load(pageText) -> { buildSnapshot(bars, cfg) } */
'use strict';
const vm = require('vm');
function between(src, from, to) {
  const a = src.indexOf(from); if (a < 0 || src.indexOf(from, a + 1) >= 0) throw new Error('page rule not found exactly once: ' + from);
  const b = src.indexOf(to, a); if (b < 0) throw new Error('end of page rule not found: ' + to);
  return src.slice(a, b);
}
function load(page) {
  const code = [
    between(page, 'const isoDay=', '\n'),
    between(page, 'const monLabel=', '\n'),
    between(page, 'function buildSnapshot(b,cfg){', '\nfunction applySnapshot('),
    ';__out = { buildSnapshot };'
  ].join('\n');
  const ctx = { __out: null };
  vm.runInNewContext(code, ctx, { filename: 'page-rules-from-original.js' });
  return { buildSnapshot: (bars, cfg) => JSON.parse(JSON.stringify(ctx.__out.buildSnapshot(bars, cfg))) };
}
module.exports = { load };
