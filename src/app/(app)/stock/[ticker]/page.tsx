import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  analyzeStock,
  type Candle,
} from '@/lib/technical-engine'

function price(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'

  return `Rp${new Intl.NumberFormat('id-ID').format(value)}`
}

function pct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function labelSetup(setup: string) {
  const map: Record<string, string> = {
    BREAKOUT: 'Breakout',
    PULLBACK: 'Pullback to Support',
    MOMENTUM: 'Momentum Continuation',
    RANGE: 'Range / Resistance',
    BREAKDOWN: 'Breakdown',
    NONE: 'No Clear Setup',
  }

  return map[setup] ?? setup
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    BUY_ON_CONFIRMATION: 'BUY ON CONFIRMATION',
    WAIT_CONFIRMATION: 'WAIT CONFIRMATION',
    WAIT_PULLBACK: 'WAIT PULLBACK',
    AVOID: 'AVOID',
  }

  return map[action] ?? action
}

async function getCandles(
  supabase: any,
  ticker: string
): Promise<Candle[]> {
  const tables = [
    'stock_candles',
    'candles',
    'ohlcv',
    'daily_prices',
    'stock_prices',
  ]

  for (const table of tables) {
    const result = await supabase
      .from(table)
      .select('*')
      .eq('ticker', ticker)
      .limit(200)

    if (result.error || !result.data?.length) {
      continue
    }

    const candles = result.data
      .map((row: any) => ({
        date:
          row.date ??
          row.trade_date ??
          row.timestamp ??
          row.created_at,

        open: Number(
          row.open ??
          row.open_price ??
          row.price ??
          0
        ),

        high: Number(
          row.high ??
          row.high_price ??
          row.price ??
          0
        ),

        low: Number(
          row.low ??
          row.low_price ??
          row.price ??
          0
        ),

        close: Number(
          row.close ??
          row.close_price ??
          row.price ??
          0
        ),

        volume: Number(
          row.volume ??
          row.volume_shares ??
          0
        ),
      }))
      .filter(
        (c: Candle) =>
          c.date &&
          c.close > 0 &&
          c.high > 0 &&
          c.low > 0
      )

    if (candles.length >= 20) {
      return candles
    }
  }

  return []
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params

  const symbol = ticker.toUpperCase()

  const supabase = await createClient()

  const [
    stockResult,
    priceResult,
    snapshotResult,
  ] = await Promise.all([
    supabase
      .from('stocks')
      .select('*')
      .eq('ticker', symbol)
      .maybeSingle(),

    supabase
      .from('latest_prices')
      .select('*')
      .eq('ticker', symbol)
      .maybeSingle(),

    supabase
      .from('market_snapshot')
      .select('*')
      .order('computed_at', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle(),
  ])

  const stock = stockResult.data
  const latestPrice = priceResult.data
  const snapshot = snapshotResult.data

  const candles = await getCandles(
    supabase,
    symbol
  )

  let analysis = null

  if (candles.length >= 20) {
    try {
      analysis = analyzeStock(candles)
    } catch {
      analysis = null
    }
  }

  const marketBias =
    snapshot?.market_bias_label ?? 'UNKNOWN'

  return (
    <div className="space-y-6 p-6">

      <div>
        <Link
          href="/opportunities"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Kembali ke Opportunities
        </Link>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">
              {symbol}
            </h1>

            <p className="mt-1 text-sm text-neutral-500">
              {stock?.name ?? 'Stock Intelligence'}
            </p>
          </div>

          {analysis && (
            <div className="text-right">
              <p className="text-xs uppercase text-neutral-400">
                Opportunity Score
              </p>

              <p
                className={`text-3xl font-bold ${
                  analysis.score >= 70
                    ? 'text-emerald-600'
                    : analysis.score >= 45
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}
              >
                {analysis.score}
                <span className="text-sm text-neutral-400">
                  /100
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">
            Last Price
          </p>

          <p className="mt-2 text-xl font-bold text-neutral-900">
            {price(
              analysis?.lastPrice ??
              Number(latestPrice?.price ?? 0)
            )}
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            {pct(
              analysis?.changePercent ??
              Number(latestPrice?.change_percent ?? 0)
            )}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">
            Market Bias
          </p>

          <p className="mt-2 text-lg font-bold text-neutral-900">
            {marketBias}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">
            Signal
          </p>

          <p className="mt-2 text-lg font-bold text-neutral-900">
            {analysis?.signal ?? 'DATA NEEDED'}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">
            Setup
          </p>

          <p className="mt-2 text-lg font-bold text-neutral-900">
            {analysis
              ? labelSetup(analysis.setup)
              : 'DATA NEEDED'}
          </p>
        </div>

      </div>

      {!analysis ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">

          <p className="text-sm font-semibold text-amber-900">
            Technical analysis belum dapat dihitung.
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            StockFamily membutuhkan minimal 20 candle OHLCV
            untuk menghitung MA20, MA50, RSI, momentum,
            volume ratio, support/resistance dan market structure.
          </p>

          <p className="mt-3 text-xs text-amber-700">
            Latest price tersedia, tetapi sistem tidak akan
            mengarang level teknikal tanpa data candle.
          </p>

        </div>
      ) : (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">
                  Technical Setup
                </p>

                <h2 className="mt-1 text-xl font-bold text-neutral-900">
                  {labelSetup(analysis.setup)}
                </h2>
              </div>

              <div className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white">
                {actionLabel(analysis.action)}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">

              <div>
                <p className="text-xs text-neutral-500">
                  MA20
                </p>

                <p className="mt-1 font-semibold text-neutral-900">
                  {price(analysis.ma20)}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  MA50
                </p>

                <p className="mt-1 font-semibold text-neutral-900">
                  {price(analysis.ma50)}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  RSI 14
                </p>

                <p className="mt-1 font-semibold text-neutral-900">
                  {analysis.rsi14?.toFixed(1) ?? '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Volume Ratio
                </p>

                <p className="mt-1 font-semibold text-neutral-900">
                  {analysis.volumeRatio
                    ? `${analysis.volumeRatio.toFixed(1)}x`
                    : '-'}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">

            <p className="text-xs font-semibold uppercase text-neutral-500">
              Market Structure
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">

              <div>
                <p className="text-xs text-neutral-500">
                  Structure
                </p>

                <p className="mt-1 font-bold text-neutral-900">
                  {analysis.marketStructure}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Support
                </p>

                <p className="mt-1 font-bold text-emerald-700">
                  {price(analysis.support)}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Resistance
                </p>

                <p className="mt-1 font-bold text-red-700">
                  {price(analysis.resistance)}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Momentum 5D
                </p>

                <p className="mt-1 font-bold text-neutral-900">
                  {pct(analysis.momentum5d)}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">

            <p className="text-xs font-semibold uppercase text-neutral-500">
              Trade Plan
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">

              <div className="rounded-lg bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500">
                  Entry
                </p>

                <p className="mt-1 font-bold text-neutral-900">
                  {price(analysis.entry)}
                </p>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500">
                  Trigger
                </p>

                <p className="mt-1 font-bold text-neutral-900">
                  {price(analysis.trigger)}
                </p>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500">
                  Invalidation
                </p>

                <p className="mt-1 font-bold text-red-600">
                  {price(analysis.invalidation)}
                </p>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500">
                  Target 1
                </p>

                <p className="mt-1 font-bold text-emerald-600">
                  {price(analysis.target1)}
                </p>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <p className="text-xs text-neutral-500">
                  Target 2
                </p>

                <p className="mt-1 font-bold text-emerald-600">
                  {price(analysis.target2)}
                </p>
              </div>

            </div>

            <div className="mt-4 flex flex-wrap gap-6 border-t border-neutral-100 pt-4">

              <div>
                <p className="text-xs text-neutral-500">
                  Risk
                </p>

                <p className="font-bold text-neutral-900">
                  {analysis.risk}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Risk %
                </p>

                <p className="font-bold text-neutral-900">
                  {analysis.riskPercent != null
                    ? `${analysis.riskPercent.toFixed(2)}%`
                    : '-'}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  R:R
                </p>

                <p className="font-bold text-neutral-900">
                  {analysis.rr != null
                    ? `1 : ${analysis.rr.toFixed(2)}`
                    : '-'}
                </p>
              </div>

              <div className="flex-1">
                <p className="text-xs text-neutral-500">
                  Verdict
                </p>

                <p className="font-bold text-neutral-900">
                  {analysis.actionReason}
                </p>
              </div>

            </div>

          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">

            <p className="text-xs font-semibold uppercase text-neutral-500">
              Why This Stock?
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">

              {analysis.reasons.map(
                (reason, index) => (
                  <div
                    key={`${reason}-${index}`}
                    className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700"
                  >
                    {reason}
                  </div>
                )
              )}

            </div>

          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">

            <p className="text-xs font-semibold uppercase text-neutral-500">
              Score Breakdown
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">

              <div>
                <p className="text-xs text-neutral-500">
                  Trend
                </p>
                <p className="font-bold">
                  {analysis.trendScore}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Momentum
                </p>
                <p className="font-bold">
                  {analysis.momentumScore}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Volume
                </p>
                <p className="font-bold">
                  {analysis.volumeScore}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Structure
                </p>
                <p className="font-bold">
                  {analysis.structureScore}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500">
                  Risk
                </p>
                <p className="font-bold">
                  {analysis.riskScore}
                </p>
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  )
}