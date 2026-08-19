import time
from datetime import datetime, timezone
import yfinance as yf
from supabase import create_client, Client

# 1. PASTA URL & KEY ASLI DARI SUPABASE DASHBOARD KAMU DI SINI
SUPABASE_URL = https://ilbbjdigfubjsnapzjhv.supabase.co  
SUPABASE_KEY = sb_publishable_zoAgHKPsmyFYxS9MIaFwRQ_sF5W1LGC              

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def sync_market_data():
    try:
        # Fetch Live Data IHSG (^JKSE)
        ticker = yf.Ticker("^JKSE")
        info = ticker.fast_info
        
        ihsg_price = round(info.last_price)
        prev_close = info.previous_close
        change_percent = round(((ihsg_price - prev_close) / prev_close) * 100, 2)

        # Upsert Data ke Supabase
        supabase.table("market_overview").upsert({
            "id": 1,
            "bias": "BULLISH" if change_percent >= 0 else "BEARISH",
            "score": 78 if change_percent >= 0 else 45,
            "trend": "Bullish" if change_percent >= 0 else "Bearish",
            "momentum": "Positive" if change_percent >= 0 else "Negative",
            "breadth": "Strong",
            "volume": "Active",
            "risk": "Tinggi" if change_percent < -1 else "Waspada",
            "ihsg_price": ihsg_price,
            "ihsg_change_percent": change_percent,
            "updated_at": datetime.now(timezone.utc).isoformat()  # Diperbarui menggunakan timezone.utc
        }).execute()

        print(f"[{datetime.now().strftime('%H:%M:%S')}] SUCCESS: IHSG {ihsg_price} ({change_percent}%)")

    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ERROR: {e}")

if __name__ == "__main__":
    print("🚀 Python Realtime Market Worker Started...")
    while True:
        sync_market_data()
        time.sleep(5)