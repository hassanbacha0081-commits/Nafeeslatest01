import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Printer, Barcode, Tag, Layers, Sliders, Download, Plus, Trash2, Copy, Save, Archive } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { db, type StockItem, type PrintedTag } from '../db';
import { APP_CONFIG } from '../config';
import { Language, translations } from '../translations';
import { Capacitor } from '@capacitor/core';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { printElementDirectly } from '../lib/printUtils';
import { showToast } from '../lib/toast';
import { MultiSelectInput } from './MultiSelectInput';

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
  grossWeight: string;
  netWeight: string;
  making: string;
  copies: string;
  stockItemId?: number | null;
}

const createBlankTag = (id = Date.now()): TagItemConfig => ({
  id,
  name: '',
  tagCode: '',
  karat: '',
  grossWeight: '',
  netWeight: '',
  making: '',
  copies: '',
  stockItemId: null
});

export default function JewelryTagModal({
  isOpen,
  onClose,
  stockItems,
  initialSelectedId,
  lang = 'ur'
}: JewelryTagModalProps) {
  const isUrdu = lang === 'ur';
  const t = translations[lang];
  const itemNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const combined: string[] = [];
    [...(t.itemDetailsList || []), ...(stockItems || []).map(s => s.name || '')].forEach(opt => {
      const clean = opt.trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        combined.push(clean);
      }
    });
    return combined;
  }, [t.itemDetailsList, stockItems]);
  const [printMode, setPrintMode] = useState<'sheet' | 'barbell' | 'barcodeSheet' | 'single'>('sheet');
  const [singleSize, setSingleSize] = useState<'barcode' | 'ring'>('barcode');
  const [tagItems, setTagItems] = useState<TagItemConfig[]>([]);
  const [selectedTagIndex, setSelectedTagIndex] = useState<number>(0);
  const [batchCount, setBatchCount] = useState<string>('');
  const [showSavedTags, setShowSavedTags] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const savedTags = useLiveQuery(
    () => (db.printedTags ? db.printedTags.orderBy('id').reverse().toArray() : Promise.resolve([])),
    [isOpen]
  ) || [];
  const [tagLabels, setTagLabels] = useState<{ weight: string; polish: string; totalWeight: string; making: string }>(() => {
    try {
      const saved = localStorage.getItem('jewelryTagLabels');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          weight: parsed.weight || 'وزن',
          polish: parsed.polish || 'پالش',
          totalWeight: parsed.totalWeight || 'ٹوٹل ویٹ',
          making: parsed.making || 'مزدوری',
        };
      }
    } catch {}
    return { weight: 'وزن', polish: 'پالش', totalWeight: 'ٹوٹل ویٹ', making: 'مزدوری' };
  });
  const printSheetRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(false);

  const hasText = (val?: string) => Boolean(val && val.trim() !== '');
  const getNetWeight = (tag: TagItemConfig) => parseFloat(tag.netWeight) || 0;
  const getPolishWeight = (tag: TagItemConfig) => parseFloat(tag.grossWeight) || 0;
  const getTotalWeight = (tag: TagItemConfig) =>
    Number((getNetWeight(tag) + getPolishWeight(tag)).toFixed(3));
  const getMakingAmount = (tag: TagItemConfig) => parseFloat(tag.making) || 0;
  const getCopiesCount = (tag: TagItemConfig) => Math.max(1, Math.min(24, parseInt(tag.copies, 10) || 1));

  const updateTagLabel = (key: 'weight' | 'polish' | 'totalWeight' | 'making', value: string) => {
    setTagLabels(prev => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem('jewelryTagLabels', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Initialize tags ONLY when modal transitions from closed to open so stockItems updates don't wipe user inputs
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (!justOpened) return;

    setBatchCount('');

    if (initialSelectedId && stockItems && stockItems.length > 0) {
      const match = stockItems.find(s => s.id === initialSelectedId);
      if (match) {
        const wt = Number(match.quantity) || 0;
        setTagItems([
          {
            id: match.id || Date.now(),
            name: match.name || '',
            tagCode: '',
            karat: '',
            grossWeight: '',
            netWeight: wt > 0 ? String(Number(wt.toFixed(3))) : '',
            making: '',
            copies: '',
            stockItemId: match.id ?? null
          }
        ]);
        setSelectedTagIndex(0);
        return;
      }
    }

    setTagItems([createBlankTag()]);
    setSelectedTagIndex(0);
  }, [stockItems, initialSelectedId, isOpen]);

  const renderBarcodesNow = () => {
    const isBarbell = printMode === 'barbell' || (printMode === 'single' && singleSize === 'ring');
    const isBarcodeSticker =
      printMode === 'barcodeSheet' || (printMode === 'single' && singleSize === 'barcode');
    tagItems.forEach((tag, idx) => {
      const svgElements = document.querySelectorAll<SVGSVGElement>(`.barcode-svg-${idx}`);
      const code = tag.tagCode.trim();
      svgElements.forEach(el => {
        if (!code) {
          el.innerHTML = '';
          el.removeAttribute('width');
          el.removeAttribute('height');
          return;
        }
        try {
          JsBarcode(el, code, {
            format: 'CODE128',
            width: isBarcodeSticker ? 1.5 : isBarbell ? 1.25 : 1.5,
            height: isBarcodeSticker ? 24 : isBarbell ? 24 : 32,
            displayValue: !isBarbell && !isBarcodeSticker,
            fontSize: 9.5,
            font: "'Inter', monospace",
            margin: isBarcodeSticker ? 6 : isBarbell ? 5 : 8,
            background: '#ffffff',
            lineColor: '#000000'
          });
          el.setAttribute('shape-rendering', 'crispEdges');
        } catch (e) {
          console.error('JsBarcode rendering error:', e);
        }
      });
    });
  };

  // Render Barcodes whenever tagItems, mode, or selected tag changes
  useEffect(() => {
    if (!isOpen || tagItems.length === 0) return;
    renderBarcodesNow();
    const timer = setTimeout(renderBarcodesNow, 80);
    return () => clearTimeout(timer);
  }, [tagItems, isOpen, printMode, singleSize, selectedTagIndex]);

  const generateTagsPdf = async (): Promise<string | null> => {
    if (!printSheetRef.current) return null;
    setIsGeneratingPdf(true);
    try {
      renderBarcodesNow();
      const canvas = await html2canvas(printSheetRef.current, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => el.classList?.contains('no-print') ?? false,
      });
      const isSingle = printMode === 'single';
      const pdfWidth = isSingle ? (singleSize === 'ring' ? 60 : 38.1) : 148;
      const pageHeight = isSingle ? (singleSize === 'ring' ? 12 : 12.7) : 210;
      const totalImgHeight = (canvas.height / canvas.width) * pdfWidth;

      const pdf = new jsPDF({
        orientation: pdfWidth > pageHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pageHeight]
      });

      if (isSingle || totalImgHeight <= pageHeight) {
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pageHeight, totalImgHeight));
      } else {
        // Multi-page A5 slicing
        const pageCanvasHeight = Math.floor((pageHeight / pdfWidth) * canvas.width);
        let yOffset = 0;
        let pageIndex = 0;
        while (yOffset < canvas.height) {
          const sliceHeight = Math.min(pageCanvasHeight, canvas.height - yOffset);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          }
          if (pageIndex > 0) {
            pdf.addPage([pdfWidth, pageHeight], 'portrait');
          }
          const sliceImgHeight = (sliceHeight / canvas.width) * pdfWidth;
          pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfWidth, sliceImgHeight);
          yOffset += sliceHeight;
          pageIndex++;
        }
      }

      return pdf.output('datauristring');
    } catch (error) {
      console.error('Tag PDF generation failed:', error);
      return null;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const saveTagsToRegistry = async (showFeedback = false): Promise<number> => {
    if (!db.printedTags) return 0;
    const tagsWithCode = tagItems.filter(t => t.tagCode.trim() !== '');
    if (tagsWithCode.length === 0) {
      if (showFeedback) {
        showToast(
          isUrdu
            ? 'محفوظ کرنے کے لیے کم از کم ایک ٹیگ بارکوڈ کوڈ درج کریں'
            : 'Enter at least one Tag Code to save for billing scan',
          'warning'
        );
      }
      return 0;
    }

    let savedCount = 0;
    try {
      const existingAll = await db.printedTags.toArray();
      for (const item of tagsWithCode) {
        const cleanCode = item.tagCode.trim().toUpperCase();
        const netWt = getNetWeight(item);
        const polWt = getPolishWeight(item);
        const totWt = getTotalWeight(item);
        const mk = getMakingAmount(item);
        const existing = existingAll.find(
          e => e.tagCode.trim().toUpperCase() === cleanCode
        );

        const payload: PrintedTag = {
          ...(existing?.id ? { id: existing.id } : {}),
          tagCode: cleanCode,
          name: item.name.trim() || cleanCode,
          karat: item.karat || '',
          netWeight: netWt,
          polish: polWt,
          totalWeight: totWt,
          making: mk,
          stockItemId: item.stockItemId ?? existing?.stockItemId ?? null,
          status: 'available',
          createdAt: existing?.createdAt || new Date().toISOString(),
          soldAt: undefined,
          saleId: undefined,
        };

        if (existing?.id) {
          await db.printedTags.put(payload);
        } else {
          await db.printedTags.add(payload);
        }
        savedCount++;
      }

      if (showFeedback && savedCount > 0) {
        showToast(
          isUrdu
            ? `✓ ${savedCount} ٹیگز بلنگ اسکین کے لیے محفوظ ہو گئے`
            : `✓ Saved ${savedCount} tag(s) for instant billing scan`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to save printed tags:', err);
    }
    return savedCount;
  };

  const handleLoadSavedTag = (saved: PrintedTag) => {
    const nextConfig: TagItemConfig = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: saved.name || '',
      tagCode: saved.tagCode || '',
      karat: saved.karat || '',
      netWeight: saved.netWeight > 0 ? String(saved.netWeight) : '',
      grossWeight: saved.polish > 0 ? String(saved.polish) : '',
      making: saved.making > 0 ? String(saved.making) : '',
      copies: '',
      stockItemId: saved.stockItemId ?? null,
    };
    setTagItems(prev => {
      const onlyBlank =
        prev.length === 1 &&
        !prev[0].name.trim() &&
        !prev[0].tagCode.trim() &&
        !prev[0].netWeight.trim() &&
        !prev[0].grossWeight.trim();
      if (onlyBlank) {
        setSelectedTagIndex(0);
        return [nextConfig];
      }
      const next = [...prev, nextConfig];
      setSelectedTagIndex(next.length - 1);
      return next;
    });
  };

  const handleDeleteSavedTag = async (id?: number) => {
    if (!id || !db.printedTags) return;
    await db.printedTags.delete(id);
  };

  const executePrint = () => {
    if (!printSheetRef.current) return;
    renderBarcodesNow();
    void saveTagsToRegistry(false);

    if (Capacitor.isNativePlatform()) {
      void (async () => {
        try {
          const pdfDataUrl = await generateTagsPdf();
          if (pdfDataUrl) {
            const base64 = pdfDataUrl.split(',')[1];
            await CapPrinter.printBase64({
              name: `Jewelry_Tags_${Date.now()}`,
              data: base64,
              mimeType: 'application/pdf'
            });
            return;
          }
        } catch (err) {
          console.warn('Native printer failed, fallback to web print:', err);
        }
        await printElementDirectly(printSheetRef.current, {
          documentTitle: `Jewelry_Tags_NafeesJewellers_${Date.now()}`,
        });
      })();
      return;
    }

    void printElementDirectly(printSheetRef.current, {
      documentTitle: `Jewelry_Tags_NafeesJewellers_${Date.now()}`,
    });
  };

  const handleDownloadPdf = async () => {
    void saveTagsToRegistry(false);
    const pdfDataUrl = await generateTagsPdf();
    if (!pdfDataUrl) {
      showToast(isUrdu ? 'PDF بنانے میں خرابی پیش آئی' : 'Failed to generate PDF', 'error');
      return;
    }

    const fileName = `Jewelry_Tags_${Date.now()}.pdf`;
    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = pdfDataUrl.split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Jewelry Barcode Tags',
          url: savedFile.uri,
        });
      } catch (e) {
        console.error('Error sharing PDF:', e);
        showToast(isUrdu ? 'فائل شیئر کرنے میں خرابی پیش آئی' : 'Error sharing file', 'error');
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfDataUrl;
      link.download = fileName;
      link.click();
    }
  };

  const handleAddCustomTag = () => {
    const newTag = createBlankTag(Date.now() + tagItems.length + 1);
    setTagItems(prev => {
      const next = [...prev, newTag];
      setSelectedTagIndex(next.length - 1);
      return next;
    });
  };

  const handleGenerateSeparateTags = () => {
    const parsed = parseInt(batchCount, 10);
    if (!parsed || parsed < 1) {
      showToast(isUrdu ? 'براہ کرم ٹیگز کی تعداد درج کریں' : 'Please enter number of tags', 'error');
      return;
    }
    const count = Math.max(1, Math.min(36, parsed));
    const base = tagItems[selectedTagIndex] || tagItems[0] || createBlankTag();
    const cleanBaseName = base.name.replace(/\s*#\d+$/, '').trim();
    const cleanBaseCode = base.tagCode.replace(/-\d+$/, '').trim();
    const replaceSingle = tagItems.length === 1;
    const startIdx = replaceSingle ? 1 : tagItems.length + 1;

    const generated: TagItemConfig[] = Array.from({ length: count }, (_, i) => {
      const num = startIdx + i;
      return {
        ...base,
        id: Date.now() + i + Math.floor(Math.random() * 1000),
        name: cleanBaseName ? `${cleanBaseName} #${num}` : '',
        tagCode: cleanBaseCode ? `${cleanBaseCode}-${String(num).padStart(2, '0')}` : '',
        copies: '',
      };
    });

    if (replaceSingle) {
      setTagItems(generated);
      setSelectedTagIndex(0);
    } else {
      setTagItems(prev => [...prev, ...generated]);
    }
  };

  const handleLoadAllStock = () => {
    if (!stockItems || stockItems.length === 0) return;
    const configs: TagItemConfig[] = stockItems.map((item, idx) => {
      const paddedId = String(item.id || idx + 1).padStart(4, '0');
      const wt = Number(item.quantity) || 0;
      return {
        id: item.id || idx + 1,
        name: item.name || '',
        tagCode: `NJ-${paddedId}`,
        karat: '',
        grossWeight: '',
        netWeight: wt > 0 ? String(Number(wt.toFixed(3))) : '',
        making: '',
        copies: '',
        stockItemId: item.id ?? null
      };
    });
    setTagItems(configs);
    setSelectedTagIndex(0);
  };

  const handleRemoveTag = (idxToRemove: number) => {
    if (tagItems.length <= 1) return;
    setTagItems(prev => prev.filter((_, idx) => idx !== idxToRemove));
    setSelectedTagIndex(prev => (prev >= idxToRemove ? Math.max(0, prev - 1) : prev));
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
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X size={22} />
          </button>
        </div>

        {/* Toolbar & Controls */}
        <div className="p-4 bg-amber-50/60 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          {/* Format selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200 shadow-sm">
            <button
              type="button"
              onClick={() => setPrintMode('sheet')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'sheet'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Layers size={15} />
              <span>{isUrdu ? 'A5 اسٹیکر شیٹ (Grid)' : 'A5 Tag Sheet'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('barbell')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'barbell'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Tag size={15} />
              <span>{isUrdu ? 'A5 فولڈنگ رنگ ٹیگ (6×1.2 cm)' : 'Folded Ring Tag (6×1.2 cm)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('barcodeSheet')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'barcodeSheet'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Barcode size={15} />
              <span>{isUrdu ? 'A5 بارکوڈ ٹیگز (1.5×0.5 in)' : 'A5 Barcode Tags (1.5×0.5 in)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('single')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                printMode === 'single'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Barcode size={15} />
              <span>
                {isUrdu
                  ? `سنگل لیبل (${singleSize === 'ring' ? '6×1.2 cm' : '1.5×0.5 in'})`
                  : `Single Label (${singleSize === 'ring' ? '6×1.2 cm' : '1.5×0.5 in'})`}
              </span>
            </button>
          </div>

          {/* Print, Save & PDF Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveTagsToRegistry(true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              title={isUrdu ? 'بلنگ اسکیننگ کے لیے ٹیگز محفوظ کریں' : 'Save tags for billing scanner'}
            >
              <Save size={16} />
              <span>{isUrdu ? 'محفوظ کریں' : 'Save Tags'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Download size={17} />
              <span>{isUrdu ? 'PDF محفوظ کریں' : 'Save PDF'}</span>
            </button>
            <button
              type="button"
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
            
            {/* Tag Selection, Batch Generator & Add Custom */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-zinc-600">
                  {isUrdu ? `آئٹمز (${tagItems.length}):` : `Tags (${tagItems.length}):`}
                </span>
                <div className="flex items-center gap-1.5">
                  {stockItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleLoadAllStock}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg border border-sky-200 transition-colors"
                    >
                      {isUrdu ? 'تمام اسٹاک' : 'All Stock'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1 transition-colors"
                  >
                    <Plus size={13} />
                    <span>{isUrdu ? 'نیا ٹیگ' : 'Add Tag'}</span>
                  </button>
                </div>
              </div>

              {/* Quick Separate Tag Generator (e.g. 12 separate rings on one A5 sheet) */}
              <div className="flex items-center gap-1.5 bg-amber-50/70 p-2 rounded-xl border border-amber-200/80">
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={batchCount}
                  placeholder={isUrdu ? 'تعداد' : 'Qty'}
                  onChange={e => setBatchCount(e.target.value)}
                  className="w-16 text-xs font-mono font-bold p-1.5 bg-white border border-amber-300 rounded-lg text-center outline-none"
                  title={isUrdu ? 'الگ الگ ٹیگز کی تعداد' : 'Number of separate tags'}
                />
                <button
                  type="button"
                  onClick={handleGenerateSeparateTags}
                  className="flex-1 text-xs font-bold text-amber-900 hover:text-white bg-amber-200/80 hover:bg-amber-600 px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 font-urdu"
                  title={isUrdu ? 'منتخب آئٹم سے الگ الگ نمبر اور وزن والے کئی ٹیگز بنائیں' : 'Create separate editable tags'}
                >
                  <Copy size={13} />
                  <span>{isUrdu ? 'الگ الگ ٹیگز بنائیں' : 'Create Separate Tags'}</span>
                </button>
              </div>

              {tagItems.length > 1 && (
                <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin pt-1">
                  {tagItems.map((tag, idx) => (
                    <div
                      key={tag.id}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex justify-between items-center gap-1.5 transition-all ${
                        selectedTagIndex === idx 
                          ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300' 
                          : 'hover:bg-slate-100 text-zinc-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedTagIndex(idx)}
                        className="flex-1 flex justify-between items-center text-right min-w-0"
                      >
                        <span className="truncate max-w-[130px] font-urdu">
                          {tag.name || (isUrdu ? `ٹیگ #${idx + 1}` : `Tag #${idx + 1}`)}
                        </span>
                        <span className="font-mono text-zinc-500 text-[10px] shrink-0">
                          {tag.tagCode || '—'}{getTotalWeight(tag) > 0 ? ` (${getTotalWeight(tag)}g)` : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(idx)}
                        className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors shrink-0"
                        title={isUrdu ? 'ہٹائیں' : 'Remove'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved Tags Registry Toggle */}
              {savedTags.length > 0 && (
                <div className="pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSavedTags(prev => !prev)}
                    className="w-full flex items-center justify-between text-[11px] font-bold text-amber-900 bg-amber-50/70 hover:bg-amber-100/70 px-2.5 py-1.5 rounded-xl border border-amber-200/70 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-urdu">
                      <Archive size={13} />
                      {isUrdu ? `محفوظ شدہ ٹیگز (${savedTags.length})` : `Saved Tags (${savedTags.length})`}
                    </span>
                    <span className="text-[10px] font-mono text-amber-700">
                      {showSavedTags ? '▲' : '▼'}
                    </span>
                  </button>

                  {showSavedTags && (
                    <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1 pr-0.5">
                      {savedTags.map(st => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px]"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadSavedTag(st)}
                            className="flex-1 flex items-center justify-between gap-1.5 text-right min-w-0 hover:text-amber-800"
                          >
                            <span className="font-mono font-bold text-amber-900 shrink-0">{st.tagCode}</span>
                            <span className="font-urdu truncate text-zinc-700">{st.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                st.status === 'sold'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {st.status === 'sold' ? (isUrdu ? 'فروخت' : 'Sold') : (isUrdu ? 'موجود' : 'Active')}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteSavedTag(st.id)}
                            className="p-1 text-zinc-400 hover:text-red-600 rounded shrink-0"
                            title={isUrdu ? 'حذف کریں' : 'Delete'}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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
                  <MultiSelectInput
                    options={itemNameOptions}
                    value={currentTag.name}
                    onChange={val => updateSelectedTag('name', val)}
                    lang={lang}
                    placeholder={isUrdu ? 'آئٹم کا نام منتخب کریں یا لکھیں...' : 'Select or type item name...'}
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
                      placeholder={isUrdu ? 'کوڈ درج کریں' : 'Enter code'}
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
                      <option value="">{isUrdu ? '-- منتخب کریں --' : '-- Select --'}</option>
                      <option value="24K">24K (خالص پانسہ)</option>
                      <option value="22K">22K (معیاری زیور)</option>
                      <option value="21K">21K (دبئی و سنگاپور)</option>
                      <option value="18K">18K (ڈائمنڈ و اطالوی)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block font-urdu">
                      {tagLabels.weight || 'وزن'} (g):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={currentTag.netWeight}
                      placeholder="0.000"
                      onChange={e => updateSelectedTag('netWeight', e.target.value)}
                      className="w-full text-sm font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block font-urdu">
                      {tagLabels.polish || 'پالش'} (g):
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={currentTag.grossWeight}
                      placeholder="0.000"
                      onChange={e => updateSelectedTag('grossWeight', e.target.value)}
                      className="w-full text-sm font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                {/* Auto-calculated Total Weight (وزن + پالش) */}
                <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-950" dir="rtl">
                  <span className="font-urdu">
                    {tagLabels.totalWeight || 'ٹوٹل ویٹ'} ({tagLabels.weight || 'وزن'} + {tagLabels.polish || 'پالش'}):
                  </span>
                  <span className="font-mono text-sm font-black text-amber-900" dir="ltr">
                    {(hasText(currentTag.netWeight) || hasText(currentTag.grossWeight)) ? `${getTotalWeight(currentTag)} g` : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block font-urdu">
                      {tagLabels.making || 'مزدوری'}:
                    </label>
                    <input
                      type="number"
                      value={currentTag.making}
                      placeholder="0"
                      onChange={e => updateSelectedTag('making', e.target.value)}
                      className="w-full text-sm font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-600 mb-1 block">
                      {isUrdu ? 'تعداد (Copies):' : 'Copies:'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={currentTag.copies}
                      placeholder="1"
                      onChange={e => updateSelectedTag('copies', e.target.value)}
                      className="w-full text-sm font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                {/* Editable Tag Labels */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-amber-800 font-urdu">
                      {isUrdu ? 'ٹیگ کے لیبلز تبدیل کریں:' : 'Customize Tag Labels:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = { weight: 'وزن', polish: 'پالش', totalWeight: 'ٹوٹل ویٹ', making: 'مزدوری' };
                        setTagLabels(defaults);
                        try {
                          localStorage.setItem('jewelryTagLabels', JSON.stringify(defaults));
                        } catch {}
                      }}
                      className="text-[10px] text-zinc-500 hover:text-amber-700 underline"
                    >
                      {isUrdu ? 'ڈیفالٹ' : 'Reset'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={tagLabels.weight}
                      onChange={e => updateTagLabel('weight', e.target.value)}
                      placeholder="وزن"
                      className="w-full text-xs font-urdu font-bold p-1.5 bg-amber-50/50 border border-amber-200 rounded-lg focus:border-amber-500 outline-none text-center"
                      title={isUrdu ? 'وزن کا لیبل' : 'Weight Label'}
                    />
                    <input
                      type="text"
                      value={tagLabels.polish}
                      onChange={e => updateTagLabel('polish', e.target.value)}
                      placeholder="پالش"
                      className="w-full text-xs font-urdu font-bold p-1.5 bg-amber-50/50 border border-amber-200 rounded-lg focus:border-amber-500 outline-none text-center"
                      title={isUrdu ? 'پالش کا لیبل' : 'Polish Label'}
                    />
                    <input
                      type="text"
                      value={tagLabels.totalWeight}
                      onChange={e => updateTagLabel('totalWeight', e.target.value)}
                      placeholder="ٹوٹل ویٹ"
                      className="w-full text-xs font-urdu font-bold p-1.5 bg-amber-50/50 border border-amber-200 rounded-lg focus:border-amber-500 outline-none text-center"
                      title={isUrdu ? 'ٹوٹل ویٹ کا لیبل' : 'Total Weight Label'}
                    />
                    <input
                      type="text"
                      value={tagLabels.making}
                      onChange={e => updateTagLabel('making', e.target.value)}
                      placeholder="مزدوری"
                      className="w-full text-xs font-urdu font-bold p-1.5 bg-amber-50/50 border border-amber-200 rounded-lg focus:border-amber-500 outline-none text-center"
                      title={isUrdu ? 'مزدوری کا لیبل' : 'Making Label'}
                    />
                  </div>
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
          <div className="lg:col-span-8 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-stretch min-h-[400px]">
            <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-4 text-xs font-bold text-zinc-500 border-b pb-2">
              <span>{isUrdu ? 'پرنٹ پریویو (Live Preview)' : 'Live Tag Preview'}</span>
              <div className="flex items-center gap-2">
                {printMode === 'single' && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSingleSize('ring')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                        singleSize === 'ring' ? 'bg-amber-600 text-white' : 'text-zinc-600 hover:text-amber-800'
                      }`}
                    >
                      {isUrdu ? 'رنگ ٹیگ (6×1.2 cm)' : 'Ring Tag (6×1.2 cm)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleSize('barcode')}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                        singleSize === 'barcode' ? 'bg-amber-600 text-white' : 'text-zinc-600 hover:text-amber-800'
                      }`}
                    >
                      {isUrdu ? 'بارکوڈ (1.5×0.5 in)' : 'Barcode (1.5×0.5 in)'}
                    </button>
                  </div>
                )}
                <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  {printMode === 'sheet'
                    ? 'A5 Sticker Grid (148×210mm)'
                    : printMode === 'barbell'
                    ? 'A5 Folded Ring Tags (6×1.2 cm)'
                    : printMode === 'barcodeSheet'
                    ? 'A5 Barcode Tags (1.5×0.5 in)'
                    : singleSize === 'ring'
                    ? 'Single Folded Ring Tag (6×1.2 cm)'
                    : 'Single Barcode Tag (1.5×0.5 in)'}
                </span>
              </div>
            </div>

            {/* Scrollable Preview Frame so A5 width never squishes on smaller screens */}
            <div className="w-full overflow-x-auto pb-2 flex justify-center">
              {/* Printable Container */}
              <div
                ref={printSheetRef}
                className={`print-tags-wrapper bg-white text-black ${
                  printMode === 'single'
                    ? singleSize === 'ring'
                      ? 'print-single-tag inline-block w-[6cm] h-[1.2cm] mx-auto'
                      : 'print-single-tag inline-block w-[1.5in] h-[0.5in] mx-auto'
                    : 'print-a5-tags w-[545px] mx-auto p-2.5 border border-dashed border-amber-300/70 rounded-xl print:border-none print:w-full print:max-w-none print:p-0'
                }`}
              >
              <style>{`
                @media print {
                  @page {
                    size: ${
                      printMode === 'single'
                        ? singleSize === 'ring'
                          ? '60mm 12mm'
                          : '1.5in 0.5in'
                        : '148mm 210mm'
                    };
                    margin: ${printMode === 'single' ? '0' : '4mm'};
                  }
                }
              `}</style>

              {/* Mode 1: A5 Grid Sheet (3 columns across full A5 width) */}
              {printMode === 'sheet' && (
                <div className="grid grid-cols-3 gap-2 w-full">
                  {tagItems.flatMap((tag, idx) =>
                    Array.from({ length: getCopiesCount(tag) }, (_, copyIdx) => (
                      <div
                        key={`${tag.id}-${idx}-${copyIdx}`}
                        className="tag-card-print border border-amber-700/70 rounded-lg p-1.5 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 relative flex flex-col justify-between"
                      >
                        {/* Top Shop Banner */}
                        <div className="flex justify-between items-center border-b border-amber-600/30 pb-0.5 mb-0.5 gap-1">
                          <span className="text-[9.5px] font-black text-amber-900 font-sans tracking-tight uppercase truncate">
                            {APP_CONFIG.shopNameEnglish}
                          </span>
                          {tag.karat && (
                            <span className="text-[8.5px] font-bold bg-amber-700 text-white px-1 rounded font-mono shrink-0">
                              {tag.karat}
                            </span>
                          )}
                        </div>

                        {/* Item Title & Tag code */}
                        <div className="flex justify-between items-center text-[10.5px] my-0.5 gap-1 min-h-[16px]">
                          <span className="font-bold font-urdu text-zinc-900 truncate">
                            {tag.name}
                          </span>
                          <span className="font-mono text-[8.5px] font-black text-amber-800 shrink-0">
                            {tag.tagCode}
                          </span>
                        </div>

                        {/* Weight, Polish & Total Weight Breakdown (stacked full-width rows so numbers never truncate) */}
                        <div className="tag-metrics-box bg-amber-100/50 px-1.5 py-1 rounded font-bold my-0.5 border border-amber-200/60 space-y-0.5 text-[9.5px] leading-tight" dir="rtl">
                          <div className="tag-metric-row flex items-center justify-between gap-1">
                            <span className="font-urdu text-amber-900 shrink-0">{tagLabels.weight || 'وزن'}:</span>
                            <span className="tag-metric-value font-mono font-bold text-zinc-900 whitespace-nowrap shrink-0" dir="ltr">
                              {hasText(tag.netWeight) ? `${tag.netWeight.trim()}g` : ''}
                            </span>
                          </div>
                          <div className="tag-metric-row flex items-center justify-between gap-1">
                            <span className="font-urdu text-zinc-700 shrink-0">{tagLabels.polish || 'پالش'}:</span>
                            <span className="tag-metric-value font-mono font-bold text-zinc-900 whitespace-nowrap shrink-0" dir="ltr">
                              {hasText(tag.grossWeight) ? `${tag.grossWeight.trim()}g` : ''}
                            </span>
                          </div>
                          <div className="tag-metric-row border-t border-amber-300/60 pt-0.5 flex items-center justify-between gap-1 text-[9.5px] text-amber-950">
                            <span className="font-urdu font-black shrink-0">{tagLabels.totalWeight || 'ٹوٹل ویٹ'}:</span>
                            <span className="tag-metric-value font-mono font-black whitespace-nowrap shrink-0" dir="ltr">
                              {(hasText(tag.netWeight) || hasText(tag.grossWeight)) ? `${getTotalWeight(tag)}g` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Barcode Render */}
                        <div className="flex justify-center items-center my-0.5 overflow-hidden min-h-[22px]" dir="ltr">
                          <svg className={`barcode-svg-${idx} w-full max-w-full h-auto max-h-[28px]`}></svg>
                        </div>

                        {/* Footer Mazdori */}
                        {getMakingAmount(tag) > 0 && (
                          <div className="text-[9px] text-zinc-700 font-bold text-center border-t border-dashed border-zinc-200 pt-0.5 mt-0.5 flex items-center justify-center gap-1" dir="rtl">
                            <span className="font-urdu">{tagLabels.making || 'مزدوری'}:</span>
                            <span className="font-mono" dir="ltr">Rs. {getMakingAmount(tag).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Mode 2: A5 Standard Folded Ring Tags (Exact 6cm width x 1.2cm height, 2 across per A5 row) */}
              {printMode === 'barbell' && (
                <div className="w-full">
                  <p className="text-[11px] text-zinc-500 mb-2 font-urdu text-center no-print">
                    {isUrdu
                      ? 'اسٹینڈرڈ فولڈنگ رنگ ٹیگز (6 سینٹی میٹر × 1.2 سینٹی میٹر): ہر ٹیگ کو کاٹ کر درمیان سے انگوٹھی پر موڑیں۔'
                      : 'Standard Folded Ring Tags (6 cm × 1.2 cm): cut along dashed lines and fold in half around ring band.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 print:gap-1 justify-start w-full">
                    {tagItems.flatMap((tag, idx) =>
                      Array.from({ length: getCopiesCount(tag) }, (_, copyIdx) => (
                        <div
                          key={`${tag.id}-${idx}-${copyIdx}`}
                          className="tag-card-print barbell-ring-tag w-[6cm] h-[1.2cm] shrink-0 flex items-stretch justify-between border border-dashed border-amber-500 p-[1.5px] rounded-[3px] bg-white overflow-hidden"
                        >
                          {/* Left Wing (Front side: Name, Karat, Weight, Polish, Total) */}
                          <div className="w-[2.6cm] shrink-0 border border-amber-700 bg-white px-1 py-[1px] rounded-l-[2px] flex flex-col justify-between overflow-hidden">
                            <div className="flex items-center justify-between gap-0.5 leading-none min-h-[10px]">
                              <span className="font-bold font-urdu text-[7.5px] text-zinc-900 truncate leading-none">
                                {tag.name}
                              </span>
                              {tag.karat && (
                                <span className="bg-amber-700 text-white px-0.5 rounded text-[5.5px] font-mono font-bold shrink-0 leading-tight">
                                  {tag.karat}
                                </span>
                              )}
                            </div>

                            <div
                              className="tag-metrics-box flex-1 min-h-0 flex flex-col justify-center bg-amber-50/80 px-1 py-[1px] rounded-[2px] border border-amber-200/70 space-y-[1px]"
                              dir="rtl"
                            >
                              <div className="tag-metric-row flex items-center justify-between gap-0.5 leading-none">
                                <span className="font-urdu text-[6px] text-amber-900 shrink-0 leading-none">
                                  {tagLabels.weight || 'وزن'}:
                                </span>
                                <span className="tag-metric-value font-mono font-bold text-[6.5px] text-zinc-900 whitespace-nowrap shrink-0 leading-none" dir="ltr">
                                  {hasText(tag.netWeight) ? `${tag.netWeight.trim()}g` : ''}
                                </span>
                              </div>
                              <div className="tag-metric-row flex items-center justify-between gap-0.5 leading-none">
                                <span className="font-urdu text-[6px] text-zinc-700 shrink-0 leading-none">
                                  {tagLabels.polish || 'پالش'}:
                                </span>
                                <span className="tag-metric-value font-mono font-bold text-[6.5px] text-zinc-900 whitespace-nowrap shrink-0 leading-none" dir="ltr">
                                  {hasText(tag.grossWeight) ? `${tag.grossWeight.trim()}g` : ''}
                                </span>
                              </div>
                              <div className="tag-metric-row border-t border-amber-200/80 pt-[1px] flex items-center justify-between gap-0.5 leading-none">
                                <span className="font-urdu font-black text-[6px] text-amber-950 shrink-0 leading-none">
                                  {tagLabels.totalWeight || 'ٹوٹل ویٹ'}:
                                </span>
                                <span className="tag-metric-value font-mono font-black text-[6.5px] text-amber-950 whitespace-nowrap shrink-0 leading-none" dir="ltr">
                                  {(hasText(tag.netWeight) || hasText(tag.grossWeight)) ? `${getTotalWeight(tag)}g` : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Center Fold Neck */}
                          <div className="w-[0.65cm] shrink-0 flex items-center justify-center px-[1px]">
                            <div className="w-full h-full bg-amber-100/80 border-x border-dashed border-amber-500 flex items-center justify-center">
                              <span className="text-[4.5px] font-mono font-bold text-amber-900 tracking-widest leading-none [writing-mode:vertical-rl]">
                                FOLD
                              </span>
                            </div>
                          </div>

                          {/* Right Wing (Back side: Tag Code, Barcode & Optional Making) */}
                          <div className="w-[2.6cm] shrink-0 border border-amber-700 bg-white px-1 py-[1px] rounded-r-[2px] flex flex-col justify-between items-center overflow-hidden">
                            <div className="w-full flex items-center justify-between gap-0.5 leading-none min-h-[9px]">
                              <span className="text-[6.5px] font-mono font-black text-black truncate leading-none" dir="ltr">
                                {tag.tagCode}
                              </span>
                              {getMakingAmount(tag) > 0 && (
                                <span className="text-[5.5px] font-mono font-bold text-zinc-700 shrink-0 leading-none" dir="ltr">
                                  Rs.{getMakingAmount(tag).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="w-full flex-1 bg-white flex items-center justify-center overflow-hidden min-h-[24px]" dir="ltr">
                              <svg className={`barcode-svg-${idx} w-full max-w-full h-[24px] block`}></svg>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Mode 3: A5 Barcode Sticker Sheet (Exact 1.5in width x 0.5in length per tag, 3 across on A5) */}
              {printMode === 'barcodeSheet' && (
                <div className="w-full">
                  <p className="text-[11px] text-zinc-500 mb-2 font-urdu text-center no-print">
                    {isUrdu
                      ? 'A5 بارکوڈ اسٹیکرز (چوڑائی 1.5 انچ × لمبائی 0.5 انچ): واضح اسکین ایبل بارکوڈ کے ساتھ A5 پیج پر پرنٹ کریں۔'
                      : 'A5 Barcode Stickers (1.5" W × 0.5" L): high-contrast scannable barcode labels arranged across A5.'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 print:gap-1 justify-start w-full">
                    {tagItems.flatMap((tag, idx) =>
                      Array.from({ length: getCopiesCount(tag) }, (_, copyIdx) => (
                        <div
                          key={`${tag.id}-${idx}-${copyIdx}`}
                          className="tag-card-print barcode-sticker-tag w-[1.5in] h-[0.5in] shrink-0 border border-amber-700/80 rounded-[3px] bg-white px-1 py-[1px] flex flex-col justify-between overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-1 leading-none min-h-[9px]">
                            <div className="flex items-center gap-0.5 min-w-0">
                              <span className="font-bold font-urdu text-[7.5px] text-zinc-900 truncate leading-none">
                                {tag.name}
                              </span>
                              {tag.karat && (
                                <span className="text-[5.5px] font-mono font-bold bg-amber-700 text-white px-0.5 rounded shrink-0 leading-tight">
                                  {tag.karat}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[6.5px] font-black text-black shrink-0 leading-none" dir="ltr">
                              {tag.tagCode}
                            </span>
                          </div>

                          <div
                            className="flex items-center justify-between gap-1 text-[5.5px] font-bold text-zinc-900 bg-amber-50/70 px-1 rounded-[2px] leading-none min-h-[8px]"
                            dir="rtl"
                          >
                            <span className="whitespace-nowrap shrink-0">
                              <span className="font-urdu text-amber-900">{tagLabels.weight || 'وزن'}:</span>
                              <span className="font-mono" dir="ltr">
                                {hasText(tag.netWeight) ? `${tag.netWeight.trim()}g` : ''}
                              </span>
                            </span>
                            <span className="whitespace-nowrap shrink-0">
                              <span className="font-urdu text-zinc-700">{tagLabels.polish || 'پالش'}:</span>
                              <span className="font-mono" dir="ltr">
                                {hasText(tag.grossWeight) ? `${tag.grossWeight.trim()}g` : ''}
                              </span>
                            </span>
                            <span className="whitespace-nowrap shrink-0 font-black text-amber-950">
                              <span className="font-urdu">{isUrdu ? 'ٹوٹل' : 'Tot'}:</span>
                              <span className="font-mono" dir="ltr">
                                {(hasText(tag.netWeight) || hasText(tag.grossWeight)) ? `${getTotalWeight(tag)}g` : ''}
                              </span>
                            </span>
                          </div>

                          <div className="w-full bg-white flex items-center justify-center overflow-hidden h-[25px]" dir="ltr">
                            <svg className={`barcode-svg-${idx} w-full max-w-full h-[24px] block`}></svg>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Mode 4: Single Tag (Supports 6cm x 1.2cm Folded Ring Tag or 1.5in x 0.5in Barcode Tag) */}
              {printMode === 'single' && currentTag && (
                singleSize === 'ring' ? (
                  <div className="tag-card-print barbell-ring-tag w-[6cm] h-[1.2cm] flex items-stretch justify-between border border-dashed border-amber-500 p-[1.5px] rounded-[3px] bg-white overflow-hidden shadow-sm print:shadow-none">
                    <div className="w-[2.6cm] shrink-0 border border-amber-700 bg-white px-1 py-[1px] rounded-l-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="flex items-center justify-between gap-0.5 leading-none min-h-[10px]">
                        <span className="font-bold font-urdu text-[7.5px] text-zinc-900 truncate leading-none">
                          {currentTag.name}
                        </span>
                        {currentTag.karat && (
                          <span className="bg-amber-700 text-white px-0.5 rounded text-[5.5px] font-mono font-bold shrink-0 leading-tight">
                            {currentTag.karat}
                          </span>
                        )}
                      </div>

                      <div
                        className="tag-metrics-box flex-1 min-h-0 flex flex-col justify-center bg-amber-50/80 px-1 py-[1px] rounded-[2px] border border-amber-200/70 space-y-[1px]"
                        dir="rtl"
                      >
                        <div className="tag-metric-row flex items-center justify-between gap-0.5 leading-none">
                          <span className="font-urdu text-[6px] text-amber-900 shrink-0 leading-none">
                            {tagLabels.weight || 'وزن'}:
                          </span>
                          <span className="tag-metric-value font-mono font-bold text-[6.5px] text-zinc-900 whitespace-nowrap shrink-0 leading-none" dir="ltr">
                            {hasText(currentTag.netWeight) ? `${currentTag.netWeight.trim()}g` : ''}
                          </span>
                        </div>
                        <div className="tag-metric-row flex items-center justify-between gap-0.5 leading-none">
                          <span className="font-urdu text-[6px] text-zinc-700 shrink-0 leading-none">
                            {tagLabels.polish || 'پالش'}:
                          </span>
                          <span className="tag-metric-value font-mono font-bold text-[6.5px] text-zinc-900 whitespace-nowrap shrink-0 leading-none" dir="ltr">
                            {hasText(currentTag.grossWeight) ? `${currentTag.grossWeight.trim()}g` : ''}
                          </span>
                        </div>
                        <div className="tag-metric-row border-t border-amber-200/80 pt-[1px] flex items-center justify-between gap-0.5 leading-none">
                          <span className="font-urdu font-black text-[6px] text-amber-950 shrink-0 leading-none">
                            {tagLabels.totalWeight || 'ٹوٹل ویٹ'}:
                          </span>
                          <span className="tag-metric-value font-mono font-black text-[6.5px] text-amber-950 whitespace-nowrap shrink-0 leading-none" dir="ltr">
                            {(hasText(currentTag.netWeight) || hasText(currentTag.grossWeight)) ? `${getTotalWeight(currentTag)}g` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-[0.65cm] shrink-0 flex items-center justify-center px-[1px]">
                      <div className="w-full h-full bg-amber-100/80 border-x border-dashed border-amber-500 flex items-center justify-center">
                        <span className="text-[4.5px] font-mono font-bold text-amber-900 tracking-widest leading-none [writing-mode:vertical-rl]">
                          FOLD
                        </span>
                      </div>
                    </div>

                    <div className="w-[2.6cm] shrink-0 border border-amber-700 bg-white px-1 py-[1px] rounded-r-[2px] flex flex-col justify-between items-center overflow-hidden">
                      <div className="w-full flex items-center justify-between gap-0.5 leading-none min-h-[9px]">
                        <span className="text-[6.5px] font-mono font-black text-black truncate leading-none" dir="ltr">
                          {currentTag.tagCode}
                        </span>
                        {getMakingAmount(currentTag) > 0 && (
                          <span className="text-[5.5px] font-mono font-bold text-zinc-700 shrink-0 leading-none" dir="ltr">
                            Rs.{getMakingAmount(currentTag).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="w-full flex-1 bg-white flex items-center justify-center overflow-hidden min-h-[24px]" dir="ltr">
                        <svg className={`barcode-svg-${selectedTagIndex} w-full max-w-full h-[24px] block`}></svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="tag-card-print barcode-sticker-tag w-[1.5in] h-[0.5in] border border-amber-700 rounded-[3px] bg-white px-1 py-[1px] flex flex-col justify-between overflow-hidden shadow-sm print:shadow-none">
                    <div className="flex items-center justify-between gap-1 leading-none min-h-[9px]">
                      <div className="flex items-center gap-0.5 min-w-0">
                        <span className="font-bold font-urdu text-[7.5px] text-zinc-900 truncate leading-none">
                          {currentTag.name}
                        </span>
                        {currentTag.karat && (
                          <span className="text-[5.5px] font-mono font-bold bg-amber-700 text-white px-0.5 rounded shrink-0 leading-tight">
                            {currentTag.karat}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[6.5px] font-black text-black shrink-0 leading-none" dir="ltr">
                        {currentTag.tagCode}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-between gap-1 text-[5.5px] font-bold text-zinc-900 bg-amber-50/70 px-1 rounded-[2px] leading-none min-h-[8px]"
                      dir="rtl"
                    >
                      <span className="whitespace-nowrap shrink-0">
                        <span className="font-urdu text-amber-900">{tagLabels.weight || 'وزن'}:</span>
                        <span className="font-mono" dir="ltr">
                          {hasText(currentTag.netWeight) ? `${currentTag.netWeight.trim()}g` : ''}
                        </span>
                      </span>
                      <span className="whitespace-nowrap shrink-0">
                        <span className="font-urdu text-zinc-700">{tagLabels.polish || 'پالش'}:</span>
                        <span className="font-mono" dir="ltr">
                          {hasText(currentTag.grossWeight) ? `${currentTag.grossWeight.trim()}g` : ''}
                        </span>
                      </span>
                      <span className="whitespace-nowrap shrink-0 font-black text-amber-950">
                        <span className="font-urdu">{isUrdu ? 'ٹوٹل' : 'Tot'}:</span>
                        <span className="font-mono" dir="ltr">
                          {(hasText(currentTag.netWeight) || hasText(currentTag.grossWeight)) ? `${getTotalWeight(currentTag)}g` : ''}
                        </span>
                      </span>
                    </div>

                    <div className="w-full bg-white flex items-center justify-center overflow-hidden h-[25px]" dir="ltr">
                      <svg className={`barcode-svg-${selectedTagIndex} w-full max-w-full h-[24px] block`}></svg>
                    </div>
                  </div>
                )
              )}
              </div>
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
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-zinc-700 hover:bg-slate-100 transition-colors text-xs sm:text-sm"
            >
              {isUrdu ? 'بند کریں' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold transition-all flex items-center gap-2 text-xs sm:text-sm disabled:opacity-50"
            >
              <Download size={16} />
              <span>{isUrdu ? 'PDF محفوظ کریں' : 'Save PDF'}</span>
            </button>
            <button
              type="button"
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
