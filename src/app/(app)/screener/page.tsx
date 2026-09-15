"use client";

import React, { useState, useEffect } from "react";
import { Filter, RefreshCw, AlertCircle } from "lucide-react";

export interface StockData {
  code: string;
  name: string;
  price: number;
  change: number;
  volumeSpike?: string | number;
  rsi?: number;
  signal?: string;
}

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<"bpjs" | "breakout">("bpjs");

  const fetchStockData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/screener");
      if (!res.ok) throw new Error("Gagal mengambil data dari server");
      const data = await res.json();
      setStocks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, [activePreset]);

  const filteredStocks = stocks.filter((stock) => {
    if (activePreset === "bpjs") {
      return (stock.rsi ?? 50) >= 50;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Stock Screener Pro
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/30">
              SUPABASE & YAHOO LIVE
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Data saham riil dari Supabase, Yahoo Finance, dan stock.arjum.com.
          </p>
        </div>
        <button
          onClick={fetchStockData}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Feed
        </button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Filter size={16} className="text-emerald-400" />
            Panel Parameter Screener
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActivePreset("bpjs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === "bpjs"
                  ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              RSI & High (BPJS Mode)
            </button>
            <button
              onClick={() => setActivePreset("breakout")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === "breakout"
                  ? "bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Volume Spike Breakout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Filter Aktif</span>
            <div className="text-sm font-semibold text-emerald-400">
              {activePreset === "bpjs" ? "RSI >= 50 & High Trend" : "Volume Spike Breakout"}
            </div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Total Hasil</span>
            <div className="text-sm font-semibold text-slate-200">{filteredStocks.length} Emiten</div>
          </div>
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 block mb-1">Status Data Feed</span>
            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-ping" : "bg-emerald-500 animate-pulse"}`} />
              {loading ? "Fetching..." : "Connected"}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Memuat data saham...</div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 text-sm flex items-center justify-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Tidak ada saham yang ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Kode</th>
                  <th className="px-5 py-3.5">Nama Saham</th>
                  <th className="px-5 py-3.5 text-right">Harga</th>
                  <th className="px-5 py-3.5 text-right">Perubahan</th>
                  <th className="px-5 py-3.5 text-center">Volume Spike</th>
                  <th className="px-5 py-3.5 text-center">RSI</th>
                  <th className="px-5 py-3.5 text-center">Sinyal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStocks.map((stock) => (
                  <tr key={stock.code} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4 font-bold text-white">{stock.code}</td>
                    <td className="px-5 py-4 text-slate-300">{stock.name}</td>
                    <td className="px-5 py-4 text-right font-medium text-white">
                      Rp {stock.price?.toLocaleString("id-ID") ?? "-"}
                    </td>
                    <td className={`px-5 py-4 text-right font-semibold ${stock.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {stock.change >= 0 ? `+${stock.change}%` : `${stock.change}%`}
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-amber-400">{stock.volumeSpike ?? "-"}</td>
                    <td className="px-5 py-4 text-center font-medium">{stock.rsi ?? "-"}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {stock.signal || "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}