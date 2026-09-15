import * as XLSX from 'xlsx'

export type DailyMarketSummaryInsert = {
  trade_date: string
  stock_code: string
  stock_name: string | null
  previous: number | null
  open_price: number | null
  high: number | null
  low: number | null
  close: number | null
  change: number | null
  volume: number | null
  value: number | null
  frequency: number | null
  index_individual: number | null
  offer: number | null
  offer_volume: number | null
  bid: number | null
  bid_volume: number | null
  listed_shares: number | null
  tradeble_shares: number | null
  weight_for_index: number | null
  foreign_sell: number | null
  foreign_buy: number | null
  non_regular_volume: number | null
  non_regular_value: number | null
  non_regular_frequency: number | null
}

const HEADER_ALIASES: Record<string, keyof DailyMarketSummaryInsert | 'skip'> = {
  'stock code': 'stock_code',
  'kode saham': 'stock_code',
  code: 'stock_code',
  'stock name': 'stock_name',
  'nama perusahaan': 'stock_name',
  'nama saham': 'stock_name',
  name: 'stock_name',
  previous: 'previous',
  prev: 'previous',
  'open price': 'open_price',
  open: 'open_price',
  high: 'high',
  highest: 'high',
  tinggi: 'high',
  low: 'low',
  lowest: 'low',
  rendah: 'low',
  close: 'close',
  closing: 'close',
  penutupan: 'close',
  change: 'change',
  selisih: 'change',
  volume: 'volume',
  value: 'value',
  nilai: 'value',
  frequency: 'frequency',
  frekuensi: 'frequency',
  freq: 'frequency',
  'index individual': 'index_individual',
  indexindividual: 'index_individual',
  offer: 'offer',
  'offer volume': 'offer_volume',
  offervolume: 'offer_volume',
  bid: 'bid',
  'bid volume': 'bid_volume',
  bidvolume: 'bid_volume',
  'listed shares': 'listed_shares',
  'listed share': 'listed_shares',
  'tradeble shares': 'tradeble_shares',
  'tradeable shares': 'tradeble_shares',
  'tradable shares': 'tradeble_shares',
  'weight for index': 'weight_for_index',
  'weight forindex': 'weight_for_index',
  'foreign sell': 'foreign_sell',
  foreignsell: 'foreign_sell',
  'foreign buy': 'foreign_buy',
  foreignbuy: 'foreign_buy',
  'non regular volume': 'non_regular_volume',
  'non-regular volume': 'non_regular_volume',
  'non regular value': 'non_regular_value',
  'non-regular value': 'non_regular_value',
  'non regular frequency': 'non_regular_frequency',
  'non-regular frequency': 'non_regular_frequency',
  no: 'skip',
  remarks: 'skip',
  'first trade': 'skip',
  firsttrade: 'skip',
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const raw = String(value).trim()
  if (!raw || raw === '-' || raw === '—' || raw === 'N/A') return null

  const normalized = raw.replace(/\s/g, '').replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function isValidIsoDate(year: number, month: number, day: number): boolean {
  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  )
}

export function extractTradeDateFromFilename(filename: string): string | null {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename

  const iso = base.match(/(20\d{2})[-_.](\d{2})[-_.](\d{2})/)
  if (iso) {
    const year = Number(iso[1])
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (isValidIsoDate(year, month, day)) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`
    }
  }

  const compact = base.match(/(20\d{2})(\d{2})(\d{2})/)
  if (compact) {
    const year = Number(compact[1])
    const month = Number(compact[2])
    const day = Number(compact[3])
    if (isValidIsoDate(year, month, day)) {
      return `${compact[1]}-${compact[2]}-${compact[3]}`
    }
  }

  return null
}

function looksLikeStockCode(value: unknown): boolean {
  const code = String(value ?? '').trim().toUpperCase()
  if (!code) return false
  if (code === 'STOCK CODE' || code === 'KODE SAHAM' || code === 'CODE') return false
  return /^[A-Z0-9][A-Z0-9.\-]{0,19}$/.test(code)
}

export function parseIdxSummarySheet(
  rows: unknown[][],
  tradeDate: string,
): DailyMarketSummaryInsert[] {
  let headerIndex = -1
  let columnMap: Array<keyof DailyMarketSummaryInsert | 'skip' | null> = []

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i] ?? []
    const mapped = row.map((cell) => HEADER_ALIASES[normalizeHeader(cell)] ?? null)
    const hasCode = mapped.includes('stock_code')
    if (hasCode) {
      headerIndex = i
      columnMap = mapped
      break
    }
  }

  if (headerIndex < 0) {
    throw new Error('Header IDX tidak ditemukan (kolom Stock Code / Kode Saham).')
  }

  const result: DailyMarketSummaryInsert[] = []

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? []
    const record: Partial<DailyMarketSummaryInsert> = {
      trade_date: tradeDate,
    }

    for (let c = 0; c < columnMap.length; c++) {
      const field = columnMap[c]
      if (!field || field === 'skip') continue
      const cell = row[c]
      if (field === 'stock_code' || field === 'stock_name') {
        const text = String(cell ?? '').trim()
        record[field] = text ? (field === 'stock_code' ? text.toUpperCase() : text) : undefined
      } else {
        record[field] = parseNumber(cell)
      }
    }

    if (!looksLikeStockCode(record.stock_code)) continue

    result.push({
      trade_date: tradeDate,
      stock_code: record.stock_code as string,
      stock_name: record.stock_name ?? null,
      previous: record.previous ?? null,
      open_price: record.open_price ?? null,
      high: record.high ?? null,
      low: record.low ?? null,
      close: record.close ?? null,
      change: record.change ?? null,
      volume: record.volume ?? null,
      value: record.value ?? null,
      frequency: record.frequency ?? null,
      index_individual: record.index_individual ?? null,
      offer: record.offer ?? null,
      offer_volume: record.offer_volume ?? null,
      bid: record.bid ?? null,
      bid_volume: record.bid_volume ?? null,
      listed_shares: record.listed_shares ?? null,
      tradeble_shares: record.tradeble_shares ?? null,
      weight_for_index: record.weight_for_index ?? null,
      foreign_sell: record.foreign_sell ?? null,
      foreign_buy: record.foreign_buy ?? null,
      non_regular_volume: record.non_regular_volume ?? null,
      non_regular_value: record.non_regular_value ?? null,
      non_regular_frequency: record.non_regular_frequency ?? null,
    })
  }

  return result
}

export function parseIdxSummaryFile(
  buffer: ArrayBuffer | Buffer,
  filename: string,
): { tradeDate: string; rows: DailyMarketSummaryInsert[] } {
  const tradeDate = extractTradeDateFromFilename(filename)
  if (!tradeDate) {
    throw new Error(
      `Tanggal tidak ditemukan di nama file "${filename}". Pakai format IDX seperti Ringkasan Saham-YYYYMMDD.xlsx`,
    )
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('File Excel tidak punya sheet.')
  }

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  const rows = parseIdxSummarySheet(matrix as unknown[][], tradeDate)
  if (rows.length === 0) {
    throw new Error('Tidak ada baris saham yang bisa diparse dari file ini.')
  }

  return { tradeDate, rows }
}
