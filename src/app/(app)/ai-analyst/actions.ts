'use server'

import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { analyzeStock } from '@/lib/analysis/technical'

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export async function askAnalyst(question: string, ticker: string) {
  const supabase = await createClient()

  let marketContext = ''
  let technicalContext = ''

  if (ticker) {
    const cleanTicker = ticker.trim().toUpperCase()

    const { data: stock } = await supabase
      .from('stocks')
      .select('*')
      .eq('ticker', cleanTicker)
      .single()

    const { data: price } = await supabase
      .from('latest_prices')
      .select('*')
      .eq('ticker', cleanTicker)
      .single()

    if (stock) {
      marketContext = JSON.stringify(
        {
          ticker: cleanTicker,
          name: stock.name,
          latestPrice: price?.price ?? null,
          volume: price?.volume ?? null,
        },
        null,
        2
      )
    }

    const localAnalysis = await getLocalAnalysis(cleanTicker)

    if (localAnalysis) {
      technicalContext = JSON.stringify(localAnalysis, null, 2)
    }
  }

  const systemPrompt = `Kamu adalah StockFamily AI Analyst, AI analyst khusus saham Indonesia (IDX).

PERAN UTAMA:
Kamu adalah INTERPRETER dari data analisis StockFamily.

Technical Engine StockFamily adalah sumber kebenaran untuk seluruh angka teknikal.

ATURAN DATA — SANGAT PENTING:
1. Jangan mengarang angka.
2. Jangan menghitung ulang indikator yang sudah diberikan Technical Engine.
3. Jangan membuat support atau resistance baru.
4. Jangan membuat entry baru.
5. Jangan membuat stop loss/invalidation baru.
6. Jangan membuat target baru.
7. Jangan mengubah Risk/Reward Ratio dari Technical Engine.
8. Jangan mengubah status atau setup Trade Plan dari Technical Engine.
9. Jika suatu angka tidak tersedia, katakan "data tidak tersedia".
10. Semua angka dalam jawaban harus berasal dari DATA TECHNICAL ENGINE atau DATA MARKET STOCKFAMILY.
11. Jika terdapat perbedaan antara interpretasi kamu dan data engine, DATA ENGINE SELALU MENANG.

PEMISAHAN LEVEL:
Jika data tersedia, bedakan dengan jelas:
- Major/Structural Support = support struktural dari Technical Engine.
- Local Pullback / Retest Zone = area pullback/retest dari Trade Plan.
- Invalidation = batas invalidasi dari Trade Plan.
- Resistance = resistance dari Technical Engine.

JANGAN menyamakan Major Support dengan Local Pullback Zone.

TRADE PLAN:
Trade Plan dari Technical Engine bersifat authoritative.
Tugasmu hanya menjelaskan:
- mengapa setup tersebut muncul;
- kondisi apa yang mendukung setup;
- risiko yang perlu diperhatikan;
- skenario bullish/bearish berdasarkan data yang tersedia.

Jangan mengubah angka Trade Plan.

FORMAT JAWABAN:

### Ringkasan
Kesimpulan singkat mengenai kondisi saham.

### Data Teknikal
Tampilkan indikator penting yang tersedia.

### Trend & Momentum
Jelaskan trend dan momentum berdasarkan data engine.

### Key Levels
Pisahkan:
- Resistance
- Current Price
- Local Pullback / Retest Zone
- Invalidation
- Major / Structural Support

Hanya tampilkan level yang benar-benar tersedia.

### Risiko
Jelaskan risiko berdasarkan data engine.

### Trade Plan
Gunakan Trade Plan PERSIS dari Technical Engine.
Jangan membuat atau menghitung ulang level.

### Kesimpulan
Berikan kesimpulan objektif dan singkat.

GAYA:
- Bahasa Indonesia.
- Profesional.
- Ringkas tetapi informatif.
- Jangan bertele-tele.
- Jangan menjanjikan profit.
- Jangan mengatakan harga PASTI naik atau turun.
- Jangan memberikan rekomendasi investasi personal.

DISCLAIMER:
Selalu sertakan:
"Analisis ini bukan rekomendasi investasi resmi, melainkan alat bantu analisa berdasarkan data yang tersedia."

DATA MARKET STOCKFAMILY:
${marketContext || 'Tidak ada data market spesifik.'}

DATA TECHNICAL ENGINE STOCKFAMILY:
${technicalContext || 'Data technical analysis tidak tersedia.'}
`

  const prompt = `${systemPrompt}

PERTANYAAN USER:
${question}`

  const response = await gemini.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
  })

  return response.text || 'Maaf, tidak ada jawaban.'
}

export async function getLocalAnalysis(ticker: string) {
  const supabase = await createClient()
  const cleanTicker = ticker.trim().toUpperCase()

  const { data: candles } = await supabase
    .from('stock_ohlcv')
    .select('*')
    .eq('ticker', cleanTicker)
    .order('date', { ascending: true })

  if (!candles || candles.length < 20) {
    return null
  }

  const { data: stock } = await supabase
    .from('stocks')
    .select('*')
    .eq('ticker', cleanTicker)
    .single()

  const analysis = analyzeStock(
    candles.map((c) => ({
      date: c.date,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume),
    }))
  )

  return {
    ticker: cleanTicker,
    name: stock?.name ?? cleanTicker,
    ...analysis,
  }
}
