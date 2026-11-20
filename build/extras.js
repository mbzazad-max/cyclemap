/* Cycle Map extras (added 20 Nov 2026 at the owner's request): data for public/extras.js, which adds three things
   to the page without changing the original page or its logic:
     1. Cycle-phase marker: where today sits in Bitcoin's four-year clock (bear year -> recovery year -> halving
        year -> top year), worked out in the browser from the date and the halving dates. Nothing to build here.
     2. Month-by-month returns by cycle year: every month's close-to-close return for each coin, so the page can show
        a year x month heatmap with each year's place in the cycle, and averages for bear years and recovery years.
        Months come from the same daily candles the snapshot uses (BTC: stored Coinbase BTCUSD days before Binance
        starts; XRP: stored Bitstamp days; everything else Binance). Where no daily candles exist (BTC before Dec
        2014, ETH before Aug 2017) the month close is taken from the weekly history written inside the original page
        (the close of the last week ending in that month), and those months are flagged as approximate.
     3. BTC dashboard outlook: the BTC & ETH dashboard's Trade plan "multi-timeframe" read (trend vs EMA 20/50/200,
        RSI 14, MACD state on 4H, 1D and 1W, and its bias score), using that page's own formulas, copied verbatim
        below, on the same closed Binance candles it uses (4H x1000, 1D x400, weekly x160 made from closed days,
        price = last closed 4H close). XRP is not on that dashboard; it gets the same read without a link.
   Output is deterministic (stamped with the newest candle used, never the clock), so a run with no new candles
   changes nothing.
   usage: node build/extras.js <market-data dir>   -> public/extras.json */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), PUB = path.join(ROOT, 'public');
const MD = path.resolve(process.argv[2] || '../market-data');
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const cfg = rd(path.join(ROOT, 'config', 'dashboard.json'));
const pageText = fs.readFileSync(path.join(ROOT, 'reference', 'index.original.html'), 'utf8');

function load(id) {
  const [src, sym, tf] = id.split('/'), f = path.join(MD, 'data', src, `${sym}_${tf}.csv`);
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n'); lines.shift();
  return lines.map((ln) => { const p = ln.split(','); return { t: +p[0], o: +p[1], h: +p[2], l: +p[3], c: +p[4], v: +p[5] || 0 }; });
}
const dayStart = (t) => Math.floor(t / 86400) * 86400;
const weekStart = (t) => { const d = dayStart(t), wd = (new Date(d * 1000).getUTCDay() + 6) % 7; return d - wd * 86400; };
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
function groupBy(rows, keyOf) { const out = []; let cur = null; for (const r of rows) { const k = keyOf(r.t); if (!cur || cur.k !== k) { cur = { k, rs: [] }; out.push(cur); } cur.rs.push(r); } return out; }
const agg = (t, rs) => ({ t, o: rs[0].o, h: Math.max(...rs.map((r) => r.h)), l: Math.min(...rs.map((r) => r.l)), c: rs[rs.length - 1].c, v: rs.reduce((s, r) => s + r.v, 0) });

// weekly closes written inside the original page (BTC: Bitstamp from 12 Sep 2011; ETH: Kraken from 3 Aug 2015), up to 7 Aug 2017
const pageArr = (n) => { const m = pageText.match(new RegExp('const ' + n + '="([^"]*)"')); if (!m) throw new Error('page constant ' + n + ' not found'); return m[1].split(',').map(Number); };
const PAGE_WEEKS = { btc: { w0: '2011-09-12', c: pageArr('WK_PRE').concat(pageArr('WK_BS')) }, eth: { w0: '2015-08-03', c: pageArr('ETH_PRE') } };
for (const [k, p] of Object.entries(PAGE_WEEKS)) if (!pageText.includes(`W0:'${p.w0}'`)) throw new Error('page first week changed for ' + k);

