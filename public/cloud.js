/* Cycle Map on Cloudflare: Refresh button (asks GitHub to rebuild from the newest shared data) and a freshness
   strip listing every data series with how far behind it is. Uses the page's own colours and fonts. */
(function () {
  'use strict';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Controls live at /api/<slug>/ on the home site, which always needs the owner's login.
  var slug = location.pathname.split('/')[1] || '';
  var API = slug ? '/api/' + slug + '/' : 'api/';
  var st = document.createElement('style');
  st.textContent = '#ghRefresh{font:600 14px var(--f-body);background:var(--btc);color:var(--panel);border:0;border-radius:8px;padding:9px 16px;cursor:pointer}' +
    '#ghRefresh:disabled{opacity:.6;cursor:progress}#ghRefresh:focus-visible{outline:2px solid var(--ink);outline-offset:2px}' +
    '#fresh{font-size:13px;color:var(--muted);border:1px solid var(--line);border-left:3px solid var(--warn);border-radius:10px;padding:8px 12px;background:var(--panel)}' +
    '#fresh.ok{border-left-color:var(--good)}#fresh summary{cursor:pointer}#fresh table{margin-top:8px;border-collapse:collapse;width:auto;font-size:12.5px}' +
    '#fresh th,#fresh td{text-align:left;padding:3px 16px 3px 0;border:0;font-family:var(--f-body);text-transform:none;letter-spacing:0;font-size:12.5px}#fresh p{margin:8px 0 0;max-width:90ch}';
  document.head.appendChild(st);
  var row = document.querySelector('.refresh');
  var btn = document.createElement('button'); btn.type = 'button'; btn.id = 'ghRefresh'; btn.textContent = 'Refresh'; btn.hidden = true;
  btn.title = 'Ask GitHub to rebuild the dashboard from the newest shared data (closed candles only)';
  var pill = document.createElement('span'); pill.id = 'runState'; pill.className = 'rstatus'; pill.hidden = true;
  if (row) { row.appendChild(btn); row.appendChild(pill); }
  var strip = document.createElement('div'); strip.id = 'fresh'; strip.hidden = true;
  if (row && row.parentNode) row.parentNode.insertBefore(strip, row.nextSibling);

  var t2s = function (s) { if (!s) return '-'; var d = new Date(s * 1000); return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  function state(text, kind) { pill.hidden = false; pill.className = 'rstatus ' + (kind || ''); pill.textContent = text; }

  function showFresh(F) {
    var now = Date.now() / 1000;
    var rows = F.series.map(function (s) {
      if (s.history_only) return { label: esc(s.symbol + ' ' + s.tf) + ' <span style="opacity:.75">(' + esc(s.source) + ')</span>', when: t2s(s.last_close), st: 'stored history (frozen)', flag: false };
      var behind = s.last_close ? Math.max(0, Math.floor((now - s.last_close) / s.period_s)) : null;
      var stt = behind === null ? 'no data yet' : behind === 0 ? 'current' : behind + ' candle' + (behind > 1 ? 's' : '') + ' behind';
      return { label: esc(s.symbol + ' ' + s.tf) + ' <span style="opacity:.75">(' + esc(s.source) + ')</span>', when: t2s(s.last_close), st: stt, flag: behind === null || behind > 1 };
    });
    var flagged = rows.filter(function (r) { return r.flag; });
    var head = 'Built ' + esc(F.generated) + ' · last check ' + esc(t2s(F.checked_at)) + ' · ' + rows.length + ' inputs, ' +
      (flagged.length ? '<b>' + flagged.length + ' behind</b>' : 'all current');
    if (F.kept && F.kept.length) head += ' · kept last good: ' + F.kept.map(function (k) { return esc(k.id); }).join(', ');
    var body = rows.map(function (r) { return '<tr' + (r.flag ? ' style="font-weight:600"' : '') + '><td>' + r.label + '</td><td>' + esc(r.when) + '</td><td>' + esc(r.st) + '</td></tr>'; }).join('');
    var kept = (F.kept || []).map(function (k) { return '<li>' + esc(k.id) + ': ' + esc(k.why) + '</li>'; }).join('');
    strip.hidden = false;
    strip.className = flagged.length || (F.kept && F.kept.length) ? '' : 'ok';
    strip.innerHTML = '<details><summary>' + head + '</summary>' +
      (kept ? '<p>These show their last good version:</p><ul style="margin:4px 0 0">' + kept + '</ul>' : '') +
      '<table><thead><tr><th>Input</th><th>Last closed candle (your time)</th><th>Status</th></tr></thead><tbody>' + body + '</tbody></table>' +
      '<p>' + esc(F.last_result || '') + ' Only closed candles are used: the price is the last closed 4H candle, and this week and month run to that same candle. Candles are Binance BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT and XRPUSDT from your laptop upload; weekly and monthly bars are made from the daily candles. BTC and ETH history before Aug 2017 is the fixed history inside the page; XRP before May 2018 is stored Bitstamp history, loaded once.</p></details>';
  }
  function loadFresh() {
    return fetch('freshness.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (F) { if (F) showFresh(F); }).catch(function () {});
  }

  var polling = null;
  function poll(startedAt) {
    clearTimeout(polling);
    fetch(API + 'status', { cache: 'no-store', redirect: 'manual', credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('no access'); return r.json(); }).then(function (s) {
      btn.hidden = false;
      if (s.status && s.status !== 'completed' && s.status !== 'none') { state('Running…', ''); btn.disabled = true; polling = setTimeout(function () { poll(startedAt || Date.now()); }, 8000); return; }
      btn.disabled = false;
      if (!startedAt) return;
      if (s.conclusion === 'success') { state('Done ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 'good'); setTimeout(function () { location.reload(); }, 1500); }
      else state('Refresh failed, last good data kept', 'bad');
    }).catch(function () { btn.disabled = false; if (startedAt) state('Could not check progress', 'bad'); else btn.hidden = true; });
  }
  btn.addEventListener('click', function () {
    btn.disabled = true; state('Starting…', '');
    fetch(API + 'refresh', { method: 'POST', redirect: 'manual', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); })
      .then(function () { state('Running…', ''); setTimeout(function () { poll(Date.now()); }, 5000); })
      .catch(function (e) { btn.disabled = false; state('Refresh not started: ' + e.message, 'bad'); });
  });
  loadFresh();
  poll(0);
})();

/* "← Dashboards" link back to the home site. Added on Cloudflare only; the page itself is unchanged. */
(function () {
  'use strict';
  var st = document.createElement('style');
  st.textContent = '.dash-back{display:inline-block;font-size:13px;line-height:1.4;color:var(--muted,#586878);text-decoration:none;white-space:nowrap}.dash-back:hover{text-decoration:underline}';
  document.head.appendChild(st);
  var a = document.createElement('a'); a.className = 'dash-back'; a.href = '/'; a.textContent = '← Dashboards';
  a.title = 'Back to the list of dashboards';
  var head = document.querySelector('.wrap > header');
  if (head) head.insertBefore(a, head.firstChild); else document.body.insertBefore(a, document.body.firstChild);
})();
