import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const arjumApiKey = process.env.ARJUM_API_KEY || '';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const API_TIMEOUT_MS = 15 * 1000;

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? getSupabaseAdmin()
    : null;

type CacheRow = {
  ticker: string;
  financial_data: unknown;
  updated_at: string;
};

type ArjumFinancialResponse = {
  stock_code?: unknown;
  report_type?: unknown;
  period?: unknown;
  count?: unknown;
  items: unknown[];
  [key: string]: unknown;
};

function jsonError(
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...extra,
    },
    { status }
  );
}

/**
 * Arjum financial-statements response is FLAT:
 *
 * {
 *   stock_code,
 *   report_type,
 *   period,
 *   count,
 *   items: [...]
 * }
 *
 * Do NOT expect response.data.items here.
 */
function isValidFinancialResponse(
  data: unknown
): data is ArjumFinancialResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const value = data as Record<string, unknown>;

  return Array.isArray(value.items);
}

/**
 * Arjum may provide fetched_at inside individual financial items.
 * Use the newest valid timestamp found in the items.
 */
function getSourceFetchedAt(data: unknown): string {
  if (data && typeof data === 'object') {
    const value = data as Record<string, unknown>;
    const items = value.items;

    if (Array.isArray(items)) {
      const timestamps = items
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === 'object'
        )
        .map((item) => item.fetched_at)
        .filter(
          (timestamp): timestamp is string =>
            typeof timestamp === 'string' &&
            timestamp.trim().length > 0
        )
        .map((timestamp) => ({
          value: timestamp,
          time: new Date(timestamp).getTime(),
        }))
        .filter((item) => !Number.isNaN(item.time))
        .sort((a, b) => b.time - a.time);

      if (timestamps.length > 0) {
        return timestamps[0].value;
      }
    }
  }

  return new Date().toISOString();
}

function getCacheAge(updatedAt: string | null): number | null {
  if (!updatedAt) {
    return null;
  }

  const timestamp = new Date(updatedAt).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, Date.now() - timestamp);
}

function buildResponse(params: {
  source: 'live_api' | 'cache';
  ticker: string;
  data: unknown;
  fetchedAt: string | null;
  cachedAt: string | null;
  stale: boolean;
  warning?: string;
}) {
  const {
    source,
    ticker,
    data,
    fetchedAt,
    cachedAt,
    stale,
    warning,
  } = params;

  return NextResponse.json({
    success: true,
    source,
    ticker,
    data,
    fetched_at: fetchedAt,
    cached_at: cachedAt,
    stale,
    cache_ttl_hours: 24,
    ...(warning ? { warning } : {}),
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawTicker = searchParams.get('ticker');
  const ticker = rawTicker?.trim().toUpperCase();

  if (!ticker) {
    return jsonError('Ticker saham wajib diisi', 400);
  }

  if (!/^[A-Z0-9.-]{2,10}$/.test(ticker)) {
    return jsonError('Format ticker saham tidak valid', 400, {
      ticker,
    });
  }

  let cachedData: unknown = null;
  let cacheUpdatedAt: string | null = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_financials_cache')
        .select('ticker, financial_data, updated_at')
        .eq('ticker', ticker)
        .maybeSingle<CacheRow>();

      if (error) {
        console.error(
          '[financials] Supabase cache read error:',
          error
        );
      } else if (data) {
        cachedData = data.financial_data;
        cacheUpdatedAt = data.updated_at;
      }
    } catch (error) {
      console.error(
        '[financials] Unexpected Supabase cache read error:',
        error
      );
    }
  }

  if (cachedData && cacheUpdatedAt) {
    const cacheAgeMs = getCacheAge(cacheUpdatedAt);

    if (
      cacheAgeMs !== null &&
      cacheAgeMs < CACHE_TTL_MS
    ) {
      return buildResponse({
        source: 'cache',
        ticker,
        data: cachedData,
        fetchedAt: cacheUpdatedAt,
        cachedAt: cacheUpdatedAt,
        stale: false,
      });
    }
  }

  if (!arjumApiKey) {
    console.error(
      '[financials] ARJUM_API_KEY belum dikonfigurasi'
    );

    if (cachedData) {
      return buildResponse({
        source: 'cache',
        ticker,
        data: cachedData,
        fetchedAt: cacheUpdatedAt,
        cachedAt: cacheUpdatedAt,
        stale: true,
        warning:
          'ARJUM_API_KEY belum dikonfigurasi. Data menggunakan cache terakhir.',
      });
    }

    return jsonError(
      'Konfigurasi ARJUM_API_KEY belum tersedia di server',
      500,
      {
        ticker,
      }
    );
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT_MS);

  try {
    const apiUrl =
      `https://stock.arjum.com/api/financial-statements/${encodeURIComponent(
        ticker
      )}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': arjumApiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');

      throw new Error(
        `Arjum API ${response.status}: ${
          response.statusText || 'Request gagal'
        }${
          responseText
            ? ` - ${responseText.slice(0, 500)}`
            : ''
        }`
      );
    }

    const freshData: unknown = await response.json();

    if (!isValidFinancialResponse(freshData)) {
      let keys = '';

      if (
        freshData &&
        typeof freshData === 'object'
      ) {
        keys = Object.keys(
          freshData as Record<string, unknown>
        ).join(', ');
      }

      throw new Error(
        `Arjum API mengembalikan struktur financial data yang tidak valid${
          keys ? `. Keys: ${keys}` : ''
        }`
      );
    }

    const serverFetchedAt =
      new Date().toISOString();

    const fetchedAt =
      getSourceFetchedAt(freshData);

    let cacheWriteSucceeded = false;

    if (supabase) {
      try {
        const { error: upsertError } = await supabase
          .from('stock_financials_cache')
          .upsert(
            {
              ticker,
              financial_data: freshData,
              updated_at: serverFetchedAt,
            },
            {
              onConflict: 'ticker',
            }
          );

        if (upsertError) {
          console.error(
            '[financials] Supabase cache upsert error:',
            upsertError
          );
        } else {
          cacheWriteSucceeded = true;
        }
      } catch (error) {
        console.error(
          '[financials] Supabase cache write error:',
          error
        );
      }
    }

    return buildResponse({
      source: 'live_api',
      ticker,
      data: freshData,
      fetchedAt,
      cachedAt: cacheWriteSucceeded
        ? serverFetchedAt
        : null,
      stale: false,
    });
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      error.name === 'AbortError';

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Gagal mengambil data financials';

    console.error(
      '[financials] Arjum API error:',
      errorMessage
    );

    if (cachedData) {
      return buildResponse({
        source: 'cache',
        ticker,
        data: cachedData,
        fetchedAt: cacheUpdatedAt,
        cachedAt: cacheUpdatedAt,
        stale: true,
        warning: isTimeout
          ? 'Arjum API timeout. Data menggunakan cache terakhir.'
          : 'Arjum API gagal. Data menggunakan cache terakhir.',
      });
    }

    return jsonError(
      isTimeout
        ? 'Arjum API timeout dan tidak ada data cache'
        : 'Gagal mengambil data financials dari Arjum API',
      502,
      {
        ticker,
        source: 'arjum_api',
        detail: errorMessage,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