function monthCloses(key, a, days) {
  // {ym: [close, approx]} : daily closes where they exist, else the page's weekly history
  const out = {};
  const pw = PAGE_WEEKS[key];
  if (pw) {
    const t0 = Date.parse(pw.w0 + 'T00:00:00Z') / 1000;
    pw.c.forEach((c, i) => { const end = t0 + i * 7 * 86400 + 6 * 86400; out[ym(end)] = [c, true]; });   // last week ending in the month wins
  }
  for (const g of groupBy(days, (t) => ym(t))) out[g.k] = [g.rs[g.rs.length - 1].c, false];
  return out;
}

// ---------- BTC & ETH dashboard Trade plan formulas (copied verbatim from its page, tp_engine) ----------
const sum = (a) => a.reduce((s, x) => s + x, 0);
const ema = (c, n) => { if (c.length < n) return null; const k = 2 / (n + 1); let e = sum(c.slice(0, n)) / n; for (const v of c.slice(n)) e = v * k + e * (1 - k); return e; };
const rsi = (c, n = 14) => {
  if (c.length < n + 2) return null; let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0); }
  g /= n; l /= n;
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
};
const macd = (c) => {
  if (c.length < 40) return null;
  const ser = (n) => { const k = 2 / (n + 1); let e = c[0]; const o = [e]; for (const v of c.slice(1)) { e = v * k + e * (1 - k); o.push(e); } return o; };
  const a = ser(12), b = ser(26), m = a.map((x, i) => x - b[i]);
  let s = m[0]; const S = [s]; for (const v of m.slice(1)) { s = v * 0.2 + s * 0.8; S.push(s); }
  const L = m.length;
  return { macd: m[L - 1], signal: S[L - 1], above: m[L - 1] > S[L - 1], cross_up: m[L - 2] <= S[L - 2] && m[L - 1] > S[L - 1], cross_dn: m[L - 2] >= S[L - 2] && m[L - 1] < S[L - 1], hist: m[L - 1] - S[L - 1], hist_prev: m[L - 2] - S[L - 2] };
};
function tradePlanRead(h4, days) {
  const TF = { '4H': h4.slice(-1000).map((r) => r.c), '1D': days.slice(-400).map((r) => r.c), '1W': groupBy(days, weekStart).map((g) => agg(g.k, g.rs)).slice(-160).map((r) => r.c) };
  const spot = TF['4H'][TF['4H'].length - 1];
  const ind = {};
  for (const t of ['4H', '1D', '1W']) { const c = TF[t]; ind[t] = { rsi: rsi(c), ema20: ema(c, 20), ema50: ema(c, 50), ema200: ema(c, 200), macd: macd(c), close: c[c.length - 1] }; }
  let sc = 0; const de = ind['1D'], we = ind['1W'], macd1 = ind['1D'].macd;
  if (de.ema50) sc += spot > de.ema50 ? 1 : -1;
  if (de.ema200) sc += spot > de.ema200 ? 1 : -1;
  if (we.ema20) sc += spot > we.ema20 ? 1 : -1;
  if (macd1) sc += macd1.above ? 1 : -1;
  const bias = sc >= 3 ? 'Bullish' : sc <= -3 ? 'Bearish' : 'Neutral / range';
  const mtf = ['4H', '1D', '1W'].map((t) => {
    const x = ind[t], m = x.macd;
    const above = (e) => (e == null ? null : spot > e);
    const ups = [above(x.ema20), above(x.ema50), above(x.ema200)].filter((v) => v != null);
    const nUp = ups.filter(Boolean).length;
    const trend = nUp === ups.length ? 'Up' : nUp === 0 ? 'Down' : 'Mixed';
    return {
      tf: t, close: x.close, rsi: r2(x.rsi), ema20: x.ema20, ema50: x.ema50, ema200: x.ema200, above: ups,
      macd_state: !m ? 'n/a' : m.cross_up ? 'Crossed up' : m.cross_dn ? 'Crossed down' : m.above ? (m.hist > m.hist_prev ? 'Above signal, rising' : 'Above signal, fading') : (m.hist < m.hist_prev ? 'Below signal, falling' : 'Below signal, recovering'),
      trend,
    };
  });
  return { spot, bias, bias_score: sc, mtf };
}
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const sig = (x) => (x == null ? null : Number(x.toPrecision(7)));

