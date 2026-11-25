import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Receipt,
  History,
  ShoppingBag,
  Users,
  Wrench,
  Package,
  BarChart3,
  Settings as SettingsIcon,
  Menu,
  X,
  Languages,
  Wallet,
  Palette,
  Plus,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, type Language } from './translations';
import { cn } from './lib/utils';
import { db, sanitizeShopAddress, type Sale } from './db';
import { App as CapApp } from '@capacitor/app';
import { PhoneChannelLogos } from './components/PhoneChannelLogos';
import SarafaTicker from './components/SarafaTicker';
import ThemeSelectorModal, { type AppTheme } from './components/ThemeSelectorModal';
import LockScreen from './components/LockScreen';
import ToastContainer from './components/ToastContainer';
import Billing from './components/Billing';
import { APP_CONFIG } from './config';

// Lazy-load secondary modules so initial startup bundle stays lean & fast
const Purchases = lazy(() => import('./components/Purchases'));
const Records = lazy(() => import('./components/Records'));
const Orders = lazy(() => import('./components/Orders'));
const Karigar = lazy(() => import('./components/Karigar'));
const Repairs = lazy(() => import('./components/Repairs'));
const Stock = lazy(() => import('./components/Stock'));
const Customers = lazy(() => import('./components/Customers'));
const Expenses = lazy(() => import('./components/Expenses'));
const Reports = lazy(() => import('./components/Reports'));
const Settings = lazy(() => import('./components/Settings'));
const Khaata = lazy(() => import('./components/Khaata').then((m) => ({ default: m.Khaata })));

type Section =
  | 'billing'
  | 'purchases'
  | 'records'
  | 'orders'
  | 'karigar'
  | 'repairs'
  | 'stock'
  | 'customers'
  | 'expenses'
  | 'reports'
  | 'khaata'
  | 'settings';

const THEME_STYLES: Record<
  AppTheme,
  {
    wrapper: string;
    sidebar: string;
    sidebarHeader: string;
    sidebarBorder: string;
    sidebarNavHover: string;
    mobileHeader: string;
    mobileHeaderBorder: string;
    topBar: string;
  }
> = {
  obsidian: {
    wrapper: 'bg-[#090e17] text-slate-100',
    sidebar: 'bg-[#0d1524] text-white',
    sidebarHeader: 'bg-[#121c2d]/90',
    sidebarBorder: 'border-[#1e2d47]',
    sidebarNavHover: 'text-slate-300 hover:bg-[#162238] hover:text-gold',
    mobileHeader: 'bg-[#0d1524]',
    mobileHeaderBorder: 'border-[#1e2d47]',
    topBar: 'bg-[#0d1524]/85 border-[#1e2d47] text-slate-100',
  },
  emerald: {
    wrapper: 'bg-[#041a14] text-emerald-50',
    sidebar: 'bg-[#06281f] text-white',
    sidebarHeader: 'bg-[#093529]/90',
    sidebarBorder: 'border-[#0e4b3b]',
    sidebarNavHover: 'text-emerald-200 hover:bg-[#0a3d30] hover:text-gold',
    mobileHeader: 'bg-[#06281f]',
    mobileHeaderBorder: 'border-[#0e4b3b]',
    topBar: 'bg-[#06281f]/85 border-[#0e4b3b] text-emerald-50',
  },
  sapphire: {
    wrapper: 'bg-[#060f1e] text-slate-100',
    sidebar: 'bg-[#0b1b36] text-white',
    sidebarHeader: 'bg-[#10254a]/90',
    sidebarBorder: 'border-[#18366a]',
    sidebarNavHover: 'text-blue-200 hover:bg-[#122a54] hover:text-gold',
    mobileHeader: 'bg-[#0b1b36]',
    mobileHeaderBorder: 'border-[#18366a]',
    topBar: 'bg-[#0b1b36]/85 border-[#18366a] text-slate-100',
  },
  classic: {
    wrapper: 'bg-[#f8f5ee] text-stone-900',
    sidebar: 'bg-[#261f18] text-white',
    sidebarHeader: 'bg-[#382e24]/90',
    sidebarBorder: 'border-[#42362b]',
    sidebarNavHover: 'text-stone-300 hover:bg-[#382e24] hover:text-gold',
    mobileHeader: 'bg-[#261f18]',
    mobileHeaderBorder: 'border-[#42362b]',
    topBar: 'bg-white/90 border-[#e5dccd] text-stone-900',
  },
  sky: {
    wrapper: 'bg-sky-200 text-zinc-900',
    sidebar: 'bg-sky-600 text-white',
    sidebarHeader: 'bg-sky-700/50',
    sidebarBorder: 'border-sky-500',
    sidebarNavHover: 'text-sky-100 hover:bg-sky-500 hover:text-gold',
    mobileHeader: 'bg-sky-600',
    mobileHeaderBorder: 'border-sky-500',
    topBar: 'bg-white/90 border-sky-200 text-sky-950',
  },
};

function SectionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-3xl bg-white/10 border border-white/10" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-44 rounded-3xl bg-white/10 border border-white/10" />
        <div className="h-44 rounded-3xl bg-white/10 border border-white/10" />
        <div className="h-44 rounded-3xl bg-white/10 border border-white/10" />
      </div>
      <div className="h-64 rounded-3xl bg-white/10 border border-white/10" />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Language>('ur');
  const [activeSection, setActiveSection] = useState<Section>('billing');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [goldRate, setGoldRate] = useState<number>(0);
  const [shopName, setShopName] = useState<string>(translations.ur.shopName);
  const [shopAddress, setShopAddress] = useState<string>(translations.ur.shopAddress);
  const [shopPhone, setShopPhone] = useState<string>(translations.ur.shopPhone);
  const [shopPhone2, setShopPhone2] = useState<string>(translations.ur.shopPhone2);
  const [isLoading, setIsLoading] = useState(true);

  // Theme & Feature Toggles
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    try {
      return (localStorage.getItem('nafees_theme') as AppTheme) || 'obsidian';
    } catch {
      return 'obsidian';
    }
  });
  const [showSarafaTicker, setShowSarafaTicker] = useState<boolean>(true);
  const [stockCardStyle, setStockCardStyle] = useState<'velvet' | 'classic'>('velvet');
  const [defaultWeightUnit, setDefaultWeightUnit] = useState<'tola' | 'gram'>('tola');
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Security
  const [appPin, setAppPin] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false);

  const t = translations[lang];
  const isRTL = lang === 'ur';

  const handleThemeChange = async (theme: AppTheme) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('nafees_theme', theme);
    } catch {
      // ignore
    }
    await db.settings.put({ key: 'appTheme', value: theme });
  };

  const handleToggleSarafaTicker = async (show: boolean) => {
    setShowSarafaTicker(show);
    await db.settings.put({ key: 'showSarafaTicker', value: show });
  };

  const handleToggleStockCardStyle = async (style: 'velvet' | 'classic') => {
    setStockCardStyle(style);
    await db.settings.put({ key: 'stockCardStyle', value: style });
  };

  const handleWeightUnitChange = async (unit: 'tola' | 'gram') => {
    setDefaultWeightUnit(unit);
    await db.settings.put({ key: 'defaultWeightUnit', value: unit });
  };

  // Single-query batched settings fetch on startup (zero artificial splash delay)
  useEffect(() => {
    let active = true;
    const fetchSettings = async () => {
      try {
        const allSettings = await db.settings.toArray();
        if (!active) return;

        const map = new Map<string, any>();
        for (const item of allSettings) {
          map.set(item.key, item.value);
        }

        const rateVal = map.get('goldRate');
        if (rateVal !== undefined) setGoldRate(Number(rateVal) || 0);

        const initialTheme: AppTheme =
          map.get('appTheme') || (localStorage.getItem('nafees_theme') as AppTheme) || 'obsidian';
        setCurrentTheme(initialTheme);
        document.documentElement.setAttribute('data-theme', initialTheme);

        if (map.has('showSarafaTicker')) {
          setShowSarafaTicker(Boolean(map.get('showSarafaTicker')));
        }
        if (map.get('stockCardStyle')) {
          setStockCardStyle(map.get('stockCardStyle'));
        }
        if (map.get('defaultWeightUnit')) {
          setDefaultWeightUnit(map.get('defaultWeightUnit'));
        }

        const nameVal = map.get('shopName');
        if (nameVal) {
          if (nameVal === 'سیف جیولرز' || nameVal === "Saif jeweller's" || nameVal === "Saif Jeweller's") {
            const newVal = translations.ur.shopName;
            db.settings.put({ key: 'shopName', value: newVal });
            setShopName(newVal);
          } else {
            setShopName(nameVal);
          }
        } else {
          const newVal = translations.ur.shopName;
          db.settings.put({ key: 'shopName', value: newVal });
          setShopName(newVal);
        }

        const addrVal = map.get('shopAddress');
        if (typeof addrVal === 'string') {
          const sanitizedAddr = sanitizeShopAddress(addrVal);
          if (sanitizedAddr !== addrVal) {
            db.settings.put({ key: 'shopAddress', value: sanitizedAddr });
          }
          setShopAddress(sanitizedAddr);
        }

        const phoneVal = map.get('shopPhone');
        if (phoneVal) {
          if (phoneVal === '03135722659') {
            const newVal = translations.ur.shopPhone;
            db.settings.put({ key: 'shopPhone', value: newVal });
            setShopPhone(newVal);
          } else {
            setShopPhone(phoneVal);
          }
        } else {
          const newVal = translations.ur.shopPhone;
          db.settings.put({ key: 'shopPhone', value: newVal });
          setShopPhone(newVal);
        }

        const phone2Val = map.get('shopPhone2');
        if (phone2Val) {
          if (phone2Val === '03433977727') {
            const newVal = translations.ur.shopPhone2;
            db.settings.put({ key: 'shopPhone2', value: newVal });
            setShopPhone2(newVal);
          } else {
            setShopPhone2(phone2Val);
          }
        } else {
          const newVal = translations.ur.shopPhone2;
          db.settings.put({ key: 'shopPhone2', value: newVal });
          setShopPhone2(newVal);
        }

        const pinVal = map.get('appPin');
        if (pinVal) {
          setAppPin(pinVal);
          setIsLocked(true);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchSettings();
    return () => {
      active = false;
    };
  }, []);

  // Handle native & web back-button navigation and exit behaviors
  useEffect(() => {
    let lastTime = 0;
    let toastTimeout: ReturnType<typeof setTimeout>;

    const setupBackListener = async () => {
      try {
        const handler = await CapApp.addListener('backButton', () => {
          if (activeSection !== 'billing') {
            setActiveSection('billing');
          } else {
            const currentTime = Date.now();
            if (currentTime - lastTime < 2000) {
              CapApp.exitApp();
            } else {
              lastTime = currentTime;
              setShowExitToast(true);
              clearTimeout(toastTimeout);
              toastTimeout = setTimeout(() => {
                setShowExitToast(false);
              }, 2000);
            }
          }
        });
        return handler;
      } catch {
        return null;
      }
    };

    const handlerPromise = setupBackListener();

    const handlePopState = () => {
      if (activeSection !== 'billing') {
        setActiveSection('billing');
        window.history.pushState({ section: 'billing' }, '');
      } else {
        const currentTime = Date.now();
        if (currentTime - lastTime < 2000) {
          window.close();
        } else {
          lastTime = currentTime;
          setShowExitToast(true);
          clearTimeout(toastTimeout);
          toastTimeout = setTimeout(() => {
            setShowExitToast(false);
          }, 2000);
          window.history.pushState({ section: 'billing' }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    if (!window.history.state || window.history.state.section !== activeSection) {
      window.history.pushState({ section: activeSection }, '');
    }

    return () => {
      handlerPromise.then((h) => h && h.remove());
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(toastTimeout);
    };
  }, [activeSection]);

  const counterNavItems = [
    { id: 'billing', icon: Receipt, label: t.billing },
    { id: 'purchases', icon: ShoppingBag, label: t.purchaseGold || 'سونا خریدیں' },
    { id: 'records', icon: History, label: t.records },
    { id: 'customers', icon: UserCheck, label: t.customers },
    { id: 'orders', icon: Package, label: t.orders },
    { id: 'repairs', icon: Wrench, label: t.repairs },
  ];

  const workshopNavItems = [
    { id: 'karigar', icon: Users, label: t.karigar },
    { id: 'khaata', icon: Wallet, label: t.khaata },
    { id: 'stock', icon: Package, label: t.stock },
    { id: 'expenses', icon: Wallet, label: t.expenses },
    { id: 'reports', icon: BarChart3, label: t.reports },
  ];

  const allNavItems = [...counterNavItems, ...workshopNavItems, { id: 'settings', icon: SettingsIcon, label: t.settings }];
  const currentNavLabel = allNavItems.find((i) => i.id === activeSection)?.label || t.billing;

  const renderSection = () => {
    switch (activeSection) {
      case 'billing':
        return <Billing lang={lang} editingSale={editingSale} setEditingSale={setEditingSale} />;
      case 'purchases':
        return <Purchases lang={lang} />;
      case 'records':
        return <Records lang={lang} setActiveSection={setActiveSection} setEditingSale={setEditingSale} />;
      case 'orders':
        return <Orders lang={lang} />;
      case 'karigar':
        return <Karigar lang={lang} />;
      case 'khaata':
        return <Khaata lang={lang} />;
      case 'repairs':
        return <Repairs lang={lang} />;
      case 'stock':
        return <Stock lang={lang} />;
      case 'customers':
        return <Customers lang={lang} />;
      case 'expenses':
        return <Expenses lang={lang} />;
      case 'reports':
        return <Reports lang={lang} />;
      case 'settings':
        return (
          <Settings
            lang={lang}
            setGoldRate={setGoldRate}
            setLang={setLang}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            showSarafaTicker={showSarafaTicker}
            onToggleSarafaTicker={handleToggleSarafaTicker}
            stockCardStyle={stockCardStyle}
            onToggleStockCardStyle={handleToggleStockCardStyle}
            defaultWeightUnit={defaultWeightUnit}
            onWeightUnitChange={handleWeightUnitChange}
          />
        );
      default:
        return <Billing lang={lang} editingSale={editingSale} setEditingSale={setEditingSale} />;
    }
  };

  const themeStyle = THEME_STYLES[currentTheme] || THEME_STYLES.obsidian;

  if (isLoading) {
    return (
      <div className={cn('fixed inset-0 flex flex-col items-center justify-center', themeStyle.wrapper)}>
        <div className="w-20 h-20 bg-zinc-950 border-2 border-gold rounded-2xl flex items-center justify-center mb-3 shadow-2xl p-3">
          <img src={APP_CONFIG.appIcon} alt="Logo" className="w-12 h-12 object-contain" />
        </div>
        <h1 className="text-2xl font-bold urdu-text gold-metallic-text tracking-wide">{shopName}</h1>
      </div>
    );
  }

  if (isLocked && appPin) {
    return <LockScreen lang={lang} correctPin={appPin} shopName={shopName} onUnlock={() => setIsLocked(false)} />;
  }

  const renderNavGroup = (
    title: string,
    items: { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }[],
    closeMobile?: boolean
  ) => (
    <div className="space-y-1">
      <div className="px-4 pt-2 pb-1 text-[11px] font-bold text-zinc-400/80 urdu-text tracking-wide">
        {title}
      </div>
      {items.map((item) => {
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveSection(item.id as Section);
              if (closeMobile) setIsSidebarOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-150 group relative cursor-pointer',
              isActive
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md shadow-amber-500/20 font-black'
                : themeStyle.sidebarNavHover
            )}
          >
            <item.icon
              size={18}
              className={cn('shrink-0', isActive ? 'text-black' : 'group-hover:scale-105 transition-transform duration-150')}
            />
            <span className="urdu-text text-sm font-bold truncate whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn(
        'min-h-screen flex transition-colors duration-200',
        themeStyle.wrapper,
        isRTL ? 'flex-row-reverse text-right' : 'flex-row text-left'
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Sidebar Desktop */}
      <aside
        className={cn(
          'hidden lg:flex flex-col w-72 h-screen sticky top-0 shadow-2xl z-40 transition-colors duration-200',
          themeStyle.sidebar,
          isRTL ? cn('order-last border-l', themeStyle.sidebarBorder) : cn('order-first border-r', themeStyle.sidebarBorder)
        )}
      >
        <div className={cn('p-5 border-b flex flex-col items-center gap-3 relative', themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
          <div className="relative group">
            <img
              src={APP_CONFIG.appIcon}
              alt="Logo"
              className="w-16 h-16 object-contain rounded-2xl bg-zinc-950 border border-gold/40 p-2 shadow-lg"
            />
          </div>
          <div className="text-center space-y-1 w-full">
            <h1 className="text-2xl font-black urdu-text gold-metallic-text tracking-tight">{shopName}</h1>
            <p className="text-[11px] text-zinc-400 font-medium line-clamp-1">{shopAddress}</p>
            <div
              className="flex flex-col items-center justify-center gap-1 mt-2.5 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 shadow-inner"
              dir="ltr"
            >
              <div className="flex items-center gap-2">
                {(!shopPhone || shopPhone.replace(/\D/g, '').includes('3150023776')) && <PhoneChannelLogos size={15} />}
                <span className="font-mono text-sm font-bold text-white tabular-nums">{shopPhone}</span>
              </div>
              {shopPhone2 && (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="font-mono text-xs font-semibold tabular-nums">{shopPhone2}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-3 px-3 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          {renderNavGroup(lang === 'ur' ? 'روزمرہ کاؤنٹر' : 'Counter Operations', counterNavItems)}
          {renderNavGroup(lang === 'ur' ? 'ورکشاپ اور حسابات' : 'Workshop & Accounts', workshopNavItems)}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className={cn('p-3.5 border-t space-y-2', themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 font-bold transition-colors cursor-pointer"
            title={lang === 'ur' ? 'تھیم اور رنگ تبدیل کریں' : 'Change Theme & Colors'}
          >
            <div className="flex items-center gap-2">
              <Palette size={17} />
              <span className="urdu-text text-xs whitespace-nowrap">{lang === 'ur' ? 'رنگ اور تھیم' : 'Theme Colors'}</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-gold text-black font-mono">
              {currentTheme}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-colors text-xs font-bold cursor-pointer',
                activeSection === 'settings'
                  ? 'bg-white text-zinc-950 shadow-md'
                  : 'bg-black/30 text-zinc-300 hover:text-white border border-white/10'
              )}
            >
              <SettingsIcon size={15} />
              <span className="urdu-text whitespace-nowrap">{t.settings}</span>
            </button>
            <button
              type="button"
              onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-black/30 text-zinc-300 hover:text-gold transition-colors border border-white/10 text-xs font-bold cursor-pointer"
            >
              <Languages size={15} />
              <span className="whitespace-nowrap">{lang === 'ur' ? 'English' : 'اردو'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div
        className={cn(
          'lg:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 border-b shadow-xl transition-colors duration-200 no-print',
          themeStyle.mobileHeader,
          themeStyle.mobileHeaderBorder
        )}
      >
        <button type="button" onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-300 hover:text-white cursor-pointer">
          <Menu size={26} />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-base font-bold urdu-text gold-metallic-text leading-tight">{shopName}</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15" dir="ltr">
            {(!shopPhone || shopPhone.replace(/\D/g, '').includes('3150023776')) && <PhoneChannelLogos size={12} />}
            <span className="font-mono text-white font-bold tabular-nums">{shopPhone}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            className="p-2 text-gold hover:text-white cursor-pointer"
            title={lang === 'ur' ? 'تھیم منتخب کریں' : 'Change Theme'}
          >
            <Palette size={20} />
          </button>
          <button type="button" onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')} className="p-2 text-zinc-300 hover:text-white cursor-pointer">
            <Languages size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/75 z-[60] lg:hidden backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ duration: 0.18 }}
              className={cn(
                'fixed top-0 bottom-0 w-[285px] max-w-[85vw] z-[70] lg:hidden flex flex-col border-x shadow-2xl',
                themeStyle.sidebar,
                themeStyle.sidebarBorder,
                isRTL ? 'right-0' : 'left-0'
              )}
            >
              <div className={cn('p-5 border-b flex justify-between items-center', themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
                <h1 className="text-lg font-black urdu-text gold-metallic-text truncate pr-2">{shopName}</h1>
                <button type="button" onClick={() => setIsSidebarOpen(false)} className="text-zinc-400 hover:text-white p-1 shrink-0 cursor-pointer">
                  <X size={22} />
                </button>
              </div>
              <nav className="flex-1 py-3 px-3 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                {renderNavGroup(lang === 'ur' ? 'روزمرہ کاؤنٹر' : 'Counter Operations', counterNavItems, true)}
                {renderNavGroup(lang === 'ur' ? 'ورکشاپ اور حسابات' : 'Workshop & Accounts', workshopNavItems, true)}
              </nav>

              <div className={cn('p-4 border-t space-y-2', themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
                <button
                  type="button"
                  onClick={() => {
                    setIsThemeModalOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gold/10 text-gold border border-gold/30 font-bold cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Palette size={18} />
                    <span className="urdu-text text-xs">{lang === 'ur' ? 'تھیم اور رنگ تبدیل کریں' : 'Change Theme'}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold text-black font-mono font-bold uppercase">{currentTheme}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('settings');
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold transition-colors text-xs cursor-pointer',
                      activeSection === 'settings'
                        ? 'bg-white text-zinc-950 font-black shadow-lg'
                        : 'text-zinc-300 bg-black/40 border border-white/10'
                    )}
                  >
                    <SettingsIcon size={16} />
                    <span className="urdu-text">{t.settings}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLang(lang === 'ur' ? 'en' : 'ur');
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-black/40 text-zinc-300 transition-colors border border-white/10 font-bold text-xs cursor-pointer"
                  >
                    <Languages size={16} />
                    <span>{lang === 'ur' ? 'English' : 'اردو'}</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main App Area */}
      <main className="flex-1 p-4 lg:p-6 mt-16 lg:mt-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Desktop Workspace Header Bar */}
          <header
            className={cn(
              'hidden lg:flex items-center justify-between gap-6 px-5 py-3 mb-5 rounded-2xl border backdrop-blur-md no-print',
              themeStyle.topBar
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-base font-black urdu-text truncate whitespace-nowrap">{currentNavLabel}</span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {activeSection !== 'customers' && (
                <button
                  type="button"
                  onClick={() => setActiveSection('customers')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <UserCheck size={15} />
                  <span className="urdu-text">{lang === 'ur' ? 'گاہک پروفائل' : 'Customer Profiles'}</span>
                </button>
              )}
              {activeSection !== 'billing' && (
                <button
                  type="button"
                  onClick={() => setActiveSection('billing')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold hover:bg-gold-light text-black text-xs font-black transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
                >
                  <Plus size={15} />
                  <span className="urdu-text">{lang === 'ur' ? 'نیا بل' : 'New Bill'}</span>
                </button>
              )}
            </div>
          </header>

          {/* Optional Sarafa Live Rate Ribbon */}
          {showSarafaTicker && (
            <SarafaTicker
              baseRate={goldRate}
              lang={lang}
              onRateChange={(newRate) => setGoldRate(newRate)}
            />
          )}

          {/* Active Module (Snappy zero-lag transition + Suspense for lazy chunks) */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0.7, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Suspense fallback={<SectionSkeleton />}>{renderSection()}</Suspense>
          </motion.div>
        </div>
      </main>

      {/* Instant Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={handleThemeChange}
        lang={lang}
      />

      {/* Global Non-Blocking Toast Notifications */}
      <ToastContainer />

      {/* Toast Notification for back button exit */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900 border border-gold/40 text-white rounded-full font-bold shadow-2xl flex items-center gap-2 z-[9999]"
          >
            <span className="urdu-text text-sm font-bold">{t.doubleBackExit}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
