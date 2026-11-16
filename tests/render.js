/* Render check: public/index.html (the original page + shim.js + cloud.js) opened with the built public/snapshot.json,
   once for BTC and once for ETH. Fails on any page error, if the saved snapshot was not picked up, or if a section is empty.
   usage: node tests/render.js <node_modules dir that has jsdom> */
'use strict';
const fs = require('fs'), path = require('path');
const NM = path.resolve(process.argv[2]);
const { JSDOM, VirtualConsole } = require(path.join(NM, 'jsdom'));
const PUB = path.resolve(__dirname, '..', 'public');
const SNAP = JSON.parse(fs.readFileSync(path.join(PUB, 'snapshot.json'), 'utf8')).docs;
async function view(asset, doc, owner) {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8')
    .replace('<script src="shim.js"></script>', () => '<script>' + fs.readFileSync(path.join(PUB, 'shim.js'), 'utf8') + '</script>')
    .replace('<script src="cloud.js"></script>', () => '<script>' + fs.readFileSync(path.join(PUB, 'cloud.js'), 'utf8') + '</script>')
    .replace(/<link[^>]+>/g, '');
  const errors = [], vc = new VirtualConsole(); vc.on('error', (...a) => errors.push(a.map(String).join(' '))); vc.on('jsdomError', (e) => errors.push('jsdom: ' + e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://dashboards.example/cyclemap/#' + asset, beforeParse(w) {
    w.fetch = async (u) => { const f = String(u);
      if (f.includes('/api/')) return owner ? { ok: true, status: 200, json: async () => ({ status: 'completed', conclusion: 'success' }) } : { ok: false, status: 302, json: async () => ({}) };
      const b = fs.readFileSync(path.join(PUB, f.replace(/^.*\//, '').split('?')[0]), 'utf8'); return { ok: true, status: 200, json: async () => JSON.parse(b) }; };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 900; } });
  } });
  const w = dom.window, d = w.document, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1500);
  const t = (s) => { const e = d.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : ''; };
  const n = (s) => d.querySelectorAll(s).length;
  const s = SNAP['snap/' + doc], price = '$' + (s.price >= 10 ? Math.round(s.price).toLocaleString('en-US') : s.price.toFixed(2));
  const v = { asset, owner, asof: t('#asof'), h1: t('#h1'), strip_price: t('#strip .stat .v'), want_price: price, status_line: t('#refreshStatus'),
    stats: n('#strip .stat'), outlook: n('#outlook tbody tr'), match: n('#matchTable tbody tr'), sma: n('#smaTable tbody tr'), scen: n('#scenTable tbody tr'), clocks: n('#clocks .clock'),
    roadmap: n('#roadmap tbody tr'), cycles: n('#cycles tbody tr'), years: n('#years tbody tr'), quarters: n('#quarters tbody tr'), tf: n('#tf .tfc'), checks: n('#checks li'),
    chart_paths: n('#chart path'), track_paths: n('#track path'), sma_paths: n('#smaChart path'), week: t('#weekCheck').slice(0, 90),
    own_refresh_hidden: /#refreshBtn,#refreshStatus\{display:none!important\}/.test(d.head.innerHTML), cloud_refresh_hidden: d.getElementById('ghRefresh').hidden,
    fresh: t('#fresh summary'), back: !!d.querySelector('a.dash-back[href="/"]'), nan: /NaN|undefined|Infinity/.test(d.querySelector('.wrap').textContent),
    hidden_css: /\[hidden\]:not\(\[hidden=until-found i\]\)\{display:none!important\}/.test(d.head.innerHTML), utf8: d.characterSet === 'UTF-8' && t('title').indexOf('–') > 0, errors };
  w.close(); return v;
}
(async () => {
  const out = [await view('btc', 'cycle', false), await view('eth', 'cycle_eth', false), await view('btc', 'cycle', true)];
  const bad = out.filter((v) => v.errors.length || v.nan || !/Binance closed candles/.test(v.asof) || v.strip_price !== v.want_price || !/Showing the last saved refresh/.test(v.status_line)
    || v.stats !== 6 || v.outlook < 8 || v.match < 3 || v.sma < 9 || v.scen < 3 || v.clocks !== 4 || v.roadmap < 8 || v.cycles < 4 || v.years !== 4 || v.quarters !== 4 || v.tf !== 3 || v.checks !== 6
    || v.chart_paths < 3 || v.track_paths < 2 || v.sma_paths < 2 || !v.own_refresh_hidden || v.cloud_refresh_hidden !== !v.owner || !/all current|behind/.test(v.fresh) || !v.back || !v.hidden_css || !v.utf8);
  console.log(JSON.stringify(out, null, 1));
  console.log(bad.length ? 'RENDER FAILED: ' + bad.map((v) => v.asset).join(', ') : 'RENDER OK');
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
