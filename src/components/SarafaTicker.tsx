import React, { useState } from 'react';
import { db } from '../db';
import { type Language } from '../translations';
import { Coins, TrendingUp, Edit3, X, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface SarafaTickerProps {
  baseRate: number; // 24K gold rate per tola
  lang: Language;
  onRateChange: (newRate: number) => void;
}

export type RateUnit = 'tola' | 'gram' | '10gram';

export default function SarafaTicker({ baseRate, lang, onRateChange }: SarafaTickerProps) {
  const isUrdu = lang === 'ur';
  const [unit, setUnit] = useState<RateUnit>('tola');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputRate, setInputRate] = useState<string>('');
  const [silverInput, setSilverInput] = useState<string>('3250');
  const [silverRate, setSilverRate] = useState<number>(3250);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Conversion factor based on unit
  // Default baseRate is assumed to be Per Tola (11.664 grams)
  const getDisplayRate = (tolaRate: number) => {
    if (!tolaRate) return 0;
    if (unit === 'tola') return Math.round(tolaRate);
    if (unit === 'gram') return Math.round(tolaRate / 11.664);
    if (unit === '10gram') return Math.round((tolaRate / 11.664) * 10);
    return Math.round(tolaRate);
  };

  const getUnitLabel = () => {
    if (isUrdu) {
      if (unit === 'tola') return 'فی تولہ';
      if (unit === 'gram') return 'فی گرام';
      if (unit === '10gram') return 'فی 10 گرام';
    } else {
      if (unit === 'tola') return 'Per Tola';
      if (unit === 'gram') return 'Per Gram';
      if (unit === '10gram') return 'Per 10g';
    }
    return '';
  };

  const rate24K = getDisplayRate(baseRate);
  const rate22K = getDisplayRate(baseRate * (22 / 24));
  const rate21K = getDisplayRate(baseRate * (21 / 24));
  const rate18K = getDisplayRate(baseRate * (18 / 24));
  const rateSilver = getDisplayRate(silverRate);

  const handleSaveRate = async () => {
    const num = Number(inputRate);
    if (isNaN(num) || num <= 0) {
      alert(isUrdu ? 'براہ کرم درست ریٹ درج کریں' : 'Please enter a valid rate');
      return;
    }

    try {
      await db.settings.put({ key: 'goldRate', value: num });
      if (silverInput && !isNaN(Number(silverInput))) {
        await db.settings.put({ key: 'silverRate', value: Number(silverInput) });
        setSilverRate(Number(silverInput));
      }
      onRateChange(num);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsModalOpen(false);
      }, 700);
    } catch (e) {
      console.error(e);
      alert('Error saving rate');
    }
  };

  const openModal = () => {
    setInputRate(baseRate ? String(baseRate) : '');
    setSilverInput(String(silverRate));
    setIsModalOpen(true);
  };

  return (
    <div className="w-full mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-gold/40 shadow-xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 text-white transition-all duration-300">
        {/* Top Glowing Metallic Gold Accent Line */}
        <div className="h-1 w-full gold-metallic-bg" />

        {/* Bar Header Content */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Market Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-700 p-0.5 shadow-md shadow-amber-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Coins className="text-amber-400" size={20} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base urdu-text gold-metallic-text tracking-wide">
                  {isUrdu ? 'صرافہ مارکیٹ لائیو ریٹ بورڈ' : 'Official Sarafa Bullion Board'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isUrdu ? 'آج کا ریٹ' : 'Live'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium urdu-text">
                {isUrdu ? `حالیہ پیمائش: ${getUnitLabel()}` : `Current unit: ${getUnitLabel()}`}
              </p>
            </div>
          </div>

          {/* Unit Switcher & Quick Edit Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Unit Buttons */}
            <div className="flex items-center bg-zinc-800/80 p-1 rounded-xl border border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setUnit('tola')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  unit === 'tola'
                    ? 'bg-gold text-black shadow-sm'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {isUrdu ? 'تولہ' : 'Tola'}
              </button>
              <button
                type="button"
                onClick={() => setUnit('gram')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  unit === 'gram'
                    ? 'bg-gold text-black shadow-sm'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {isUrdu ? 'گرام' : 'Gram'}
              </button>
              <button
                type="button"
                onClick={() => setUnit('10gram')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  unit === '10gram'
                    ? 'bg-gold text-black shadow-sm'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                {isUrdu ? '10 گرام' : '10g'}
              </button>
            </div>

            {/* Quick Edit Rate Button */}
            <button
              type="button"
              onClick={openModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs transition-all shadow-sm"
              title={isUrdu ? 'ریٹ تبدیل کریں' : 'Update Gold Rate'}
            >
              <Edit3 size={14} />
              <span className="urdu-text">{isUrdu ? 'ریٹ تبدیل کریں' : 'Update Rate'}</span>
            </button>

            {/* Toggle Collapse */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title={isCollapsed ? 'Show' : 'Hide'}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {/* Karats Ticker Ribbon (Expandable) */}
        {!isCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 sm:p-4 pt-0 border-t border-zinc-800/80 bg-zinc-950/60">
            {/* 24K */}
            <div className="bg-gradient-to-br from-amber-950/40 via-zinc-900 to-zinc-900/90 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between shadow-inner group hover:border-amber-400 transition-all">
              <div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-black">24K</span>
                  <span className="text-[11px] font-bold text-amber-200 urdu-text">{isUrdu ? 'خالص سونا (999)' : 'Pure Gold'}</span>
                </div>
                <p className="text-base sm:text-lg font-black text-amber-400 mt-0.5 font-mono tracking-tight">
                  Rs. {rate24K.toLocaleString()}
                </p>
              </div>
              <Sparkles size={16} className="text-amber-400/40 group-hover:text-amber-300 transition-colors" />
            </div>

            {/* 22K */}
            <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between shadow-inner group hover:border-amber-500/40 transition-all">
              <div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-600/80 text-white">22K</span>
                  <span className="text-[11px] font-bold text-zinc-300 urdu-text">{isUrdu ? 'زیورات (916)' : 'Jewelry'}</span>
                </div>
                <p className="text-base sm:text-lg font-black text-zinc-100 mt-0.5 font-mono tracking-tight">
                  Rs. {rate22K.toLocaleString()}
                </p>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold">91.6%</span>
            </div>

            {/* 21K */}
            <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between shadow-inner group hover:border-amber-500/40 transition-all">
              <div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-yellow-600/80 text-white">21K</span>
                  <span className="text-[11px] font-bold text-zinc-300 urdu-text">{isUrdu ? 'عرب کلاسک (875)' : 'Arabian'}</span>
                </div>
                <p className="text-base sm:text-lg font-black text-zinc-100 mt-0.5 font-mono tracking-tight">
                  Rs. {rate21K.toLocaleString()}
                </p>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold">87.5%</span>
            </div>

            {/* 18K */}
            <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between shadow-inner group hover:border-amber-500/40 transition-all">
              <div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-700 text-amber-300">18K</span>
                  <span className="text-[11px] font-bold text-zinc-300 urdu-text">{isUrdu ? 'ڈائمنڈ سیٹ (750)' : 'Diamond Cut'}</span>
                </div>
                <p className="text-base sm:text-lg font-black text-zinc-200 mt-0.5 font-mono tracking-tight">
                  Rs. {rate18K.toLocaleString()}
                </p>
              </div>
              <span className="text-[10px] text-zinc-500 font-bold">75.0%</span>
            </div>

            {/* Silver / Chandi */}
            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-slate-900/80 to-zinc-900 border border-slate-700/60 p-2.5 rounded-xl flex items-center justify-between shadow-inner group hover:border-slate-400 transition-all">
              <div>
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-200 text-slate-900">Ag</span>
                  <span className="text-[11px] font-bold text-slate-300 urdu-text">{isUrdu ? 'خالص چاندی' : 'Silver'}</span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-200 mt-0.5 font-mono tracking-tight">
                  Rs. {rateSilver.toLocaleString()}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-bold">Chandi</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Rate Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 text-white border border-amber-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="text-amber-400" size={22} />
                <h3 className="font-bold text-lg urdu-text gold-metallic-text">
                  {isUrdu ? 'آج کا صرافہ ریٹ درج کریں' : 'Update Sarafa Gold Rate'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-amber-300 mb-1.5 urdu-text tracking-wide">
                  {isUrdu ? '24 قیراط سونے کا ریٹ فی تولہ (PKR)' : '24K Gold Rate Per Tola (PKR)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={inputRate}
                    onChange={(e) => setInputRate(e.target.value)}
                    placeholder="e.g. 275000"
                    className="w-full bg-black border-2 border-amber-400 text-amber-300 placeholder-amber-400/50 text-2xl font-black font-mono focus:outline-none focus:ring-4 focus:ring-amber-500/40 focus:border-amber-300 shadow-xl px-4 py-3.5 rounded-xl transition-all"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-amber-300 bg-zinc-900/90 px-2.5 py-1 rounded-lg border border-amber-400/60 shadow-sm">PKR</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-200 mb-1.5 urdu-text tracking-wide">
                  {isUrdu ? 'چاندی کا ریٹ فی تولہ (PKR)' : 'Silver Rate Per Tola (PKR)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={silverInput}
                    onChange={(e) => setSilverInput(e.target.value)}
                    placeholder="e.g. 3250"
                    className="w-full bg-black border-2 border-slate-400 text-white placeholder-slate-400/50 text-xl font-black font-mono focus:outline-none focus:ring-4 focus:ring-slate-400/40 focus:border-white shadow-xl px-4 py-3 rounded-xl transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-200 bg-zinc-900/90 px-2.5 py-1 rounded-lg border border-slate-400/60 shadow-sm">PKR</span>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-200/90 leading-relaxed urdu-text">
                {isUrdu
                  ? 'نوٹ: نیا ریٹ محفوظ کرتے ہی تمام 22K، 21K، 18K اور فی گرام ریٹس خودکار طریقے سے اپ ڈیٹ ہو جائیں گے۔'
                  : 'Note: Updating will automatically recalculate 22K, 21K, 18K, and per-gram prices across the entire application.'}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveRate}
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-black py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 urdu-text text-base"
              >
                {saveSuccess ? (
                  <>
                    <Check size={18} />
                    <span>{isUrdu ? 'محفوظ ہو گیا!' : 'Saved!'}</span>
                  </>
                ) : (
                  <span>{isUrdu ? 'ریٹ محفوظ کریں' : 'Save Rate'}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white font-bold transition-all text-sm urdu-text"
              >
                {isUrdu ? 'منسوخ' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
