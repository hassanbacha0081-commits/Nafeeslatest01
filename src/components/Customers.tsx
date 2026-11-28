import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  type Sale,
  type Order,
  type Repair,
  type GoldPurchase,
  type KhaataAccount,
  type KhaataEntry
} from '../db';
import {
  Search,
  User,
  Phone,
  History,
  CreditCard,
  Package,
  Wrench,
  ShoppingBag,
  BookOpen,
  Printer,
  X,
  Download,
  Image as ImageIcon,
  Coins
} from 'lucide-react';
import { formatWhatsAppUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Printer as CapPrinter } from '@capgo/capacitor-printer';
import { APP_CONFIG } from '../config';
import { PrintReceipt } from './PrintReceipt';
import ImageLightbox from './ImageLightbox';
import { WhatsAppLogo } from './PhoneChannelLogos';
import { printElementDirectly } from '../lib/printUtils';
import { useDebouncedValue } from '../lib/useDebouncedValue';

interface CustomersProps {
  lang: string;
}

interface NormalizedKhaataItem {
  entry: KhaataEntry;
  accountName: string;
  details: string;
  pureWeight: number;
  pasaDia: number;
}

interface CustomerProfile {
  key: string;
  name: string;
  phone: string;
  totalSpent: number;
  totalReceived: number;
  totalRemaining: number;
  totalPurchasesAmt: number;
  totalPurchasesWt: number;
  pendingRepairCharges: number;
  khaataGoldBalance: number;
  khaataAccounts: KhaataAccount[];
  khaataEntries: NormalizedKhaataItem[];
  lastVisitTimestamp: number;
  lastVisitDisplay: string;
  transactionCount: number;
  sales: Sale[];
  orders: Order[];
  repairs: Repair[];
  purchases: GoldPurchase[];
}

type DirectoryFilter = 'all' | 'due' | 'orders' | 'khaata';
type ProfileTab = 'all' | 'sales' | 'orders' | 'repairs' | 'purchases' | 'khaata';

function normalizePhoneKey(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';
  return digits.slice(-10);
}

