/* Render check: public/index.html (the original page + shim.js + cloud.js + extras.js) opened with the built public/snapshot.json,
   once for each coin (BTC, ETH, SOL, BNB, XRP). Fails on any page error, if the saved snapshot was not picked up, or if a section is empty.
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
    .replace('<script src="extras.js"></script>', () => '<script>' + fs.readFileSync(path.join(PUB, 'extras.js'), 'utf8') + '</script>')
    .replace(/<link[^>]+>/g, '');
  const errors = [], vc = new VirtualConsole(); vc.on('error', (...a) => errors.push(a.map(String).join(' '))); vc.on('jsdomError', (e) => errors.push('jsdom: ' + e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://dashboards.example/cyclemap/#' + asset, beforeParse(w) {
    w.fetch = async (u) => { const f = String(u);
      if (f.includes('/api/')) return owner ? { ok: true, status: 200, json: async () => ({ status: 'completed', conclusion: 'success' }) } : { ok: false, status: 302, json: async () => ({}) };
      const b = fs.readFileSync(path.join(PUB, f.replace(/^.*\//, '').split('?')[0]), 'utf8'), j = JSON.parse(b);
      // The page uses a saved snapshot only if it is newer than its built-in one. On the day a coin is added both come
      // from the same candle, so the snapshot is moved 4 hours later here to check the page really switches to it.
      if (j.docs) for (const d of Object.values(j.docs)) d.at += 4 * 3600e3;
      return { ok: true, status: 200, json: async () => j }; };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 900; } });
  } });
  const w = dom.window, d = w.document, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(1500);
  const t = (s) => { const e = d.querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, ' ') : ''; };
  const n = (s) => d.querySelectorAll(s).length;
  const s = SNAP['snap/' + doc], price = '$' + (s.price >= 10 ? Math.round(s.price).toLocaleString('en-US') : s.price.toFixed(2));
  const replays = { btc: 3, eth: 2, sol: 1, bnb: 2, xrp: 2 }[asset];
  const v = { asset, owner, replays, buttons: n('#segAsset button'), pressed: t('#segAsset button[aria-pressed="true"]'), bad_text: (d.querySelector('.wrap').textContent.match(/.{0,30}(?:wk null|\$NaN|null wk).{0,30}/) || [''])[0], asof: t('#asof'), h1: t('#h1'), strip_price: t('#strip .stat .v'), want_price: price, status_line: t('#refreshStatus'),
    stats: n('#strip .stat'), outlook: n('#outlook tbody tr'), match: n('#matchTable tbody tr'), sma: n('#smaTable tbody tr'), scen: n('#scenTable tbody tr'), clocks: n('#clocks .clock'),
    roadmap: n('#roadmap tbody tr'), cycles: n('#cycles tbody tr'), years: n('#years tbody tr'), quarters: n('#quarters tbody tr'), tf: n('#tf .tfc'), checks: n('#checks li'),
    chart_paths: n('#chart path'), track_paths: n('#track path'), sma_paths: n('#smaChart path'), week: t('#weekCheck').slice(0, 90),
    own_refresh_hidden: /#refreshBtn,#refreshStatus\{display:none!important\}/.test(d.head.innerHTML), cloud_refresh_hidden: d.getElementById('ghRefresh').hidden,
    fresh: t('#fresh summary'),
    x_phase: n('#cxPhase .stat'), x_bar: n('#cxPhase .cx-bar > div.on'), x_heat: n('#cxHeat tbody tr'), x_now: n('#cxHeat td.now'), x_tp: n('#cxTP tbody tr'), x_link: !!d.querySelector('#cxTP a.cx-go[href="/btc-eth/#plan"]'), x_read: t('#cxPhase .cx-read').slice(0, 120), x_agree: t('#cxTP .cx-agree').slice(0, 120),
    x_order: !!(d.getElementById('cxPhase') && d.getElementById('cxPhase').previousElementSibling && d.getElementById('cxPhase').previousElementSibling.id === 'strip'), back: !!d.querySelector('a.dash-back[href="/"]'), nan: /NaN|undefined|Infinity/.test(d.querySelector('.wrap').textContent),
    hidden_css: /\[hidden\]:not\(\[hidden=until-found i\]\)\{display:none!important\}/.test(d.head.innerHTML), utf8: d.characterSet === 'UTF-8' && t('title').indexOf('–') > 0, errors };
  w.close(); return v;
}
(async () => {
  const out = [await view('btc', 'cycle', false), await view('eth', 'cycle_eth', false), await view('sol', 'cycle_sol', false), await view('bnb', 'cycle_bnb', false), await view('xrp', 'cycle_xrp', false), await view('btc', 'cycle', true)];
  const bad = out.filter((v) => v.errors.length || v.nan || !/Binance closed candles/.test(v.asof) || v.strip_price !== v.want_price || !/Showing the last saved refresh/.test(v.status_line)
    || v.buttons !== 5 || v.pressed.toLowerCase() !== v.asset || v.bad_text
    || v.stats !== 6 || v.outlook < 8 || v.match !== v.replays + 1 || v.sma < 9 || v.scen !== v.replays + 1 || v.clocks !== 4 || v.roadmap < 8 || v.cycles < 3 || v.years !== 4 || v.quarters !== 4 || v.tf !== 3 || v.checks !== 6
    || v.chart_paths < v.replays + 2 || v.track_paths < 2 || v.sma_paths < 2 || !v.own_refresh_hidden || v.cloud_refresh_hidden !== !v.owner || !/all current|behind/.test(v.fresh) || !v.back || !v.hidden_css || !v.utf8
    || v.x_phase !== 6 || v.x_bar !== 1 || v.x_heat < 10 || v.x_now !== 1 || v.x_tp !== 3 || v.x_link !== (v.asset !== 'xrp') || !v.x_order || !v.x_agree);
  console.log(JSON.stringify(out, null, 1));
  console.log(bad.length ? 'RENDER FAILED: ' + bad.map((v) => v.asset).join(', ') : 'RENDER OK');
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
