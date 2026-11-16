/* The page must be the original "BTC & ETH 2026–2029 Cycle Map" artifact, unchanged.
   1. reference/index.original.html must match reference/PAGE_SHA256SUMS (the published artifact page, read 16 Nov 2026).
   2. public/index.html must be exactly: reference/artifact_wrapper.html (the head that claude.ai's artifact host puts
      around every page: UTF-8, mobile viewport, "hidden" really hides) + that file + the two added script tags
      (shim.js before the page's script, cloud.js at the end). There are no other edits.
   3. The page's own values copied into config/dashboard.json (document name, decimals, starting all-time high per coin)
      must still be in the page.
   usage: node tools/check_page.js [--write]   (exit 1 on any difference; --write rebuilds public/index.html) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const ref = fs.readFileSync(path.join(ROOT, 'reference/index.original.html'));
const want = fs.readFileSync(path.join(ROOT, 'reference/PAGE_SHA256SUMS'), 'utf8').trim().split(/\s+/)[0];
const got = crypto.createHash('sha256').update(ref).digest('hex');
if (got !== want) { console.error('reference/index.original.html changed: ' + got + ' != ' + want); process.exit(1); }
const text = ref.toString('utf8'), SCRIPT = '\n<script>\n';
if (text.split(SCRIPT).length !== 2) { console.error('the page should have exactly one script block'); process.exit(1); }
const WRAP = fs.readFileSync(path.join(ROOT, 'reference/artifact_wrapper.html'), 'utf8');
const expected = WRAP + text.replace(SCRIPT, () => '\n<script src="shim.js"></script>' + SCRIPT) + '<script src="cloud.js"></script>\n';
if (process.argv.includes('--write')) { fs.writeFileSync(path.join(ROOT, 'public/index.html'), expected); console.log('public/index.html written'); process.exit(0); }
if (fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8') !== expected) { console.error('public/index.html is not the original page plus shim.js and cloud.js'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/dashboard.json'), 'utf8')).assets;
const must = [
  `pair:'${cfg.btc.pair}', tv:'${cfg.btc.tv}', doc:'${cfg.btc.doc}', dp:${cfg.btc.dp},`,
  `pair:'${cfg.eth.pair}', tv:'${cfg.eth.tv}', doc:'${cfg.eth.doc}', dp:${cfg.eth.dp},`,
  `let ATH = {d:'${cfg.btc.baseATH.d}', p:${cfg.btc.baseATH.p}};`,
  `ATH:{d:'${cfg.eth.baseATH.d}',p:${cfg.eth.baseATH.p}}`,
  "const jobs=[['w','1W',1000,'weekly'],['m','M',200,'monthly'],['d','1D',400,'daily'],['h4','4h',300,'4-hour']]",
];
const lost = must.filter((m) => text.split(m).length !== 2);
if (lost.length) { console.error('config/dashboard.json no longer matches the page:\n' + lost.join('\n')); process.exit(1); }
console.log('Page = original artifact + shim.js + cloud.js: ' + got);