// ---------- per coin ----------
const LINKED = { btc: 'BTC', eth: 'ETH', sol: 'SOL', bnb: 'BNB' };   // coins on the BTC & ETH dashboard
const out = { about: 'Built by build/extras.js from the same closed candles as snapshot.json. See the file header for the rules.', coins: {}, errors: [] };
let newest = 0;
for (const [key, a] of Object.entries(cfg.assets)) {
  try {
    let days = load(a.daily); const h4 = load(a.h4);
    if (!days || !h4) throw new Error('missing candles');
    let hist = days;
    const seedId = a.seed || (key === 'btc' ? 'tv/COINBASE_BTCUSD/1D' : null);   // BTC: stored Coinbase history, as the BTC & ETH dashboard uses
    if (seedId) { const seed = load(seedId); if (seed) hist = seed.filter((r) => r.t < days[0].t).concat(days); }
    const endsAt = Math.max(days[days.length - 1].t + 86400, h4[h4.length - 1].t + 14400); newest = Math.max(newest, endsAt);
    // month table: closed days, plus today so far from closed 4H candles (same as the snapshot's today_from_4h)
    let d = hist;
    if (cfg.today_from_4h) { const after = hist[hist.length - 1].t + 86400; d = hist.concat(groupBy(h4.filter((r) => r.t >= after), dayStart).map((g) => agg(g.k, g.rs))); }
    const mc = monthCloses(key, a, d), keys = Object.keys(mc).map(Number).sort((x, y) => x - y);
    const months = [];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i], p = mc[k - 1]; if (!p) continue;
      const c = mc[k], y = Math.floor(k / 12), m = k % 12 + 1;
      months.push([y, m, r2((c[0] / p[0] - 1) * 100), (c[1] || p[1]) ? 1 : 0]);
    }
    const lastDay = d[d.length - 1].t;
    const tp = tradePlanRead(h4, days);
    out.coins[key] = {
      sym: a.pair.replace('USDT', ''), months, month_through: new Date(lastDay * 1000).toISOString().slice(0, 10),
      partial_month: new Date((lastDay + 86400) * 1000).getUTCDate() !== 1,
      first_exact: new Date(hist[0].t * 1000).toISOString().slice(0, 7),
      trade_plan: { link: LINKED[key] || null, spot: sig(tp.spot), bias: tp.bias, bias_score: tp.bias_score,
        mtf: tp.mtf.map((m) => ({ ...m, close: sig(m.close), ema20: sig(m.ema20), ema50: sig(m.ema50), ema200: sig(m.ema200) })),
        at: new Date((h4[h4.length - 1].t + 14400) * 1000).toISOString().slice(0, 16) + 'Z' },
    };
  } catch (e) { out.errors.push({ coin: key, why: String(e.message || e) }); }
}
out.generated = new Date(newest * 1000).toISOString().slice(0, 16) + 'Z';
const file = path.join(PUB, 'extras.json');
if (!Object.keys(out.coins).length) { console.error('extras: no coin could be built; keeping the last extras.json'); process.exit(1); }
if (out.errors.length && fs.existsSync(file)) {               // keep a coin's last good extras on failure
  const prev = rd(file); for (const e of out.errors) if (prev.coins && prev.coins[e.coin]) { out.coins[e.coin] = prev.coins[e.coin]; e.kept = true; }
}
fs.writeFileSync(file, JSON.stringify(out));
console.log(JSON.stringify({ extras: Object.keys(out.coins), errors: out.errors, generated: out.generated }));
