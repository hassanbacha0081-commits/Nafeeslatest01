import React, { useState, useEffect } from 'react';
import { db, type KhaataAccount, type Khaata } from '../db';
import { translations, type Language } from '../translations';
import { Save, Download, Upload, Languages, Trash2, AlertTriangle, BadgeDollarSign, History, ShoppingBag, Palette, Sparkles, LayoutGrid, Coins, Check } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { SecurityModal } from './SecurityModal';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { type AppTheme, THEME_OPTIONS } from './ThemeSelectorModal';

import { APP_CONFIG } from '../config';

interface SettingsProps {
  lang: Language;
  setGoldRate: (rate: number) => void;
  setLang: (lang: Language) => void;
  currentTheme?: AppTheme;
  onThemeChange?: (theme: AppTheme) => void;
  showSarafaTicker?: boolean;
  onToggleSarafaTicker?: (show: boolean) => void;
  stockCardStyle?: 'velvet' | 'classic';
  onToggleStockCardStyle?: (style: 'velvet' | 'classic') => void;
  defaultWeightUnit?: 'tola' | 'gram';
  onWeightUnitChange?: (unit: 'tola' | 'gram') => void;
}

export default function Settings({
  lang,
  setGoldRate,
  setLang,
  currentTheme = 'obsidian',
  onThemeChange,
  showSarafaTicker = true,
  onToggleSarafaTicker,
  stockCardStyle = 'velvet',
  onToggleStockCardStyle,
  defaultWeightUnit = 'tola',
  onWeightUnitChange
}: SettingsProps) {
  const t = translations[lang];
  const [rateInput, setRateInput] = useState<string>('');
  const [shopNameInput, setShopNameInput] = useState<string>('');
  const [shopAddressInput, setShopAddressInput] = useState<string>('');
  const [shopPhoneInput, setShopPhoneInput] = useState<string>('');
  const [shopPhone2Input, setShopPhone2Input] = useState<string>('');
  const [shiftXInput, setShiftXInput] = useState<string>('');
  const [shiftYInput, setShiftYInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [securityAction, setSecurityAction] = useState<{ nameUr: string, nameEn: string, onVerify: () => void } | null>(null);

  const triggerSecurityCheck = (nameUr: string, nameEn: string, onVerify: () => void) => {
    if (currentSettings.appPin) {
      setSecurityAction({ nameUr, nameEn, onVerify });
    } else {
      onVerify();
    }
  };
  
  const [currentSettings, setCurrentSettings] = useState({
    goldRate: 0,
    shopName: translations.ur.shopName,
    shopAddress: translations.ur.shopAddress,
    shopPhone: translations.ur.shopPhone,
    shopPhone2: translations.ur.shopPhone2,
    printShiftX: 0,
    printShiftY: 0,
    appPin: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const rateData = await db.settings.get('goldRate');
      const nameData = await db.settings.get('shopName');
      const addressData = await db.settings.get('shopAddress');
      const phoneData = await db.settings.get('shopPhone');
      const phone2Data = await db.settings.get('shopPhone2');
      const shiftXData = await db.settings.get('printShiftX');
      const shiftYData = await db.settings.get('printShiftY');
      const appPinData = await db.settings.get('appPin');
      
      setCurrentSettings({
        goldRate: rateData?.value || 0,
        shopName: nameData?.value || translations[lang].shopName,
        shopAddress: addressData?.value || translations[lang].shopAddress,
        shopPhone: phoneData?.value || translations[lang].shopPhone,
        shopPhone2: phone2Data?.value || translations[lang].shopPhone2,
        printShiftX: shiftXData?.value || 0,
        printShiftY: shiftYData?.value || 0,
        appPin: appPinData?.value || ''
      });
    };
    fetchSettings();
  }, [lang]);

  const handleSaveRate = async () => {
    const newRate = Number(rateInput);
    if (isNaN(newRate) || rateInput === '') {
      alert(lang === 'ur' ? 'براہ کرم درست ریٹ درج کریں' : 'Please enter a valid rate');
      return;
    }
    triggerSecurityCheck(
      'سونے کا ریٹ تبدیل کریں',
      'Change Gold Rate',
      async () => {
        await db.settings.put({ key: 'goldRate', value: newRate });
        setGoldRate(newRate);
        setCurrentSettings(prev => ({ ...prev, goldRate: newRate }));
        setRateInput('');
        alert(lang === 'ur' ? 'سونے کا ریٹ محفوظ کر لیا گیا ہے' : 'Gold rate saved successfully');
      }
    );
  };

  const handleRemovePin = async () => {
    triggerSecurityCheck(
      'پاس ورڈ ختم کریں',
      'Remove Password',
      async () => {
        await db.settings.put({ key: 'appPin', value: '' });
        setCurrentSettings(prev => ({ ...prev, appPin: '' }));
        setPinInput('');
        alert(lang === 'ur' ? 'ایپ پاس ورڈ ختم کر دیا گیا ہے' : 'App password removed');
        window.location.reload();
      }
    );
  };

  const handleSaveShopDetails = async () => {
    triggerSecurityCheck(
      'تفصیلات تبدیل کریں',
      'Change Details & Settings',
      async () => {
        if (shopNameInput) {
          await db.settings.put({ key: 'shopName', value: shopNameInput });
          setCurrentSettings(prev => ({ ...prev, shopName: shopNameInput }));
        }
        if (shopAddressInput) {
          await db.settings.put({ key: 'shopAddress', value: shopAddressInput });
          setCurrentSettings(prev => ({ ...prev, shopAddress: shopAddressInput }));
        }
        if (shopPhoneInput) {
          await db.settings.put({ key: 'shopPhone', value: shopPhoneInput });
          setCurrentSettings(prev => ({ ...prev, shopPhone: shopPhoneInput }));
        }
        if (shopPhone2Input) {
          await db.settings.put({ key: 'shopPhone2', value: shopPhone2Input });
          setCurrentSettings(prev => ({ ...prev, shopPhone2: shopPhone2Input }));
        }
        
        // Save shifts if they are typed (even if 0)
        if (shiftXInput !== '') {
          await db.settings.put({ key: 'printShiftX', value: Number(shiftXInput) });
          setCurrentSettings(prev => ({ ...prev, printShiftX: Number(shiftXInput) }));
        }
        if (shiftYInput !== '') {
          await db.settings.put({ key: 'printShiftY', value: Number(shiftYInput) });
          setCurrentSettings(prev => ({ ...prev, printShiftY: Number(shiftYInput) }));
        }
        
        if (pinInput !== '') {
          await db.settings.put({ key: 'appPin', value: pinInput });
          setCurrentSettings(prev => ({ ...prev, appPin: pinInput }));
        }

        setShopNameInput('');
        setShopAddressInput('');
        setShopPhoneInput('');
        setShopPhone2Input('');
        setShiftXInput('');
        setShiftYInput('');
        alert(lang === 'ur' ? 'دکان اور پرنٹ کی تفصیلات محفوظ کر لی گئی ہیں' : 'Shop and print details saved successfully');
        window.location.reload(); // Reload to update App header
      }
    );
  };

  const handleExportCSV = async (type: 'sales' | 'purchases') => {
    try {
      let data: any[] = [];
      let filename = '';
      let headers = '';

      if (type === 'sales') {
        const sales = await db.sales.toArray();
        filename = `Sales_Export_${new Date().toISOString().split('T')[0]}.csv`;
        headers = 'Invoice #,Date,Customer Name,Phone,Total,Received,Remaining,Items\n';
        data = sales.map(s => {
          const itemsStr = s.items.map(i => `${i.n}(${i.w}g)`).join(' | ');
          return `${s.id},"${s.date}","${s.name}","${s.phone}",${s.total},${s.rec},${s.rem},"${itemsStr}"`;
        });
      } else {
        const purchases = await db.goldPurchases.toArray();
        filename = `Purchases_Export_${new Date().toISOString().split('T')[0]}.csv`;
        headers = 'Date,Seller Name,Phone,Weight(g),Rate,Total\n';
        data = purchases.map(p => {
          return `"${p.date}","${p.name}","${p.phone}",${p.weight},${p.rate},${p.total}`;
        });
      }

      const csvContent = headers + data.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    }
  };

  const handleBackup = async () => {
    try {
      const sales = await db.sales.toArray();
      const orders = await db.orders.toArray();
      const karigars = await db.karigars.toArray();
      const repairs = await db.repairs.toArray();
      const stock = await db.stock.toArray();
      const settings = await db.settings.toArray();
      const goldPurchases = await db.goldPurchases.toArray();
      const expenses = await db.expenses.toArray();
      const khaataAccounts = await db.khaataAccounts.toArray();
      const khaata = await db.khaata.toArray();

      const data = { 
        sales, 
        orders, 
        karigars, 
        repairs, 
        stock, 
        settings, 
        goldPurchases, 
        expenses, 
        khaataAccounts, 
        khaata,
        // Compatibility aliases for older versions or external imports
        khataAccounts: khaataAccounts,
        khata: khaata
      };
      const fileName = `nafees_jewellers_backup_${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = JSON.stringify(data);

      if (Capacitor.isNativePlatform()) {
        // Mobile (Android/iOS)
        const result = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title: `${APP_CONFIG.shopNameEnglish} Backup`,
          text: `Backup of ${APP_CONFIG.shopNameEnglish} application data`,
          url: result.uri,
          dialogTitle: 'Save Backup',
        });
      } else {
        // Desktop/Web
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Backup error:', error);
      alert(lang === 'ur' ? 'بیک اپ بنانے میں خرابی پیش آئی' : 'Error creating backup');
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerSecurityCheck(
      'ڈیٹا بحال کریں',
      'Restore Backup Data',
      () => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const rawContent = event.target?.result as string;
            const data = JSON.parse(rawContent);

            if (!data || typeof data !== 'object') {
              throw new Error('Invalid JSON format');
            }

            // Clear existing data cleanly before restore
            await Promise.all([
              db.sales.clear(),
              db.orders.clear(),
              db.karigars.clear(),
              db.repairs.clear(),
              db.stock.clear(),
              db.settings.clear(),
              db.goldPurchases.clear(),
              db.expenses.clear(),
              db.khaataAccounts.clear(),
              db.khaata.clear()
            ]);

            // Helper to restore standard tables safely
            const restoreTable = async (table: any, items: any[], tableName: string) => {
              if (!Array.isArray(items) || items.length === 0) return;
              try {
                await table.bulkPut(items);
              } catch (bulkErr) {
                console.warn(`bulkPut failed for ${tableName}, falling back to put:`, bulkErr);
                for (const item of items) {
                  try {
                    await table.put(item);
                  } catch (itemErr) {
                    console.error(`Error inserting into ${tableName}:`, itemErr, item);
                  }
                }
              }
            };

            // Unnest root object in case backup JSON is wrapped in { data: ... } or { backup: ... } or { export: ... }
            const root = data.data || data.backup || data.export || data.payload || data.db || data;

            // 1. Standard tables
            if (root.sales && root.sales.length > 0) await restoreTable(db.sales, root.sales, 'sales');
            if (root.orders && root.orders.length > 0) await restoreTable(db.orders, root.orders, 'orders');
            if (root.karigars && root.karigars.length > 0) await restoreTable(db.karigars, root.karigars, 'karigars');
            if (root.repairs && root.repairs.length > 0) await restoreTable(db.repairs, root.repairs, 'repairs');
            if (root.stock && root.stock.length > 0) await restoreTable(db.stock, root.stock, 'stock');
            if (root.settings && root.settings.length > 0) await restoreTable(db.settings, root.settings, 'settings');

            const purchases = root.goldPurchases || root.gold_purchases || root.purchases || [];
            if (purchases.length > 0) await restoreTable(db.goldPurchases, purchases, 'goldPurchases');

            if (root.expenses && root.expenses.length > 0) await restoreTable(db.expenses, root.expenses, 'expenses');

            // 2. Comprehensive Khaata Section Restoration
            // Inspect any naming variations: khaataAccounts, khataAccounts, accounts, khatas, etc.
            const rawAccounts = 
              root.khaataAccounts || 
              root.khataAccounts || 
              root.khaata_accounts || 
              root.khata_accounts || 
              root.khatas || 
              root.khaatas || 
              root.accounts || 
              root.khaataAccount || 
              root.khataAccount || 
              root.khataList || 
              root.khaataList || 
              root.KhaataAccounts || 
              root.KhataAccounts || 
              root.customers || 
              root.parties || 
              [];

            // Inspect any naming variations for transactions/entries: khaata, khata, entries, records, etc.
            const rawEntries = 
              root.khaata || 
              root.khata || 
              root.khaataRecords || 
              root.khataRecords || 
              root.khaata_records || 
              root.khata_records || 
              root.khaataEntries || 
              root.khataEntries || 
              root.khaata_entries || 
              root.khata_entries || 
              root.entries || 
              root.records || 
              root.transactions || 
              root.Khaata || 
              root.Khata || 
              [];

            const normalizedAccounts: KhaataAccount[] = [];
            const normalizedEntries: Khaata[] = [];
            const accountIdMap = new Map<any, number>();
            let nextAccountId = 1;

            // Robust helper to extract numbers from string/number inputs (e.g. "10.36g", "R 16", "11 R", 10.36)
            const extractNum = (val: any): number => {
              if (val === undefined || val === null || val === '') return 0;
              if (typeof val === 'number') return isNaN(val) ? 0 : val;
              const str = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
              const num = parseFloat(str);
              return isNaN(num) ? 0 : num;
            };

            // Helper to extract string from multiple potential key names
            const extractStr = (item: any, keys: string[]): string => {
              if (!item || typeof item !== 'object') return '';
              for (const k of keys) {
                if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
                  return String(item[k]).trim();
                }
              }
              return '';
            };

            // Helper to parse Khaata entry while preserving exact stored values
            const parseKhaataEntry = (item: any, accId: number): Khaata => {
              const entryId = item.id !== undefined && !isNaN(Number(item.id)) && Number(item.id) > 0 ? Number(item.id) : undefined;
              const date = item.date || item.created_at || item.createdAt || new Date().toISOString().split('T')[0];
              
              const itemDetail = extractStr(item, [
                'details', 'itemDetail', 'item_detail', 'ashia_tafseel', 'ashiaTafseel',
                'ashia', 'itemsDetails', 'items_details', 'tafseel_ashia', 'tafseelAshia',
                'description', 'particulars', 'item', 'tafsil', 'tafseel', 'n', 'title', 'name', 'notes', 'remark', 'remarks'
              ]) || 'تفصیل';

              const pakaye = extractNum(
                item.pakaye ?? item.pakai ?? item.pakaye_wazan ?? item.pure ?? item.touch
              );

              const mixWazan = extractNum(
                item.mixWeight ?? item.mixWazan ?? item.mix_weight ?? item.mix_wazan ?? 
                item.mix ?? item.weight ?? item.wazan ?? item.grossWeight ?? item.gross_weight ?? item.totalWeight ?? item.total_weight ?? item.w
              );

              const kaatInRati = extractNum(
                item.kaatRati ?? item.kaatInRati ?? item.kaat_rati ?? item.kaat_in_rati ?? 
                item.kaat ?? item.rati ?? item.kaat_rati_mein ?? item.kaatRatiMein ?? item.deduction
              );

              // Extract raw pasaDia if present in any variation
              let pasaDiaRaw = 
                item.pasaDia ?? item.pasa_dia ?? item.dia ?? item.given ?? item.paid ?? 
                item.pasaGiven ?? item.pasa_given ?? item.debit ?? item.namee ?? item.namme;

              const pasaDia = extractNum(pasaDiaRaw);

              // Extract raw itemPasa if present in any variation
              let itemPasaRaw = 
                item.pureWeight ?? item.pure_weight ?? item.itemPasa ?? item.item_pasa ?? 
                item.pasaJama ?? item.pasa_jama ?? item.jama ?? item.credit ?? 
                item.pureGold ?? item.pure_gold ?? item.pasaMade ?? item.pasa_made ?? item.pasaWazan ?? item.pasa_wazan;

              let itemPasa: number;
              if (itemPasaRaw !== undefined && itemPasaRaw !== null && itemPasaRaw !== '') {
                itemPasa = extractNum(itemPasaRaw);
              } else if (mixWazan > 0) {
                itemPasa = parseFloat(((mixWazan / 96) * (96 - kaatInRati)).toFixed(3));
              } else {
                itemPasa = 0;
              }

              // Extract raw totalBaqaya if present in any variation
              let totalBaqayaRaw = 
                item.totalBaqaya ?? item.total_baqaya ?? item.baqaya ?? item.rem ?? 
                item.balance ?? item.netBaqaya ?? item.net_baqaya ?? item.closingBalance ?? item.closing_balance;

              let totalBaqaya: number;
              if (totalBaqayaRaw !== undefined && totalBaqayaRaw !== null && totalBaqayaRaw !== '') {
                totalBaqaya = extractNum(totalBaqayaRaw);
              } else {
                totalBaqaya = parseFloat((itemPasa - pasaDia).toFixed(3));
              }

              const img = item.img || item.image || item.photo || null;

              return {
                ...(entryId ? { id: entryId } : {}),
                accountId: accId,
                date,
                details: itemDetail || 'تفصیل',
                itemDetail: itemDetail || 'تفصیل',
                type: item.type || 'give',
                mixWeight: mixWazan,
                mixWazan: mixWazan,
                pakaye,
                kaatRati: kaatInRati,
                kaatInRati,
                pureWeight: itemPasa,
                itemPasa,
                pasaDia,
                totalBaqaya,
                img,
                ...(item.notes ? { notes: item.notes } : {}),
                ...(item._syncId ? { _syncId: item._syncId } : {}),
                ...(item._updatedAt ? { _updatedAt: item._updatedAt } : {})
              };
            };

            // Process accounts from rawAccounts
            if (Array.isArray(rawAccounts)) {
              rawAccounts.forEach((acc: any) => {
                if (!acc || typeof acc !== 'object') return;
                
                let accId: number;
                if (acc.id !== undefined && !isNaN(Number(acc.id)) && Number(acc.id) > 0) {
                  accId = Number(acc.id);
                } else {
                  accId = nextAccountId;
                }
                nextAccountId = Math.max(nextAccountId, accId + 1);

                const name = String(acc.name || acc.accountName || acc.account_name || acc.customerName || acc.customer_name || acc.title || `اکاؤنٹ #${accId}`).trim();
                const phone = String(acc.phone || acc.mobile || acc.contact || acc.phoneNumber || acc.phone_number || '').trim();
                const createdAt = acc.createdAt || acc.created_at || acc.date || new Date().toISOString();

                normalizedAccounts.push({
                  id: accId,
                  name,
                  phone,
                  createdAt,
                  date: acc.date || createdAt,
                  notes: acc.notes || '',
                  ...(acc._syncId ? { _syncId: acc._syncId } : {}),
                  ...(acc._updatedAt ? { _updatedAt: acc._updatedAt } : {})
                });

                accountIdMap.set(accId, accId);
                accountIdMap.set(String(accId), accId);
                if (name) accountIdMap.set(name.toLowerCase(), accId);

                // Handle nested entries inside account object (e.g. acc.entries or acc.records or acc.khaata)
                const nested = acc.entries || acc.records || acc.khaata || acc.khata || acc.items || acc.transactions || acc.history || acc.details;
                if (Array.isArray(nested) && nested.length > 0) {
                  nested.forEach((item: any) => {
                    if (!item || typeof item !== 'object') return;
                    normalizedEntries.push(parseKhaataEntry(item, accId));
                  });
                }
              });
            }

            // Process entries from top-level entries array
            if (Array.isArray(rawEntries)) {
              rawEntries.forEach((item: any) => {
                if (!item || typeof item !== 'object') return;

                // Resolve which account this belongs to
                let accId: number | undefined;
                const rawAccId = item.accountId ?? item.account_id ?? item.accId ?? item.acc_id ?? item.customerId ?? item.customer_id;
                if (rawAccId !== undefined && accountIdMap.has(rawAccId)) {
                  accId = accountIdMap.get(rawAccId);
                } else if (rawAccId !== undefined && accountIdMap.has(Number(rawAccId))) {
                  accId = accountIdMap.get(Number(rawAccId));
                } else if (rawAccId !== undefined && !isNaN(Number(rawAccId)) && Number(rawAccId) > 0) {
                  accId = Number(rawAccId);
                }

                // If not found by ID, try finding by accountName or customerName
                const accName = String(item.accountName || item.account_name || item.customerName || item.customer_name || item.name || '').trim();
                if (!accId && accName && accountIdMap.has(accName.toLowerCase())) {
                  accId = accountIdMap.get(accName.toLowerCase());
                }

                // If no account exists for this entry, create one automatically so data is never lost
                if (!accId) {
                  accId = nextAccountId++;
                  const newAcc: KhaataAccount = {
                    id: accId,
                    name: accName || `اکاؤنٹ #${accId}`,
                    phone: String(item.phone || item.mobile || ''),
                    createdAt: item.date || new Date().toISOString()
                  };
                  normalizedAccounts.push(newAcc);
                  accountIdMap.set(accId, accId);
                  accountIdMap.set(String(accId), accId);
                  if (newAcc.name) accountIdMap.set(newAcc.name.toLowerCase(), accId);
                }

                normalizedEntries.push(parseKhaataEntry(item, accId));
              });
            }

            // Restore sanitized accounts and entries into Dexie
            if (normalizedAccounts.length > 0) {
              await restoreTable(db.khaataAccounts, normalizedAccounts, 'khaataAccounts');
            }
            if (normalizedEntries.length > 0) {
              await restoreTable(db.khaata, normalizedEntries, 'khaata');
            }

            const restoreStatsUrdu = `ڈیٹا کامیابی سے بحال ہو گیا ہے! (${normalizedAccounts.length} کھاتہ جات اور ${normalizedEntries.length} اندراجات بحال ہوئے)`;
            const restoreStatsEng = `Data restored successfully! (${normalizedAccounts.length} khaata accounts and ${normalizedEntries.length} entries restored)`;

            alert(lang === 'ur' ? restoreStatsUrdu : restoreStatsEng);
            window.location.reload();
          } catch (err: any) {
            console.error('Restore error:', err);
            alert((lang === 'ur' ? 'بیک اپ فائل درست نہیں ہے یا ڈیٹا بحال کرنے میں مسئلہ پیش آیا: ' : 'Invalid backup file or error restoring data: ') + (err?.message || ''));
          }
        };
        reader.readAsText(file);
      }
    );
  };

  const clearAllData = async () => {
    triggerSecurityCheck(
      'تمام ڈیٹا حذف کریں',
      'Clear All Data Permanently',
      async () => {
        try {
          await Promise.all([
            db.sales.clear(),
            db.orders.clear(),
            db.karigars.clear(),
            db.repairs.clear(),
            db.stock.clear(),
            db.settings.clear(),
            db.goldPurchases.clear(),
            db.expenses.clear(),
            db.khaataAccounts.clear(),
            db.khaata.clear()
          ]);
          window.location.reload();
        } catch (err) {
          console.error("Clear data error:", err);
          alert("Error clearing data");
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      <ConfirmModal 
        isOpen={showConfirmClear}
        onClose={() => setShowConfirmClear(false)}
        onConfirm={clearAllData}
        title={lang === 'ur' ? 'ڈیلیٹ کریں؟' : 'Confirm Clear'}
        message={lang === 'ur' ? 'کیا آپ واقعی تمام ڈیٹا حذف کرنا چاہتے ہیں؟ یہ عمل ناقابل واپسی ہے۔' : 'Are you sure you want to clear all data? This cannot be undone.'}
        lang={lang}
      />
      
      <SecurityModal
        isOpen={!!securityAction}
        onClose={() => setSecurityAction(null)}
        onVerifySuccess={() => {
          if (securityAction) {
            securityAction.onVerify();
          }
        }}
        correctPin={currentSettings.appPin}
        lang={lang}
        actionName={lang === 'ur' ? securityAction?.nameUr || '' : securityAction?.nameEn || ''}
      />
      
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-gold-dark urdu-text">{t.settings}</h2>
        <p className="text-zinc-500 text-sm">{lang === 'ur' ? 'ایپلی کیشن کی ترتیبات تبدیل کریں' : 'Configure application settings'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quick Stats & Language */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase urdu-text">{lang === 'ur' ? 'موجودہ ریٹ' : 'Current Rate'}</h3>
            <div className="text-center py-2">
              <p className="text-3xl font-bold text-gold-dark">Rs. {currentSettings.goldRate.toLocaleString()}</p>
              <p className="text-[10px] text-zinc-500 uppercase mt-1">Per Gram Gold</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase urdu-text">{t.language}</h3>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => setLang('ur')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                  lang === 'ur' ? 'bg-gold text-black border-gold shadow-md' : 'bg-sky-50 border-sky-100 text-zinc-600 hover:bg-sky-100'
                }`}
              >
                <span className="font-bold urdu-text">اردو</span>
                {lang === 'ur' && <div className="w-2 h-2 bg-black rounded-full" />}
              </button>
              <button 
                onClick={() => setLang('en')}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                  lang === 'en' ? 'bg-gold text-black border-gold shadow-md' : 'bg-sky-50 border-sky-100 text-zinc-600 hover:bg-sky-100'
                }`}
              >
                <span className="font-bold">English</span>
                {lang === 'en' && <div className="w-2 h-2 bg-black rounded-full" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Interface & Luxury Gold Themes Customizer */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gold/40 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-gold text-black text-[10px] font-black uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
              <Sparkles size={12} />
              <span>{lang === 'ur' ? 'اختیاری تھیمز' : 'Visual Themes'}</span>
            </div>
            
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                <Palette size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900 urdu-text">
                  {lang === 'ur' ? 'یوزر انٹرفیس، رنگ اور تھیم کی ترتیبات' : 'User Interface & Theme Colors'}
                </h3>
                <p className="text-xs text-zinc-500 urdu-text">
                  {lang === 'ur' 
                    ? 'آپ کسی بھی وقت اپنی پسند کا رنگ اور تھیم خود منتخب کر سکتے ہیں' 
                    : 'Select your preferred visual style and color scheme anytime'}
                </p>
              </div>
            </div>

            {/* Themes Grid */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-600 urdu-text">
                {lang === 'ur' ? 'دستیاب شاہی گولڈ تھیمز (کلک کر کے منتخب کریں):' : 'Select Theme Palette:'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {THEME_OPTIONS.map((th) => {
                  const isSelected = currentTheme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => onThemeChange && onThemeChange(th.id)}
                      className={`p-3.5 rounded-xl border text-right transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-gold bg-zinc-900 text-white shadow-md shadow-gold/20 ring-2 ring-gold/40'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 hover:border-zinc-300'
                      }`}
                      dir={lang === 'ur' ? 'rtl' : 'ltr'}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-lg border border-white/20 shrink-0 shadow-sm"
                          style={{ backgroundColor: th.bgHex }}
                        />
                        <div
                          className="w-6 h-6 rounded-lg border border-white/20 shrink-0 shadow-sm flex items-center justify-center text-[9px] font-black"
                          style={{ backgroundColor: th.accentHex, color: '#000' }}
                        >
                          Au
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm urdu-text leading-tight ${isSelected ? 'text-gold' : 'text-zinc-900'}`}>
                            {lang === 'ur' ? th.nameUr : th.nameEn}
                          </p>
                          <span className={`text-[10px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            {th.badge}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-gold text-black border-gold'
                            : 'border-zinc-300 text-transparent'
                        }`}
                      >
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feature Options: Sarafa Ticker & Velvet Showcase */}
            <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Live Ticker Toggle */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-sm urdu-text">
                    <Coins size={16} className="text-gold" />
                    <span>{lang === 'ur' ? 'لائیو صرافہ ریٹ بورڈ' : 'Live Sarafa Board'}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 urdu-text">
                    {lang === 'ur' ? 'ہیڈر میں لائیو 24K, 22K, 21K ریٹ بار' : 'Top 24K, 22K karat ticker'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSarafaTicker && onToggleSarafaTicker(!showSarafaTicker)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    showSarafaTicker ? 'bg-gold justify-end' : 'bg-zinc-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              {/* Velvet Showcase Cards Toggle */}
              <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-zinc-900 font-bold text-sm urdu-text">
                    <LayoutGrid size={16} className="text-gold" />
                    <span>{lang === 'ur' ? 'مخمل شوکیس کارڈز' : 'Velvet Showcase Cards'}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 urdu-text">
                    {lang === 'ur' ? 'سٹاک اور بلنگ میں شاہی مخمل باکس لک' : 'Jewelry tray look with hallmark badges'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleStockCardStyle && onToggleStockCardStyle(stockCardStyle === 'velvet' ? 'classic' : 'velvet')}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    stockCardStyle === 'velvet' ? 'bg-gold justify-end' : 'bg-zinc-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>
            </div>

            {/* Default Weight Unit Choice */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-700 urdu-text block">
                  {lang === 'ur' ? 'پہلے سے طے شدہ وزن کی اکائی (Default Weight Unit):' : 'Default Weight Unit:'}
                </label>
                <span className="text-[11px] text-zinc-500 urdu-text">
                  {lang === 'ur' ? 'تولہ اور گرام کے درمیان ترجیح منتخب کریں' : 'Choose default unit for market calculations'}
                </span>
              </div>
              <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs">
                <button
                  type="button"
                  onClick={() => onWeightUnitChange && onWeightUnitChange('tola')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all urdu-text ${
                    defaultWeightUnit === 'tola' ? 'bg-gold text-black shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {lang === 'ur' ? 'تولہ (Tola)' : 'Tola'}
                </button>
                <button
                  type="button"
                  onClick={() => onWeightUnitChange && onWeightUnitChange('gram')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all urdu-text ${
                    defaultWeightUnit === 'gram' ? 'bg-gold text-black shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {lang === 'ur' ? 'گرام (Gram)' : 'Gram'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-6">
            <h3 className="text-lg font-bold text-gold-dark border-b border-sky-100 pb-2 urdu-text">{lang === 'ur' ? 'دکان کی تفصیلات' : 'Shop Details'}</h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.shopName}</label>
                <input 
                  type="text" 
                  value={shopNameInput}
                  onChange={e => setShopNameInput(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.addressLabel}</label>
                <input 
                  type="text" 
                  value={shopAddressInput}
                  onChange={e => setShopAddressInput(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 urdu-text">{t.phoneNumber} 1</label>
                  <input 
                    type="text" 
                    value={shopPhoneInput}
                    onChange={e => setShopPhoneInput(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 urdu-text">{t.phoneNumber} 2</label>
                  <input 
                    type="text" 
                    value={shopPhone2Input}
                    onChange={e => setShopPhone2Input(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-black"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 urdu-text">{t.goldRate}</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    value={rateInput || ''}
                    onChange={e => setRateInput(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none font-bold text-black"
                  />
                  <button 
                    onClick={handleSaveRate}
                    className="px-4 bg-gold text-black rounded-lg hover:bg-gold-light transition-colors shadow-lg shadow-gold-20"
                  >
                    <Save size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 pt-4 border-t border-sky-100">
                <label className="text-xs font-bold text-zinc-500 urdu-text flex items-center justify-between">
                  <span>{t.appSecurity}</span>
                  {currentSettings.appPin && (
                    <span className="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder={t.pinPlaceholder}
                    className="flex-1 px-4 py-2 bg-white border border-sky-200 rounded-lg focus:ring-2 focus:ring-gold outline-none text-center tracking-widest text-black"
                    dir="ltr"
                  />
                  {currentSettings.appPin && (
                    <button 
                      onClick={handleRemovePin}
                      className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      title={t.removePin}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400">{lang === 'ur' ? 'ایپ کو کھولنے کے لیے پاس ورڈ سیٹ کریں' : 'Set a password to lock the application on startup.'}</p>
              </div>

              <button 
                onClick={handleSaveShopDetails}
                className="w-full py-3 bg-gold text-black rounded-lg font-bold hover:bg-gold-light transition-colors flex items-center justify-center gap-2 shadow-lg shadow-gold-20"
              >
                <Save size={20} />
                <span className="urdu-text">{t.save}</span>
              </button>
            </div>
          </div>

          {/* PDF Print Calibration */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-sky-200 space-y-4">
            <h3 className="text-lg font-bold text-gold-dark border-b border-sky-100 pb-2 urdu-text">
              {lang === 'ur' ? 'پہلے سے پرنٹ شدہ بل کیٹنگ (Pre-printed Calibration)' : 'Print Calibration'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'موجودہ شفٹ' : 'Current Shift'}</label>
                <p className="text-sm font-bold text-sky-600 font-mono" dir="ltr">
                  X: {currentSettings.printShiftX}mm, Y: {currentSettings.printShiftY}mm
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'افقی ایڈجسٹمنٹ (Shift X)' : 'Shift X (mm)'}</label>
                  <input
                    type="number"
                    value={shiftXInput}
                    onChange={(e) => setShiftXInput(e.target.value)}
                    placeholder="e.g. 5 or -5"
                    className="w-full p-2 border border-sky-200 rounded-lg outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1 urdu-text">{lang === 'ur' ? 'عمودی ایڈجسٹمنٹ (Shift Y)' : 'Shift Y (mm)'}</label>
                  <input
                    type="number"
                    value={shiftYInput}
                    onChange={(e) => setShiftYInput(e.target.value)}
                    placeholder="e.g. 5 or -5"
                    className="w-full p-2 border border-sky-200 rounded-lg outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <button 
                onClick={handleSaveShopDetails}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
              >
                <Save size={20} />
                <span className="urdu-text">{lang === 'ur' ? 'کیلیبریشن محفوظ کریں' : 'Save Calibration'}</span>
              </button>
            </div>
          </div>

          {/* Data Management - HIGHLIGHTED */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-gold space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 bg-gold text-black text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
              Critical Actions
            </div>
            <h3 className="text-xl font-bold text-sky-900 border-b border-sky-100 pb-4 urdu-text flex items-center gap-3">
              <Download className="text-gold" />
              {lang === 'ur' ? 'بیک اپ اور ڈیٹا مینجمنٹ' : 'Backup & Data Management'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={handleBackup}
                className="flex flex-col items-center justify-center gap-3 p-8 bg-sky-600 text-white rounded-3xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 hover:-translate-y-1 active:translate-y-0"
              >
                <div className="p-4 bg-white/20 rounded-2xl">
                   <Download size={32} />
                </div>
                <div className="text-center">
                  <span className="block text-lg font-black urdu-text">{t.backup}</span>
                  <span className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Download Data File</span>
                </div>
              </button>

              <label className="flex flex-col items-center justify-center gap-3 p-8 bg-sky-50 text-sky-600 border-2 border-dashed border-sky-200 rounded-3xl hover:bg-sky-100 hover:border-sky-400 transition-all cursor-pointer hover:-translate-y-1 active:translate-y-0">
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                   <Upload size={32} />
                </div>
                <div className="text-center">
                  <span className="block text-lg font-black urdu-text">{t.restore}</span>
                  <span className="text-[10px] text-sky-400 uppercase font-bold tracking-widest">Upload JSON Backup</span>
                </div>
                <input type="file" className="hidden" onChange={handleRestore} accept=".json" />
              </label>
            </div>

            {/* Excel Export Section */}
            <div className="pt-8 border-t border-sky-100 space-y-4">
              <div className="flex items-center gap-2 text-sky-900 font-bold urdu-text">
                <BadgeDollarSign className="text-emerald-500" />
                {lang === 'ur' ? 'ایکسل رپورٹنگ (Excel Sheets)' : 'Excel Reporting'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => handleExportCSV('sales')}
                  className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all font-bold group"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <History size={20} />
                  </div>
                  <span className="urdu-text text-sm">{t.exportSalesExcel}</span>
                </button>
                <button 
                  onClick={() => handleExportCSV('purchases')}
                  className="flex items-center gap-3 p-4 bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl hover:bg-amber-100 transition-all font-bold group"
                >
                  <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <ShoppingBag size={20} />
                  </div>
                  <span className="urdu-text text-sm">{t.exportPurchasesExcel}</span>
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-sky-100 italic text-center">
              <p className="text-xs text-zinc-400">
                {lang === 'ur' 
                  ? 'نوٹ: اپنے قیمتی ڈیٹا کا باقاعدگی سے بیک اپ لیں تاکہ نقصان سے بچا جا سکے۔' 
                  : 'Important: Regularly back up your data to avoid accidental loss.'}
              </p>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => setShowConfirmClear(true)}
                className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all font-bold group"
              >
                <Trash2 size={20} className="group-hover:animate-bounce" />
                <span className="urdu-text">{lang === 'ur' ? 'تمام ڈیٹا حذف کریں' : 'Clear All Data Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
