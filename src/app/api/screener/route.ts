import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    let stocksData: any[] = [];

    // Mengambil data dari tabel Supabase (sesuaikan nama tabel jika perlu, misal: "stocks" atau "market_data")
    const { data: supabaseStocks, error } = await supabase
      .from("stocks")
      .select("*")
      .limit(20);

    if (!error && supabaseStocks && supabaseStocks.length > 0) {
      stocksData = supabaseStocks;
    } else {
      // Fallback ke Yahoo Finance jika tabel Supabase kosong/belum ada isinya
      const tickers = ["BBCA.JK", "BBRI.JK", "BMRI.JK", "TLKM.JK", "ASII.JK"];
      const yahooPromises = tickers.map(async (symbol) => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`);
          const json = await res.json();
          const result = json.chart.result[0];
          const meta = result.meta;
          const quote = result.indicators.quote[0];
          const closePrices = quote.close.filter((p: any) => p !== null);
          const currentPrice = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || closePrices[closePrices.length - 2];
          const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

          return {
            code: symbol.replace(".JK", ""),
            name: meta.shortName || symbol,
            price: currentPrice,
            change: parseFloat(changePercent.toFixed(2)),
            volumeSpike: `${(meta.regularMarketVolume / 1000000).toFixed(1)}M`,
            rsi: 55,
            signal: changePercent > 1 ? "Strong Buy" : changePercent > 0 ? "Momentum" : "Watchlist"
          };
        } catch {
          return null;
        }
      });

      stocksData = (await Promise.all(yahooPromises)).filter(Boolean);
    }

    return NextResponse.json(stocksData);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal memuat data screener" }, { status: 500 });
  }
}