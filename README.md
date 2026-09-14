# StockFamily — Yahoo Candlestick / Daily Summary Separation

Patch ini memisahkan sumber data Ticker Detail secara tegas:

## Yahoo Finance — chart saja
`src/app/api/stock-ohlcv/route.ts` sekarang mengambil daily OHLCV langsung dari Yahoo Finance untuk `{TICKER}.JK`.

Field yang dikembalikan:
- date
- open
- high
- low
- close
- volume

`SFAlphaChart` menggunakan feed ini untuk:
- candlestick
- SMA20
- SMA50
- volume histogram

Tidak ada fallback candlestick ke `daily_market_summary`. Jika Yahoo gagal, chart tidak diam-diam berganti sumber.

## daily_market_summary — StockFamily intelligence
Tetap digunakan untuk:
- Foreign Buy / Sell / Foreign Net
- Bid / Offer
- Participation / Flow
- SCRET dan State/Regime
- SCRET insights
- EOD header metrics

Technical Analysis dan Trade Plan juga tetap dihitung dari OHLCV `daily_market_summary`, sehingga kalkulasi Trade Plan yang sudah cocok tidak berubah akibat pergantian sumber chart.

## Catatan
Yahoo endpoint yang dipakai adalah chart endpoint:
`https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}.JK`

Route mengembalikan maksimal 200 candle terbaru dan diberi `Cache-Control: no-store`.
