import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker saham wajib diisi' }, { status: 400 });
  }

  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from('stock_financials_cache')
      .select('*')
      .eq('ticker', ticker)
      .single();

    if (cachedData && !cacheError) {
      const updatedAt = new Date(cachedData.updated_at).getTime();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

      if (Date.now() - updatedAt < thirtyDaysInMs) {
        return NextResponse.json({
          source: 'cache',
          data: cachedData.financial_data,
        });
      }
    }

    const apiKey = process.env.ARJUM_API_KEY;
    const response = await fetch(`https://stock.arjum.com/api/financial-statements/${ticker}`, {
      headers: {
        'X-API-Key': apiKey || '',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari API Arjum: ${response.statusText}`);
    }

    const freshData = await response.json();

    await supabase.from('stock_financials_cache').upsert({
      ticker: ticker,
      financial_data: freshData,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      source: 'live_api',
      data: freshData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
