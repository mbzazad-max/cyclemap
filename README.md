# Cycle Map (BTC, ETH, SOL, BNB, XRP · 2026–2029)

The Claude artifact "BTC & ETH 2026–2029 Cycle Map", rebuilt on GitHub and shown on Cloudflare.
Claude only loads data; it does not run the dashboard's logic. Spot only.

- **Data**: read from the shared repo `mbzazad-max/market-data`, closed candles only. No TradingView calls and nothing new to load.
  - BTC: Binance BTCUSDT 1D and 4H (laptop upload).
  - ETH: Binance ETHUSDT 1D and 4H (laptop upload).
  - Weekly and monthly bars are made from the daily candles (Monday weeks, calendar months, UTC).
  - The current day is added from the 4H candles that have already closed (`today_from_4h` in `config/dashboard.json`), so the price, this week and this month all end at the same last closed 4H candle. Set it to `false` to stop at the last closed day.
  - Weekly history before Aug 2017 (Bitstamp BTCUSD, Kraken ETHUSD) is written inside the original page. It is not data here.
  - The original page has no market gauges and no readings, so none are used.
- **Logic**: all of it stays in the original page, which runs unchanged in the browser. `public/index.html` is the artifact page plus two script tags: `shim.js` (the saved snapshot, read-only, in place of the claude.ai database) and `cloud.js` (Refresh button, freshness strip, "← Dashboards" link). The original is `reference/index.original.html`; every run checks it against `reference/PAGE_SHA256SUMS` (`sha256sum -c` and `node tools/check_page.js`).
- **Build**: `build/build.js` prepares the candles and gives them to the page's own `buildSnapshot` function, which `build/page_rules.js` runs straight from the original page text. So the all-time high, cycle low, levels and rounding are worked out by the page's code, not by a copy of it. The result is the two documents the page's own Refresh saves: `snap/cycle` (BTC) and `snap/cycle_eth` (ETH), in `public/snapshot.json`.
- **Two fields differ from a page refresh on purpose**: `at` is the close time of the newest candle used (the page uses the clock at the moment of the refresh), and `src` says "Binance closed candles" (the page writes "TradingView BINANCE:…").
- **Address**: none of its own. It opens at `/cyclemap/` on the home site (repo `dashboards`), which holds the one login lock. Owner-only.
- **Runs**: when market-data gets new BTCUSDT or ETHUSDT candles, once a day as a safety net (01:20 UTC), or when Refresh is pressed. If nothing new arrived, nothing is rebuilt.
- **Safety**: a coin that cannot be built keeps its last good document and is listed in `public/freshness.json` (the page shows "kept last good"). If a coin has no data at all, nothing is written.

Tests (need `npm i jsdom@24` in some folder):
- Parity, the original page's own Refresh vs build.js on identical data: `node tests/parity.js <market-data dir> <node_modules dir>`.
  16 Nov 2026: both saved documents identical (9 fields each, 484 weeks).
- Render, the Cloudflare page for BTC and ETH: `node tests/render.js <node_modules dir>`.
- Real-data check done once on 16 Nov 2026: the candles written inside the original page (TradingView, pulled 28 Oct and 7 Nov 2026) against the same periods made here from market-data: 480 BTC weeks, 110 BTC months, 481 ETH weeks and 280 BTC days, all identical.

## SOL, BNB, XRP (added 16 Nov 2026)
- **Page**: the original stays byte-identical in `reference/`. `tools/page.js` holds a fixed list of edits that add the three coins to the coin switch, with their cycle tops and lows, replays and wording. Every edit must match the original exactly once, or the build stops. For BTC and ETH the edits change nothing, and parity still runs them on the untouched original.
- **Cycle dates** come from the Binance candles; XRP's Jan 2018 top and earlier come from the stored Bitstamp history.
  - SOL: one replay (2022–25).
  - BNB and XRP: two replays (2022–25, 2018–21).
- **Data**:
  - Binance SOLUSDT, BNBUSDT and XRPUSDT 1D and 4H (laptop upload).
  - XRP only: `tv/BITSTAMP_XRPUSD/1D`, Bitstamp daily Aug 2013 to May 2018, loaded once from TradingView and marked frozen in market-data. It is used only for days before Binance XRPUSDT starts.
  - One empty week in it (26 Dec 2016) repeats the previous close.
- **Shrink rate between cycles**: SOL has too few cycles to measure one, and XRP's 2021 top was lower than its 2018 top. In both cases the last step is repeated unchanged, and the page says so. BTC and ETH are not affected.
- **Built-in snapshot**: `reference/builtin_alts.json` is made once with `node build/build.js <market-data> --builtin`, as the original page carries one for BTC and ETH.
- **Parity**, 16 Nov 2026: all five saved documents are identical to the page's own Refresh on the same data (SOL 328, BNB 472, XRP 695 weeks).

## Cycle extras (added 20 Nov 2026)
Three additions around the original page, in `public/extras.js` (a third script tag; the original page and its logic are unchanged, `tools/check_page.js` checks the tag):
- **Where we are in the four-year cycle** (under the top strip): Bitcoin's halving clock in the page's own calendar slots (bear 2026 → recovery 2027 → halving 2028 → top 2029), a "today" marker, days to the next slot and the ~Apr 2028 halving, the coin's distance from its top and cycle low (from the saved snapshot), what this month did in past same-slot years, and the next three months after them.
- **Month by month, by cycle year** (after the four-year calendar): a year × month return heatmap per coin, each year tagged with its slot, plus slot averages, all-years average/median and % of months up. This month so far is outlined and left out of the averages.
- **BTC dashboard read** (inside "Right now: 1W · 1D · 4H"): the BTC & ETH dashboard's Trade plan multi-timeframe read (trend vs EMA 20/50/200, RSI 14, MACD on 4H/1D/1W, bias score of ±4), with the same formulas copied verbatim from that page and the same closed candles, set next to this page's own cards ("agree / differ"), and a button that opens `/btc-eth/#plan` on the same coin (sets that page's `bd_asset`). XRP is not on that dashboard: same read, no link.
- **Data**: `build/extras.js md` → `public/extras.json` (run by the workflow after the snapshot; keeps a coin's last good data on failure; stamped with the newest candle, so no new candles = no commit). Months come from closed days (BTC: stored Coinbase BTCUSD from Dec 2014 then Binance; XRP: stored Bitstamp then Binance). Before daily data (BTC 2011–Nov 2014, ETH 2015–Jul 2017) the month close is the last weekly close inside the page, shown in italics with "~" (approximate).
- Render test checks all three on every coin.
