import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronDown, X, Plus, Search, Languages, Trash2 } from 'lucide-react';
import { db } from '../db';
import { hasUrduScript, translateInstantLocal, translateToUrdu } from '../lib/urduTranslator';

export interface CustomDropdownItem {
  ur: string;
  en: string;
}

interface MultiSelectInputProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  lang: 'ur' | 'en';
  placeholder?: string;
}

const CUSTOM_ITEMS_SETTING_KEY = 'customDropdownItems';

export function MultiSelectInput({ options, value, onChange, lang, placeholder }: MultiSelectInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [urduTranslation, setUrduTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const userEditedUrduRef = useRef(false);

  const customSetting = useLiveQuery(() => db.settings.get(CUSTOM_ITEMS_SETTING_KEY), []);

  const savedCustomItems: CustomDropdownItem[] = useMemo(() => {
    const raw = customSetting?.value;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry: any) => {
        if (typeof entry === 'string') {
          return { ur: entry, en: entry };
        }
        if (entry && (entry.ur || entry.en)) {
          return { ur: String(entry.ur || entry.en), en: String(entry.en || entry.ur) };
        }
        return null;
      })
      .filter((x): x is CustomDropdownItem => Boolean(x));
  }, [customSetting]);

  const customOptionLabels = useMemo(() => {
    return savedCustomItems.map((item) => (lang === 'ur' ? (item.ur || item.en) : (item.en || item.ur)));
  }, [savedCustomItems, lang]);

  const mergedOptions = useMemo(() => {
    const seen = new Set<string>();
    const combined: string[] = [];
    [...options, ...customOptionLabels].forEach((opt) => {
      const clean = (opt || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(clean);
      }
    });
    return combined;
  }, [options, customOptionLabels]);

  const customSetLower = useMemo(() => {
    const baseLower = new Set(options.map((o) => o.trim().toLowerCase()));
    const set = new Set<string>();
    customOptionLabels.forEach((label) => {
      const key = label.trim().toLowerCase();
      if (!baseLower.has(key)) {
        set.add(key);
      }
    });
    return set;
  }, [options, customOptionLabels]);

  const selectedItems = value ? value.split(', ').filter(Boolean) : [];

  // Automatic Urdu translation when typing an entry not in the dropdown
  useEffect(() => {
    const trimmed = customValue.trim();
    userEditedUrduRef.current = false;

    if (!trimmed) {
      setUrduTranslation('');
      setIsTranslating(false);
      return;
    }

    if (hasUrduScript(trimmed)) {
      setUrduTranslation(trimmed);
      setIsTranslating(false);
      return;
    }

    const instant = translateInstantLocal(trimmed);
    if (instant) {
      setUrduTranslation(instant);
      setIsTranslating(false);
      return;
    }

    let cancelled = false;
    setIsTranslating(true);
    const timer = setTimeout(async () => {
      const translated = await translateToUrdu(trimmed);
      if (!cancelled && !userEditedUrduRef.current) {
        setUrduTranslation(translated);
        setIsTranslating(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customValue]);

  const toggleItem = (item: string, shouldClose = true) => {
    let newItems;
    if (selectedItems.includes(item)) {
      newItems = selectedItems.filter(i => i !== item);
    } else {
      newItems = [...selectedItems, item];
    }
    onChange(newItems.join(', '));
    if (shouldClose) {
      setIsOpen(false);
    }
  };

  const persistCustomItem = async (urText: string, enText: string) => {
    const cleanUr = urText.trim();
    const cleanEn = enText.trim();
    if (!cleanUr && !cleanEn) return;

    const existing = await db.settings.get(CUSTOM_ITEMS_SETTING_KEY);
    const currentList: CustomDropdownItem[] = Array.isArray(existing?.value)
      ? existing.value.map((entry: any) =>
          typeof entry === 'string'
            ? { ur: entry, en: entry }
            : { ur: String(entry?.ur || entry?.en || ''), en: String(entry?.en || entry?.ur || '') }
        )
      : [];

    const alreadyInBase = options.some(
      (o) => o.trim().toLowerCase() === cleanUr.toLowerCase() || o.trim().toLowerCase() === cleanEn.toLowerCase()
    );
    const alreadyInCustom = currentList.some(
      (item) =>
        (cleanUr && item.ur.trim().toLowerCase() === cleanUr.toLowerCase()) ||
        (cleanEn && item.en.trim().toLowerCase() === cleanEn.toLowerCase())
    );

    if (!alreadyInBase && !alreadyInCustom) {
      await db.settings.put({
        key: CUSTOM_ITEMS_SETTING_KEY,
        value: [...currentList, { ur: cleanUr || cleanEn, en: cleanEn || cleanUr }]
      });
    }
  };

  const handleDeleteCustomOption = async (optionLabel: string) => {
    const targetLower = optionLabel.trim().toLowerCase();
    const updated = savedCustomItems.filter(
      (item) => item.ur.trim().toLowerCase() !== targetLower && item.en.trim().toLowerCase() !== targetLower
    );
    await db.settings.put({
      key: CUSTOM_ITEMS_SETTING_KEY,
      value: updated
    });
    if (selectedItems.some((i) => i.trim().toLowerCase() === targetLower)) {
      onChange(selectedItems.filter((i) => i.trim().toLowerCase() !== targetLower).join(', '));
    }
  };

  const addCustom = async () => {
    const trimmed = customValue.trim();
    if (!trimmed) return;

    let finalUrdu = urduTranslation.trim();
    if (!finalUrdu) {
      finalUrdu = hasUrduScript(trimmed) ? trimmed : await translateToUrdu(trimmed);
    }

    const finalEn = trimmed;
    const itemToSelect = lang === 'ur' ? (finalUrdu || trimmed) : finalEn;

    // Permanently save to the dropdown list across all formats
    await persistCustomItem(finalUrdu || trimmed, finalEn);

    if (itemToSelect && !selectedItems.some(item => item.toLowerCase() === itemToSelect.toLowerCase())) {
      const newItems = [...selectedItems, itemToSelect];
      onChange(newItems.join(', '));
    }

    setCustomValue('');
    setUrduTranslation('');
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on both typed query and its auto-translated Urdu value
  const queryLower = customValue.trim().toLowerCase();
  const translatedLower = urduTranslation.trim().toLowerCase();
  const filteredOptions = mergedOptions.filter(option => {
    const optLower = option.toLowerCase();
    if (!queryLower) return true;
    return optLower.includes(queryLower) || (translatedLower ? optLower.includes(translatedLower) : false);
  });

  const targetCandidate = (lang === 'ur' ? (urduTranslation.trim() || customValue.trim()) : customValue.trim()).toLowerCase();
  const showAddCustomOption = Boolean(customValue.trim()) &&
    !mergedOptions.some(o => o.toLowerCase() === queryLower || (targetCandidate && o.toLowerCase() === targetCandidate));

  const defaultPlaceholder = lang === 'ur' ? 'آئٹم منتخب کریں...' : 'Select items...';

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border border-sky-200 rounded-lg bg-white flex items-center justify-between cursor-pointer focus-within:border-gold min-h-[50px] transition-all hover:bg-sky-50/30"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedItems.length > 0 ? (
            selectedItems.map((item, idx) => (
              <span key={idx} className="bg-gold/10 text-gold-dark border border-gold/30 px-2.5 py-1 rounded-md text-sm font-semibold flex items-center gap-1.5 animate-in zoom-in-95 duration-200">
                {item}
                <X 
                  size={14} 
                  className="cursor-pointer hover:text-red-500 transition-colors" 
                  onClick={(e) => { e.stopPropagation(); toggleItem(item, false); }} 
                />
              </span>
            ))
          ) : (
            <span className={`text-zinc-400 ${lang === 'ur' ? 'urdu-text text-sm' : 'text-sm'}`}>
              {placeholder || defaultPlaceholder}
            </span>
          )}
        </div>
        <ChevronDown size={20} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-sky-200 rounded-lg shadow-xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Custom entry input, auto Urdu translation & permanent "+" add */}
          <div className="p-2 border-b border-sky-100 sticky top-0 bg-zinc-50 space-y-2 z-10 shadow-sm">
            <div className="flex gap-2">
              <div className="relative flex-1 flex items-center">
                <Search size={16} className="absolute left-2.5 text-zinc-400" />
                <input 
                  type="text"
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  placeholder={lang === 'ur' ? 'تلاش کریں یا نیا لکھیں...' : 'Search or type custom item...'}
                  className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-sky-200 rounded outline-none focus:border-gold text-black bg-white"
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustom();
                    }
                  }}
                />
              </div>
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); addCustom(); }}
                disabled={!customValue.trim()}
                className="px-3 bg-gold text-black rounded-md font-bold text-xs flex items-center gap-1 hover:bg-gold-light transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                title={lang === 'ur' ? 'لسٹ میں مستقل شامل کریں' : 'Save & Add Permanently'}
              >
                <Plus size={14} />
                <span className="hidden sm:inline">{lang === 'ur' ? 'شامل کریں' : 'Add'}</span>
              </button>
            </div>

            {/* Live Automatic Urdu Translation Box for non-listed entries */}
            {customValue.trim() && !hasUrduScript(customValue.trim()) && (
              <div
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-2 bg-amber-50/90 border border-amber-200 rounded-md px-2.5 py-1.5"
              >
                <Languages size={14} className="text-amber-700 shrink-0" />
                <span className="text-[11px] font-bold text-amber-900 urdu-text shrink-0">
                  {lang === 'ur' ? 'اردو ترجمہ:' : 'Urdu:'}
                </span>
                <input
                  type="text"
                  dir="rtl"
                  value={isTranslating ? (urduTranslation || '...') : urduTranslation}
                  onChange={e => {
                    userEditedUrduRef.current = true;
                    setUrduTranslation(e.target.value);
                  }}
                  placeholder={isTranslating ? 'ترجمہ ہو رہا ہے...' : 'اردو نام'}
                  className="flex-1 bg-white border border-amber-200 rounded px-2 py-0.5 text-xs font-bold text-zinc-900 urdu-text outline-none focus:border-gold text-right"
                />
              </div>
            )}
          </div>

          <div className="py-1 max-h-52 overflow-y-auto">
            {/* Direct "+" Custom Add Option when keyword is not in the list */}
            {showAddCustomOption && (
              <div 
                onClick={(e) => { e.stopPropagation(); addCustom(); }}
                className="p-3 bg-amber-50 hover:bg-amber-100/80 flex items-center justify-between gap-2 cursor-pointer border-b border-sky-100 text-gold-dark font-bold text-sm transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Plus size={16} />
                  <span className={lang === 'ur' ? 'urdu-text' : ''}>
                    {lang === 'ur'
                      ? `مستقل شامل کریں: "${urduTranslation.trim() || customValue.trim()}"`
                      : `Save & Add Permanently: "${customValue.trim()}"${urduTranslation.trim() ? ` (${urduTranslation.trim()})` : ''}`}
                  </span>
                </div>
              </div>
            )}

            {/* List options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => {
                const isCustomSaved = customSetLower.has(option.toLowerCase());
                return (
                  <div 
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); toggleItem(option); }}
                    className="p-3 hover:bg-sky-50 flex items-center justify-between cursor-pointer border-b border-sky-100 last:border-0 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-zinc-900 ${lang === 'ur' ? 'urdu-text text-sm font-medium' : 'text-sm font-medium'}`}>
                        {option}
                      </span>
                      {isCustomSaved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                          {lang === 'ur' ? 'محفوظ' : 'Saved'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedItems.includes(option) && (
                        <Check size={16} className="text-gold-dark stroke-[3px]" />
                      )}
                      {isCustomSaved && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomOption(option);
                          }}
                          className="p-1 text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title={lang === 'ur' ? 'لسٹ سے حذف کریں' : 'Remove from saved list'}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              !showAddCustomOption && (
                <div className="p-4 text-center text-zinc-400 text-xs">
                  {lang === 'ur' ? 'کوئی آئٹم نہیں ملا' : 'No items found'}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
