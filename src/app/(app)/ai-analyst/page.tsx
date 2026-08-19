'use client';

import React, { useState, useEffect } from 'react';

type AnalysisTab = 'business' | 'financial_trend' | 'red_flags' | 'valuation' | 'stress_test' | 'quarterly_kpi';

export default function AIAnalystPage() {
  const [ticker, setTicker] = useState('TLKM');
  const [inputTicker, setInputTicker] = useState('TLKM');
  const [userThesis, setUserThesis] = useState('');
  const [activeTab, setActiveTab] = useState<AnalysisTab>('business');

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // State Dinamis
  const [currentPrice, setCurrentPrice] = useState<number>(2950);
  const [convictionScore, setConvictionScore] = useState<number>(74);
  const [targets, setTargets] = useState({ base: 3400, bear: 2600, bull: 4100 });

  // Store data per tab
  const [tabData, setTabData] = useState<Record<string, any>>({});

  const tabs: { id: AnalysisTab; label: string; icon: string }[] = [
    { id: 'business', label: '1. Bongkar Bisnis', icon: '🔍' },
    { id: 'financial_trend', label: '2. Tren 5 Tahun', icon: '📊' },
    { id: 'red_flags', label: '3. Red Flag Audit', icon: '🚨' },
    { id: 'valuation', label: '4. Skenario Valuasi', icon: '🎯' },
    { id: 'stress_test', label: '5. Hancurkan Tesis', icon: '💥' },
    { id: 'quarterly_kpi', label: '6. Dashboard Kuartalan', icon: '📅' },
  ];

  const quickTickers = ['TLKM', 'BBCA', 'BUMI', 'UNVR', 'ASII', 'ADMR'];

  // Fungsi Fetch Data Utama ketika Ticker Berganti
  const fetchTickerData = async (targetTicker: string, tab: AnalysisTab = activeTab) => {
    const symbol = targetTicker.toUpperCase().trim();
    if (!symbol) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: symbol, mode: tab, userThesis }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        // Update Metadata
        if (json.data.meta) {
          setCurrentPrice(json.data.meta.price);
          setConvictionScore(json.data.meta.score);
          setTargets(json.data.meta.targets);
        }
        
        // Save Tab Data
        setTabData((prev) => ({
          ...prev,
          [`${symbol}_${tab}`]: json.data,
        }));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Switch Emiten
  const handleSwitchTicker = (newTicker: string) => {
    const symbol = newTicker.toUpperCase().trim();
    setTicker(symbol);
    setInputTicker(symbol);
    setTabData({}); // Reset cache tab lama
    fetchTickerData(symbol, activeTab);
  };

  // Switch Tab
  const handleTabChange = (tabId: AnalysisTab) => {
    setActiveTab(tabId);
    const cacheKey = `${ticker}_${tabId}`;
    if (!tabData[cacheKey]) {
      fetchTickerData(ticker, tabId);
    }
  };

  // Load Awal
  useEffect(() => {
    fetchTickerData('TLKM', 'business');
  }, []);

  // Perhitungan Persentase Dynamic
  const baseUpside = currentPrice > 0 ? (((targets.base - currentPrice) / currentPrice) * 100) : 0;
  const bearDownside = currentPrice > 0 ? (((targets.bear - currentPrice) / currentPrice) * 100) : 0;
  const bullUpside = currentPrice > 0 ? (((targets.bull - currentPrice) / currentPrice) * 100) : 0;

  // Warna Tema Berdasarkan Skor
  const getThemeByScore = (score: number) => {
    if (score >= 80) {
      return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Bulls', risk: 'Low Risk' };
    } else if (score >= 60) {
      return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Neutral', risk: 'Medium Risk' };
    } else {
      return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'Bears', risk: 'High Risk' };
    }
  };

  const theme = getThemeByScore(convictionScore);
  const activeContent = tabData[`${ticker}_${activeTab}`];

  // PDF Exporter
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = document.getElementById('analyst-report-container');
      if (!element) return;

      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0b1118' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`StockFamily_AI_${ticker}.pdf`);
    } catch (err) {
      alert('Gagal mengekspor PDF');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="analyst-report-container" className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-[#0b1118]">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-white">
                AI Analyst <span className="text-emerald-400">PRO</span>
              </h1>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/30 font-semibold">
                INSTITUTIONAL GRADE
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-2">
              Platform analisis riset fundamental otomatis. Audit kualitas laba, simulasikan skenario harga, dan uji ketahanan tesis investasi Anda.
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[320px]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputTicker}
                onChange={(e) => setInputTicker(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSwitchTicker(inputTicker)}
                placeholder="Kode Saham (e.g. BBCA)"
                className="bg-slate-950 border border-slate-700 text-white font-mono font-bold px-4 py-2.5 rounded-xl text-base uppercase focus:outline-none focus:border-emerald-500 w-full"
              />
              <button
                onClick={() => handleSwitchTicker(inputTicker)}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition whitespace-nowrap"
              >
                {loading ? 'Memproses...' : 'Analisis Saham'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Populer:</span>
              {quickTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => handleSwitchTicker(t)}
                  className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border transition ${
                    ticker === t
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Verdict Summary Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${theme.bg} border ${theme.border} flex items-center justify-center text-2xl`}>🏆</div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">AI Conviction Score</span>
            <div className={`text-xl font-black ${theme.text}`}>
              {convictionScore} / 100 <span className="text-xs font-normal text-slate-400">({theme.label})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-2xl">🎯</div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Target Base Case</span>
            <div className="text-xl font-black text-white">
              Rp {targets.base.toLocaleString('id-ID')}{' '}
              <span className={`text-xs font-bold ${baseUpside >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({baseUpside >= 0 ? '+' : ''}{baseUpside.toFixed(1)}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-500">Harga Terkini: Rp {currentPrice.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl ${theme.bg} border ${theme.border} flex items-center justify-center text-2xl`}>🛡️</div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Status Risiko Laba</span>
            <div className={`text-xl font-black ${theme.text}`}>{theme.risk}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Laporan Riset</span>
            <p className="text-xs text-slate-400 mt-0.5">{ticker}.PDF</p>
          </div>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition"
          >
            <span>📥</span> {isExporting ? 'Proses...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Input Tesis Investasi */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
          📝 Tesis Investasi Anda untuk <span className="text-emerald-400 font-black">{ticker}</span>
        </label>
        <textarea
          rows={2}
          value={userThesis}
          onChange={(e) => setUserThesis(e.target.value)}
          placeholder={`Tulis tesis investasi Anda untuk ${ticker}...`}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Tab Navigasi */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800">
          <div className="inline-block animate-spin text-3xl mb-3">⚙️</div>
          <p className="text-slate-300 font-medium">AI sedang menganalisis data {ticker}...</p>
        </div>
      )}

      {/* Main Analysis Content */}
      {!loading && activeContent && (
        <div className="space-y-6">
          {activeTab === 'business' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white uppercase border-b border-slate-800 pb-3">
                  🔍 Model & Operational Overview ({ticker})
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">{activeContent.overview}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-red-400 uppercase border-b border-slate-800 pb-3">
                  ⚠️ Top 5 Risiko Utama
                </h3>
                <ul className="space-y-3">
                  {activeContent.risks?.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-red-400 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'financial_trend' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Pertumbuhan Revenue (CAGR)</span>
                  <div className="text-2xl font-black text-emerald-400 mt-2">{activeContent.cagr_revenue}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Rata-rata Margin</span>
                  <div className="text-2xl font-black text-blue-400 mt-2">{activeContent.avg_margin}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Profil Utang</span>
                  <div className="text-2xl font-black text-emerald-400 mt-2">{activeContent.debt_status}</div>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-emerald-400 uppercase mb-3">Analisis Tren 5 Tahun ({ticker})</h3>
                <p className="text-slate-300 text-sm">{activeContent.trend_analysis}</p>
              </div>
            </div>
          )}

          {activeTab === 'red_flags' && (
            <div className="space-y-4">
              {activeContent.red_flags?.map((flag: any, idx: number) => (
                <div key={idx} className="bg-slate-900 border-l-4 border-l-amber-500 border border-slate-800 p-5 rounded-r-2xl space-y-2">
                  <span className="bg-amber-950 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded border border-amber-800">
                    {flag.level} RISK
                  </span>
                  <h4 className="text-sm font-bold text-white">{flag.issue}</h4>
                  <p className="text-xs text-slate-400"><strong>Bukti:</strong> {flag.evidence}</p>
                  <p className="text-xs text-slate-400"><strong>Implikasi:</strong> {flag.implication}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'valuation' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-6">
                <span className="text-xs font-bold text-slate-400 uppercase">Target Bear Case</span>
                <div className="text-3xl font-black text-white mt-2">Rp {targets.bear.toLocaleString('id-ID')}</div>
                <div className="text-xs font-bold text-red-400 mt-1">Downside: {bearDownside.toFixed(1)}%</div>
              </div>
              <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6">
                <span className="text-xs font-bold text-slate-400 uppercase">Target Fair Value (Base)</span>
                <div className="text-3xl font-black text-emerald-400 mt-2">Rp {targets.base.toLocaleString('id-ID')}</div>
                <div className="text-xs font-bold text-emerald-400 mt-1">Upside: +{baseUpside.toFixed(1)}%</div>
              </div>
              <div className="bg-slate-900 border border-blue-900/40 rounded-2xl p-6">
                <span className="text-xs font-bold text-slate-400 uppercase">Target Bull Case</span>
                <div className="text-3xl font-black text-white mt-2">Rp {targets.bull.toLocaleString('id-ID')}</div>
                <div className="text-xs font-bold text-blue-400 mt-1">Upside: +{bullUpside.toFixed(1)}%</div>
              </div>
            </div>
          )}

          {activeTab === 'stress_test' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-amber-900/40 rounded-2xl p-5">
                <h4 className="text-xs font-bold text-amber-400 uppercase">Potensi Bias ({ticker})</h4>
                <p className="text-sm font-semibold text-slate-200 mt-1">{activeContent.main_bias}</p>
              </div>
              {activeContent.reasons_to_fail?.map((item: any, idx: number) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-red-400">❌ {item.reason}</h4>
                  <p className="text-xs text-slate-400"><strong>Bukti Real:</strong> {item.evidence}</p>
                  <p className="text-xs text-amber-400"><strong>Sinyal Peringatan:</strong> {item.early_warning}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'quarterly_kpi' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Nama Metrik</th>
                    <th className="p-3.5">Kuartal Lalu</th>
                    <th className="p-3.5">Terbaru</th>
                    <th className="p-3.5">Target Tesis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {activeContent.metrics?.map((m: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-3.5 text-white font-bold">{m.name}</td>
                      <td className="p-3.5 text-slate-400">{m.previous}</td>
                      <td className="p-3.5 text-slate-100 font-bold">{m.latest}</td>
                      <td className="p-3.5 text-slate-300">{m.expectation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
