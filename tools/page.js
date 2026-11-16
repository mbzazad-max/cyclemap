/* The served page = the original artifact page (reference/index.original.html, byte-identical, checked by its
   SHA-256) with a small fixed list of edits that add SOL, BNB and XRP to the coin switch (added 16 Nov 2026 at the
   owner's request). The design and the model are unchanged: the three coins use exactly the same sections, charts
   and calculations as BTC and ETH. For BTC and ETH every edit below gives exactly the same result as before
   (tests/parity.js still compares them with the untouched original).
     1. coin switch: SOL, BNB and XRP buttons after ETH
     2. the three coins' own entries in the page's coin list: names, cycle tops and lows (from the Binance candles;
        XRP's Jan 2018 top and earlier from the stored Bitstamp history), replays, wording, and a starting snapshot
        (reference/builtin_alts.json, made once by `node build/build.js <market-data> --builtin`), just as the
        original page carries a starting snapshot for BTC and ETH
     3. weekly history: BTC and ETH keep their fixed pre-2017 history; the new coins' whole weekly history comes in
        the snapshot, starting at each coin's own first week (wk0) instead of 14 Aug 2017
     4. the retest box gets a starting value per coin
     5. shrink rate between cycles: where it cannot be measured (fewer than two steps, as for SOL, or a step that did
        not shrink at all, as XRP's lower 2021 top), the last step is repeated unchanged. BTC and ETH always have
        measurable rates, so nothing changes for them.
   Every edit must match the original text exactly once, or the build stops.
   usage: require('./page.js').edit(originalText, builtin) -> served page body (builtin = reference/builtin_alts.json) */
'use strict';

