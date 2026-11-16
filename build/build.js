/* Cycle Map build: turns the shared closed candles (repo mbzazad-max/market-data) into the saved snapshot the ORIGINAL
   page reads (the same documents its own "Refresh from TradingView" saves: snap/cycle for BTC, snap/cycle_eth for ETH).
   All of the dashboard's logic (cycle match, SMA fingerprint, replays, outlook, calendar) stays in the original page,
   which runs unchanged in the browser. This script only prepares the candles and hands them to the page's own
   buildSnapshot (build/page_rules.js runs it straight from the page text):
     daily   -> Binance closed days; with today_from_4h, plus the current UTC day so far from closed 4H candles
     weekly / monthly -> made from those days (Monday weeks, calendar months, UTC)
     4H      -> Binance closed 4H candles
     counts  -> the newest 1000 weeks, 200 months, 400 days, 300 4H candles (what the page asks TradingView for)
     SOL, BNB, XRP (added 16 Nov 2026) -> same rules; the page learns these coins from the fixed edits in tools/page.js,
               so buildSnapshot is taken from the edited page (the edit only lets the weekly history start at each
               coin's own first week). XRP: stored Bitstamp days before Binance's first day, then Binance only.
               A week with no candles repeats the previous close (keeps the weekly history without holes).
     --builtin -> writes reference/builtin_alts.json (the starting snapshot of SOL, BNB, XRP that tools/page.js puts
               inside the page, as the original page carries one for BTC and ETH). Run once when a coin is added.
   Two fields differ from a page refresh on purpose: "at" is the close time of the newest candle used (the page uses the
   clock at the moment of the refresh) and "src" names the real source (the page writes "TradingView ...").
   usage: node build/build.js <market-data dir> [--force]
   Writes public/snapshot.json and public/freshness.json. A coin that cannot be built keeps its last good document and
   is listed. If the inputs are unchanged since the last build (and not --force), nothing is rebuilt. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), PUB = path.join(ROOT, 'public');
const MD = path.resolve(process.argv[2] || '../market-data'), FORCE = process.argv.includes('--force'), BUILTIN = process.argv.includes('--builtin');
const BUILTIN_FILE = path.join(ROOT, 'reference', 'builtin_alts.json');
const NOW = process.env.BUILD_NOW ? Number(process.env.BUILD_NOW) : Math.floor(Date.now() / 1000);

const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const wr = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o)); };
const cfg = rd(path.join(ROOT, 'config', 'dashboard.json'));
const manifest = rd(path.join(MD, 'manifest.json')).series || {};
const pageText = fs.readFileSync(path.join(ROOT, 'reference', 'index.original.html'), 'utf8');
const prevSnap = fs.existsSync(path.join(PUB, 'snapshot.json')) ? rd(path.join(PUB, 'snapshot.json')) : { docs: {} };
const prevFresh = fs.existsSync(path.join(PUB, 'freshness.json')) ? rd(path.join(PUB, 'freshness.json')) : null;

// ---------- candles ----------
function load(id) {                                   // [{t,o,h,l,c}] oldest first, closed candles only (market-data rule)
  const [src, sym, tf] = id.split('/'), f = path.join(MD, 'data', src, `${sym}_${tf}.csv`);
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n'); lines.shift();
  return lines.map((ln) => { const p = ln.split(','); return { t: +p[0], o: +p[1], h: +p[2], l: +p[3], c: +p[4] }; });
}
const agg = (t, rs) => ({ t, o: rs[0].o, h: Math.max(...rs.map((r) => r.h)), l: Math.min(...rs.map((r) => r.l)), c: rs[rs.length - 1].c });
function groupBy(rows, keyOf) { const out = []; let cur = null; for (const r of rows) { const k = keyOf(r.t); if (!cur || cur.k !== k) { cur = { k, rs: [] }; out.push(cur); } cur.rs.push(r); } return out; }
const dayStart = (t) => Math.floor(t / 86400) * 86400;
const WEEK = 7 * 86400;
const weekStart = (t) => { const d = dayStart(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * 86400; };
const monthStart = (t) => { const d = new Date(t * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; };
const columns = (bars, n) => { const b = bars.slice(-n); return { t: b.map((x) => x.t), o: b.map((x) => x.o), h: b.map((x) => x.h), l: b.map((x) => x.l), c: b.map((x) => x.c) }; };
function weeksOf(d) {                                 // Monday weeks; a week with no candles repeats the previous close
  const out = [];
  for (const g of groupBy(d, weekStart)) {
    while (out.length && g.k - out[out.length - 1].t > WEEK) { const p = out[out.length - 1]; out.push({ t: p.t + WEEK, o: p.c, h: p.c, l: p.c, c: p.c }); }
    out.push(agg(g.k, g.rs));
  }
  return out;
}
function barsFor(a) {
  let days = load(a.daily); const h4 = load(a.h4);
  if (a.seed) {                                       // stored history for the days before the main series starts
    const seed = load(a.seed); if (!seed || !days) throw new Error('missing stored history (' + a.seed + ')');
    days = seed.filter((r) => r.t < days[0].t).concat(days);
  }
  if (!days || days.length < 400) throw new Error('missing or too few daily candles (' + a.daily + ')');
  if (!h4 || h4.length < 300) throw new Error('missing or too few 4H candles (' + a.h4 + ')');
  let d = days;
  if (cfg.today_from_4h) {                            // days after the last closed day, so far, from closed 4H candles
    const after = days[days.length - 1].t + 86400;
    d = days.concat(groupBy(h4.filter((r) => r.t >= after), dayStart).map((g) => agg(g.k, g.rs)));
  }
  for (const set of [d, h4]) if (!set.every((b) => b.c > 0 && b.h >= b.l && b.l > 0)) throw new Error('invalid candle values');
  const endsAt = Math.max(days[days.length - 1].t + 86400, h4[h4.length - 1].t + 14400);   // close of the newest candle used
  return { endsAt, bars: {
    w: columns(weeksOf(d), cfg.counts.w),
    m: columns(groupBy(d, monthStart).map((g) => agg(g.k, g.rs)), cfg.counts.m),
    d: columns(d, cfg.counts.d), h4: columns(h4, cfg.counts.h4) } };
}
function check(s, prev, a) {                             // a snapshot the page can safely open
  const num = (v) => typeof v === 'number' && isFinite(v) && v > 0, n = (x) => String(x).split(/[,;]/).length;
  if (!num(s.price)) return 'no price';
  const wantWeeks = Math.floor((s.at / 1000 - Date.parse((a.wk0 || '2017-08-14') + 'T00:00:00Z') / 1000) / WEEK);
  if (n(s.WK_BN) < wantWeeks || n(s.M_RAW) < 60) return 'weekly or monthly history is too short';
  if (prev && n(s.WK_BN) < n(prev.WK_BN)) return 'weekly history got shorter than the last good build';
  if (s.D_C.length !== 300 || s.H4_C.length !== 300 || s.W_C.length !== 60) return 'wrong number of recent candles';
  if (![...s.D_C, ...s.H4_C, ...s.W_C].every(num)) return 'a recent close is not a number';
  if (!num(s.ATH.p) || !num(s.LOW.p) || s.LOW.p >= s.ATH.p || s.LOW.d < s.ATH.d) return 'all-time high or cycle low does not make sense';
  if (![s.LEVELS.hi, s.LEVELS.lo30, s.LEVELS.lo90].every((x) => x && num(x.p) && x.m)) return 'levels missing';
  return null;
}

// ---------- inputs and the skip check ----------
const usedSeries = [...new Set(Object.values(cfg.assets).flatMap((a) => [a.daily, a.h4, a.seed].filter(Boolean)))].sort();
const historyOnly = new Set(Object.values(cfg.assets).map((a) => a.seed).filter(Boolean));
const pageJs = fs.readFileSync(path.join(ROOT, 'tools', 'page.js'));
const builtin = fs.existsSync(BUILTIN_FILE) ? rd(BUILTIN_FILE) : {};
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const inputsHash = sha(JSON.stringify([sha(pageText), sha(fs.readFileSync(__filename)), sha(fs.readFileSync(path.join(__dirname, 'page_rules.js'))), sha(pageJs), builtin, cfg,
  usedSeries.map((id) => [id, manifest[id] && manifest[id].last_open, manifest[id] && manifest[id].rows])]));
const freshnessRows = () => usedSeries.map((id) => { const m = manifest[id] || null;
  return { id, history_only: historyOnly.has(id) || undefined, source: id.split('/')[0], symbol: m ? m.symbol : id.split('/')[1], tf: id.split('/')[2], period_s: m ? m.period_s : null,
    last_open: m ? m.last_open : null, last_close: m ? m.last_close : null, fetched_at: m ? m.fetched_at : null, rows: m ? m.rows : 0 }; });
if (!FORCE && !BUILTIN && prevFresh && prevFresh.inputs_hash === inputsHash) {
  prevFresh.checked_at = NOW; prevFresh.series = freshnessRows(); prevFresh.readings = [];
  prevFresh.last_result = 'No new candles since the last build; dashboard unchanged.';
  wr(path.join(PUB, 'freshness.json'), prevFresh);
  console.log(JSON.stringify({ skipped: true, reason: 'inputs unchanged', checked_at: NOW }));
  process.exit(0);
}

// ---------- build each coin with the page's own buildSnapshot; a failure keeps the last good document ----------
const rules = require('./page_rules.js').load(require('../tools/page.js').edit(pageText, BUILTIN ? null : builtin));
const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const docs = {}, kept = [], last = {};
for (const [key, a] of Object.entries(cfg.assets)) {
  if (BUILTIN && !a.builtin) continue;
  const id = 'snap/' + a.doc, prev = BUILTIN ? null : prevSnap.docs[id] || null;
  try {
    const { bars, endsAt } = barsFor(a);
    let baseATH = a.baseATH || (builtin[key] && builtin[key].ATH);
    if (BUILTIN) {                                    // first time only: the day of the highest daily high on record
      const all = a.seed ? load(a.seed).filter((r) => r.t < load(a.daily)[0].t).concat(load(a.daily)) : load(a.daily), top = all.reduce((m, r) => (r.h > m.h ? r : m));
      const f = 10 ** a.dp; baseATH = { d: dayOf(top.t), p: Math.round(top.h * f) / f };
    }
    if (!baseATH) throw new Error('no starting all-time high (reference/builtin_alts.json)');
    const s = rules.buildSnapshot(bars, { dp: a.dp, tv: a.tv, baseATH, wk0: a.wk0 });
    s.at = endsAt * 1000; s.src = cfg.src;
    const bad = check(s, prev, a); if (bad) throw new Error(bad);
    docs[id] = s; last[key] = { price: s.price, at: new Date(s.at).toISOString().slice(0, 16) + 'Z', ATH: s.ATH, LOW: s.LOW, weeks: s.WK_BN.split(',').length };
  } catch (e) {
    kept.push({ id: key, why: String(e.message || e) });
    if (prev) docs[id] = prev;
  }
}
if (BUILTIN) {
  if (kept.length) { console.error('Could not make the built-in snapshot:\n' + kept.map((k) => k.id + ': ' + k.why).join('\n')); process.exit(1); }
  const out = {}; for (const [key, a] of Object.entries(cfg.assets)) if (a.builtin) out[key] = docs['snap/' + a.doc];
  wr(BUILTIN_FILE, out); console.log(JSON.stringify({ builtin: last })); process.exit(0);
}
const missing = Object.values(cfg.assets).filter((a) => !docs['snap/' + a.doc]).map((a) => a.pair);
if (missing.length) { console.error('Validation failed, nothing written: no data at all for ' + missing.join(', ') + '\n' + kept.map((k) => k.id + ': ' + k.why).join('\n')); process.exit(1); }

const generated = new Date(NOW * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', nAll = Object.keys(cfg.assets).length;
wr(path.join(PUB, 'snapshot.json'), { generated, docs });
wr(path.join(PUB, 'freshness.json'), { built_at: NOW, checked_at: NOW, generated, inputs_hash: inputsHash, kept,
  last_result: kept.length ? `Built ${nAll - kept.length} of ${nAll} coins; ${kept.length} kept their last good version.` : `Built all ${nAll} coins.`,
  series: freshnessRows(), readings: [] });
console.log(JSON.stringify({ generated, built: nAll - kept.length, kept, last }));
