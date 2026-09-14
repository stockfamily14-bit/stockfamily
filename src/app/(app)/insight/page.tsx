import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'

type InsightStatus =
  | 'PUBLISHED'
  | 'ACTIVE'
  | 'TARGET_1_HIT'
  | 'TARGET_2_HIT'
  | 'TARGET_3_HIT'
  | 'STOPPED'
  | 'CLOSED'

type FilterStatus = 'ALL' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED'

const PUBLIC_STATUSES: InsightStatus[] = [
  'PUBLISHED',
  'ACTIVE',
  'TARGET_1_HIT',
  'TARGET_2_HIT',
  'TARGET_3_HIT',
  'STOPPED',
  'CLOSED',
]

export default async function InsightPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="sf-page">
        <div className="mx-auto max-w-6xl">
          <div className="sf-card p-8 text-center">
            <h1 className="text-xl font-semibold text-white">
              Login diperlukan
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Silakan login untuk melihat StockFamily Insight.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { data: membership } = await supabase
    .from('user_memberships')
    .select('role, plan')
    .eq('user_id', user.id)
    .maybeSingle()

  const isPremium = membership?.plan === 'PREMIUM'
  const isAdmin = membership?.role === 'ADMIN'

  const requestedStatus = String(params.status ?? 'ALL').toUpperCase()

  const activeFilter: FilterStatus =
    requestedStatus === 'PUBLISHED' ||
    requestedStatus === 'ACTIVE' ||
    requestedStatus === 'CLOSED'
      ? requestedStatus
      : 'ALL'

  /*
   * ============================================================
   * SIGNALS
   * ============================================================
   */

  const { data: signals, error } = await supabase
    .from('insight_signals')
    .select(`
      id,
      ticker,
      company_name,
      title,
      signal_type,
      direction,
      timeframe,

      entry_1,
      entry_2,
      entry_3,

      entry_1_weight,
      entry_2_weight,
      entry_3_weight,

      entry_1_filled,
      entry_2_filled,
      entry_3_filled,

      filled_weight,
      average_entry,

      current_price,
      pnl_points,
      pnl_percent,
      last_price_at,

      trigger,

      target_1,
      target_2,
      target_3,

      target_1_hit,
      target_1_hit_at,
      target_2_hit,
      target_2_hit_at,
      target_3_hit,
      target_3_hit_at,

      invalidation,
      risk_reward,

      thesis,
      technical_note,
      chart_image_url,

      status,
      published_at,
      closed_at,

      outcome,
      result_percent,
      created_at
    `)
    .in('status', PUBLIC_STATUSES)
    .order('published_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const allSignals = signals ?? []

  /*
   * ============================================================
   * LATEST PRICE
   *
   * Tetap membaca latest_prices.
   * Tidak membuat request Yahoo baru.
   * ============================================================
   */

  const tickers = Array.from(
    new Set(allSignals.map((signal) => signal.ticker)),
  )

  const { data: latestPrices } =
    tickers.length > 0
      ? await supabase
          .from('latest_prices')
          .select('ticker, price, volume, recorded_at')
          .in('ticker', tickers)
      : { data: [] }

  const latestPriceMap = new Map(
    (latestPrices ?? []).map((row) => [
      row.ticker,
      {
        price: asNumber(row.price),
        volume: asNumber(row.volume),
        recordedAt: row.recorded_at,
      },
    ]),
  )

  /*
   * ============================================================
   * PERFORMANCE
   * ============================================================
   */

  const performance = calculatePerformance(allSignals)

  /*
   * ============================================================
   * FILTER
   * ============================================================
   */

  const counts = {
    all: allSignals.length,

    published: allSignals.filter(
      (signal) => signal.status === 'PUBLISHED',
    ).length,

    active: allSignals.filter(
      (signal) =>
        signal.status === 'ACTIVE' ||
        signal.status === 'TARGET_1_HIT' ||
        signal.status === 'TARGET_2_HIT' ||
        signal.status === 'TARGET_3_HIT',
    ).length,

    closed: allSignals.filter(
      (signal) =>
        signal.status === 'STOPPED' ||
        signal.status === 'CLOSED',
    ).length,
  }

  const filteredSignals = allSignals.filter((signal) => {
    if (activeFilter === 'ALL') {
      return true
    }

    if (activeFilter === 'PUBLISHED') {
      return signal.status === 'PUBLISHED'
    }

    if (activeFilter === 'ACTIVE') {
      return (
        signal.status === 'ACTIVE' ||
        signal.status === 'TARGET_1_HIT' ||
        signal.status === 'TARGET_2_HIT' ||
        signal.status === 'TARGET_3_HIT'
      )
    }

    if (activeFilter === 'CLOSED') {
      return (
        signal.status === 'STOPPED' ||
        signal.status === 'CLOSED'
      )
    }

    return true
  })

  return (
    <div className="sf-page">
      <div className="mx-auto max-w-[1400px]">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-emerald-400" />

                <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">
                  Market Intelligence
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                StockFamily Insight
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Curated market signals dengan realtime price,
                execution progress, target tracking, dan
                documented performance.
              </p>
            </div>

            <div className="w-fit rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Access
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]" />

                <span className="text-xs font-bold text-white">
                  {isAdmin
                    ? 'ADMIN ACCESS'
                    : isPremium
                      ? 'PREMIUM'
                      : 'FREE'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ======================================================
            PREMIUM GATE
        ====================================================== */}

        {!isPremium && !isAdmin ? (
          <PremiumGate />
        ) : (
          <>
            {/* ==================================================
                PERFORMANCE
            ================================================== */}

            <PerformancePanel performance={performance} />

            {/* ==================================================
                FILTER
            ================================================== */}

            <section className="mt-8">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                    Signal Monitor
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Pantau signal berdasarkan lifecycle.
                  </p>
                </div>

                <span className="text-xs text-slate-600">
                  {filteredSignals.length} signal
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <FilterLink
                  href="/insight"
                  label="All"
                  count={counts.all}
                  active={activeFilter === 'ALL'}
                />

                <FilterLink
                  href="/insight?status=PUBLISHED"
                  label="Published"
                  count={counts.published}
                  active={activeFilter === 'PUBLISHED'}
                />

                <FilterLink
                  href="/insight?status=ACTIVE"
                  label="Active"
                  count={counts.active}
                  active={activeFilter === 'ACTIVE'}
                />

                <FilterLink
                  href="/insight?status=CLOSED"
                  label="Closed"
                  count={counts.closed}
                  active={activeFilter === 'CLOSED'}
                />
              </div>
            </section>

            {/* ==================================================
                SIGNALS
            ================================================== */}

            <section className="mt-6">
              {filteredSignals.length === 0 ? (
                <EmptyState filter={activeFilter} />
              ) : (
                <div className="space-y-6">
                  {filteredSignals.map((signal) => {
                    const latest = latestPriceMap.get(signal.ticker)

                    return (
                      <InsightCard
                        key={signal.id}
                        signal={signal}
                        latestPrice={latest?.price ?? null}
                        latestRecordedAt={
                          latest?.recordedAt ?? null
                        }
                      />
                    )
                  })}
                </div>
              )}
            </section>

            {/* ==================================================
                DISCLAIMER
            ================================================== */}

            <div className="mt-10 border-t border-slate-900 pt-6 text-center">
              <p className="text-[10px] leading-5 text-slate-600">
                StockFamily Insight bersifat informatif dan
                bukan merupakan rekomendasi investasi. Selalu
                lakukan riset dan pengelolaan risiko secara
                mandiri.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   PERFORMANCE ENGINE
================================================================ */

function calculatePerformance(signals: any[]) {
  // Klasifikasi win/loss berbasis OUTCOME (sudah dikunci final di backend
  // saat kejadian pertama terjadi), BUKAN status mentah -- karena status
  // bisa jadi STOPPED sekalipun target sudah tercapai lebih dulu, dan itu
  // tetap harus terhitung WIN, bukan loss.
  const wins = signals.filter(
    (signal) =>
      signal.outcome === 'TARGET_1' ||
      signal.outcome === 'TARGET_2' ||
      signal.outcome === 'TARGET_3',
  )

  const losses = signals.filter(
    (signal) => signal.outcome === 'STOP',
  )

  const breakeven = signals.filter((signal) => {
    return (
      signal.outcome === 'BREAKEVEN' ||
      signal.outcome === 'BREAK_EVEN' ||
      signal.outcome === 'MANUAL_CLOSE'
    )
  })

  const active = signals.filter(
    (signal) =>
      signal.status === 'ACTIVE' ||
      signal.status === 'TARGET_1_HIT' ||
      signal.status === 'TARGET_2_HIT' ||
      signal.status === 'TARGET_3_HIT',
  )

  const closed = signals.filter(
    (signal) =>
      signal.status === 'STOPPED' ||
      signal.status === 'CLOSED',
  )

  const completed =
    wins.length +
    losses.length +
    breakeven.length

  const winRate =
    wins.length + losses.length > 0
      ? (wins.length /
          (wins.length + losses.length)) *
        100
      : null

  const results = signals
    .filter((signal) => {
      const result = asNumber(signal.result_percent)

      if (result === null) {
        return false
      }

      return (
        signal.outcome === 'TARGET_1' ||
        signal.outcome === 'TARGET_2' ||
        signal.outcome === 'TARGET_3' ||
        signal.outcome === 'STOP' ||
        signal.outcome === 'BREAKEVEN' ||
        signal.outcome === 'BREAK_EVEN' ||
        signal.outcome === 'MANUAL_CLOSE'
      )
    })
    .map((signal) => Number(signal.result_percent))

  const averageResult =
    results.length > 0
      ? results.reduce(
          (sum, value) => sum + value,
          0,
        ) / results.length
      : null

  const bestResult =
    results.length > 0
      ? Math.max(...results)
      : null

  const worstResult =
    results.length > 0
      ? Math.min(...results)
      : null

  /*
   * Signal frequency.
   *
   * Menggunakan published_at agar frekuensi
   * mencerminkan signal yang benar-benar
   * dipublikasikan.
   */

  const publishedDates = signals
    .map((signal) =>
      signal.published_at
        ? new Date(signal.published_at).getTime()
        : null,
    )
    .filter(
      (value): value is number =>
        value !== null &&
        Number.isFinite(value),
    )

  let frequency = 0

  if (publishedDates.length > 0) {
    const earliest = Math.min(...publishedDates)
    const latest = Math.max(...publishedDates)

    const days = Math.max(
      1,
      (latest - earliest) /
        (1000 * 60 * 60 * 24),
    )

    const months = Math.max(
      1,
      days / 30,
    )

    frequency =
      publishedDates.length / months
  }

  /*
   * Signal type frequency.
   */

  const frequencyByType: Record<string, number> = {}

  signals.forEach((signal) => {
    const type =
      signal.signal_type || 'OTHER'

    frequencyByType[type] =
      (frequencyByType[type] || 0) + 1
  })

  /*
   * Outcome distribution.
   */

  const outcomes = {
    target1: signals.filter(
      (signal) =>
        signal.status === 'TARGET_1_HIT' ||
        signal.outcome === 'TARGET_1',
    ).length,

    target2: signals.filter(
      (signal) =>
        signal.status === 'TARGET_2_HIT' ||
        signal.outcome === 'TARGET_2',
    ).length,

    target3: signals.filter(
      (signal) =>
        signal.status === 'TARGET_3_HIT' ||
        signal.outcome === 'TARGET_3',
    ).length,

    stopped: signals.filter(
      (signal) =>
        signal.status === 'STOPPED' ||
        signal.outcome === 'STOP' ||
        signal.outcome === 'STOPPED',
    ).length,

    breakeven: breakeven.length,
  }

  return {
    total: signals.length,

    published: signals.filter(
      (signal) =>
        signal.status === 'PUBLISHED',
    ).length,

    active: active.length,

    closed: closed.length,

    completed,

    wins: wins.length,

    losses: losses.length,

    breakeven: breakeven.length,

    winRate,

    averageResult,

    bestResult,

    worstResult,

    frequency,

    frequencyByType,

    outcomes,
  }
}

/* ================================================================
   PERFORMANCE PANEL
================================================================ */

function PerformancePanel({
  performance,
}: {
  performance: ReturnType<typeof calculatePerformance>
}) {
  const frequencyEntries = Object.entries(
    performance.frequencyByType,
  ).sort(([, a], [, b]) => b - a)

  const maxFrequency =
    frequencyEntries.length > 0
      ? Math.max(
          ...frequencyEntries.map(
            ([, value]) => value,
          ),
        )
      : 1

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0c1114] shadow-[0_20px_60px_rgba(0,0,0,.25)]">

      {/* Header */}

      <div className="border-b border-slate-800 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              Performance Engine
            </p>

            <h2 className="mt-1 text-lg font-bold text-white">
              Signal Performance
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Track record StockFamily Insight berdasarkan
              signal yang telah diproses.
            </p>
          </div>

          <span className="w-fit rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            {performance.completed} completed
          </span>
        </div>
      </div>

      {/* Primary */}

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-800 md:grid-cols-4 md:divide-y-0">

        <PerformanceMetric
          label="Total Signals"
          value={String(performance.total)}
          description={`${performance.active} active`}
        />

        <PerformanceMetric
          label="Win Rate"
          value={
            performance.winRate === null
              ? '—'
              : `${performance.winRate.toFixed(1)}%`
          }
          description={`${performance.wins}W / ${performance.losses}L`}
          positive
        />

        <PerformanceMetric
          label="Average Result"
          value={formatSignedPercent(
            performance.averageResult,
          )}
          description={`${performance.completed} completed`}
          positive={
            performance.averageResult !== null &&
            performance.averageResult >= 0
          }
          negative={
            performance.averageResult !== null &&
            performance.averageResult < 0
          }
        />

        <PerformanceMetric
          label="Signal Frequency"
          value={`${performance.frequency.toFixed(1)} / month`}
          description="Based on published signals"
        />
      </div>

      {/* Secondary */}

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-800 border-t border-slate-800 md:grid-cols-5 md:divide-y-0">

        <PerformanceMetric
          label="Wins"
          value={String(performance.wins)}
          description="Target reached"
          positive
        />

        <PerformanceMetric
          label="Losses"
          value={String(performance.losses)}
          description="Stopped"
          negative={performance.losses > 0}
        />

        <PerformanceMetric
          label="Breakeven"
          value={String(performance.breakeven)}
          description="Neutral outcome"
        />

        <PerformanceMetric
          label="Active"
          value={String(performance.active)}
          description="Running signals"
        />

        <PerformanceMetric
          label="Closed"
          value={String(performance.closed)}
          description="Finished signals"
        />
      </div>

      {/* Best / Worst */}

      <div className="grid grid-cols-1 border-t border-slate-800 md:grid-cols-2">

        <div className="border-b border-slate-800 p-5 md:border-b-0 md:border-r">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
            Best Result
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {formatSignedPercent(
              performance.bestResult,
            )}
          </p>
        </div>

        <div className="p-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
            Worst Result
          </p>

          <p className="mt-2 text-2xl font-bold text-rose-400">
            {formatSignedPercent(
              performance.worstResult,
            )}
          </p>
        </div>
      </div>

      {/* Analytics */}

      <div className="grid grid-cols-1 gap-4 border-t border-slate-800 p-5 lg:grid-cols-2">

        {/* Frequency */}

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              Signal Frequency
            </p>

            <h3 className="mt-1 text-sm font-bold text-white">
              By Signal Type
            </h3>

            <p className="mt-1 text-[10px] text-slate-600">
              Jumlah signal yang dipublikasikan berdasarkan
              tipe setup.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {frequencyEntries.length === 0 ? (
              <p className="text-xs text-slate-600">
                Belum ada data signal type.
              </p>
            ) : (
              frequencyEntries.map(
                ([type, count]) => {
                  const width =
                    (count / maxFrequency) * 100

                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {formatLabel(type)}
                        </span>

                        <span className="text-xs font-bold text-white">
                          {count}
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{
                            width: `${width}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                },
              )
            )}
          </div>
        </div>

        {/* Outcomes */}

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              Outcome Distribution
            </p>

            <h3 className="mt-1 text-sm font-bold text-white">
              Target & Risk Results
            </h3>

            <p className="mt-1 text-[10px] text-slate-600">
              Distribusi outcome yang tercatat pada signal.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">

            <OutcomeMetric
              label="T1"
              value={performance.outcomes.target1}
            />

            <OutcomeMetric
              label="T2"
              value={performance.outcomes.target2}
            />

            <OutcomeMetric
              label="T3"
              value={performance.outcomes.target3}
            />

            <OutcomeMetric
              label="STOP"
              value={performance.outcomes.stopped}
              negative
            />

            <OutcomeMetric
              label="BE"
              value={performance.outcomes.breakeven}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-900 pt-4">

            <MiniStat
              label="Published"
              value={performance.published}
            />

            <MiniStat
              label="Active"
              value={performance.active}
            />

            <MiniStat
              label="Completed"
              value={performance.completed}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function PerformanceMetric({
  label,
  value,
  description,
  positive,
  negative,
}: {
  label: string
  value: string
  description: string
  positive?: boolean
  negative?: boolean
}) {
  let valueClass = 'text-white'

  if (positive) {
    valueClass = 'text-emerald-400'
  }

  if (negative) {
    valueClass = 'text-rose-400'
  }

  return (
    <div className="min-h-[105px] bg-[#0c1114] p-4 sm:p-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p
        className={`mt-2 text-xl font-bold tracking-tight sm:text-2xl ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[10px] text-slate-600">
        {description}
      </p>
    </div>
  )
}

function OutcomeMetric({
  label,
  value,
  negative,
}: {
  label: string
  value: number
  negative?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b0f12] p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">
        {label}
      </p>

      <p
        className={[
          'mt-2 text-xl font-bold',
          negative
            ? 'text-rose-400'
            : 'text-emerald-400',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-white">
        {value}
      </p>
    </div>
  )
}

/* ================================================================
   FILTER
================================================================ */

function FilterLink({
  href,
  label,
  count,
  active,
}: {
  href: string
  label: string
  count: number
  active: boolean
}) {
  return (
    <a
      href={href}
      className={[
        'flex items-center justify-between rounded-xl border px-4 py-3 transition',
        active
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:bg-slate-900',
      ].join(' ')}
    >
      <span className="text-xs font-bold uppercase tracking-wide">
        {label}
      </span>

      <span
        className={[
          'rounded-full px-2 py-0.5 text-[10px] font-bold',
          active
            ? 'bg-emerald-400/10 text-emerald-400'
            : 'bg-slate-900 text-slate-500',
        ].join(' ')}
      >
        {count}
      </span>
    </a>
  )
}

/* ================================================================
   INSIGHT CARD
================================================================ */

function InsightCard({
  signal,
  latestPrice,
  latestRecordedAt,
}: {
  signal: any
  latestPrice: number | null
  latestRecordedAt: string | null
}) {
  const direction = String(
    signal.direction ?? '',
  ).toUpperCase()

  const averageEntry = asNumber(
    signal.average_entry,
  )

  const currentPnl = calculateCurrentPnl(
    direction,
    latestPrice,
    averageEntry,
  )

  const targetProgress = getTargetProgress(
    signal,
  )

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0d1215] shadow-[0_20px_70px_rgba(0,0,0,.25)]">

      {/* Header */}

      <div className="border-t-2 border-emerald-400">
        <div className="border-b border-slate-800 px-5 py-5 sm:px-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div>
              <div className="flex flex-wrap items-center gap-2">

                <span className="text-xl font-bold text-white">
                  {signal.ticker}
                </span>

                <StatusBadge
                  status={signal.status}
                />

                <span className="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {signal.timeframe}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {signal.company_name}
              </p>

              <h2 className="mt-3 text-lg font-bold text-white sm:text-xl">
                {signal.title}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {formatLabel(
                  signal.signal_type ?? 'OTHER',
                )}{' '}
                · {signal.direction}
              </p>
            </div>

            <div className="w-fit rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 lg:text-right">

              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                Direction
              </p>

              <div className="mt-1 flex items-center gap-2 lg:justify-end">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-xs font-bold text-emerald-400">
                  {direction || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          LIVE PRICE
      ======================================================== */}

      <div className="grid grid-cols-1 border-b border-slate-800 md:grid-cols-2">

        <div className="border-b border-slate-800 p-5 md:border-b-0 md:border-r md:p-6">

          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
            Last Price
          </p>

          <div className="mt-2 flex flex-wrap items-end gap-3">

            <span className="text-3xl font-bold tracking-tight text-white">
              {formatNumber(latestPrice)}
            </span>

            <span className="mb-1 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[9px] font-bold text-slate-500">
              LIVE SOURCE
            </span>
          </div>

          <p className="mt-2 text-[10px] text-slate-600">
            {latestRecordedAt
              ? `Updated ${formatDateTime(
                  latestRecordedAt,
                )}`
              : 'Realtime price unavailable'}
          </p>
        </div>

        <div className="p-5 md:p-6">

          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
            Current P/L
          </p>

          <div
            className={[
              'mt-2 text-3xl font-bold tracking-tight',
              currentPnl === null
                ? 'text-slate-500'
                : currentPnl >= 0
                  ? 'text-emerald-400'
                  : 'text-rose-400',
            ].join(' ')}
          >
            {formatSignedPercent(currentPnl)}
          </div>

          <p className="mt-2 text-[10px] text-slate-600">
            Based on current price vs average filled entry
          </p>
        </div>
      </div>

      {/* ========================================================
          ENTRY PROGRESS
      ======================================================== */}

      <div className="border-b border-slate-800 p-5 sm:p-6">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              Execution
            </p>

            <h3 className="mt-1 text-sm font-bold text-white">
              Entry Progress
            </h3>
          </div>

          <span className="text-[10px] font-semibold text-slate-600">
            {formatFilledWeight(
              signal.filled_weight,
            )}{' '}
            filled
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

          <EntryBox
            label="ENTRY 1"
            weight="40%"
            price={signal.entry_1}
            filled={Boolean(
              signal.entry_1_filled,
            )}
          />

          <EntryBox
            label="ENTRY 2"
            weight="30%"
            price={signal.entry_2}
            filled={Boolean(
              signal.entry_2_filled,
            )}
          />

          <EntryBox
            label="ENTRY 3"
            weight="30%"
            price={signal.entry_3}
            filled={Boolean(
              signal.entry_3_filled,
            )}
          />
        </div>
      </div>

      {/* ========================================================
          TARGET PROGRESS
      ======================================================== */}

      <div className="border-b border-slate-800 p-5 sm:p-6">

        <div className="flex items-center justify-between">

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              Trade Progress
            </p>

            <h3 className="mt-1 text-sm font-bold text-white">
              Target Progression
            </h3>
          </div>

          <span className="text-[10px] text-slate-600">
            {targetProgress.completed}/3 targets
          </span>
        </div>

        <div className="mt-5">

          <div className="relative hidden h-px bg-slate-800 md:block">

            <div
              className="absolute left-0 top-0 h-px bg-emerald-400 transition-all"
              style={{
                width: `${targetProgress.percent}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">

            <TargetStep
              label="T1"
              price={signal.target_1}
              hit={Boolean(
                signal.target_1_hit,
              )}
              active={
                targetProgress.current === 1
              }
            />

            <TargetStep
              label="T2"
              price={signal.target_2}
              hit={Boolean(
                signal.target_2_hit,
              )}
              active={
                targetProgress.current === 2
              }
            />

            <TargetStep
              label="T3"
              price={signal.target_3}
              hit={Boolean(
                signal.target_3_hit,
              )}
              active={
                targetProgress.current === 3
              }
            />
          </div>
        </div>
      </div>

      {/* ========================================================
          LEVELS
      ======================================================== */}

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-800 sm:grid-cols-4 sm:divide-y-0">

        <LevelMetric
          label="Trigger"
          value={formatNumber(signal.trigger)}
        />

        <LevelMetric
          label="Target 1"
          value={formatNumber(signal.target_1)}
          accent
        />

        <LevelMetric
          label="Target 2"
          value={formatNumber(signal.target_2)}
          accent
        />

        <LevelMetric
          label="Target 3"
          value={formatNumber(signal.target_3)}
          accent
        />
      </div>

      {/* ========================================================
          BODY
      ======================================================== */}

      <div className="grid grid-cols-1 gap-6 border-t border-slate-800 p-5 sm:p-6 lg:grid-cols-3">

        <div className="space-y-6 lg:col-span-2">

          {signal.thesis && (
            <TextSection
              title="Investment Thesis"
              text={signal.thesis}
            />
          )}

          {signal.technical_note && (
            <TextSection
              title="Technical Note"
              text={signal.technical_note}
            />
          )}
        </div>

        <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
                Risk Engine
              </p>

              <h3 className="mt-1 text-sm font-bold text-white">
                Risk Management
              </h3>
            </div>

            <span className="rounded-full border border-slate-800 px-2 py-1 text-[9px] font-bold text-emerald-400">
              R/R
            </span>
          </div>

          <div className="mt-5">

            <RiskRow
              label="Invalidation"
              value={formatNumber(
                signal.invalidation,
              )}
              negative
            />

            <RiskRow
              label="Risk / Reward"
              value={formatRiskReward(
                signal.risk_reward,
              )}
              accent
            />

            <RiskRow
              label="Average Entry"
              value={formatNumber(
                signal.average_entry,
              )}
            />

            <RiskRow
              label="Outcome"
              value={formatOutcome(
                signal.outcome,
              )}
            />

            <RiskRow
              label="Result"
              value={formatSignedPercent(
                signal.result_percent,
              )}
              accent={
                asNumber(
                  signal.result_percent,
                ) !== null &&
                Number(
                  signal.result_percent,
                ) >= 0
              }
              negative={
                asNumber(
                  signal.result_percent,
                ) !== null &&
                Number(
                  signal.result_percent,
                ) < 0
              }
            />
          </div>
        </aside>
      </div>

      {/* ========================================================
          CHART
      ======================================================== */}

      {signal.chart_image_url && (
        <div className="border-t border-slate-800 p-5 sm:p-6">

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">

            <img
              src={signal.chart_image_url}
              alt={`${signal.ticker} chart`}
              className="max-h-[600px] w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* ========================================================
          FOOTER
      ======================================================== */}

      <div className="flex flex-col gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

        <div className="flex items-center gap-2">

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            StockFamily Insight
          </span>
        </div>

        <p className="text-[9px] text-slate-600">
          Published{' '}
          {signal.published_at
            ? formatDateTime(
                signal.published_at,
              )
            : '—'}
        </p>
      </div>
    </article>
  )
}

/* ================================================================
   ENTRY BOX
================================================================ */

function EntryBox({
  label,
  weight,
  price,
  filled,
}: {
  label: string
  weight: string
  price: number | null
  filled: boolean
}) {
  return (
    <div
      className={[
        'rounded-xl border p-4 transition',
        filled
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : 'border-slate-800 bg-slate-950/60',
      ].join(' ')}
    >

      <div className="flex items-center justify-between">

        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">
          {label} · {weight}
        </p>

        <span
          className={[
            'text-[9px] font-bold uppercase',
            filled
              ? 'text-emerald-400'
              : 'text-slate-600',
          ].join(' ')}
        >
          {filled ? 'FILLED' : 'WAITING'}
        </span>
      </div>

      <p
        className={[
          'mt-2 text-lg font-bold',
          filled
            ? 'text-emerald-400'
            : 'text-white',
        ].join(' ')}
      >
        {formatNumber(price)}
      </p>
    </div>
  )
}

/* ================================================================
   TARGET
================================================================ */

function TargetStep({
  label,
  price,
  hit,
  active,
}: {
  label: string
  price: number | null
  hit: boolean
  active: boolean
}) {
  return (
    <div className="text-center">

      <div
        className={[
          'mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold',
          hit
            ? 'border-emerald-400 bg-emerald-400 text-slate-950'
            : active
              ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
              : 'border-slate-800 bg-slate-950 text-slate-600',
        ].join(' ')}
      >
        {hit ? '✓' : label.replace('T', '')}
      </div>

      <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-600">
        {label}
      </p>

      <p
        className={[
          'mt-1 text-sm font-bold',
          hit || active
            ? 'text-emerald-400'
            : 'text-white',
        ].join(' ')}
      >
        {formatNumber(price)}
      </p>

      <p className="mt-1 text-[8px] font-bold uppercase text-slate-700">
        {hit
          ? 'HIT'
          : active
            ? 'NEXT'
            : 'PENDING'}
      </p>
    </div>
  )
}

function getTargetProgress(signal: any) {
  if (
    signal.target_3_hit ||
    signal.status === 'TARGET_3_HIT'
  ) {
    return {
      completed: 3,
      current: 3,
      percent: 100,
    }
  }

  const completed = signal.target_2_hit
    ? 2
    : signal.target_1_hit
      ? 1
      : 0

  const isStopped = signal.status === 'STOPPED'

  if (isStopped) {
    return {
      completed,
      current: -1,
      percent: completed === 2 ? 66 : completed === 1 ? 33 : 0,
    }
  }

  if (completed === 2 || signal.status === 'TARGET_2_HIT') {
    return {
      completed: 2,
      current: 3,
      percent: 66,
    }
  }

  if (completed === 1 || signal.status === 'TARGET_1_HIT') {
    return {
      completed: 1,
      current: 2,
      percent: 33,
    }
  }

  return {
    completed: 0,
    current: 0,
    percent: 0,
  }
}

/* ================================================================
   TEXT
================================================================ */

function TextSection({
  title,
  text,
}: {
  title: string
  text: string
}) {
  return (
    <section>

      <div className="flex items-center gap-2">

        <span className="h-4 w-px bg-emerald-400" />

        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">
          {title}
        </h3>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-400">
        {text}
      </p>
    </section>
  )
}

/* ================================================================
   RISK
================================================================ */

function RiskRow({
  label,
  value,
  accent,
  negative,
}: {
  label: string
  value: string
  accent?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-900 py-3 last:border-b-0">

      <span className="text-[10px] text-slate-600">
        {label}
      </span>

      <span
        className={[
          'text-right text-xs font-bold',
          accent
            ? 'text-emerald-400'
            : negative
              ? 'text-rose-400'
              : 'text-white',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}

/* ================================================================
   LEVEL
================================================================ */

function LevelMetric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="bg-[#0d1215] p-4 sm:p-5">

      <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>

      <p
        className={[
          'mt-2 text-sm font-bold sm:text-base',
          accent
            ? 'text-emerald-400'
            : 'text-white',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

/* ================================================================
   STATUS BADGE
================================================================ */

function StatusBadge({
  status,
}: {
  status: string
}) {
  const styles: Record<
    string,
    {
      bg: string
      border: string
      text: string
      dot: string
    }
  > = {
    PUBLISHED: {
      bg: 'bg-cyan-400/10',
      border: 'border-cyan-400/20',
      text: 'text-cyan-300',
      dot: 'bg-cyan-400',
    },

    ACTIVE: {
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
    },

    TARGET_1_HIT: {
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
    },

    TARGET_2_HIT: {
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
    },

    TARGET_3_HIT: {
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
    },

    STOPPED: {
      bg: 'bg-rose-400/10',
      border: 'border-rose-400/20',
      text: 'text-rose-300',
      dot: 'bg-rose-400',
    },

    CLOSED: {
      bg: 'bg-slate-400/10',
      border: 'border-slate-400/20',
      text: 'text-slate-300',
      dot: 'bg-slate-400',
    },
  }

  const style =
    styles[status] ?? styles.CLOSED

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
        style.bg,
        style.border,
        style.text,
      ].join(' ')}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
      />

      {status.replaceAll('_', ' ')}
    </span>
  )
}

/* ================================================================
   PREMIUM GATE
================================================================ */

function PremiumGate() {
  return (
    <div className="sf-card-premium p-10 text-center">

      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-sm font-bold text-emerald-400">
        SF
      </div>

      <h2 className="mt-5 text-xl font-bold text-white">
        StockFamily Insight
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Curated market signals, realtime execution tracking,
        target progression, dan documented performance
        tersedia untuk member Premium.
      </p>

      <div className="mt-5 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-xs font-bold text-emerald-400">
        PREMIUM FEATURE
      </div>
    </div>
  )
}

/* ================================================================
   EMPTY STATE
================================================================ */

function EmptyState({
  filter,
}: {
  filter: FilterStatus
}) {
  const message =
    filter === 'PUBLISHED'
      ? 'Belum ada signal yang menunggu trigger.'
      : filter === 'ACTIVE'
        ? 'Belum ada signal yang sedang berjalan.'
        : filter === 'CLOSED'
          ? 'Belum ada signal yang selesai.'
          : 'Belum ada published insight.'

  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0b0f12] p-12 text-center">

      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-emerald-400">
        SF
      </div>

      <h2 className="mt-4 text-lg font-bold text-white">
        {message}
      </h2>

      <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-600">
        Signal akan muncul di sini sesuai lifecycle dan
        status yang dipilih.
      </p>
    </div>
  )
}

/* ================================================================
   HELPERS
================================================================ */

function asNumber(
  value: number | string | null | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const parsed =
    typeof value === 'number'
      ? value
      : Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : null
}

function calculateCurrentPnl(
  direction: string,
  currentPrice: number | null,
  averageEntry: number | null,
) {
  if (
    currentPrice === null ||
    averageEntry === null ||
    averageEntry <= 0
  ) {
    return null
  }

  if (
    direction === 'SHORT' ||
    direction === 'SELL'
  ) {
    return (
      ((averageEntry - currentPrice) /
        averageEntry) *
      100
    )
  }

  return (
    ((currentPrice - averageEntry) /
      averageEntry) *
    100
  )
}

function formatNumber(
  value: number | string | null | undefined,
) {
  const number = asNumber(value)

  if (number === null) {
    return '—'
  }

  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(number)
}

function formatSignedPercent(
  value: number | string | null | undefined,
) {
  const number = asNumber(value)

  if (number === null) {
    return '—'
  }

  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

function formatRiskReward(
  value: number | string | null | undefined,
) {
  const number = asNumber(value)

  if (number === null) {
    return '—'
  }

  return `1 : ${number.toFixed(2)}`
}

function formatFilledWeight(
  value: number | string | null | undefined,
) {
  const number = asNumber(value)

  if (number === null) {
    return '0%'
  }

  /*
   * DB stores weights as fractions:
   * 0.4 = 40%
   */

  return `${(number * 100).toFixed(0)}%`
}

function formatOutcome(
  value: string | null | undefined,
) {
  if (!value) {
    return '—'
  }

  const labels: Record<string, string> = {
    TARGET_1: 'Target 1',
    TARGET_2: 'Target 2',
    TARGET_3: 'Target 3',
    STOP: 'Stopped',
    STOPPED: 'Stopped',
    BREAKEVEN: 'Breakeven',
    BREAK_EVEN: 'Breakeven',
    CLOSED: 'Closed',
  }

  return (
    labels[value] ??
    value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) =>
        char.toUpperCase(),
      )
  )
}

function formatLabel(
  value: string,
) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    )
}

function formatDateTime(
  value: string,
) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return '—'
  }
}