// The three coins, written as the page writes BTC and ETH. DATA is replaced by the coin's starting snapshot.
const ALTS = String.raw`
  sol:{key:'sol', sym:'SOL', name:'Solana', pair:'SOLUSDT', tv:'BINANCE:SOLUSDT', doc:'cycle_sol', dp:2, cycleNo:2, nextName:'Cycle 3', halvLabel:'BTC halving', W0:'2020-08-10', wk0:'2020-08-10',
    retest:{def:65,min:8,max:120,step:1},
    annual:{},
    lateNote:'Q4 of the top year; SOL topped Nov 2021 and Jan 2025',
    tell:a=>` + '`A new high above <b class="mono">$${a.p.toFixed(2)}</b> before the April 2028 halving. SOL has never made a new high before a Bitcoin halving: its one full cycle topped nine months after the 2024 halving.`' + String.raw`,
    cyclesNote:'SOL has one full cycle on record. It topped in Nov 2021 ($260), fell 97% to $8.00 in Dec 2022, then rose 37× to $296 in Jan 2025, nine months after the Bitcoin halving and only 14% above the 2021 top. The bear since then has been −80% into the Jun 2026 low.',
    limits:'<b>Limits.</b> One full cycle is not a sample. SOL only has the 2022–25 cycle to replay, its 2021 top came from a launch-era run, and the 2022 low was driven by the FTX collapse, which is unlikely to repeat in the same way. Its sizing rests on that single cycle: where a shrink rate between cycles cannot be measured, the last step is repeated unchanged. SOL also trades as a high-beta version of Bitcoin, so its tops and lows follow the Bitcoin halving cycle. Treat this as a map of what repeating history would look like, not a forecast. Not financial advice.',
    dataNote:'<b>Data.</b> Binance SOLUSDT monthly, weekly, daily and 4H candles (built-in snapshot from 16 Nov 2026, replaced by each refresh). History starts when Binance listed SOLUSDT in Aug 2020, so the first low used ($1.03, Dec 2020) is the lowest price on Binance, not SOL\'s launch price. There are no 2018–21 or 2015–17 replays for SOL, and the early weekly SMAs use the weeks available.',
    scenExtra:'<p>SOL has two tops on record, so only one top-to-top step (×1.14) and one bottom-to-top step can be compared. The top-to-top model repeats that single step; the bottom-run model uses the one measured shrink (from the 2020–21 run to the 2022–25 run). Read the scaled target as a rough marker, and compare it with "Same % as original".</p>',
    cycles:(ATH,LOW)=>[
      {name:'Cycle 1', prevBot:'2020-12-23', prevBotP:1.0301, halv:'2020-05-11', top:'2021-11-06', topP:259.9, bot:'2022-12-29', botP:8},
      {name:'Cycle 2', halv:'2024-04-20', top:ATH.d, topP:ATH.p, bot:LOW.d, botP:LOW.p},
    ],
    replays:(ATH,LOW)=>({R:[
      {k:'r22', name:'Last cycle · 2022–25', short:'2022–25', follow:'Last cycle · 2022–25', sub:'2024 halving · ETF era', color:'--r22', bot:'2022-12-29', botP:8, halv:'2024-04-20', top:ATH.d, topP:ATH.p, nextBot:LOW.d, nextBotP:LOW.p},
    ], PB:{ r22:['2021-11-06',259.9,'2022-12-29',8] }}),
    data:DATA_SOL
  },
  bnb:{key:'bnb', sym:'BNB', name:'BNB', pair:'BNBUSDT', tv:'BINANCE:BNBUSDT', doc:'cycle_bnb', dp:2, cycleNo:3, nextName:'Cycle 4', halvLabel:'BTC halving', W0:'2017-11-06', wk0:'2017-11-06',
    retest:{def:560,min:180,max:800,step:10},
    annual:{},
    lateNote:'Q4 of the top year; BNB topped Jan 2018, May 2021 and Oct 2025',
    tell:a=>` + '`A new high above <b class="mono">$${Math.round(a.p).toLocaleString(\'en-US\')}</b> before the April 2028 halving. No past BNB cycle did this: BNB has topped 12–18 months after each Bitcoin halving.`' + String.raw`,
    cyclesNote:'BNB tops landed 12–18 months after each Bitcoin halving: Jan 2018, May 2021 and Oct 2025 (the same month as BTC last cycle). Each bull has been far smaller than the one before (168× off the 2018 low, then 7.5× off the 2022 low), and the 2025 high was twice the 2021 high. BNB bears have also eased: −84%, −73%, then −61% into the Jul 2026 low, the shallowest of the five coins.',
    limits:'<b>Limits.</b> Three cycles is a tiny sample, and the first is cut short: Binance listed BNBUSDT in Nov 2017, two months before the Jan 2018 top, so that cycle has no bottom to measure its run from. BNB is also tied to one exchange, and exchange news can move it apart from the rest of the market. Treat this as a map of what repeating history would look like, not a forecast. Not financial advice.',
    dataNote:'<b>Data.</b> Binance BNBUSDT monthly, weekly, daily and 4H candles (built-in snapshot from 16 Nov 2026, replaced by each refresh). History starts when Binance listed BNBUSDT in Nov 2017. BNB made a higher high in Jun 2019 ($39.59) than in Jan 2018; the cycle dates here follow the market-wide cycle (top Jan 2018, low Dec 2018), as they do for ETH. There is no 2015–17 replay for BNB, and the early weekly SMAs use the weeks available.',
    scenExtra:'',
    cycles:(ATH,LOW)=>[
      {name:'Cycle 1', halv:'2016-07-09', top:'2018-01-12', topP:25.18, bot:'2018-12-07', botP:4.12},
      {name:'Cycle 2', halv:'2020-05-11', top:'2021-05-10', topP:691.77, bot:'2022-06-18', botP:183.4},
      {name:'Cycle 3', halv:'2024-04-20', top:ATH.d, topP:ATH.p, bot:LOW.d, botP:LOW.p},
    ],
    replays:(ATH,LOW)=>({R:[
      {k:'r22', name:'Last cycle · 2022–25', short:'2022–25', follow:'Last cycle · 2022–25', sub:'2024 halving · ETF era', color:'--r22', bot:'2022-06-18', botP:183.4, halv:'2024-04-20', top:ATH.d, topP:ATH.p, nextBot:LOW.d, nextBotP:LOW.p},
      {k:'r18', name:'2018–21 cycle', short:'2018–21', follow:'2018–21', sub:'2020 halving', color:'--r18', bot:'2018-12-07', botP:4.12, halv:'2020-05-11', top:'2021-05-10', topP:691.77, nextBot:'2022-06-18', nextBotP:183.4},
    ], PB:{ r22:['2021-05-10',691.77,'2022-06-18',183.4], r18:['2018-01-12',25.18,'2018-12-07',4.12] }}),
    data:DATA_BNB
  },
  xrp:{key:'xrp', sym:'XRP', name:'XRP', pair:'XRPUSDT', tv:'BINANCE:XRPUSDT', doc:'cycle_xrp', dp:6, cycleNo:3, nextName:'Cycle 4', halvLabel:'BTC halving', W0:'2013-07-29', wk0:'2013-07-29',
    retest:{def:0.9,min:0.1,max:1.5,step:0.05},
    annual:{2014:-0.1094,2015:-0.7524,2016:-0.0068,2017:330.67},
    lateNote:'Q4 of the top year; XRP topped Jan 2018, Apr 2021 and Jul 2025',
    tell:a=>` + '`A new high above <b class="mono">$${a.p.toFixed(2)}</b> before the April 2028 halving. No past XRP cycle did this: XRP has topped 11–18 months after each Bitcoin halving.`' + String.raw`,
    cyclesNote:'XRP tops landed 11–18 months after each Bitcoin halving: Jan 2018, Apr 2021 and Jul 2025. Its cycles do not shrink in a steady way: the 2021 top ($1.97) was below the 2018 top ($3.32), and the 2025 top ($3.66) was only 10% above it. XRP bears have eased (−97%, −85%, then −76% so far), but this one is still making new lows: the latest was in Nov 2026.',
    limits:'<b>Limits.</b> Three cycles is a tiny sample, and XRP\'s do not follow the pattern the model assumes: its 2021 top was lower than its 2018 top (the SEC case hung over that cycle), so a top-to-top shrink rate cannot be measured and the last step is repeated unchanged instead. XRP also made a new cycle low in Nov 2026, so "Already in" is an assumption here, and the rebound scores mean little until there are several weeks off a low. Treat this as a map of what repeating history would look like, not a forecast. Not financial advice.',
    dataNote:'<b>Data.</b> Binance XRPUSDT monthly, weekly, daily and 4H candles from May 2018 (built-in snapshot from 16 Nov 2026, replaced by each refresh). Before that, Bitstamp XRPUSD daily candles via TradingView (Aug 2013 to May 2018, loaded once), which give the Jan 2018 top ($3.317) and the 2014 low. One week with no Bitstamp trades on record (26 Dec 2016) repeats the previous close. 2014–17 annual returns use those Bitstamp closes. There is no 2015–17 replay for XRP.',
    scenExtra:'<p>XRP\'s 2021 top was below its 2018 top, so the top-to-top model cannot measure a shrink rate and simply repeats the last step (2021 → 2025). That makes the scaled target less conservative than for the other coins. Compare it with "Same % as original" before leaning on it.</p>',
    cycles:(ATH,LOW)=>[
      {name:'Cycle 1', prevBot:'2014-07-06', prevBotP:0.00280765, halv:'2016-07-09', top:'2018-01-04', topP:3.317, bot:'2020-03-13', botP:0.10129},
      {name:'Cycle 2', halv:'2020-05-11', top:'2021-04-14', topP:1.96689, bot:'2022-06-18', botP:0.2872},
      {name:'Cycle 3', halv:'2024-04-20', top:ATH.d, topP:ATH.p, bot:LOW.d, botP:LOW.p},
    ],
    replays:(ATH,LOW)=>({R:[
      {k:'r22', name:'Last cycle · 2022–25', short:'2022–25', follow:'Last cycle · 2022–25', sub:'2024 halving · ETF era', color:'--r22', bot:'2022-06-18', botP:0.2872, halv:'2024-04-20', top:ATH.d, topP:ATH.p, nextBot:LOW.d, nextBotP:LOW.p},
      {k:'r18', name:'2018–21 cycle', short:'2018–21', follow:'2018–21', sub:'2020 halving', color:'--r18', bot:'2020-03-13', botP:0.10129, halv:'2020-05-11', top:'2021-04-14', topP:1.96689, nextBot:'2022-06-18', nextBotP:0.2872},
    ], PB:{ r22:['2021-04-14',1.96689,'2022-06-18',0.2872], r18:['2018-01-04',3.317,'2020-03-13',0.10129] }}),
    data:DATA_XRP
  }`;

