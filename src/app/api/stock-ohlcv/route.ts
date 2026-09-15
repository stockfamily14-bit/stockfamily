import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function yahooDate(timestamp: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp * 1000))

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export async function GET(req: NextRequest) {
  const rawTicker = req.nextUrl.searchParams.get('ticker')?.trim().toUpperCase()

  if (!rawTicker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  // Only allow a stock ticker; the Yahoo host/path itself is fixed below.
  if (!/^[A-Z0-9-]{1,12}$/.test(rawTicker)) {
    return NextResponse.json({ error: 'invalid ticker' }, { status: 400 })
  }

  const yahooTicker = `${rawTicker}.JK`
  const period2 = Math.floor(Date.now() / 1000) + 86400
  const period1 = period2 - 400 * 86400
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}`)
  url.searchParams.set('period1', String(period1))
  url.searchParams.set('period2', String(period2))
  url.searchParams.set('interval', '1d')
  url.searchParams.set('events', 'history')
  url.searchParams.set('includeAdjustedClose', 'true')

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 StockFamily/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`)
    }

    const payload = await response.json()
    const result = payload?.chart?.result?.[0]

    if (!result) {
      throw new Error('Yahoo Finance returned no chart data')
    }

    const timestamps: number[] = result.timestamp ?? []
    const quote = result.indicators?.quote?.[0] ?? {}
    const timezone = result.meta?.exchangeTimezoneName || 'Asia/Jakarta'

    const candles = timestamps
      .map((timestamp, index) => ({
        ticker: rawTicker,
        date: yahooDate(timestamp, timezone),
        open: Number(quote.open?.[index]),
        high: Number(quote.high?.[index]),
        low: Number(quote.low?.[index]),
        close: Number(quote.close?.[index]),
        volume: Number(quote.volume?.[index]),
      }))
      .filter((candle) =>
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        Number.isFinite(candle.volume) &&
        candle.close > 0,
      )
      .slice(-200)

    return NextResponse.json(
      { source: 'Yahoo Finance', ticker: yahooTicker, candles },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Yahoo Finance OHLCV' },
      { status: 502 },
    )
  }
}
