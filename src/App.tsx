import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, type Language } from './translations';
import { cn } from './lib/utils';
import { db, type Sale } from './db';
import { App as CapApp } from '@capacitor/app';

// Sections
import Billing from './components/Billing';
import Dashboard from './components/Dashboard';
import Purchases from './components/Purchases';
import Records from './components/Records';
import Orders from './components/Orders';
import Karigar from './components/Karigar';
import Repairs from './components/Repairs';
import Stock from './components/Stock';
import Customers from './components/Customers';
import Reports from './components/Reports';
import Settings from './components/Settings';
import LockScreen from './components/LockScreen';
import Expenses from './components/Expenses';
import { Khaata } from './components/Khaata';
import SarafaTicker from './components/SarafaTicker';
import ThemeSelectorModal, { type AppTheme } from './components/ThemeSelectorModal';

import { APP_CONFIG } from './config';

type Section = 'billing' | 'purchases' | 'records' | 'orders' | 'karigar' | 'repairs' | 'stock' | 'customers' | 'expenses' | 'reports' | 'khaata' | 'settings';

const THEME_STYLES: Record<AppTheme, {
  wrapper: string;
  sidebar: string;
  sidebarHeader: string;
  sidebarBorder: string;
  sidebarNavHover: string;
  mobileHeader: string;
  mobileHeaderBorder: string;
}> = {
  obsidian: {
    wrapper: 'bg-[#090e17] text-slate-100',
    sidebar: 'bg-[#0d1524] text-white',
    sidebarHeader: 'bg-[#121c2d]/90',
    sidebarBorder: 'border-[#1e2d47]',
    sidebarNavHover: 'text-slate-300 hover:bg-[#162238] hover:text-gold',
    mobileHeader: 'bg-[#0d1524]',
    mobileHeaderBorder: 'border-[#1e2d47]'
  },
  emerald: {
    wrapper: 'bg-[#041a14] text-emerald-50',
    sidebar: 'bg-[#06281f] text-white',
    sidebarHeader: 'bg-[#093529]/90',
    sidebarBorder: 'border-[#0e4b3b]',
    sidebarNavHover: 'text-emerald-200 hover:bg-[#0a3d30] hover:text-gold',
    mobileHeader: 'bg-[#06281f]',
    mobileHeaderBorder: 'border-[#0e4b3b]'
  },
  sapphire: {
    wrapper: 'bg-[#060f1e] text-slate-100',
    sidebar: 'bg-[#0b1b36] text-white',
    sidebarHeader: 'bg-[#10254a]/90',
    sidebarBorder: 'border-[#18366a]',
    sidebarNavHover: 'text-blue-200 hover:bg-[#122a54] hover:text-gold',
    mobileHeader: 'bg-[#0b1b36]',
    mobileHeaderBorder: 'border-[#18366a]'
  },
  classic: {
    wrapper: 'bg-[#f8f5ee] text-stone-900',
    sidebar: 'bg-[#261f18] text-white',
    sidebarHeader: 'bg-[#382e24]/90',
    sidebarBorder: 'border-[#42362b]',
    sidebarNavHover: 'text-stone-300 hover:bg-[#382e24] hover:text-gold',
    mobileHeader: 'bg-[#261f18]',
    mobileHeaderBorder: 'border-[#42362b]'
  },
  sky: {
    wrapper: 'bg-sky-200 text-zinc-900',
    sidebar: 'bg-sky-600 text-white',
    sidebarHeader: 'bg-sky-700/50',
    sidebarBorder: 'border-sky-500',
    sidebarNavHover: 'text-sky-100 hover:bg-sky-500 hover:text-gold',
    mobileHeader: 'bg-sky-600',
    mobileHeaderBorder: 'border-sky-500'
  }
};

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
  const [currentTheme, setCurrentTheme] = useState<AppTheme>('obsidian');
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

  // Apply theme to document root
  const handleThemeChange = async (theme: AppTheme) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nafees_theme', theme);
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

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      const rate = await db.settings.get('goldRate');
      const name = await db.settings.get('shopName');
      const address = await db.settings.get('shopAddress');
      const phone = await db.settings.get('shopPhone');
      const phone2 = await db.settings.get('shopPhone2');
      const pin = await db.settings.get('appPin');
      const savedTheme = await db.settings.get('appTheme');
      const savedTicker = await db.settings.get('showSarafaTicker');
      const savedStockStyle = await db.settings.get('stockCardStyle');
      const savedWeightUnit = await db.settings.get('defaultWeightUnit');
      
      if (rate) setGoldRate(rate.value);

      // Theme initialization
      const initialTheme: AppTheme = savedTheme?.value || (localStorage.getItem('nafees_theme') as AppTheme) || 'obsidian';
      setCurrentTheme(initialTheme);
      document.documentElement.setAttribute('data-theme', initialTheme);

      if (savedTicker !== undefined && savedTicker.value !== undefined) {
        setShowSarafaTicker(Boolean(savedTicker.value));
      }
      if (savedStockStyle?.value) {
        setStockCardStyle(savedStockStyle.value);
      }
      if (savedWeightUnit?.value) {
        setDefaultWeightUnit(savedWeightUnit.value);
      }

      if (name) {
        if (name.value === "سیف جیولرز" || name.value === "Saif jeweller's" || name.value === "Saif Jeweller's") {
          const newVal = translations.ur.shopName;
          await db.settings.put({key: 'shopName', value: newVal});
          setShopName(newVal);
        } else {
          setShopName(name.value);
        }
      } else {
        const newVal = translations.ur.shopName;
        await db.settings.put({key: 'shopName', value: newVal});
        setShopName(newVal);
      }
      if (address) setShopAddress(address.value);
      
      if (phone) {
        if (phone.value === "03135722659") {
          const newVal = translations.ur.shopPhone;
          await db.settings.put({key: 'shopPhone', value: newVal});
          setShopPhone(newVal);
        } else {
          setShopPhone(phone.value);
        }
      } else {
        const newVal = translations.ur.shopPhone;
        await db.settings.put({key: 'shopPhone', value: newVal});
        setShopPhone(newVal);
      }
      
      if (phone2) {
        if (phone2.value === "03433977727") {
          const newVal = translations.ur.shopPhone2;
          await db.settings.put({key: 'shopPhone2', value: newVal});
          setShopPhone2(newVal);
        } else {
          setShopPhone2(phone2.value);
        }
      } else {
        const newVal = translations.ur.shopPhone2;
        await db.settings.put({key: 'shopPhone2', value: newVal});
        setShopPhone2(newVal);
      }
      if (pin && pin.value) {
        setAppPin(pin.value);
        setIsLocked(true);
      }
      
      setTimeout(() => setIsLoading(false), 800);
    };
    fetchSettings();
  }, []);

  // Handle native & web back-button navigation and exit behaviors
  useEffect(() => {
    let lastTime = 0;
    let toastTimeout: NodeJS.Timeout;

    // listener for Capacitor App Back Button and exit app logic
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
      } catch (err) {
        console.warn('Capacitor App backButton listener not supported or failed to bind', err);
        return null;
      }
    };

    const handlerPromise = setupBackListener();

    // Standard Web browser history state / popstate listeners
    const handlePopState = (e: PopStateEvent) => {
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

    // Synchronize browser history stack
    if (!window.history.state || window.history.state.section !== activeSection) {
      window.history.pushState({ section: activeSection }, '');
    }

    return () => {
      handlerPromise.then(h => h && h.remove());
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(toastTimeout);
    };
  }, [activeSection]);

  const navItems = [
    { id: 'billing', icon: Receipt, label: t.billing },
    { id: 'purchases', icon: ShoppingBag, label: t.purchaseGold || "سونا خریدیں" },
    { id: 'records', icon: History, label: t.records },
    { id: 'orders', icon: Package, label: t.orders },
    { id: 'karigar', icon: Users, label: t.karigar },
    { id: 'khaata', icon: Wallet, label: t.khaata },
    { id: 'repairs', icon: Wrench, label: t.repairs },
    { id: 'stock', icon: Package, label: t.stock },
    { id: 'customers', icon: Users, label: t.customers },
    { id: 'expenses', icon: Wallet, label: t.expenses },
    { id: 'reports', icon: BarChart3, label: t.reports },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'billing': return <Billing lang={lang} editingSale={editingSale} setEditingSale={setEditingSale} />;
      case 'purchases': return <Purchases lang={lang} />;
      case 'records': return <Records lang={lang} setActiveSection={setActiveSection} setEditingSale={setEditingSale} />;
      case 'orders': return <Orders lang={lang} />;
      case 'karigar': return <Karigar lang={lang} />;
      case 'khaata': return <Khaata lang={lang} />;
      case 'repairs': return <Repairs lang={lang} />;
      case 'stock': return <Stock lang={lang} />;
      case 'customers': return <Customers lang={lang} />;
      case 'expenses': return <Expenses lang={lang} />;
      case 'reports': return <Reports lang={lang} />;
      case 'settings': return (
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
      default: return <Billing lang={lang} editingSale={editingSale} setEditingSale={setEditingSale} />;
    }
  };

  const themeStyle = THEME_STYLES[currentTheme] || THEME_STYLES.obsidian;

  if (isLoading) {
    return (
      <div className={cn("fixed inset-0 flex flex-col items-center justify-center", themeStyle.wrapper)}>
        <div className="w-24 h-24 bg-zinc-950 border-2 border-gold rounded-full flex items-center justify-center mb-4 shadow-2xl p-3">
          <img src={APP_CONFIG.appIcon} alt="Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-3xl font-bold urdu-text gold-metallic-text tracking-wide">{shopName}</h1>
        <div className="mt-4 animate-pulse text-gold text-sm urdu-text">لوڈ ہو رہا ہے...</div>
      </div>
    );
  }

  if (isLocked && appPin) {
    return (
      <LockScreen 
        lang={lang} 
        correctPin={appPin} 
        shopName={shopName}
        onUnlock={() => setIsLocked(false)} 
      />
    );
  }

  return (
    <div className={cn(
      "min-h-screen flex transition-colors duration-300",
      themeStyle.wrapper,
      isRTL ? "flex-row-reverse text-right" : "flex-row text-left"
    )} dir={isRTL ? "rtl" : "ltr"}>
      {/* Sidebar Desktop */}
      <aside className={cn(
        "hidden lg:flex flex-col w-72 h-screen sticky top-0 shadow-2xl z-40 transition-colors duration-300",
        themeStyle.sidebar,
        isRTL ? cn("order-last border-l", themeStyle.sidebarBorder) : cn("order-first border-r", themeStyle.sidebarBorder)
      )}>
        <div className={cn("p-6 border-b flex flex-col items-center gap-3.5 relative", themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
          <div className="relative group">
            <div className="absolute inset-0 bg-gold blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <img 
              src={APP_CONFIG.appIcon} 
              alt="Logo" 
              className="w-18 h-18 object-contain rounded-2xl bg-zinc-950 border border-gold/40 p-2 relative z-10 shadow-xl" 
              referrerPolicy="no-referrer" 
            />
          </div>
          <div className="text-center space-y-1 w-full">
            <h1 className="text-2xl font-black urdu-text gold-metallic-text tracking-tight">{shopName}</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold line-clamp-1">{shopAddress}</p>
            <div className="flex flex-col items-center justify-center gap-1 mt-3 bg-black/30 px-3.5 py-2 rounded-xl border border-white/10 shadow-inner" dir="ltr">
              <div className="flex items-center gap-2">
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="w-4 h-4" alt="WhatsApp" referrerPolicy="no-referrer" />
                <span className="font-mono text-sm font-bold text-white">{shopPhone}</span>
              </div>
              {shopPhone2 && (
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="font-mono text-xs font-semibold">{shopPhone2}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-5 px-3.5 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as Section)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                activeSection === item.id 
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-lg shadow-amber-500/20 font-black" 
                  : themeStyle.sidebarNavHover
              )}
            >
              {activeSection === item.id && (
                <motion.div layoutId="nav-bg" className="absolute inset-0 bg-gold" />
              )}
              <item.icon size={18} className={cn("relative z-10 shrink-0", activeSection === item.id ? "text-black" : "group-hover:scale-110 transition-transform")} />
              <span className="urdu-text text-sm relative z-10 font-bold">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Controls: Theme Picker, Settings & Language */}
        <div className={cn("p-4 border-t space-y-2", themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
          {/* Quick Theme Switcher Button */}
          <button
            onClick={() => setIsThemeModalOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 font-bold transition-all shadow-sm group"
            title={lang === 'ur' ? 'تھیم اور رنگ تبدیل کریں' : 'Change Theme & Colors'}
          >
            <div className="flex items-center gap-2">
              <Palette size={18} className="group-hover:rotate-45 transition-transform" />
              <span className="urdu-text text-xs">{lang === 'ur' ? 'رنگ اور تھیم' : 'Theme Colors'}</span>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-gold text-black font-mono">
              {currentTheme}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveSection('settings')}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all text-xs font-bold",
                activeSection === 'settings' 
                  ? "bg-white text-zinc-950 shadow-md" 
                  : "bg-black/30 text-zinc-300 hover:text-white border border-white/10"
              )}
            >
              <SettingsIcon size={16} />
              <span className="urdu-text">{t.settings}</span>
            </button>
            <button 
              onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-black/30 text-zinc-300 hover:text-gold transition-all border border-white/10 text-xs font-bold"
            >
              <Languages size={16} />
              <span>{lang === 'ur' ? 'English' : 'اردو'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className={cn(
        "lg:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 border-b shadow-xl transition-colors duration-300",
        themeStyle.mobileHeader,
        themeStyle.mobileHeaderBorder
      )}>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-zinc-300 hover:text-white">
          <Menu size={26} />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-base font-bold urdu-text gold-metallic-text leading-tight">{shopName}</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15" dir="ltr">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-mono text-white font-bold">{shopPhone}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsThemeModalOpen(true)} 
            className="p-2 text-gold hover:text-white"
            title={lang === 'ur' ? 'تھیم منتخب کریں' : 'Change Theme'}
          >
            <Palette size={20} />
          </button>
          <button onClick={() => setLang(lang === 'ur' ? 'en' : 'ur')} className="p-2 text-zinc-300 hover:text-white">
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
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/75 z-[60] lg:hidden backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              className={cn(
                "fixed top-0 bottom-0 w-[285px] max-w-[85vw] z-[70] lg:hidden flex flex-col border-x shadow-2xl",
                themeStyle.sidebar,
                themeStyle.sidebarBorder,
                isRTL ? "right-0" : "left-0"
              )}
            >
              <div className={cn("p-5 border-b flex justify-between items-center", themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
                <h1 className="text-lg font-black urdu-text gold-metallic-text truncate pr-2">{shopName}</h1>
                <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-400 hover:text-white p-1 shrink-0">
                  <X size={22} />
                </button>
              </div>
              <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id as Section);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all",
                      activeSection === item.id 
                        ? "bg-gold text-black font-black shadow-lg shadow-gold/20" 
                        : themeStyle.sidebarNavHover
                    )}
                  >
                    <item.icon size={18} />
                    <span className="urdu-text text-sm truncate font-bold">{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className={cn("p-4 border-t space-y-2", themeStyle.sidebarHeader, themeStyle.sidebarBorder)}>
                <button
                  onClick={() => {
                    setIsThemeModalOpen(true);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gold/10 text-gold border border-gold/30 font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Palette size={18} />
                    <span className="urdu-text text-xs">{lang === 'ur' ? 'تھیم اور رنگ تبدیل کریں' : 'Change Theme'}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-gold text-black font-mono font-bold uppercase">{currentTheme}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setActiveSection('settings');
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold transition-all text-xs",
                      activeSection === 'settings' 
                        ? "bg-white text-zinc-950 font-black shadow-lg" 
                        : "text-zinc-300 bg-black/40 border border-white/10"
                    )}
                  >
                    <SettingsIcon size={16} />
                    <span className="urdu-text">{t.settings}</span>
                  </button>
                  <button 
                    onClick={() => {
                      setLang(lang === 'ur' ? 'en' : 'ur');
                      setIsSidebarOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-black/40 text-zinc-300 transition-all border border-white/10 font-bold text-xs"
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
      <main className="flex-1 p-4 lg:p-8 mt-16 lg:mt-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Top Live Sarafa Market Bullion Board */}
          {showSarafaTicker && (
            <SarafaTicker 
              baseRate={goldRate} 
              lang={lang} 
              onRateChange={(newRate) => setGoldRate(newRate)} 
            />
          )}

          {/* Active Module */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
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

      {/* Toast Notification for back button exit */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 bg-zinc-900 border border-gold/40 text-white rounded-full font-bold shadow-2xl flex items-center gap-2 z-[9999]"
          >
            <span className="text-gold">⚠️</span>
            <span className="urdu-text text-sm font-bold">{t.doubleBackExit}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