function alts(builtin) {
  const data = (k) => JSON.stringify(builtin ? builtin[k] : { ATH: {}, at: 0 });   // builtin is null only while it is first being made
  return ALTS.replace('DATA_SOL', () => data('sol')).replace('DATA_BNB', () => data('bnb')).replace('DATA_XRP', () => data('xrp'));
}
const EDITS = (builtin) => [
  ['<button type="button" data-k="eth" aria-pressed="false">ETH</button></div>',
   '<button type="button" data-k="eth" aria-pressed="false">ETH</button><button type="button" data-k="sol" aria-pressed="false">SOL</button><button type="button" data-k="bnb" aria-pressed="false">BNB</button><button type="button" data-k="xrp" aria-pressed="false">XRP</button></div>'],
  ['  }\n};\nASSETS.btc.data={M_RAW, WK_BN,', '  },' + alts(builtin) + '\n};\nASSETS.btc.data={M_RAW, WK_BN,'],
  ["const WALL=((A.key==='btc'? WK_PRE+','+WK_BS : ETH_PRE)+','+WK_BN).split(',').map(Number);",
   "const WALL=((A.key==='btc'? WK_PRE+','+WK_BS+',' : A.key==='eth'? ETH_PRE+',' : '')+WK_BN).split(',').map(Number);"],
  ['retest_btc:62000, retest_eth:1400,', 'retest_btc:62000, retest_eth:1400, retest_sol:65, retest_bnb:560, retest_xrp:0.9,'],
  ['const ratioAvg=a=>{ const r=[]; for(let i=1;i<a.length;i++) r.push(a[i]/a[i-1]); return r.reduce((s,v)=>s+v,0)/r.length; };',
   'const ratioAvg=a=>{ const r=[]; for(let i=1;i<a.length;i++) r.push(a[i]/a[i-1]); return (r.length && a.every(v=>v>0)) ? r.reduce((s,v)=>s+v,0)/r.length : 1; };'],
  ["const wStart=W.t.findIndex(t=>isoDay(t)>='2017-08-14'); if(wStart<0||isoDay(W.t[wStart])!=='2017-08-14') throw {code:'shape',message:'Weekly bars did not line up with the history (expected a week starting 14 Aug 2017).'};",
   "const wk0=cfg.wk0||'2017-08-14', wStart=W.t.findIndex(t=>isoDay(t)>=wk0); if(wStart<0||isoDay(W.t[wStart])!==wk0) throw {code:'shape',message:'Weekly bars did not line up with the history (expected a week starting '+wk0+').'};"],
];
function edit(src, builtin) {
  let out = src;
  for (const [find, repl] of EDITS(builtin)) {
    const count = out.split(find).length - 1;
    if (count !== 1) throw new Error(`page edit expected 1 match, found ${count}: ${find.slice(0, 80)}`);
    out = out.replace(find, () => repl);
  }
  return out;
}
module.exports = { edit };
