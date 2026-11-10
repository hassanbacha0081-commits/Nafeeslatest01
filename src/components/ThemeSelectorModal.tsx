import React from 'react';
import { type Language } from '../translations';
import { X, Check, Palette, Sparkles } from 'lucide-react';

export type AppTheme = 'obsidian' | 'emerald' | 'sapphire' | 'classic' | 'sky';

interface ThemeOption {
  id: AppTheme;
  nameUr: string;
  nameEn: string;
  descUr: string;
  descEn: string;
  bgHex: string;
  cardHex: string;
  accentHex: string;
  sidebarHex: string;
  badge: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'obsidian',
    nameUr: 'شاہی اوبسیڈین گولڈ',
    nameEn: 'Royal Obsidian & Gold',
    descUr: 'سیاہ مخمل بیک گراؤنڈ اور سنہری بارڈرز (سب سے زیادہ شاہانہ اور پرکشش)',
    descEn: 'Deep black velvet backdrop with glowing gold trims (Most Luxurious)',
    bgHex: '#090E17',
    cardHex: '#121C2D',
    accentHex: '#D4AF37',
    sidebarHex: '#0D1524',
    badge: 'Luxury 24K'
  },
  {
    id: 'emerald',
    nameUr: 'زمردی مخمل گولڈ',
    nameEn: 'Imperial Emerald Velvet',
    descUr: 'شاہی زمردی سبز مخمل اور خالص سونے کی چمک (روایتی صرافہ زیورات)',
    descEn: 'Imperial emerald velvet with lustrous gold (Artisan Jewelry Boutique)',
    bgHex: '#041A14',
    cardHex: '#093529',
    accentHex: '#D4AF37',
    sidebarHex: '#06281F',
    badge: 'Emerald Velvet'
  },
  {
    id: 'sapphire',
    nameUr: 'نیلم نیوی گولڈ',
    nameEn: 'Midnight Sapphire & Gold',
    descUr: 'گہرا نیلم نیوی بلیو اور چمکتا ہوا سونا (جدید اور پیشہ ورانہ)',
    descEn: 'Regal midnight sapphire with rich gold accents (Modern & Elegant)',
    bgHex: '#060F1E',
    cardHex: '#10254A',
    accentHex: '#D4AF37',
    sidebarHex: '#0B1B36',
    badge: 'Sapphire'
  },
  {
    id: 'classic',
    nameUr: 'کلاسک عاج و گولڈ',
    nameEn: 'Classic Ivory & Warm Gold',
    descUr: 'روشن عاجی سفید اور براؤن ووڈ سنہری اسٹائل (دن کے وقت صاف نظر آنے والا)',
    descEn: 'Warm ivory background with rich walnut and gold (Bright & Clean)',
    bgHex: '#F8F5EE',
    cardHex: '#FFFFFF',
    accentHex: '#C59B27',
    sidebarHex: '#261F18',
    badge: 'Classic'
  },
  {
    id: 'sky',
    nameUr: 'روایتی اسکائی بلیو',
    nameEn: 'Traditional Sky Blue',
    descUr: 'روایتی نیلگوں اور سنہری انٹرفیس (پہلے والا انداز)',
    descEn: 'Original sky blue and gold interface',
    bgHex: '#BAE6FD',
    cardHex: '#FFFFFF',
    accentHex: '#D4AF37',
    sidebarHex: '#0284C7',
    badge: 'Original'
  }
];

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  lang: Language;
}

export default function ThemeSelectorModal({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  lang
}: ThemeSelectorModalProps) {
  if (!isOpen) return null;
  const isUrdu = lang === 'ur';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-950 text-white border border-gold/40 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Top Metallic Line */}
        <div className="h-1.5 w-full gold-metallic-bg" />

        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <Palette size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black urdu-text gold-metallic-text">
                {isUrdu ? 'ایپ کا رنگ اور تھیم منتخب کریں' : 'Select App Color & Theme'}
              </h3>
              <p className="text-xs text-zinc-400 urdu-text">
                {isUrdu ? 'کسی بھی وقت اپنی پسند کا گولڈ اور جیولری تھیم لگائیں' : 'Change your jewelry shop visual theme anytime'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="p-6 space-y-3 max-h-[65vh] overflow-y-auto">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onSelectTheme(theme.id);
                  onClose();
                }}
                className={`w-full text-right p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 group ${
                  isSelected
                    ? 'border-gold bg-zinc-900 shadow-lg shadow-gold/10'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900'
                }`}
              >
                {/* Left side: Palette Preview Swatches */}
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className="w-7 h-7 rounded-lg border border-white/20 shadow-md"
                    style={{ backgroundColor: theme.bgHex }}
                    title="Background"
                  />
                  <div
                    className="w-7 h-7 rounded-lg border border-white/20 shadow-md"
                    style={{ backgroundColor: theme.sidebarHex }}
                    title="Sidebar"
                  />
                  <div
                    className="w-7 h-7 rounded-lg border border-white/20 shadow-md flex items-center justify-center text-[10px] font-black text-black"
                    style={{ backgroundColor: theme.accentHex }}
                    title="Gold Accent"
                  >
                    Au
                  </div>
                </div>

                {/* Center / Right: Theme Details */}
                <div className="flex-1 min-w-0" dir={isUrdu ? 'rtl' : 'ltr'}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-base text-zinc-100 group-hover:text-gold transition-colors urdu-text">
                      {isUrdu ? theme.nameUr : theme.nameEn}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold/10 text-gold border border-gold/20">
                      {theme.badge}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-1 urdu-text">
                    {isUrdu ? theme.descUr : theme.descEn}
                  </p>
                </div>

                {/* Selected Checkmark */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                    isSelected
                      ? 'bg-gold text-black border-gold'
                      : 'border-zinc-700 text-transparent group-hover:border-zinc-500'
                  }`}
                >
                  <Check size={14} className="stroke-[3]" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5 urdu-text">
            <Sparkles size={14} className="text-gold" />
            <span>{isUrdu ? 'یہ تھیم فوری طور پر محفوظ ہو جائے گی' : 'Theme persists automatically'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl transition-all urdu-text"
          >
            {isUrdu ? 'بند کریں' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
