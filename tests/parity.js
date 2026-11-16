/* Parity test: the ORIGINAL page (reference/index.original.html, its own "Refresh from TradingView") versus
   build/build.js, fed the SAME closed candles from market-data.
   usage: node tests/parity.js <market-data dir> <node_modules dir that has jsdom>
   The page asks TradingView for, per coin: weekly x1000, monthly x200, daily x400, 4H x300. The mock answers with the
   stored closed candles, prepared by this file's own code (not build.js): days (plus today so far from closed 4H
   candles when config says so), weeks and months made from those days, and the 4H candles. The page then runs its
   whole Refresh for BTC and for ETH and saves snap/cycle and snap/cycle_eth; both are compared with build.js output.
   Not compared (on purpose): "at" (the page uses the clock at refresh time, build.js the close of the newest candle)
   and "src" (the page writes "TradingView BINANCE:...", build.js names the real source). */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const MD = path.resolve(process.argv[2]), NM = path.resolve(process.argv[3]);
const { JSDOM, VirtualConsole } = require(path.join(NM, 'jsdom'));
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/dashboard.json'), 'utf8'));
const load = (id) => fs.readFileSync(path.join(MD, 'data', id.split('/')[0], id.split('/')[1] + '_' + id.split('/')[2] + '.csv'), 'utf8').trim().split('\n').slice(1)
  .map((x) => { const p = x.split(',').map(Number); return { t: p[0], o: p[1], h: p[2], l: p[3], c: p[4] }; });
const fold = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r.t), b = m.get(k);
  if (!b) m.set(k, { t: k, o: r.o, h: r.h, l: r.l, c: r.c }); else { if (r.h > b.h) b.h = r.h; if (r.l < b.l) b.l = r.l; b.c = r.c; } } return [...m.values()]; };
const day = (t) => t - (t % 86400);
const week = (t) => { const d = new Date(day(t) * 1000); return day(t) - ((d.getUTCDay() || 7) - 1) * 86400; };
const month = (t) => Date.parse(new Date(t * 1000).toISOString().slice(0, 7) + '-01T00:00:00Z') / 1000;
const answer = (bars, n) => { const b = bars.slice(-n); return { success: true, format: 'columns', bars: { t: b.map((x) => x.t), o: b.map((x) => x.o), h: b.map((x) => x.h), l: b.map((x) => x.l), c: b.map((x) => x.c) } }; };
const BY_TV = Object.fromEntries(Object.values(cfg.assets).map((a) => [a.tv, a]));
function tv(a) {
  const A = BY_TV[a.symbol]; if (!A) throw { code: 'tool_error', message: 'no fixture for ' + a.symbol };
  const h4 = load(A.h4); let d = load(A.daily);
  if (cfg.today_from_4h) { const from = d[d.length - 1].t + 86400; d = d.concat(fold(h4.filter((r) => r.t >= from), day)); }
  if (a.interval === '4h') return answer(h4, a.count);
  if (a.interval === '1D') return answer(d, a.count);
  if (a.interval === '1W') return answer(fold(d, week), a.count);
  if (a.interval === 'M') return answer(fold(d, month), a.count);
  throw { code: 'tool_error', message: 'no fixture for ' + a.symbol + ' ' + a.interval };
}
(async () => {
  const store = {}, calls = [];
  const html = fs.readFileSync(path.join(ROOT, 'reference/artifact_wrapper.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'reference/index.original.html'), 'utf8').replace(/<link[^>]+>/g, '');
  const errors = [], vc = new VirtualConsole(); vc.on('error', (...a) => errors.push(a.map(String).join(' '))); vc.on('jsdomError', (e) => errors.push('jsdom: ' + e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.test/', beforeParse(w) {
    const snap = (p) => ({ id: p.split('/').pop(), exists: p in store, data: () => JSON.parse(JSON.stringify(store[p])), metadata: {} });
    const DB = { doc: (p) => ({ get: async () => snap(p), set: async (o) => { store[p] = JSON.parse(JSON.stringify(o)); } }) };
    const MCP = { callTool: async (server, tool, a) => { calls.push(a.symbol + ' ' + a.interval + ' x' + a.count); if (tool !== 'mcp-tv-get-ohlcv') throw { code: 'tool_error', message: 'unexpected tool ' + tool }; return { payload: tv(a) }; } };
    w.claude = { use: async (k) => (k === 'db' ? DB : k === 'mcp' ? MCP : null) };
  } });
  const w = dom.window, d = w.document, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const status = {};
  for (const key of Object.keys(cfg.assets)) {
    await sleep(300);
    d.querySelector(`#segAsset button[data-k="${key}"]`).click();
    await sleep(300);
    d.getElementById('refreshBtn').click();
    const el = d.getElementById('refreshStatus');
    for (let i = 0; i < 600 && !/\b(good|bad)\b/.test(el.className); i++) await sleep(100);
    status[key] = el.textContent;
    if (!/\bgood\b/.test(el.className)) throw new Error('the page could not refresh ' + key + ': ' + el.textContent);
  }
  // build.js on the same data
  const tmp = fs.mkdtempSync('/tmp/cyclemap-parity-'); execFileSync('cp', ['-r', ROOT + '/.', tmp]);
  for (const f of ['public/snapshot.json', 'public/freshness.json']) try { fs.unlinkSync(path.join(tmp, f)); } catch (e) { /* none */ }
  execFileSync('node', [path.join(tmp, 'build/build.js'), MD, '--force']);
  const ours = JSON.parse(fs.readFileSync(path.join(tmp, 'public/snapshot.json'), 'utf8')).docs;
  const norm = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.at; delete c.src; return c; };
  const res = { page_status: status, page_calls: calls, identical: [], different: {}, only_page: [], only_build: [] };
  for (const k of Object.keys(store)) {
    if (!(k in ours)) { res.only_page.push(k); continue; }
    const a = norm(store[k]), b = norm(ours[k]);
    if (JSON.stringify(a) === JSON.stringify(b)) res.identical.push(k + ' (' + Object.keys(a).length + ' fields, ' + String(a.WK_BN).split(',').length + ' weeks, price ' + a.price + ')');
    else res.different[k] = Object.keys({ ...a, ...b }).filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]));
  }
  for (const k of Object.keys(ours)) if (!(k in store)) res.only_build.push(k);
  res.not_compared = { at: Object.fromEntries(Object.keys(ours).map((k) => [k, { page: new Date(store[k] ? store[k].at : 0).toISOString(), build: new Date(ours[k].at).toISOString() }])), src: Object.fromEntries(Object.keys(ours).map((k) => [k, { page: store[k] && store[k].src, build: ours[k].src }])) };
  res.page_errors = errors;
  const ok = res.identical.length === Object.keys(cfg.assets).length && !Object.keys(res.different).length && !res.only_page.length && !res.only_build.length && !errors.length && calls.length === 4 * Object.keys(cfg.assets).length;
  console.log(JSON.stringify({ ok, ...res }, null, 1));
  w.close(); process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