function parseFlexibleDate(val: Date | string | undefined): { ts: number; display: string } {
  if (!val) return { ts: 0, display: '-' };
  if (val instanceof Date) {
    const t = val.getTime();
    if (isNaN(t)) return { ts: 0, display: '-' };
    return { ts: t, display: val.toLocaleDateString('en-GB') };
  }
  const str = String(val).trim();
  if (!str) return { ts: 0, display: '-' };

  // Match DD/MM/YYYY or D/M/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]) - 1;
    const year = Number(dmyMatch[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return { ts: d.getTime(), display: str };
    }
  }

  // Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]) - 1;
    const day = Number(ymdMatch[3]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return { ts: d.getTime(), display: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}` };
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return { ts: parsed.getTime(), display: parsed.toLocaleDateString('en-GB') };
  }
  return { ts: 0, display: str };
}

function extractNum(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function getKhaataPureAndPasa(entry: any): { details: string; pureWeight: number; pasaDia: number } {
  const details =
    String(
      entry.details ||
        entry.itemDetail ||
        entry.description ||
        entry.notes ||
        'تفصیل'
    ).trim() || 'تفصیل';

  const rawMix = extractNum(entry.mixWeight ?? entry.mixWazan ?? entry.weight ?? 0);
  const rawKaat = extractNum(entry.kaatRati ?? entry.kaatInRati ?? entry.kaat ?? 0);
  const pasaDia = extractNum(entry.pasaDia ?? entry.pasaGiven ?? entry.given ?? 0);

  const rawPureRaw = entry.pureWeight ?? entry.itemPasa ?? entry.pasaJama;
  let pureWeight = 0;
  if (rawPureRaw !== undefined && rawPureRaw !== null && rawPureRaw !== '' && Number(rawPureRaw) > 0) {
    pureWeight = extractNum(rawPureRaw);
  } else if (rawMix > 0) {
    const ratiFactor = rawKaat > 0 ? (rawKaat <= 48 ? 96 - rawKaat : rawKaat) : 96;
    pureWeight = parseFloat(((rawMix / 96) * ratiFactor).toFixed(3));
  }

  return { details, pureWeight, pasaDia };
}

export default function Customers({ lang }: CustomersProps) {
  const isUrdu = lang === 'ur';
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 150);
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTab>('all');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [printData, setPrintData] = useState<{
    type: 'sale' | 'order' | 'repair' | 'purchase';
    data: Sale | Order | Repair | GoldPurchase;
    id?: number;
  } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const sales = useLiveQuery(() => db.sales.toArray(), []) || [];
  const orders = useLiveQuery(() => db.orders.toArray(), []) || [];
  const repairs = useLiveQuery(() => db.repairs.toArray(), []) || [];
  const purchases = useLiveQuery(() => db.goldPurchases.toArray(), []) || [];
  const khaataAccounts = useLiveQuery(() => db.khaataAccounts.toArray(), []) || [];
  const khaataEntries = useLiveQuery(() => db.khaata.toArray(), []) || [];

  const previewScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (printData && previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }
  }, [printData]);

  const openReceiptModal = async (
    type: 'sale' | 'order' | 'repair' | 'purchase',
    data: Sale | Order | Repair | GoldPurchase,
    id?: number
  ) => {
    setPrintData({ type, data, id });
    setPdfUrl(null);
    setTimeout(async () => {
      if (!printRef.current) return;
      try {
        window.scrollTo(0, 0);
        if (previewScrollRef.current) previewScrollRef.current.scrollTop = 0;
        const isA4 = type === 'order' || type === 'purchase';
        const wStr = isA4 ? '1000px' : '800px';
        const hStr = isA4 ? '1414px' : '1135px';
        const pdfWidth = isA4 ? 21.0 : 14.8;
        const canvas = await html2canvas(printRef.current, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: false,
          windowWidth: isA4 ? 1000 : 800,
          onclone: (clonedDoc) => {
            clonedDoc.body.style.margin = '0';
            clonedDoc.body.style.padding = '0';
            clonedDoc.body.style.backgroundColor = '#ffffff';
            clonedDoc.body.style.width = wStr;
            const el = clonedDoc.querySelector('.print-receipt-container') as HTMLElement;
            if (el) {
              clonedDoc.body.innerHTML = '';
              clonedDoc.body.appendChild(el);
              el.style.margin = '0';
              el.style.padding = '0.8cm';
              el.style.width = wStr;
              el.style.minHeight = hStr;
              el.style.height = 'auto';
              el.style.display = 'block';
              el.style.position = 'relative';
            }
          }
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfHeight = (canvas.height / canvas.width) * pdfWidth;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'cm',
          format: [pdfWidth, pdfHeight]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        setPdfUrl(pdf.output('datauristring'));
      } catch (err) {
        console.error('Receipt PDF generation failed:', err);
      }
    }, 350);
  };

  const executePrint = async () => {
    if (Capacitor.isNativePlatform() && pdfUrl) {
      try {
        await CapPrinter.printBase64({
          name: `Receipt_${printData?.id || 'record'}`,
          data: pdfUrl.split(',')[1],
          mimeType: 'application/pdf'
        });
        return;
      } catch {
        // fallback below
      }
    }
    await printElementDirectly(printRef.current, {
      documentTitle: `${printData?.type || 'Receipt'}_${printData?.id || 'record'}`,
      fallbackPdfUrl: pdfUrl,
    });
  };

  const downloadPDF = async () => {
    if (!pdfUrl) return;
    if (Capacitor.isNativePlatform()) {
      try {
        const saved = await Filesystem.writeFile({
          path: `Customer_Receipt_${printData?.id || Date.now()}.pdf`,
          data: pdfUrl.split(',')[1],
          directory: Directory.Cache
        });
        await Share.share({ title: 'Receipt', url: saved.uri });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Receipt_${printData?.type || 'bill'}_${printData?.id || 'doc'}.pdf`;
      link.click();
    }
  };

  // Build unified all-in-one customer profiles across Sales, Orders, Repairs, Purchases, and Khaata
  const customerProfiles = useMemo(() => {
    const map = new Map<string, CustomerProfile>();
    const nameToPhoneKey = new Map<string, string>();

    const registerKey = (rawName: string, rawPhone: string): string => {
      const cleanName = (rawName || '').trim() || (isUrdu ? 'نامعلوم گاہک' : 'Unknown Customer');
      const cleanPhone = (rawPhone || '').trim();
      const phoneKey = normalizePhoneKey(cleanPhone);

      if (phoneKey) {
        nameToPhoneKey.set(cleanName.toLowerCase(), `p:${phoneKey}`);
        return `p:${phoneKey}`;
      }
      const mapped = nameToPhoneKey.get(cleanName.toLowerCase());
      if (mapped) return mapped;
      return `n:${cleanName.toLowerCase()}`;
    };

    // Pre-index phone numbers from all tables so name-only entries attach to matching phone records
    const seedPhoneIndex = (name?: string, phone?: string) => {
      const cn = (name || '').trim().toLowerCase();
      const pk = normalizePhoneKey(phone);
      if (cn && pk && !nameToPhoneKey.has(cn)) {
        nameToPhoneKey.set(cn, `p:${pk}`);
      }
    };
    sales.forEach(s => seedPhoneIndex(s.name, s.phone));
    orders.forEach(o => seedPhoneIndex(o.name, o.phone));
    repairs.forEach(r => seedPhoneIndex(r.customerName, r.customerPhone));
    purchases.forEach(p => seedPhoneIndex(p.name, p.phone));
    khaataAccounts.forEach(a => seedPhoneIndex(a.name, a.phone));

    const getOrCreate = (rawName: string, rawPhone: string): CustomerProfile => {
      const key = registerKey(rawName, rawPhone);
      const cleanName = (rawName || '').trim() || (isUrdu ? 'نامعلوم گاہک' : 'Unknown Customer');
      const cleanPhone = (rawPhone || '').trim();
      let profile = map.get(key);
      if (!profile) {
        profile = {
          key,
          name: cleanName,
          phone: cleanPhone && cleanPhone !== '-' ? cleanPhone : '-',
          totalSpent: 0,
          totalReceived: 0,
          totalRemaining: 0,
          totalPurchasesAmt: 0,
          totalPurchasesWt: 0,
          pendingRepairCharges: 0,
          khaataGoldBalance: 0,
          khaataAccounts: [],
          khaataEntries: [],
          lastVisitTimestamp: 0,
          lastVisitDisplay: '-',
          transactionCount: 0,
          sales: [],
          orders: [],
          repairs: [],
          purchases: []
        };
        map.set(key, profile);
      } else {
        if (profile.phone === '-' && cleanPhone && cleanPhone !== '-') {
          profile.phone = cleanPhone;
        }
        if (
          (profile.name === 'Unknown Customer' || profile.name === 'نامعلوم گاہک' || profile.name === 'کسٹمر') &&
          cleanName
        ) {
          profile.name = cleanName;
        }
      }
      return profile;
    };

    const touchDate = (profile: CustomerProfile, dateVal: Date | string | undefined) => {
      const parsed = parseFlexibleDate(dateVal);
      if (parsed.ts >= profile.lastVisitTimestamp) {
        profile.lastVisitTimestamp = parsed.ts;
        profile.lastVisitDisplay = parsed.display;
      } else if (profile.lastVisitDisplay === '-' && parsed.display !== '-') {
        profile.lastVisitDisplay = parsed.display;
      }
    };

    sales.forEach(s => {
      const p = getOrCreate(s.name, s.phone);
      p.sales.push(s);
      p.totalSpent += Number(s.total) || 0;
      p.totalReceived += Number(s.rec) || 0;
      p.totalRemaining += Number(s.rem) || 0;
      p.transactionCount += 1;
      touchDate(p, s.date);
    });

    orders.forEach(o => {
      const p = getOrCreate(o.name, o.phone);
      p.orders.push(o);
      p.totalSpent += Number(o.total) || 0;
      const paid = (o.payments || []).reduce((acc, pay) => acc + (Number(pay.amt) || 0), 0);
      p.totalReceived += paid;
      p.totalRemaining += Number(o.rem) || 0;
      p.transactionCount += 1;
      touchDate(p, o.date);
    });

    repairs.forEach(r => {
      const p = getOrCreate(r.customerName, r.customerPhone);
      p.repairs.push(r);
      if (r.status === 'Pending') {
        p.pendingRepairCharges += Number(r.charges) || 0;
      }
      p.transactionCount += 1;
      touchDate(p, r.date);
    });

    purchases.forEach(gp => {
      const p = getOrCreate(gp.name, gp.phone);
      p.purchases.push(gp);
      p.totalPurchasesAmt += Number(gp.total) || 0;
      p.totalPurchasesWt += Number(gp.weight) || 0;
      p.transactionCount += 1;
      touchDate(p, gp.date);
    });

    // Attach Khaata accounts & compute net gold balance
    const accountIdToProfile = new Map<number, { profile: CustomerProfile; accName: string }>();
    khaataAccounts.forEach(acc => {
      if (acc._deletedAt) return;
      const p = getOrCreate(acc.name, acc.phone || '');
      p.khaataAccounts.push(acc);
      if (acc.id !== undefined) {
        accountIdToProfile.set(Number(acc.id), { profile: p, accName: acc.name });
      }
      if (acc.date) touchDate(p, acc.date);
    });

    khaataEntries.forEach(entry => {
      if (entry._deletedAt) return;
      const linked = accountIdToProfile.get(Number(entry.accountId));
      if (!linked) return;
      const { details, pureWeight, pasaDia } = getKhaataPureAndPasa(entry);
      linked.profile.khaataEntries.push({
        entry,
        accountName: linked.accName,
        details,
        pureWeight,
        pasaDia
      });
      linked.profile.khaataGoldBalance = Number(
        (linked.profile.khaataGoldBalance + pureWeight - pasaDia).toFixed(3)
      );
      linked.profile.transactionCount += 1;
      touchDate(linked.profile, entry.date);
    });

    // Sort internal lists newest-first
    map.forEach(profile => {
      profile.sales.sort((a, b) => (b.id || 0) - (a.id || 0));
      profile.orders.sort((a, b) => (b.id || 0) - (a.id || 0));
      profile.repairs.sort((a, b) => (b.id || 0) - (a.id || 0));
      profile.purchases.sort((a, b) => (b.id || 0) - (a.id || 0));
      profile.khaataEntries.sort((a, b) => (b.entry.id || 0) - (a.entry.id || 0));
      if (Math.abs(profile.khaataGoldBalance) < 0.0001) {
        profile.khaataGoldBalance = 0;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.lastVisitTimestamp !== a.lastVisitTimestamp) {
        return b.lastVisitTimestamp - a.lastVisitTimestamp;
      }
      return b.totalSpent - a.totalSpent;
    });
  }, [sales, orders, repairs, purchases, khaataAccounts, khaataEntries, isUrdu]);

  const filteredCustomers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return customerProfiles.filter(c => {
      if (directoryFilter === 'due' && c.totalRemaining <= 0 && c.khaataGoldBalance <= 0) return false;
      if (directoryFilter === 'orders' && c.orders.length === 0) return false;
      if (directoryFilter === 'khaata' && c.khaataAccounts.length === 0) return false;

      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        c.sales.some(s => (s.items || []).some(i => (i.n || '').toLowerCase().includes(q))) ||
        c.orders.some(o => (o.item || '').toLowerCase().includes(q)) ||
        c.repairs.some(r => (r.item || '').toLowerCase().includes(q))
      );
    });
  }, [customerProfiles, debouncedSearch, directoryFilter]);

  const visibleCustomers = useMemo(() => filteredCustomers.slice(0, visibleLimit), [filteredCustomers, visibleLimit]);

  const selectedCustomer = useMemo(() => {
    if (selectedKey) {
      const found = customerProfiles.find(c => c.key === selectedKey);
      if (found) return found;
    }
    return filteredCustomers[0] || null;
  }, [customerProfiles, filteredCustomers, selectedKey]);

  const buildWhatsAppReminderUrl = (customer: CustomerProfile) => {
    const lines = [
      `محترم ${customer.name} صاحب، ${APP_CONFIG.shopNameUrdu} کی جانب سے تفصیل:`,
      customer.totalRemaining > 0
        ? `• بقایا رقم (Cash Due): Rs. ${customer.totalRemaining.toLocaleString()}`
        : null,
      customer.khaataGoldBalance !== 0
        ? `• کھاتہ سونا بقایا (Khaata Gold): ${customer.khaataGoldBalance.toFixed(3)}g`
        : null,
      customer.pendingRepairCharges > 0
        ? `• ریپیئرنگ چارجز: Rs. ${customer.pendingRepairCharges.toLocaleString()}`
        : null,
      `شکریہ! (${APP_CONFIG.phone1})`
    ].filter(Boolean);
    return formatWhatsAppUrl(customer.phone, lines.join('\n'));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Directory Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-sky-100">
        <div>
          <h2 className="text-3xl font-black text-sky-900 tracking-tight urdu-text">
            {isUrdu ? 'آل ان ون گاہک پروفائل' : 'All-in-One Customer Profiles'}
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            {isUrdu
              ? 'بلز، آرڈرز، ریپیئرنگ، پرانا سونا اور کھاتہ ایک ہی جگہ دیکھیں'
              : 'Bills, orders, repairs, gold purchases & khaata combined in one profile'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400" size={18} />
            <input
              type="text"
              placeholder={isUrdu ? 'نام، فون یا آئٹم تلاش کریں...' : 'Search name, phone, or item...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-sky-50 border border-sky-100 rounded-2xl focus:ring-2 focus:ring-gold focus:bg-white outline-none transition-all text-sm font-medium text-zinc-900"
            />
          </div>
        </div>
      </div>

      {/* Directory Quick Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: isUrdu ? `تمام گاہک (${customerProfiles.length})` : `All (${customerProfiles.length})` },
            {
              id: 'due',
              label: isUrdu
                ? `ادھار / بقایا (${customerProfiles.filter(c => c.totalRemaining > 0 || c.khaataGoldBalance > 0).length})`
                : `Due / Udhaar (${customerProfiles.filter(c => c.totalRemaining > 0 || c.khaataGoldBalance > 0).length})`
            },
            {
              id: 'orders',
              label: isUrdu
                ? `آرڈرز والے (${customerProfiles.filter(c => c.orders.length > 0).length})`
                : `With Orders (${customerProfiles.filter(c => c.orders.length > 0).length})`
            },
            {
              id: 'khaata',
              label: isUrdu
                ? `کھاتہ دار (${customerProfiles.filter(c => c.khaataAccounts.length > 0).length})`
                : `Khaata Holders (${customerProfiles.filter(c => c.khaataAccounts.length > 0).length})`
            }
          ] as { id: DirectoryFilter; label: string }[]
        ).map(chip => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setDirectoryFilter(chip.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              directoryFilter === chip.id
                ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                : 'bg-white text-zinc-600 border-sky-100 hover:border-sky-300'
            } ${isUrdu ? 'urdu-text' : ''}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Directory List */}
        <div className="lg:col-span-1 space-y-3 max-h-[75vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-sky-200">
          {visibleCustomers.map((customer) => {
            const isSelected = selectedCustomer?.key === customer.key;
            return (
              <button
                key={customer.key}
                type="button"
                onClick={() => {
                  setSelectedKey(customer.key);
                  setActiveProfileTab('all');
                }}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 border-sky-600 shadow-lg shadow-sky-200'
                    : 'bg-white border-sky-100 hover:border-sky-300 hover:shadow-sm'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-sky-50 text-sky-600'
                  }`}
                >
                  {customer.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate urdu-text text-sm ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {customer.name}
                  </h3>
                  <p
                    className={`text-xs font-mono font-medium truncate ${isSelected ? 'text-sky-100' : 'text-zinc-400'}`}
                    dir="ltr"
                  >
                    {customer.phone}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {customer.sales.length > 0 && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-sky-50 text-sky-700'
                        }`}
                      >
                        {customer.sales.length} Bill
                      </span>
                    )}
                    {customer.orders.length > 0 && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {customer.orders.length} Order
                      </span>
                    )}
                    {customer.repairs.length > 0 && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {customer.repairs.length} Repair
                      </span>
                    )}
                    {customer.khaataAccounts.length > 0 && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        Khaata
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {customer.totalSpent > 0 && (
                    <p className={`font-black text-xs font-mono ${isSelected ? 'text-gold' : 'text-sky-700'}`}>
                      Rs. {customer.totalSpent.toLocaleString()}
                    </p>
                  )}
                  {customer.totalRemaining > 0 && (
                    <p
                      className={`text-[10px] font-bold font-mono mt-0.5 ${
                        isSelected ? 'text-red-200' : 'text-red-600'
                      }`}
                    >
                      Due: {customer.totalRemaining.toLocaleString()}
                    </p>
                  )}
                  {customer.khaataGoldBalance !== 0 && (
                    <p
                      className={`text-[10px] font-bold font-mono mt-0.5 ${
                        isSelected ? 'text-amber-200' : 'text-amber-700'
                      }`}
                    >
                      Gold: {customer.khaataGoldBalance.toFixed(2)}g
                    </p>
                  )}
                </div>
              </button>
            );
          })}

          {filteredCustomers.length > visibleLimit && (
            <button
              type="button"
              onClick={() => setVisibleLimit((n) => n + 60)}
              className="w-full py-2.5 rounded-xl bg-white border border-sky-200 text-sky-700 font-bold text-xs hover:bg-sky-50 transition-colors cursor-pointer urdu-text"
            >
              {isUrdu
                ? `مزید گاہک دیکھیں (${filteredCustomers.length - visibleLimit})`
                : `Load More (${filteredCustomers.length - visibleLimit} remaining)`}
            </button>
          )}

          {filteredCustomers.length === 0 && (
            <div className="py-16 text-center bg-white rounded-3xl border-2 border-dashed border-sky-100">
              <User className="mx-auto text-sky-200 mb-3" size={44} />
              <p className="text-zinc-400 urdu-text text-sm">{isUrdu ? 'کوئی گاہک نہیں ملا' : 'No customers found'}</p>
            </div>
          )}
        </div>

        {/* Right All-in-One Profile Detail Panel */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedCustomer ? (
              <motion.div
                key={selectedCustomer.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl border border-sky-100 shadow-lg overflow-hidden"
              >
                {/* Profile Header */}
                <div className="bg-sky-600 p-6 sm:p-7 text-white relative">
                  <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start justify-between relative z-10">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                      <div className="w-18 h-18 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-3xl font-black shrink-0">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-black urdu-text leading-tight">
                          {selectedCustomer.name}
                        </h3>
                        <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2.5">
                          <a
                            href={selectedCustomer.phone !== '-' ? `tel:${selectedCustomer.phone}` : undefined}
                            className="flex items-center gap-1.5 bg-black/20 hover:bg-black/30 px-3 py-1 rounded-full text-xs font-bold border border-white/15 transition-colors"
                          >
                            <Phone size={13} className="text-gold" />
                            <span className="font-mono" dir="ltr">{selectedCustomer.phone}</span>
                          </a>
                          <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs font-bold border border-white/15">
                            <History size={13} className="text-gold" />
                            <span>
                              {isUrdu ? 'آخری وزٹ:' : 'Last:'} {selectedCustomer.lastVisitDisplay}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedCustomer.phone !== '-' &&
                      (selectedCustomer.totalRemaining > 0 ||
                        selectedCustomer.khaataGoldBalance !== 0 ||
                        selectedCustomer.pendingRepairCharges > 0) && (
                        <a
                          href={buildWhatsAppReminderUrl(selectedCustomer)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all shrink-0"
                        >
                          <WhatsAppLogo size={16} />
                          <span className={isUrdu ? 'urdu-text' : ''}>
                            {isUrdu ? 'واٹس ایپ یاد دہانی' : 'WhatsApp Reminder'}
                          </span>
                        </a>
                      )}
                  </div>
                </div>

                {/* Unified 4-Card Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-sky-50/50 border-b border-sky-100">
                  <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-wider">
                      {isUrdu ? 'کل بزنس' : 'Total Business'}
                    </p>
                    <p className="text-lg font-black text-sky-900 font-mono mt-1">
                      Rs. {selectedCustomer.totalSpent.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {selectedCustomer.sales.length} Bills • {selectedCustomer.orders.length} Orders
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border shadow-xs ${
                      selectedCustomer.totalRemaining > 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <p
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        selectedCustomer.totalRemaining > 0 ? 'text-red-500' : 'text-emerald-600'
                      }`}
                    >
                      {isUrdu ? 'کل بقیہ ادھار' : 'Cash Udhaar Due'}
                    </p>
                    <p
                      className={`text-lg font-black font-mono mt-1 ${
                        selectedCustomer.totalRemaining > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      Rs. {selectedCustomer.totalRemaining.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {selectedCustomer.totalRemaining > 0
                        ? isUrdu
                          ? 'وصولی باقی'
                          : 'Pending collection'
                        : isUrdu
                        ? 'کلیئر ہے'
                        : 'All clear'}
                    </p>
                  </div>

                  <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-xs">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
                      {isUrdu ? 'کھاتہ سونا بقایا' : 'Khaata Gold Bal'}
                    </p>
                    <p className="text-lg font-black text-amber-900 font-mono mt-1">
                      {selectedCustomer.khaataGoldBalance.toFixed(3)}g
                    </p>
                    <p className="text-[10px] text-amber-700/80 mt-0.5">
                      {selectedCustomer.khaataAccounts.length > 0
                        ? `${selectedCustomer.khaataEntries.length} ${isUrdu ? 'اندراجات' : 'entries'}`
                        : isUrdu
                        ? 'کوئی کھاتہ نہیں'
                        : 'No khaata'}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-sky-100 shadow-xs">
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-wider">
                      {isUrdu ? 'ریپیئر و خریداری' : 'Repairs & Gold Sold'}
                    </p>
                    <p className="text-lg font-black text-zinc-900 font-mono mt-1">
                      {selectedCustomer.repairs.length} / {selectedCustomer.purchases.length}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                      {selectedCustomer.totalPurchasesWt > 0
                        ? `${selectedCustomer.totalPurchasesWt.toFixed(2)}g sold`
                        : isUrdu
                        ? `${selectedCustomer.transactionCount} کل لین دین`
                        : `${selectedCustomer.transactionCount} total txns`}
                    </p>
                  </div>
                </div>

                {/* Inner Profile Module Tabs */}
                <div className="px-5 pt-4 pb-2 border-b border-sky-100 flex flex-wrap gap-2 bg-white">
                  {(
                    [
                      { id: 'all', label: isUrdu ? 'تمام تفصیل' : 'All' },
                      { id: 'sales', label: `${isUrdu ? 'بلز' : 'Bills'} (${selectedCustomer.sales.length})` },
                      { id: 'orders', label: `${isUrdu ? 'آرڈرز' : 'Orders'} (${selectedCustomer.orders.length})` },
                      { id: 'repairs', label: `${isUrdu ? 'ریپیئر' : 'Repairs'} (${selectedCustomer.repairs.length})` },
                      { id: 'purchases', label: `${isUrdu ? 'پرانا سونا' : 'Purchases'} (${selectedCustomer.purchases.length})` },
                      { id: 'khaata', label: `${isUrdu ? 'کھاتہ' : 'Khaata'} (${selectedCustomer.khaataEntries.length})` }
                    ] as { id: ProfileTab; label: string }[]
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveProfileTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeProfileTab === tab.id
                          ? 'bg-gold text-black shadow-xs'
                          : 'bg-sky-50 text-zinc-600 hover:bg-sky-100'
                      } ${isUrdu ? 'urdu-text' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Detailed Sections */}
                <div className="p-5 sm:p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                  {/* SALES BILLS */}
                  {(activeProfileTab === 'all' || activeProfileTab === 'sales') &&
                    selectedCustomer.sales.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-sky-900 urdu-text flex items-center gap-2">
                          <CreditCard size={17} className="text-sky-600" />
                          {isUrdu ? 'سیلز بلز (Sales Bills)' : 'Sales Bills'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedCustomer.sales.map((sale) => (
                            <div
                              key={sale.id}
                              className="p-4 rounded-2xl border border-sky-100 bg-sky-50/40 hover:bg-white hover:border-sky-300 transition-all space-y-2"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-[11px] font-black text-gold-dark font-mono">
                                    Bill #{1000 + (sale.id || 0)}
                                  </span>
                                  <p className="text-xs text-zinc-500 font-mono">{parseFlexibleDate(sale.date).display}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      sale.rem > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    {sale.rem > 0 ? `Due: Rs. ${sale.rem.toLocaleString()}` : 'Clear'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openReceiptModal('sale', sale, sale.id)}
                                    className="p-1.5 rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-gold hover:text-black hover:border-gold transition-colors cursor-pointer"
                                    title={isUrdu ? 'رسید دیکھیں / پرنٹ کریں' : 'View / Print Receipt'}
                                  >
                                    <Printer size={14} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-zinc-700 urdu-text line-clamp-2">
                                {(sale.items || []).map(i => `${i.n} (${i.w}g)`).join(' • ')}
                              </p>
                              <div className="flex justify-between items-center text-xs font-mono pt-1 border-t border-sky-100">
                                <span className="font-bold text-zinc-900">Total: Rs. {(Number(sale.total) || 0).toLocaleString()}</span>
                                <span className="text-emerald-700 font-bold">Paid: Rs. {(Number(sale.rec) || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* ORDERS */}
                  {(activeProfileTab === 'all' || activeProfileTab === 'orders') &&
                    selectedCustomer.orders.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-amber-900 urdu-text flex items-center gap-2">
                          <Package size={17} className="text-amber-600" />
                          {isUrdu ? 'آرڈرز (Custom Orders)' : 'Custom Orders'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedCustomer.orders.map((order) => (
                            <div
                              key={order.id}
                              className="p-4 rounded-2xl border border-amber-100 bg-amber-50/40 hover:bg-white hover:border-amber-300 transition-all space-y-2"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold text-zinc-900 text-sm urdu-text truncate">{order.item}</p>
                                  <p className="text-[11px] text-zinc-500 font-mono">
                                    Order #{1000 + (order.id || 0)} • Due: {parseFlexibleDate(order.due).display}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                      order.status === 'complete' || order.status === 'completed' || order.status === 'delivered'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {order.status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openReceiptModal('order', order, order.id)}
                                    className="p-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-gold hover:text-black hover:border-gold transition-colors cursor-pointer"
                                    title={isUrdu ? 'آرڈر رسید دیکھیں' : 'View Order Receipt'}
                                  >
                                    <Printer size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs font-mono pt-1 border-t border-amber-100">
                                <span className="font-bold text-zinc-900">Total: Rs. {(Number(order.total) || 0).toLocaleString()}</span>
                                <span className={(Number(order.rem) || 0) > 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                                  {(Number(order.rem) || 0) > 0 ? `Due: Rs. ${(Number(order.rem) || 0).toLocaleString()}` : 'Clear'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* REPAIRS */}
                  {(activeProfileTab === 'all' || activeProfileTab === 'repairs') &&
                    selectedCustomer.repairs.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-purple-900 urdu-text flex items-center gap-2">
                          <Wrench size={17} className="text-purple-600" />
                          {isUrdu ? 'ریپیئرنگ ریکارڈ (Repairs)' : 'Repairs'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedCustomer.repairs.map((repair) => (
                            <div
                              key={repair.id}
                              className="p-4 rounded-2xl border border-purple-100 bg-purple-50/40 hover:bg-white hover:border-purple-300 transition-all space-y-2"
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold text-zinc-900 text-sm urdu-text truncate">{repair.item}</p>
                                  <p className="text-xs text-zinc-500 urdu-text truncate">{repair.issue}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      repair.status === 'Done'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-orange-100 text-orange-700'
                                    }`}
                                  >
                                    {repair.status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openReceiptModal('repair', repair, repair.id)}
                                    className="p-1.5 rounded-lg bg-white border border-purple-200 text-purple-700 hover:bg-gold hover:text-black hover:border-gold transition-colors cursor-pointer"
                                    title={isUrdu ? 'ریپیئر رسید دیکھیں' : 'View Repair Receipt'}
                                  >
                                    <Printer size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs font-mono pt-1 border-t border-purple-100">
                                <span className="text-zinc-500">{parseFlexibleDate(repair.date).display}</span>
                                <span className="font-bold text-zinc-900">Rs. {(Number(repair.charges) || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* OLD GOLD PURCHASES */}
                  {(activeProfileTab === 'all' || activeProfileTab === 'purchases') &&
                    selectedCustomer.purchases.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-amber-900 urdu-text flex items-center gap-2">
                          <ShoppingBag size={17} className="text-amber-600" />
                          {isUrdu ? 'پرانا سونا خریداری (Gold Sold to Shop)' : 'Old Gold Sold to Shop'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedCustomer.purchases.map((gp) => (
                            <div
                              key={gp.id}
                              className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 hover:bg-white transition-all space-y-2"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Coins size={15} className="text-gold-dark" />
                                  <span className="font-bold font-mono text-zinc-900 text-sm">{gp.weight}g</span>
                                  <span className="text-xs text-zinc-500 font-mono">@ {(Number(gp.rate) || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {gp.img && (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImage(gp.img!)}
                                      className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-gold-dark cursor-pointer"
                                    >
                                      <ImageIcon size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openReceiptModal('purchase', gp, gp.id)}
                                    className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-gold hover:text-black cursor-pointer"
                                  >
                                    <Printer size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs font-mono pt-1 border-t border-zinc-200">
                                <span className="text-zinc-500">{parseFlexibleDate(gp.date).display}</span>
                                <span className="font-black text-amber-800">Paid: Rs. {(Number(gp.total) || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* KHAATA LEDGER ENTRIES */}
                  {(activeProfileTab === 'all' || activeProfileTab === 'khaata') &&
                    selectedCustomer.khaataEntries.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-black text-emerald-900 urdu-text flex items-center gap-2">
                          <BookOpen size={17} className="text-emerald-600" />
                          {isUrdu ? 'کھاتہ لیجر (Gold Khaata Ledger)' : 'Khaata Ledger'}
                        </h4>
                        <div className="space-y-2">
                          {selectedCustomer.khaataEntries.map((item, idx) => (
                            <div
                              key={item.entry.id || idx}
                              className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 flex flex-wrap justify-between items-center gap-2"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-zinc-900 urdu-text">{item.details}</p>
                                <p className="text-[11px] text-zinc-500 font-mono">
                                  {item.accountName} • {parseFlexibleDate(item.entry.date).display}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 text-xs font-mono">
                                {item.pureWeight > 0 && (
                                  <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                                    Pure: {item.pureWeight}g
                                  </span>
                                )}
                                {item.pasaDia > 0 && (
                                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                    Given: {item.pasaDia}g
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Empty tab fallback */}
                  {((activeProfileTab === 'sales' && selectedCustomer.sales.length === 0) ||
                    (activeProfileTab === 'orders' && selectedCustomer.orders.length === 0) ||
                    (activeProfileTab === 'repairs' && selectedCustomer.repairs.length === 0) ||
                    (activeProfileTab === 'purchases' && selectedCustomer.purchases.length === 0) ||
                    (activeProfileTab === 'khaata' && selectedCustomer.khaataEntries.length === 0)) && (
                    <div className="py-12 text-center text-zinc-400 text-sm urdu-text">
                      {isUrdu ? 'اس سیکشن میں کوئی ریکارڈ موجود نہیں' : 'No records in this category'}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-white rounded-3xl border-2 border-dashed border-sky-100 min-h-[65vh] p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-sky-50 flex items-center justify-center text-sky-300 mb-4">
                  <User size={40} />
                </div>
                <h3 className="text-xl font-bold text-sky-900 urdu-text">
                  {isUrdu ? 'گاہک کا انتخاب کریں' : 'Select a Customer'}
                </h3>
                <p className="text-zinc-500 text-sm mt-2 max-w-sm">
                  {isUrdu
                    ? 'کسی بھی گاہک کے تمام بلز، آرڈرز، ریپیئر، پرانا سونا اور کھاتہ ایک ساتھ دیکھنے کے لیے فہرست سے منتخب کریں'
                    : 'Choose any customer from the directory to view their complete bills, orders, repairs, purchases, and khaata in one place'}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Receipt Print & PDF Modal */}
      {printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="bg-zinc-100 w-[95vw] h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
            <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm">
              <h3 className="text-lg font-bold urdu-text text-zinc-900">
                {isUrdu ? 'رسید پرنٹ پریویو' : 'Receipt Print Preview'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPrintData(null);
                  setPdfUrl(null);
                }}
                className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-500 hover:text-red-500 border border-zinc-200 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div ref={previewScrollRef} className="flex-1 overflow-y-auto p-6 flex justify-center bg-zinc-200">
              <div className="bg-white shadow-2xl origin-top transform scale-[0.6] sm:scale-[0.8] md:scale-[0.9] lg:scale-100">
                <PrintReceipt ref={printRef} type={printData.type} data={printData.data} id={printData.id} />
              </div>
            </div>
            <div className="p-4 border-t bg-white flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={executePrint}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <Printer size={18} />
                <span className="urdu-text">{isUrdu ? 'پرنٹ کریں' : 'Print'}</span>
              </button>
              <button
                type="button"
                disabled={!pdfUrl}
                onClick={downloadPDF}
                className="bg-gold hover:bg-gold-light text-black font-bold py-3 px-6 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download size={18} />
                <span className="urdu-text">{isUrdu ? 'پی ڈی ایف محفوظ کریں' : 'Save PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintData(null);
                  setPdfUrl(null);
                }}
                className="bg-zinc-100 text-zinc-700 font-bold py-3 px-6 rounded-xl hover:bg-zinc-200 cursor-pointer urdu-text"
              >
                {isUrdu ? 'بند کریں' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage}
          onClose={() => setLightboxImage(null)}
          title={isUrdu ? 'تصویر' : 'Photo'}
        />
      )}
    </div>
  );
}
