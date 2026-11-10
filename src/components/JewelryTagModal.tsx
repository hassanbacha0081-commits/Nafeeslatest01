import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Barcode, Tag, Sparkles, Layers, Sliders, Check, Copy } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { StockItem } from '../db';
import { APP_CONFIG } from '../config';
import { Language } from '../translations';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';
import html2canvas from 'html2canvas-pro';

interface JewelryTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItems: StockItem[];
  initialSelectedId?: number | null;
  lang?: Language;
}

interface TagItemConfig {
  id: number;
  name: string;
  tagCode: string;
  karat: string;
  grossWeight: number;
  netWeight: number;
  making: number;
  copies: number;
}

export default function JewelryTagModal({
  isOpen,
  onClose,
  stockItems,
  initialSelectedId,
  lang = 'ur'
}: JewelryTagModalProps) {
  const isUrdu = lang === 'ur';
  const [printMode, setPrintMode] = useState<'sheet' | 'single' | 'barbell'>('sheet');
  const [tagItems, setTagItems] = useState<TagItemConfig[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState<number>(0);
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Initialize tags from stock
  useEffect(() => {
    if (!stockItems || stockItems.length === 0) return;

    let itemsToProcess = stockItems;
    if (initialSelectedId) {
      const match = stockItems.find(s => s.id === initialSelectedId);
      if (match) {
        itemsToProcess = [match];
      }
    }

    const configs: TagItemConfig[] = itemsToProcess.map((item, idx) => {
      const paddedId = String(item.id || idx + 1).padStart(4, '0');
      const tagCode = `NJ-${paddedId}`;
      const wt = Number(item.quantity) || 1.0;
      return {
        id: item.id || idx + 1,
        name: item.name,
        tagCode,
        karat: '21K',
        grossWeight: Number(wt.toFixed(3)),
        netWeight: Number((wt * 0.98).toFixed(3)),
        making: 0,
        copies: 1
      };
    });

    setTagItems(configs);
    setSelectedTagIndex(0);
  }, [stockItems, initialSelectedId, isOpen]);

  // Render Barcodes whenever tagItems change
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      tagItems.forEach((tag, idx) => {
        const svgElements = document.querySelectorAll<SVGSVGElement>(`.barcode-svg-${idx}`);
        svgElements.forEach(el => {
          try {
            JsBarcode(el, tag.tagCode, {
              format: 'CODE128',
              width: 1.3,
              height: 28,
              displayValue: true,
              fontSize: 10,
              font: "'Inter', monospace",
              margin: 2,
              lineColor: '#1e293b'
            });
          } catch (e) {
            console.error('JsBarcode rendering error:', e);
          }
        });
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [tagItems, isOpen, printMode]);

  const handlePrint = useReactToPrint({
    contentRef: printSheetRef,
    documentTitle: `Jewelry_Tags_NafeesJewellers_${Date.now()}`
  });

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && printSheetRef.current) {
      try {
        const canvas = await html2canvas(printSheetRef.current, { scale: 2.0, backgroundColor: '#ffffff' });
        const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        await CapPrinter.printBase64({
          name: `Jewelry_Tags_${Date.now()}`,
          data: base64,
          mimeType: 'application/pdf'
        });
        return;
      } catch (err) {
        console.warn('Native printer failed, fallback to web print:', err);
      }
    }
    handlePrint();
  };

  const updateSelectedTag = (field: keyof TagItemConfig, value: any) => {
    setTagItems(prev => {
      const updated = [...prev];
      if (updated[selectedTagIndex]) {
        updated[selectedTagIndex] = {
          ...updated[selectedTagIndex],
          [field]: value
        };
      }
      return updated;
    });
  };

  if (!isOpen) return null;

  const currentTag = tagItems[selectedTagIndex] || tagItems[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto" dir={isUrdu ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-amber-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-200 border border-white/20 shadow-inner">
              <Tag size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-nastaliq tracking-wide">
                {isUrdu ? 'جیولری شوکیس ٹیگز اور بارکوڈ پرنٹنگ' : 'Jewelry Showcase Tags & Barcodes'}
              </h2>
              <p className="text-xs text-amber-100/80 font-sans">
                {APP_CONFIG.shopNameEnglish} • Official Jewelry Display Label System
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X size={22} />
          </button>
        </div>

        {/* Toolbar & Controls */}
        <div className="p-4 bg-amber-50/60 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Format selector */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200 shadow-sm">
            <button
              onClick={() => setPrintMode('sheet')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'sheet'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Layers size={15} />
              <span>{isUrdu ? 'A4 اسٹیکر شیٹ (Grid Sheet)' : 'A4 Tag Sheet'}</span>
            </button>
            <button
              onClick={() => setPrintMode('barbell')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'barbell'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Tag size={15} />
              <span>{isUrdu ? 'فولڈیبل رنگ ٹیگ (Barbell Tag)' : 'Ring Barbell'}</span>
            </button>
            <button
              onClick={() => setPrintMode('single')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'single'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Barcode size={15} />
              <span>{isUrdu ? 'سنگل لیبل (Single 50x25mm)' : 'Single Label'}</span>
            </button>
          </div>

          {/* Print Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={executePrint}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20 active:scale-95"
            >
              <Printer size={18} />
              <span className="font-bold">{isUrdu ? 'ٹیگز پرنٹ کریں (Print)' : 'Print Tags'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50">
          
          {/* Left Column: Tag Customizer & Item Selector */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Tag Selection if multiple */}
            {tagItems.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <label className="text-xs font-bold text-zinc-600 flex items-center justify-between">
                  <span>{isUrdu ? 'آئٹم منتخب کریں:' : 'Select Item:'}</span>
                  <span className="text-[10px] text-amber-700 font-mono">Total {tagItems.length} items</span>
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                  {tagItems.map((tag, idx) => (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagIndex(idx)}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs flex justify-between items-center transition-all ${
                        selectedTagIndex === idx 
                          ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300' 
                          : 'hover:bg-slate-100 text-zinc-700'
                      }`}
                    >
                      <span className="truncate max-w-[140px] font-nastaliq">{tag.name}</span>
                      <span className="font-mono text-zinc-500 text-[11px]">{tag.tagCode} ({tag.grossWeight}g)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tag Details Editor */}
            {currentTag && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
                <div className="flex items-center gap-2 border-b pb-2 text-amber-800 font-bold text-sm">
                  <Sliders size={16} />
                  <span>{isUrdu ? 'ٹیگ کی تفصیلات میں تبدیلی' : 'Customize Selected Tag'}</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                    {isUrdu ? 'آئٹم کا نام:' : 'Item Name:'}
                  </label>
                  <input
                    type="text"
                    value={currentTag.name}
                    onChange={e => updateSelectedTag('name', e.target.value)}
                    className="w-full text-sm font-nastaliq font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                      {isUrdu ? 'ٹیگ بارکوڈ کوڈ:' : 'Tag Code:'}
                    </label>
                    <input
                      type="text"
                      value={currentTag.tagCode}
                      onChange={e => updateSelectedTag('tagCode', e.target.value.toUpperCase())}
                      className="w-full text-sm font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                      {isUrdu ? 'قیراط / پیورٹی:' : 'Karat Purity:'}
                    </label>
                    <select
                      value={currentTag.karat}
                      onChange={e => updateSelectedTag('karat', e.target.value)}
                      className="w-full text-sm font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    >
                      <option value="24K">24K (خالص پانسہ)</option>
                      <option value="22K">22K (معیاری زیور)</option>
                      <option value="21K">21K (دبئی و سنگاپور)</option>
                      <option value="18K">18K (ڈائمنڈ و اطالوی)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                      {isUrdu ? 'ٹوٹل وزن (G.Wt):' : 'Gross Wt (g):'}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={currentTag.grossWeight}
                      onChange={e => updateSelectedTag('grossWeight', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                      {isUrdu ? 'صاف سونا (N.Wt):' : 'Net Wt (g):'}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={currentTag.netWeight}
                      onChange={e => updateSelectedTag('netWeight', parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                    {isUrdu ? 'مزدوری / پالش (اختیاری):' : 'Making / Mazdori:'}
                  </label>
                  <input
                    type="number"
                    value={currentTag.making || ''}
                    placeholder="0"
                    onChange={e => updateSelectedTag('making', parseFloat(e.target.value) || 0)}
                    className="w-full text-sm font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold font-nastaliq text-amber-800">📌 شوکیس ٹپ:</p>
              <p className="leading-relaxed font-nastaliq">
                یہ بارکوڈ معیاری Code-128 میں تیار ہوتا ہے۔ آپ اپنے موبائل کے کیمرہ یا کسی بھی یو ایس بی اسکینر سے اس بارکوڈ کو اسکین کر کے بل میں ڈائریکٹ درج کر سکتے ہیں۔
              </p>
            </div>
          </div>

          {/* Right Column: Live Printable Preview */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-start overflow-x-auto min-h-[400px]">
            <div className="w-full flex justify-between items-center mb-4 text-xs font-bold text-zinc-500 border-b pb-2">
              <span>{isUrdu ? 'پرنٹ پریویو (Live Printable Preview)' : 'Live Tag Preview'}</span>
              <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {printMode === 'sheet' ? 'A4 Sticker Grid (24 Tags per page)' : printMode === 'barbell' ? 'Showcase Barbell Tag' : 'Single 50x25mm Label'}
              </span>
            </div>

            {/* Printable Container */}
            <div ref={printSheetRef} className="print-tags-wrapper bg-white text-black p-4 w-full">
              <style>{`
                @media print {
                  @page {
                    size: ${printMode === 'single' ? '50mm 25mm' : 'A4 portrait'};
                    margin: ${printMode === 'single' ? '0' : '6mm'};
                  }
                  body {
                    background: white !important;
                    margin: 0 !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  .print-tags-wrapper {
                    padding: 0 !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}</style>

              {/* Mode 1: A4 Grid Sheet for Showcase Trays */}
              {printMode === 'sheet' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {tagItems.map((tag, idx) => (
                    <div
                      key={idx}
                      className="border border-amber-700/60 rounded-xl p-2.5 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 relative shadow-sm hover:border-amber-600 transition-all"
                      style={{ minHeight: '120px' }}
                    >
                      {/* Top Shop Banner */}
                      <div className="flex justify-between items-center border-b border-amber-600/30 pb-1 mb-1">
                        <span className="text-[11px] font-black text-amber-900 font-sans tracking-tight uppercase">
                          {APP_CONFIG.shopNameEnglish}
                        </span>
                        <span className="text-[10px] font-bold bg-amber-700 text-white px-1.5 py-0.2 rounded font-mono">
                          {tag.karat}
                        </span>
                      </div>

                      {/* Item Title & Tag code */}
                      <div className="flex justify-between items-center text-xs my-0.5">
                        <span className="font-bold font-nastaliq text-zinc-900 truncate max-w-[110px]">
                          {tag.name}
                        </span>
                        <span className="font-mono text-[10px] font-black text-amber-800">
                          {tag.tagCode}
                        </span>
                      </div>

                      {/* Weight Breakdown */}
                      <div className="grid grid-cols-2 gap-1 text-[10px] bg-amber-100/50 p-1 rounded font-mono font-bold my-1 border border-amber-200/50">
                        <div>G.Wt: <span className="text-zinc-900">{tag.grossWeight}g</span></div>
                        <div className="text-right">N.Wt: <span className="text-amber-900">{tag.netWeight}g</span></div>
                      </div>

                      {/* Barcode Render */}
                      <div className="flex justify-center items-center my-0.5 overflow-hidden">
                        <svg className={`barcode-svg-${idx} max-w-[95%] h-[26px]`}></svg>
                      </div>

                      {/* Footer polish/date */}
                      {tag.making > 0 && (
                        <div className="text-[9px] text-zinc-500 font-mono text-center border-t border-dashed border-zinc-200 pt-0.5 mt-0.5">
                          Mk: Rs. {tag.making.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Mode 2: Showcase Ring/Bangle Barbell Foldable Tag */}
              {printMode === 'barbell' && currentTag && (
                <div className="flex flex-col items-center justify-center p-6 w-full">
                  <p className="text-xs text-zinc-400 mb-4 font-sans text-center no-print">
                    Foldable barbell tag: wrap around the jewelry piece and fold the two ends together.
                  </p>
                  <div className="flex items-center justify-center border-2 border-dashed border-amber-400 p-4 rounded-2xl bg-amber-50/20">
                    {/* Left Wing (Front side) */}
                    <div className="w-[125px] h-[75px] border border-amber-700 bg-white p-2 rounded-l-lg flex flex-col justify-between shadow-sm">
                      <div className="flex justify-between items-center text-[10px] font-bold border-b border-amber-200 pb-0.5">
                        <span className="font-sans text-amber-900 uppercase font-black">{APP_CONFIG.shopNameEnglish}</span>
                        <span className="bg-amber-600 text-white px-1 rounded text-[9px]">{currentTag.karat}</span>
                      </div>
                      <div className="text-xs font-bold font-nastaliq text-center truncate my-1">
                        {currentTag.name}
                      </div>
                      <div className="text-[9px] font-mono text-center font-bold bg-amber-50 p-0.5 rounded text-amber-950">
                        Wt: {currentTag.grossWeight}g | Net: {currentTag.netWeight}g
                      </div>
                    </div>

                    {/* Middle Bridge (for jewelry ring / silk thread) */}
                    <div className="w-[45px] h-[10px] bg-amber-200 border-y border-amber-400 flex items-center justify-center text-[7px] font-mono text-amber-800">
                      FOLD
                    </div>

                    {/* Right Wing (Back side: Barcode & Code) */}
                    <div className="w-[125px] h-[75px] border border-amber-700 bg-white p-1.5 rounded-r-lg flex flex-col items-center justify-between shadow-sm">
                      <span className="text-[9px] font-mono font-bold text-amber-800">{currentTag.tagCode}</span>
                      <svg className={`barcode-svg-${selectedTagIndex} w-[110px] h-[34px]`}></svg>
                      <span className="text-[8px] font-sans text-zinc-400">Guaranteed Pure Gold</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 3: Single Compact 50x25mm Sticker Tag */}
              {printMode === 'single' && currentTag && (
                <div className="flex flex-col items-center justify-center p-6 w-full">
                  <div className="w-[200px] border-2 border-amber-700 rounded-xl p-3 bg-white shadow-md flex flex-col justify-between">
                    <div className="flex justify-between items-center border-b border-amber-200 pb-1 mb-1">
                      <span className="text-xs font-black text-amber-900 font-sans tracking-tight">{APP_CONFIG.shopNameEnglish}</span>
                      <span className="text-[10px] font-bold bg-amber-700 text-white px-1.5 py-0.2 rounded font-mono">{currentTag.karat}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs my-1">
                      <span className="font-bold font-nastaliq text-zinc-900">{currentTag.name}</span>
                      <span className="font-mono text-xs font-bold text-amber-900">{currentTag.tagCode}</span>
                    </div>
                    <div className="text-[11px] font-mono font-bold bg-amber-50 p-1 rounded text-center my-1 text-zinc-900">
                      Wt: {currentTag.grossWeight}g (Net: {currentTag.netWeight}g)
                    </div>
                    <div className="flex justify-center my-1">
                      <svg className={`barcode-svg-${selectedTagIndex} w-[170px] h-[36px]`}></svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-zinc-500 font-nastaliq">
            {isUrdu 
              ? 'مجموعی ٹیگز: ' + tagItems.length + ' آئٹمز شوکیس ڈسپلے کیلئے تیار ہیں۔'
              : 'Ready to print ' + tagItems.length + ' showcase tags.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-zinc-700 hover:bg-slate-100 transition-colors text-xs sm:text-sm"
            >
              {isUrdu ? 'بند کریں' : 'Close'}
            </button>
            <button
              onClick={executePrint}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all flex items-center gap-2 text-xs sm:text-sm shadow-md"
            >
              <Printer size={16} />
              <span>{isUrdu ? 'پرنٹ بھیجیں' : 'Send to Printer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
