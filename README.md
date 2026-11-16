# Cycle Map (BTC & ETH 2026–2029)

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

Not included yet: SOL, BNB, XRP. Their Binance candles are already in market-data, but the original page has no cycle dates for them; adding them is a separate step (fixed edits on top of the original page).
