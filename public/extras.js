/* Cycle Map on Cloudflare: three additions (20 Nov 2026). The original page and its logic are unchanged; this file
   only adds sections around it, using the page's own colours, fonts and classes.
     1. "Where we are in the four-year cycle": a phase marker on Bitcoin's clock (bear year -> recovery year ->
        halving year -> top year, the same slots as the page's four-year calendar), with the coin's distance from
        its top and its cycle low (from the same saved snapshot the page shows).
     2. "Month by month, by cycle year": every month's return (extras.json), each year tagged with its cycle slot,
        with averages per slot, what this month did in past bear years, and the next three months after past bear years.
     3. Under "Right now: 1W · 1D · 4H": the BTC & ETH dashboard's Trade plan read (4H, 1D, 1W trend vs EMA 20/50/200,
        RSI 14, MACD, bias score; same formulas, same candles) next to this page's own read, with a link that opens
        that dashboard's Trade plan on the same coin. */
(function () {
  'use strict';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var DAY = 864e5, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SLOTS = [['Bear year', 'bottom'], ['Recovery year', 'recovery'], ['Halving year', 'rally'], ['Top year', 'top']];
  var slotOf = function (y) { return ((y - 2014) % 4 + 4) % 4; };              // 2014, 2018, 2022, 2026 = bear years
  var SLOT_CLS = ['bad', 'warn', 'good', 'good'];
  var HALVINGS = ['2012-11-28', '2016-07-09', '2020-05-11', '2024-04-20'], NEXT_HALVING = '2028-04-15';   // the page's own estimate
  var D = function (s) { return new Date(s + 'T00:00:00Z'); };
  var fdate = function (d) { return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  var pct = function (v, dp) { return v == null || !isFinite(v) ? '–' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(dp == null ? 0 : dp) + '%'; };
  var px = function (v) { if (v == null) return '–'; var a = Math.abs(v); return '$' + (a >= 1000 ? Math.round(v).toLocaleString('en-US') : a >= 10 ? v.toFixed(2) : a >= 1 ? v.toFixed(3) : v.toFixed(4)); };
  var coinKey = function () { var b = document.querySelector('#segAsset button[aria-pressed="true"]'); return b ? b.dataset.k : 'btc'; };

  var st = document.createElement('style');
  st.textContent =
    '.cx-wrap{position:relative}.cx-bar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:12.5px}' +
    '.cx-bar>div{padding:10px 8px;border-right:1px solid var(--line);min-width:0}.cx-bar>div:last-child{border-right:0}' +
    '.cx-bar>div.on{background:var(--btc-soft)}.cx-bar b{display:block;font-size:13px}.cx-bar span{color:var(--muted);font-size:11.5px}' +
    '.cx-ov{position:absolute;inset:0;pointer-events:none}.cx-mk{position:absolute;top:0;bottom:0;width:0;border-left:3px solid var(--btc)}' +
    '.cx-tick{position:absolute;bottom:0;height:14px;width:0;border-left:2px dotted var(--muted)}' +
    '.cx-scale{position:relative;height:18px;font:600 11.5px var(--f-mono);color:var(--btc)}.cx-scale i{position:absolute;top:2px;font-style:normal;white-space:nowrap;transform:translateX(-50%)}' +
    '.cx-read{font-size:14px;max-width:95ch}.cx-read b{font-family:var(--f-mono);font-weight:600}' +
    'table.cx-heat{border-collapse:collapse;font-size:12.5px;width:100%}table.cx-heat th,table.cx-heat td{padding:4px 5px;text-align:right;white-space:nowrap;font-family:var(--f-mono)}' +
    'table.cx-heat th{font:600 11.5px var(--f-body);color:var(--muted)}table.cx-heat td:first-child,table.cx-heat th:first-child{text-align:left}' +
    'table.cx-heat td.cx-ph{text-align:left;font-family:var(--f-body)}table.cx-heat td.a{font-style:italic;opacity:.8}table.cx-heat td.now{outline:2px solid var(--btc);outline-offset:-2px}' +
    'table.cx-heat tr.cur td{font-weight:600}table.cx-heat tbody tr.sum td{border-top:1px solid var(--line)}table.cx-heat tr.hl td:first-child{box-shadow:inset 3px 0 var(--btc)}' +
    '.cx-tp{display:flex;flex-direction:column;gap:10px}.cx-tp .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}' +
    '.cx-tp table{border-collapse:collapse;font-size:13px;width:100%}.cx-tp th,.cx-tp td{padding:5px 8px;text-align:left;border-bottom:1px solid var(--line)}.cx-tp td.n{font-family:var(--f-mono)}' +
    '.cx-go{font:600 13px var(--f-body);background:var(--btc);color:var(--panel);border-radius:8px;padding:8px 14px;text-decoration:none;display:inline-block}.cx-go:focus-visible{outline:2px solid var(--ink);outline-offset:2px}' +
    '.cx-agree{font-size:13px;color:var(--muted)}';
  document.head.appendChild(st);

  // ---------- places in the page ----------
  var secByTitle = function (t) { var hs = document.querySelectorAll('section > h2'); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.indexOf(t) === 0) return hs[i].parentNode; return null; };
  var phaseSec = document.createElement('section'); phaseSec.id = 'cxPhase';
  var stripEl = document.getElementById('strip');
  if (stripEl && stripEl.parentNode) stripEl.parentNode.insertBefore(phaseSec, stripEl.nextSibling);
  var heatSec = document.createElement('section'); heatSec.id = 'cxHeat';
  var cal = secByTitle('The four-year calendar');
  if (cal && cal.parentNode) cal.parentNode.insertBefore(heatSec, cal.nextSibling);
  var tpBox = document.createElement('div'); tpBox.id = 'cxTP'; tpBox.className = 'panel cx-tp';
  var tfSec = secByTitle('Right now');
  if (tfSec) tfSec.appendChild(tpBox);

  var SNAP = null, X = null;
  var j = function (f) { return fetch(f, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(f + ' HTTP ' + r.status); return r.json(); }); };
  Promise.all([j('snapshot.json').catch(function () { return null; }), j('extras.json')]).then(function (r) { SNAP = r[0]; X = r[1]; draw(); })
    .catch(function () { phaseSec.innerHTML = '<p class="muted">Cycle extras could not load.</p>'; });

  // ---------- 1. phase marker ----------
  function docFor(k) { var A = { btc: 'cycle', eth: 'cycle_eth', sol: 'cycle_sol', bnb: 'cycle_bnb', xrp: 'cycle_xrp' }; return SNAP && SNAP.docs && SNAP.docs['snap/' + A[k]]; }
  function drawPhase(k, C) {
    var now = new Date(), y = now.getUTCFullYear(), s = slotOf(y), y0 = y - s;          // y0 = this cycle's bear year
    var start = Date.UTC(y0, 0, 1), end = Date.UTC(y0 + 4, 0, 1), frac = (now - start) / (end - start);
    var yStart = Date.UTC(y, 0, 1), yEnd = Date.UTC(y + 1, 0, 1), yFrac = (now - yStart) / (yEnd - yStart);
    var pos = function (d) { return Math.max(0, Math.min(1, (d - start) / (end - start))) * 100; };
    var seg = SLOTS.map(function (sl, i) {
      return '<div class="' + (i === s ? 'on' : '') + '"><b>' + (y0 + i) + '</b><b>' + sl[0].replace(' year', '') + '</b><span>' + ['“bottom”', '', '“rally” · halving ~' + fdate(D(NEXT_HALVING)).replace(/^\d+ /, ''), ''][i] + '</span></div>';
    }).join('');
    var fx = (frac * 100).toFixed(2), lx = Math.max(6, Math.min(94, frac * 100)).toFixed(2);
    var mk = '<div class="cx-ov"><div class="cx-mk" style="left:' + fx + '%"></div><div class="cx-tick" style="left:' + pos(D(NEXT_HALVING)).toFixed(2) + '%" title="Next halving (estimate)"></div></div>';
    var doc = docFor(k), sym = C.sym, facts = [];
    var nextStart = new Date(Date.UTC(y + 1, 0, 1)), dLeft = Math.ceil((nextStart - now) / DAY), dHalv = Math.round((D(NEXT_HALVING) - now) / DAY);
    facts.push(['Cycle year', SLOTS[s][0].replace(' year', ''), Math.round(yFrac * 100) + '% through ' + y]);
    facts.push(['Next slot', SLOTS[(s + 1) % 4][0].replace(' year', ''), 'starts 1 Jan ' + (y + 1) + ' · in ' + dLeft + ' days']);
    facts.push(['Four-year cycle', Math.round(frac * 100) + '%', y0 + '–' + (y0 + 3) + ' cycle done']);
    facts.push(['Next halving', '~' + fdate(D(NEXT_HALVING)).replace(/^\d+ /, ''), 'in about ' + Math.round(dHalv / 30.44) + ' months (estimate)']);
    var read = '';
    if (doc && doc.ATH && doc.LOW && doc.price) {
      var topD = D(doc.ATH.d), lowD = D(doc.LOW.d);
      facts.push([sym + ' from top', pct((doc.price / doc.ATH.p - 1) * 100), Math.round((now - topD) / DAY) + ' days since ' + fdate(topD)]);
      facts.push([sym + ' from cycle low', pct((doc.price / doc.LOW.p - 1) * 100), Math.round((now - lowD) / DAY) + ' days since ' + fdate(lowD)]);
    }
    // this month and the next three months in past years of the same slot
    var M = {}; C.months.forEach(function (m) { M[m[0] * 12 + m[1] - 1] = m; });
    var mNow = now.getUTCMonth(), same = [];
    for (var yy = y - 4; yy >= 2011; yy -= 4) { var e = M[yy * 12 + mNow]; if (e) same.push(e); }
    var cur = M[y * 12 + mNow];
    if (same.length) {
      var avg = same.reduce(function (a, e) { return a + e[2]; }, 0) / same.length;
      read += '<p class="cx-read"><b>' + MON[mNow] + '</b> in past ' + SLOTS[s][0].toLowerCase() + 's: ' + same.slice().reverse().map(function (e) { return e[0] + ' <span class="' + (e[2] >= 0 ? 'up' : 'dn') + '">' + pct(e[2]) + (e[3] ? '~' : '') + '</span>'; }).join(', ') +
        ' (average ' + pct(avg) + ')' + (cur ? '. This ' + MON[mNow] + ' so far: <span class="' + (cur[2] >= 0 ? 'up' : 'dn') + '">' + pct(cur[2]) + '</span>' : '') + '.</p>';
    }
    var nxt = [];
    for (var yb = y - 4; yb >= 2011; yb -= 4) {
      var g = 1, ok = true, lab = [];
      for (var i = 1; i <= 3; i++) { var kk = yb * 12 + mNow + i, ee = M[kk]; if (!ee) { ok = false; break; } g *= 1 + ee[2] / 100; lab.push(ee); }
      if (ok) nxt.push([yb, (g - 1) * 100, lab.some(function (e) { return e[3]; })]);
    }
    if (nxt.length) {
      var span = MON[(mNow + 1) % 12] + '–' + MON[(mNow + 3) % 12], up = nxt.filter(function (n) { return n[1] > 0; }).length;
      read += '<p class="cx-read">The next three months (<b>' + span + '</b>) after past ' + SLOTS[s][0].toLowerCase() + 's: ' + nxt.slice().reverse().map(function (n) { return n[0] + ' <span class="' + (n[1] >= 0 ? 'up' : 'dn') + '">' + pct(n[1]) + (n[2] ? '~' : '') + '</span>'; }).join(', ') +
        ' (' + up + ' of ' + nxt.length + ' up).</p>';
    }
    phaseSec.innerHTML = '<h2>Where we are in the four-year cycle</h2>' +
      '<p class="muted">Bitcoin\'s halving clock, in the same slots as the four-year calendar below (some trackers call them bottom, recovery, rally and top years). Other coins follow the same clock.</p>' +
      '<div role="img" aria-label="Today is ' + Math.round(frac * 100) + '% through the ' + y0 + '–' + (y0 + 3) + ' cycle, in the ' + SLOTS[s][0] + '"><div class="cx-wrap"><div class="cx-bar">' + seg + '</div>' + mk + '</div><div class="cx-scale"><i style="left:' + lx + '%">▲ today</i></div></div>' +
      '<div class="strip">' + facts.map(function (f) { return '<div class="stat"><span class="k">' + esc(f[0]) + '</span><span class="v">' + esc(f[1]) + '</span><span class="s">' + esc(f[2]) + '</span></div>'; }).join('') + '</div>' +
      read + '<div class="notes"><p>Same-slot years are 4 years apart. ~ marks a month made from weekly closes (before daily data starts in ' + esc(C.first_exact) + '). A pattern from 2–3 past cycles is a lean, not a rule.</p></div>';
  }

  // ---------- 2. heatmap ----------
  function drawHeat(k, C) {
    var now = new Date(), yNow = now.getUTCFullYear(), mNow = now.getUTCMonth() + 1, sNow = slotOf(yNow);
    var byY = {}; C.months.forEach(function (m) { (byY[m[0]] = byY[m[0]] || {})[m[1]] = m; });
    var years = Object.keys(byY).map(Number).sort();
    var bg = function (v) { if (v == null) return ''; var a = Math.min(60, 8 + Math.abs(v) * 1.4); return ' style="background:color-mix(in srgb,var(' + (v >= 0 ? '--good' : '--bad') + ') ' + a.toFixed(0) + '%,transparent)"'; };
    var cell = function (e, isNow) { return e ? '<td class="' + (e[3] ? 'a' : '') + (isNow ? ' now' : '') + '"' + bg(e[2]) + ' title="' + MON[e[1] - 1] + ' ' + e[0] + ': ' + pct(e[2], 1) + (e[3] ? ' (from weekly closes)' : '') + '">' + pct(e[2]) + '</td>' : '<td class="muted">·</td>'; };
    var rows = years.map(function (y) {
      var r = byY[y], s = slotOf(y), g = 1, n = 0, a = false;
      for (var m = 1; m <= 12; m++) if (r[m]) { g *= 1 + r[m][2] / 100; n++; a = a || !!r[m][3]; }
      var full = n === 12 || y === yNow;
      return '<tr class="' + (y === yNow ? 'cur' : '') + (s === sNow || s === (sNow + 1) % 4 ? ' hl' : '') + '"><td>' + y + '</td><td class="cx-ph"><span class="pill ' + SLOT_CLS[s] + '">' + SLOTS[s][0].replace(' year', '') + '</span></td>' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (m) { return cell(r[m], y === yNow && m === mNow); }).join('') +
        (full ? '<td class="' + (a ? 'a' : '') + '"' + bg((g - 1) * 100 / 4) + '>' + pct((g - 1) * 100) + (y === yNow ? ' <span class="muted">YTD</span>' : '') + '</td>' : '<td class="muted">part</td>') + '</tr>';
    }).join('');
    var stat = function (label, pick, kind) {
      return '<tr class="sum"><td colspan="2">' + label + '</td>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (m) {
        var v = years.filter(pick).map(function (y) { return byY[y][m]; }).filter(function (e) { return e && !(e[0] === yNow && e[1] === mNow); }).map(function (e) { return e[2]; });
        if (!v.length) return '<td class="muted">·</td>';
        if (kind === 'up') { var u = v.filter(function (x) { return x > 0; }).length; return '<td>' + Math.round(u / v.length * 100) + '%</td>'; }
        if (kind === 'med') { var sv = v.slice().sort(function (a, b) { return a - b; }), h = sv.length >> 1; var md = sv.length % 2 ? sv[h] : (sv[h - 1] + sv[h]) / 2; return '<td' + bg(md) + '>' + pct(md) + '</td>'; }
        var av = v.reduce(function (a, b) { return a + b; }, 0) / v.length; return '<td' + bg(av) + ' title="' + v.length + ' years">' + pct(av) + '</td>';
      }).join('') + '<td></td></tr>';
    };
    var sums = SLOTS.map(function (sl, i) { return stat(sl[0] + ' average', function (y) { return slotOf(y) === i; }); }).join('') +
      stat('All years average', function () { return true; }) + stat('All years median', function () { return true; }, 'med') + stat('Months up', function () { return true; }, 'up');
    heatSec.innerHTML = '<h2>Month by month, by cycle year</h2>' +
      '<p class="muted">' + esc(C.sym) + ' monthly returns, each year tagged with its slot in the four-year cycle. Rows marked on the left are this year\'s slot (' + SLOTS[sNow][0].toLowerCase() + ') and the next one (' + SLOTS[(sNow + 1) % 4][0].toLowerCase() + '). The outlined cell is this month so far (to ' + fdate(D(C.month_through)) + '); averages leave it out.</p>' +
      '<div class="tablebox panel" style="padding:6px 8px"><table class="cx-heat"><thead><tr><th>Year</th><th>Slot</th>' + MON.map(function (m, i) { return '<th' + (i + 1 === mNow ? ' style="color:var(--btc)"' : '') + '>' + m + '</th>'; }).join('') + '<th>Year</th></tr></thead><tbody>' + rows + sums + '</tbody></table></div>' +
      '<div class="notes"><p>Close-to-close monthly returns from the same closed candles as the rest of the page' + (k === 'btc' ? ' (Coinbase BTCUSD days from Dec 2014, Binance from Aug 2017)' : k === 'xrp' ? ' (Bitstamp XRPUSD days before Binance)' : '') + '. Italic cells marked by a lighter shade come from weekly closes inside the page and are approximate. Slot averages rest on 2–4 years each.</p></div>';
  }

  // ---------- 3. BTC dashboard Trade plan read ----------
  function pageRead() {
    var out = {}; document.querySelectorAll('#tf .tfc').forEach(function (c) { var h = c.querySelector('h3'), p = c.querySelector('.pill'); if (h && p) out[h.textContent.trim()] = p.textContent.trim(); });
    return out;
  }
  var dir = function (s) { return /bull/i.test(s) || s === 'Up' ? 1 : /bear/i.test(s) || s === 'Down' ? -1 : 0; };
  function drawTP(k, C) {
    var T = C.trade_plan; if (!T) { tpBox.innerHTML = ''; return; }
    var trendPill = function (t) { return '<span class="pill ' + (t === 'Up' ? 'good' : t === 'Down' ? 'bad' : 'warn') + '">' + t + '</span>'; };
    var arrow = function (v, e) { return e == null ? '–' : px(e) + ' ' + (v > e ? '▲' : '▼'); };
    var rows = T.mtf.slice().reverse().map(function (m) {
      return '<tr><td><b>' + m.tf + '</b></td><td>' + trendPill(m.trend) + '</td><td class="n">' + arrow(T.spot, m.ema20) + '</td><td class="n">' + arrow(T.spot, m.ema50) + '</td><td class="n">' + arrow(T.spot, m.ema200) + '</td><td class="n">' + (m.rsi == null ? '–' : m.rsi.toFixed(0)) + '</td><td>' + esc(m.macd_state) + '</td></tr>';
    }).join('');
    var mine = pageRead(), agree = [], differ = [];
    T.mtf.forEach(function (m) { var p = mine[m.tf]; if (!p) return; (dir(p) === dir(m.trend) ? agree : differ).push(m.tf + ' (here: ' + p.toLowerCase() + ', trade plan: ' + m.trend.toLowerCase() + ')'); });
    var biasCls = T.bias === 'Bullish' ? 'good' : T.bias === 'Bearish' ? 'bad' : 'warn';
    var link = T.link
      ? '<a class="cx-go" href="/btc-eth/#plan" data-asset="' + T.link + '">Open ' + T.link + ' trade plan →</a>'
      : '<span class="muted">' + esc(C.sym) + ' is not on the BTC &amp; ETH dashboard; this read uses its formulas on ' + esc(C.sym) + '.</span>';
    tpBox.innerHTML = '<div class="row"><h3>BTC dashboard read · Trade plan (4H · 1D · 1W)</h3><span>Bias <span class="pill ' + biasCls + '">' + esc(T.bias) + '</span> <span class="muted" style="font-family:var(--f-mono);font-size:12px">score ' + (T.bias_score > 0 ? '+' : T.bias_score < 0 ? '−' : '') + Math.abs(T.bias_score) + ' of ±4</span></span></div>' +
      '<div class="tablebox"><table><thead><tr><th>TF</th><th>Trend</th><th>EMA 20</th><th>EMA 50</th><th>EMA 200</th><th>RSI</th><th>MACD</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="cx-agree">' + (agree.length && !differ.length ? 'Both reads agree on every timeframe.' : (agree.length ? 'Agree: ' + agree.map(function (a) { return a.split(' (')[0]; }).join(', ') + '. ' : '') + (differ.length ? 'Differ: ' + differ.join('; ') + '. The cards above use their own EMAs (1W EMA 21 / SMA 50, 1D and 4H EMA 50 / 200) and an RSI tilt; the trade plan counts price against EMA 20, 50 and 200.' : '')) +
      ' Price ' + px(T.spot) + ', last closed 4H candle ' + esc(T.at.replace('T', ' ').replace('Z', ' UTC')) + '. Bias = price vs 1D EMA 50 and 200, 1W EMA 20, and the 1D MACD (±1 each).</p>' +
      '<div class="row">' + link + '</div>';
    var a = tpBox.querySelector('a.cx-go');
    if (a) a.addEventListener('click', function () { try { localStorage.setItem('bd_asset', a.dataset.asset); } catch (e) { /* storage unavailable */ } });
  }

  // ---------- draw for the coin on screen; again when the coin changes ----------
  var drawn = null;
  function draw() {
    if (!X) return;
    var k = coinKey(), C = X.coins && X.coins[k];
    if (!C) { phaseSec.innerHTML = ''; heatSec.innerHTML = ''; tpBox.innerHTML = ''; drawn = k; return; }
    try { drawPhase(k, C); } catch (e) { phaseSec.innerHTML = ''; }
    try { drawHeat(k, C); } catch (e) { heatSec.innerHTML = ''; }
    try { drawTP(k, C); } catch (e) { tpBox.innerHTML = ''; }
    drawn = k;
  }
  var seg = document.getElementById('segAsset');
  if (seg && window.MutationObserver) new MutationObserver(function () { if (coinKey() !== drawn) draw(); }).observe(seg, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
  var tf = document.getElementById('tf');                 // the page redraws its own 1W/1D/4H cards after loading; refresh the comparison
  if (tf && window.MutationObserver) new MutationObserver(function () { if (X) { var C = X.coins[coinKey()]; if (C) try { drawTP(coinKey(), C); } catch (e) { /* layout only */ } } }).observe(tf, { childList: true });
})();
