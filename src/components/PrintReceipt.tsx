import React, { forwardRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Sale, Order, Repair, KarigarRecord, StockItem, GoldPurchase, db } from '../db';
import { formatDate } from '../lib/utils';
import { translations } from '../translations';
import { APP_CONFIG } from '../config';

// Luxury Royal Gold Authenticity Seal
export const RoyalGoldSeal = ({ size = 88 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 2px 4px rgba(153,101,21,0.2))' }}>
    <circle cx="100" cy="100" r="95" stroke="#996515" strokeWidth="3" strokeDasharray="5 2.5" fill="#fffdf7" />
    <circle cx="100" cy="100" r="88" stroke="#D4AF37" strokeWidth="2" fill="none" />
    <circle cx="100" cy="100" r="83" stroke="#996515" strokeWidth="1" strokeDasharray="3 2" fill="none" />
    <circle cx="100" cy="100" r="62" stroke="#996515" strokeWidth="2.5" fill="#fdfcf8" />

    <path id="sealCurveTop" d="M 30,100 A 70,70 0 0,1 170,100" fill="none" />
    <text fill="#855806" fontSize="13" fontWeight="900" letterSpacing="3" fontFamily="'Inter', sans-serif">
      <textPath href="#sealCurveTop" startOffset="50%" textAnchor="middle">
        NAFEES JEWELLERS
      </textPath>
    </text>

    <path id="sealCurveBottom" d="M 170,100 A 70,70 0 0,1 30,100" fill="none" />
    <text fill="#855806" fontSize="10.5" fontWeight="800" letterSpacing="2.5" fontFamily="'Inter', sans-serif">
      <textPath href="#sealCurveBottom" startOffset="50%" textAnchor="middle">
        ★ VERIFIED AUTHENTIC ★
      </textPath>
    </text>

    <g transform="translate(100, 100)">
      <path d="M 0,-36 L 2,-31 L 7,-31 L 3,-28 L 5,-23 L 0,-26 L -5,-23 L -3,-28 L -7,-31 L -2,-31 Z" fill="#D4AF37" stroke="#996515" strokeWidth="0.5" />
      <path d="M -16,-32 L -14,-28 L -10,-28 L -13,-26 L -12,-22 L -16,-24 L -20,-22 L -19,-26 L -22,-28 L -18,-28 Z" fill="#D4AF37" stroke="#996515" strokeWidth="0.5" />
      <path d="M 16,-32 L 18,-28 L 22,-28 L 19,-26 L 20,-22 L 16,-24 L 12,-22 L 13,-26 L 10,-28 L 14,-28 Z" fill="#D4AF37" stroke="#996515" strokeWidth="0.5" />

      <text y="-5" textAnchor="middle" fill="#996515" fontSize="16" fontWeight="bold" fontFamily="'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif">
        ضمانت شدہ
      </text>
      <text y="15" textAnchor="middle" fill="#784803" fontSize="18" fontWeight="bold" fontFamily="'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif">
        خالص سونا
      </text>

      <rect x="-42" y="24" width="84" height="15" rx="3" fill="#996515" />
      <text y="35" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="900" letterSpacing="1.2" fontFamily="'Inter', sans-serif">
        100% GENUINE
      </text>
    </g>
  </svg>
);

interface PrintReceiptProps {
  type: 'sale' | 'order' | 'repair' | 'karigar' | 'stock' | 'purchase';
  data: Sale | Order | Repair | KarigarRecord | StockItem | GoldPurchase;
  id?: number;
  showOrderStatus?: boolean;
}

export const PrintReceipt = forwardRef<HTMLDivElement, PrintReceiptProps>(({ type, data, id, showOrderStatus = true }, ref) => {
  const [shopSettings, setShopSettings] = useState({
    name: translations.ur.shopName,
    address: translations.ur.shopAddress,
    phone: translations.ur.shopPhone,
    phone2: translations.ur.shopPhone2
  });
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const getOrderStatusConfig = (status?: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'progress' || s === 'in progress' || s === 'in_progress') {
      return {
        label: 'کام جاری ہے (In Progress)',
        color: '#1e40af',
        bg: '#eff6ff',
        border: '#93c5fd'
      };
    }
    if (s === 'complete' || s === 'completed') {
      return {
        label: 'مکمل / تیار ہے (Completed)',
        color: '#166534',
        bg: '#f0fdf4',
        border: '#86efac'
      };
    }
    if (s === 'delivered') {
      return {
        label: 'حوالے کر دیا گیا (Delivered)',
        color: '#6b21a8',
        bg: '#faf5ff',
        border: '#d8b4fe'
      };
    }
    return {
      label: 'زیر التواء (Pending)',
      color: '#c2410c',
      bg: '#fff7ed',
      border: '#fdba74'
    };
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const name = await db.settings.get('shopName');
      const address = await db.settings.get('shopAddress');
      const phone = await db.settings.get('shopPhone');
      const phone2 = await db.settings.get('shopPhone2');
      
      const resolvedName = (name?.value && name.value !== "سیف جیولرز" && name.value !== "Saif jeweller's" && name.value !== "Saif Jeweller's")
        ? name.value
        : translations.ur.shopName;

      const resolvedPhone = (phone?.value && phone.value !== "03135722659")
        ? phone.value
        : translations.ur.shopPhone;

      const resolvedPhone2 = (phone2?.value && phone2.value !== "03433977727")
        ? phone2.value
        : translations.ur.shopPhone2;

      setShopSettings({
        name: resolvedName,
        address: address?.value || translations.ur.shopAddress,
        phone: resolvedPhone,
        phone2: resolvedPhone2
      });
    };
    fetchSettings();
  }, []);

  // Generate verified dynamic QR code for receipt
  useEffect(() => {
    let active = true;
    const generateQR = async () => {
      try {
        let text = '';
        if (type === 'sale') {
          const s = data as Sale;
          text = `NAFEES JEWELLERS • INVOICE #${1000 + (id || 0)}\n` +
                 `Customer: ${s.name} (${s.phone})\n` +
                 `Date: ${s.date}\n` +
                 `Total: Rs. ${s.total.toLocaleString()}\n` +
                 `Paid: Rs. ${s.rec.toLocaleString()}\n` +
                 `Balance: Rs. ${s.rem.toLocaleString()}\n` +
                 `Status: ${s.rem <= 0 ? 'PAID IN FULL / صاف بے باق' : 'BALANCE DUE / بقایا دار'}\n` +
                 `Shop: 03150023776 / 03208680186\n` +
                 `100% Genuine Guaranteed Gold`;
        } else if (type === 'order') {
          const o = data as Order;
          text = `NAFEES JEWELLERS • ORDER #${1000 + (id || 0)}\n` +
                 `Customer: ${o.name} (${o.phone})\n` +
                 `Item: ${o.item}\n` +
                 `Weight: ${o.readyWt || o.totalWt || '-'}g\n` +
                 `Total: Rs. ${o.total.toLocaleString()}\n` +
                 `Balance: Rs. ${o.rem.toLocaleString()}\n` +
                 `Due Date: ${o.due}\n` +
                 `Shop: 03150023776 / 03208680186`;
        } else if (type === 'repair') {
          const r = data as Repair;
          text = `NAFEES JEWELLERS • REPAIR RECEIPT\n` +
                 `Customer: ${r.customerName} (${r.customerPhone})\n` +
                 `Item: ${r.item}\n` +
                 `Issue: ${r.issue}\n` +
                 `Charges: Rs. ${r.charges.toLocaleString()}\n` +
                 `Status: ${r.status}\n` +
                 `Shop: 03150023776 / 03208680186`;
        } else if (type === 'karigar') {
          const k = data as KarigarRecord;
          text = `NAFEES JEWELLERS • KARIGAR RECEIPT\n` +
                 `Karigar: ${k.name} (${k.phone})\n` +
                 `Task: ${k.task}\n` +
                 `Net Balance: ${k.net}g\n` +
                 `Date: ${k.date}\n` +
                 `Shop: 03150023776`;
        } else if (type === 'purchase') {
          const p = data as GoldPurchase;
          text = `NAFEES JEWELLERS • GOLD PURCHASE #${5000 + (id || 0)}\n` +
                 `Seller: ${p.name} (${p.phone})\n` +
                 `Weight: ${p.weight}g\n` +
                 `Rate: Rs. ${p.rate.toLocaleString()}\n` +
                 `Cash Paid: Rs. ${p.total.toLocaleString()}\n` +
                 `Date: ${p.date}\n` +
                 `CNIC Legal Ownership Declaration Verified`;
        } else {
          text = `NAFEES JEWELLERS • OFFICIAL RECEIPT\nVerified Authentic Gold Jewellery`;
        }

        const url = await QRCode.toDataURL(text, {
          width: 140,
          margin: 1,
          color: {
            dark: '#451a03',
            light: '#ffffff'
          }
        });
        if (active) setQrCodeUrl(url);
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    };
    generateQR();
    return () => { active = false; };
  }, [type, data, id]);

  const isPurchase = type === 'purchase';
  const isOrder = type === 'order';
  const isA4 = isPurchase || isOrder;
  const widthStr = isA4 ? '21cm' : '14.8cm';
  const heightStr = isA4 ? '29.7cm' : '21cm';

  const printStyles = (
    <style>
      {`
        @import url('https://fonts.cdnfonts.com/css/jameel-noori-nastaleeq');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Inter:wght@400;700&display=swap');
        
        @media print {
          @page {
            size: ${isA4 ? 'A4 portrait' : `${widthStr} ${heightStr}`};
            margin: 0;
          }
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }
          .print-receipt-container {
            width: ${widthStr} !important;
            min-height: ${heightStr} !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 auto !important;
            padding: ${isA4 ? '0.6cm 1cm 1cm 1cm' : '0.4cm 0.6cm 0.6cm 0.6cm'} !important;
            box-sizing: border-box !important;
            background: white !important;
            position: relative !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
        .print-receipt-container {
          box-sizing: border-box !important;
          position: relative !important;
        }
        .receipt-border-decor {
          position: absolute !important;
          top: 10px !important;
          bottom: 10px !important;
          left: 10px !important;
          right: 10px !important;
          border: 4px double #996515 !important;
          outline: 1px solid #D4AF37 !important;
          outline-offset: -6px !important;
          border-radius: 6px !important;
          pointer-events: none !important;
          z-index: 99 !important;
        }
        .urdu-text {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          line-height: 1.6;
        }
        .header-section {
          text-align: center;
          border-bottom: 3px double #996515;
          padding-bottom: ${isA4 ? '12px' : '6px'};
          margin-bottom: ${isA4 ? '16px' : '10px'};
          padding-top: ${isA4 ? '18px' : '12px'};
        }
        .shop-name {
          font-size: ${isA4 ? '84px' : '72px'};
          font-weight: 900;
          color: #996515;
          margin: 0;
          margin-bottom: ${isA4 ? '10px' : '6px'};
          font-family: 'Jameel Noori Nastaleeq', serif !important;
          line-height: 1.2;
        }
        .header-phone {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: ${isPurchase ? '10px' : '6px'};
          width: 100%;
          flex-wrap: wrap;
        }
        .phone-brand-box, .phone-brand-box-secondary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: #f0fdf4;
          padding: ${isPurchase ? '6px 12px' : '4px 8px'};
          border-radius: 4px;
          border: 1.2px solid #22c55e;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          line-height: normal;
        }
        .phone-brand-box-secondary {
          background: #fffdf5;
          border-color: #996515;
        }
        .brand-icon {
          width: ${isPurchase ? '26px' : '20px'};
          height: ${isPurchase ? '26px' : '20px'};
          object-fit: contain;
          display: block;
        }
        .phone-number {
          color: #166534;
          font-weight: 900;
          font-size: ${isPurchase ? '20px' : '15px'};
          letter-spacing: 0.5px;
          font-family: 'Inter', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .phone2-container {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: ${isPurchase ? '24px' : '18px'};
          font-weight: 900;
          color: #996515;
        }
        .receipt-footer {
          margin-top: ${isPurchase ? '50px' : '20px'};
          
          border-top: 1px solid #eee;
          text-align: center;
        }
        .footer-brand-box {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          margin-top: 10px;
          opacity: 0.8;
        }
        .footer-icon {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }
        .info-bar {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          background: #f8fafc;
          padding: 18px;
          border: 1.5px solid #e2e8f0;
          font-size: 16px;
          border-radius: 8px;
        }
        .receipt-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: ${isPurchase ? '25px' : '12px'};
          border-top: 1.5px solid #ddd;
          border-right: 1.5px solid #ddd;
          background: white;
        }
        .receipt-table tr:nth-child(even) {
          background-color: #fcfcfc;
        }
        .receipt-table th {
          background: #996515 !important;
          background-color: #996515 !important;
          color: white !important;
          padding: ${isPurchase ? '16px 12px' : '14px 10px'};
          text-align: center;
          vertical-align: middle;
          border-bottom: 1.5px solid #ddd;
          border-left: 1.5px solid #ddd;
          font-size: ${isPurchase ? '18px' : '16px'};
          font-weight: bold;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.8 !important;
        }
        .receipt-table td {
          padding: ${isPurchase ? '12px 12px' : '10px 10px'};
          text-align: right;
          vertical-align: middle;
          border-bottom: 1.5px solid #ddd;
          border-left: 1.5px solid #ddd;
          font-size: ${isPurchase ? '16px' : '14px'};
          color: #333;
          line-height: 1.8 !important;
        }
        .summary-table {
          width: ${isPurchase ? '320px' : '260px'};
          border: 2.5px solid #996515;
          border-radius: 12px;
          background: #fffdf5;
          margin-bottom: ${isPurchase ? '20px' : '10px'};
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
        }
        .summary-table th, .summary-table td {
          border: none;
          padding: ${isPurchase ? '10px 15px' : '6px 10px'};
        }
        .summary-table th {
          background: transparent !important;
          color: #333 !important;
          text-align: right;
          font-weight: normal;
          width: 50%;
        }
        .summary-table td {
          text-align: right;
          font-weight: bold;
          width: 50%;
        }
        .final-total-row {
          border-top: 2px solid #996515 !important;
          font-size: ${isPurchase ? '22px' : '18px'} !important;
          color: #996515 !important;
        }

        .terms {
          clear: both;
          margin-top: ${isPurchase ? '40px' : '15px'};
          font-size: ${isPurchase ? '12.5px' : '10.5px'};
          border-top: 1px solid #ccc;
          padding-top: ${isPurchase ? '15px' : '8px'};
          line-height: ${isPurchase ? '1.8' : '1.5'};
        }

        .font-nastaliq {
          font-family: 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif !important;
          line-height: 1.8 !important;
        }
        .info-grid {
          display: grid;
          grid-template-cols: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 12px;
        }
      `}
    </style>
  );

  if (type === 'sale') {
    const sale = data as Sale;
    const oldGoldDeduction = Math.round(sale.items.reduce((a, b) => a + (b.t < 0 ? Math.abs(b.t) : 0), 0));
    const goldItems = sale.items.filter(item => item.t > 0);
    const goldAmount = Math.round(goldItems.reduce((sum, item) => sum + (item.w + item.mk) * item.r, 0));
    const mazdori = Math.round(goldItems.reduce((sum, item) => sum + (item.t - (item.w + item.mk) * item.r), 0));
    const totalBill = goldAmount + mazdori;

    return (
      <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
        fontFamily: "'Inter', sans-serif", 
        width: '14.8cm', 
        minHeight: '21cm', 
        height: 'auto', 
        boxSizing: 'border-box', 
        position: 'relative', 
        padding: '0.5cm 1cm 1cm 1cm',
        paddingBottom: '2cm',
        backgroundColor: 'white'
      }}>
        {printStyles}
        <div className="receipt-border-decor" />
        <div className="header-section">
          <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
          <div style={{ height: '15px' }}></div>
          <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
          <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
          <div className="header-phone" dir="ltr">
            <div className="phone-brand-box">
              
              <span className="phone-number">{shopSettings.phone}</span>
            </div>
            {shopSettings.phone2 && (
              <div className="phone-brand-box-secondary">
                
                <span className="phone-number" style={{ color: '#996515' }}>{shopSettings.phone2}</span>
              </div>
            )}
          </div>
        </div>

          <table className="receipt-table" style={{ marginBottom: '20px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '15%', background: '#996515', color: 'white' }}>کسٹمر</th>
                <td className="font-nastaliq" style={{ width: '35%', paddingRight: '15px' }}>{sale.name}</td>
                <th className="font-nastaliq" style={{ width: '15%', background: '#996515', color: 'white' }}>موبائل</th>
                <td className="font-mono" style={{ width: '35%' }} dir="ltr">{sale.phone}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white' }}>تاریخ</th>
                <td>{sale.date}</td>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white' }}>بل نمبر</th>
                <td className="font-bold text-gold">#{1000 + (id || 0)}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white' }}>ریٹ فی تولہ</th>
                <td className="font-mono font-bold" style={{ color: '#996515' }}>{(sale.items[0]?.r ? (sale.items[0]?.r * 12).toLocaleString() : '0')}</td>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white' }}>ریٹ فی گرام</th>
                <td className="font-mono font-bold" style={{ color: '#996515' }}>{(sale.items[0]?.r || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '4px' }}>بل کی صورتحال</th>
                <td colSpan={3} style={{ paddingRight: '12px', padding: '4px 12px' }}>
                  {sale.rem <= 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 'bold', fontSize: '13px', border: '1px solid #86efac' }}>
                      ✓ صاف / بے باق (Clear - Paid in Full)
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 10px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontWeight: 'bold', fontSize: '13px', border: '1px solid #fca5a5' }}>
                      ⚠ بقایا دار (Baqaya: Rs. {sale.rem.toLocaleString()})
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr style={{ background: '#996515' }}>
                <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white' }}>تفصیل</th>
                <th className="font-nastaliq" style={{ width: '8%', background: '#996515', color: 'white' }}>تعداد</th>
                <th className="font-nastaliq" style={{ width: '12%', background: '#996515', color: 'white' }}>وزن</th>
                <th className="font-nastaliq" style={{ width: '10%', background: '#996515', color: 'white' }}>پالش</th>
                <th className="font-nastaliq" style={{ width: '14%', background: '#996515', color: 'white' }}>کل وزن</th>
                <th className="font-nastaliq" style={{ width: '18%', background: '#996515', color: 'white' }}>کل قیمت</th>
                <th className="font-nastaliq" style={{ width: '18%', background: '#996515', color: 'white' }}>تصویر</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr key={i}>
                  <td className="text-right font-bold font-nastaliq" style={{ paddingRight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.n}</td>
                  <td className="font-mono">{item.t < 0 ? '-' : (item.p || 1)}</td>
                  <td className="font-mono font-bold">{parseFloat(Number(item.w).toFixed(2))}g</td>
                  <td className="font-mono">{parseFloat(Number(item.mk).toFixed(2))}g</td>
                  <td className="font-mono font-bold">{parseFloat(Number(item.w + item.mk).toFixed(2))}g</td>
                  <td className="font-bold font-mono">{Math.round(item.t).toLocaleString()}</td>
                  <td style={{ padding: '4px', verticalAlign: 'middle' }}>
                    {item.img ? (
                      <img 
                        src={item.img} 
                        alt="" 
                        style={{ height: '102px', maxHeight: '102px', width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} 
                        className="rounded border border-zinc-200 shadow-sm"
                      />
                    ) : (
                      <span className="text-zinc-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-end mt-4 gap-4" dir="ltr">
            {/* Left side: Royal Gold Authenticity Stamp */}
            <div className="flex items-center gap-2 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/90 shadow-xs">
              <RoyalGoldSeal size={82} />
            </div>

            {/* Right side: Total balance / Receive amount summary box */}
            <table className="summary-table" dir="rtl" style={{ margin: 0 }}>
              <tbody>
                <tr>
                  <th className="font-nastaliq" style={{ padding: '3px 8px' }}>سونے کی رقم</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '3px 8px' }}>{goldAmount.toLocaleString()}</td>
                </tr>
                <tr>
                  <th className="font-nastaliq" style={{ padding: '3px 8px' }}>مزدوری</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '3px 8px' }}>{mazdori.toLocaleString()}</td>
                </tr>
                <tr style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd' }}>
                  <th className="font-nastaliq font-bold" style={{ padding: '3px 8px' }}>کل رقم</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '3px 8px' }}>{totalBill.toLocaleString()}</td>
                </tr>
                <tr className="text-red-700">
                  <th className="font-nastaliq" style={{ padding: '3px 8px' }}>پرانا سونا منہا (-)</th>
                  <td className="font-mono" style={{ padding: '3px 8px' }}>{oldGoldDeduction.toLocaleString()}</td>
                </tr>
                <tr className="text-green-700">
                  <th className="font-nastaliq" style={{ padding: '3px 8px' }}>وصول شدہ رقم</th>
                  <td className="font-mono" style={{ padding: '3px 8px' }}>{sale.rec.toLocaleString()}</td>
                </tr>
                <tr className="final-total-row">
                  <th className="font-nastaliq font-black">صاف بقایا</th>
                  <td className="font-black font-mono">{sale.rem.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start terms-container border-t border-zinc-300 pt-3 mt-4">
            <div className="terms font-nastaliq" style={{ border: 'none', marginTop: 0, paddingTop: 0, width: '70%' }}>
              <b>شرائط و ضوابط:</b><br />
              1۔ زیورات کی واپسی پر 25% کاٹ لیا جائے گا۔<br />
              2۔ کسٹمر اپنا تیار سامان 1 ہفتہ کے اندر وصول کرنے کا پابند ہوگا۔<br />
              3۔ تیار شدہ سامان چھوڑنے پر 20% کاٹ لیا جائے گا۔<br />
              4۔ فی تولہ 1 ماشہ پالش کاٹ ہوگا۔<br />
              5۔ آرڈر دیتے وقت 75-80% رقم لازمی دینا ہوگی۔<br />
              6۔ پرانے زیورات توڑ کر نئے زیورات تیار کرنے پر پانسہ 2 ماشہ اور پونڈ پانسہ 3 ماشہ فی تولہ کاٹ لیا جائے گا۔<br />
              7۔ استعمال سے پہلے بینگلز کے وزن کی تسلی کریں، گھس جانے کی وجہ سے بعد میں دکاندار ذمہ دار نہیں ہوگا۔
            </div>
            <div className="w-[28%] flex flex-col items-center justify-end text-center pr-2" dir="ltr" style={{ minHeight: '65px' }}>
              <div className="border-b-2 border-dashed border-amber-900/60 w-full mb-3"></div>
              <span className="text-[11px] font-bold text-amber-900 urdu-text block">دستخط دکاندار / تصدیق</span>
              <span className="text-[8px] font-semibold text-zinc-500 tracking-wider block uppercase">Authorized Signature</span>
            </div>
          </div>
        </div>
    );
  }

    if (type === 'order') {
      const order = data as Order;
      const paymentsSum = order.payments.reduce((sum, p) => sum + p.amt, 0);
      const goldAmount = order.goldAmount !== undefined ? order.goldAmount : order.total;
      const mazdori = order.mazdori !== undefined ? order.mazdori : 0;
      const oldGoldMinus = order.oldGoldMinus || 0;
      const totalAmount = goldAmount + mazdori;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: '21cm', 
          minHeight: '29.7cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.6cm 1cm 1.2cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '8px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq" style={{ fontSize: '20px' }}>ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600" style={{ fontSize: '15px' }}>{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                <span className="phone-number" style={{ fontSize: '16px' }}>{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  <span className="phone-number" style={{ color: '#996515', fontSize: '16px' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-4 py-1 mt-2.5 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">آرڈر بکنگ رسید</div>
          </div>

          <table className="receipt-table" style={{ marginBottom: '14px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '18%', background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>نام کسٹمر</th>
                <td className="font-nastaliq font-bold" style={{ width: '32%', paddingRight: '12px', fontSize: '15px' }}>{order.name}</td>
                <th className="font-nastaliq" style={{ width: '18%', background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>فون نمبر</th>
                <td className="font-mono font-bold" style={{ width: '32%', fontSize: '15px' }} dir="ltr">{order.phone}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>تاریخ بکنگ</th>
                <td className="font-mono font-bold" style={{ fontSize: '15px' }}>{order.date}</td>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>تاریخ واپسی</th>
                <td className="font-mono font-bold text-red-600" style={{ fontSize: '15px' }}>{order.due}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>نام آئٹم</th>
                <td className="font-nastaliq font-bold" style={{ paddingRight: '12px', fontSize: '15px' }}>{order.item}</td>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>نام کاریگر</th>
                <td className="font-nastaliq font-bold" style={{ paddingRight: '12px', fontSize: '15px' }}>{order.karigar}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>پیمائش</th>
                <td className="font-mono font-bold" style={{ fontSize: '15px' }}>{order.measurements || '-'}</td>
                <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>فی تولہ ریٹ</th>
                <td className="font-mono font-bold text-gold" style={{ fontSize: '15px' }}>{order.pricePerTola || '-'}</td>
              </tr>
              {showOrderStatus && (
                <tr>
                  <th className="font-nastaliq" style={{ background: '#996515', color: 'white', padding: '7px 10px', fontSize: '16px' }}>اسٹیٹس (Status)</th>
                  <td colSpan={3} className="font-nastaliq font-bold" style={{ paddingRight: '12px' }}>
                    {(() => {
                      const cfg = getOrderStatusConfig(order.status);
                      return (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 14px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: cfg.color,
                          backgroundColor: cfg.bg,
                          border: `1.5px solid ${cfg.border}`
                        }}>
                          {cfg.label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-2">
            <h4 className="font-bold mb-1.5 text-sm font-nastaliq text-right text-gold">وزن کی تفصیل:</h4>
            <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%', marginBottom: '14px' }}>
              <thead>
                <tr style={{ background: '#996515' }}>
                  <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white', padding: '8px', fontSize: '15px' }}>پرانا وزن</th>
                  <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white', padding: '8px', fontSize: '15px' }}>وزن</th>
                  <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white', padding: '8px', fontSize: '15px' }}>پالش</th>
                  <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white', padding: '8px', fontSize: '15px' }}>ٹوٹل وزن</th>
                  <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white', padding: '8px', fontSize: '15px' }}>اضافی وزن</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono font-bold text-center" style={{ padding: '7px', fontSize: '15px' }}>{order.oldWt ? `${parseFloat(Number(order.oldWt).toFixed(2))}g` : '-'}</td>
                  <td className="font-mono font-bold text-center" style={{ padding: '7px', fontSize: '15px' }}>{order.readyWt ? `${parseFloat(Number(order.readyWt).toFixed(2))}g` : '-'}</td>
                  <td className="font-bold font-nastaliq text-center" style={{ padding: '7px', fontSize: '15px' }}>{order.makingCharges || '-'}</td>
                  <td className="font-mono font-bold text-center" style={{ padding: '7px', fontSize: '15px' }}>{order.totalWt ? `${parseFloat(Number(order.totalWt).toFixed(2))}g` : '-'}</td>
                  <td className="font-mono font-bold text-center" style={{ padding: '7px', fontSize: '15px' }}>{order.izafiWt ? `${parseFloat(Number(order.izafiWt).toFixed(2))}g` : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {order.img && (
            <div className="mt-2 mb-2 text-center">
              <p className="font-bold text-xs font-nastaliq mb-1 text-right">تصویر:</p>
              <img src={order.img} alt="" className="max-h-36 mx-auto border border-zinc-200 rounded-lg shadow-sm" style={{ objectFit: 'contain' }} />
            </div>
          )}

          <h4 className="font-bold mt-2 mb-1.5 text-sm font-nastaliq text-right">ادائیگیوں کی تفصیل:</h4>
          <table className="receipt-table" style={{ tableLayout: 'fixed', width: '100%', marginBottom: '14px' }}>
            <thead>
              <tr style={{ background: '#996515' }}>
                <th className="font-nastaliq" style={{ width: '33%', background: '#996515', color: 'white', padding: '7px', fontSize: '15px' }}>معطلی نمبر</th>
                <th className="font-nastaliq" style={{ width: '33%', background: '#996515', color: 'white', padding: '7px', fontSize: '15px' }}>رقم</th>
                <th className="font-nastaliq" style={{ width: '34%', background: '#996515', color: 'white', padding: '7px', fontSize: '15px' }}>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-zinc-400 font-nastaliq py-2 text-center text-sm">کوئی ادائیگی نہیں ہوئی</td>
                </tr>
              ) : (
                order.payments.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td className="font-nastaliq text-center" style={{ padding: '6px', fontSize: '14px' }}>قسط {i + 1}</td>
                    <td className="font-mono font-bold text-center" style={{ padding: '6px', fontSize: '14px' }}>{p.amt.toLocaleString()}</td>
                    <td className="font-mono text-center" style={{ padding: '6px', fontSize: '14px' }}>{p.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex justify-between items-end mt-3 gap-6" dir="ltr">
            {/* Left side: Royal Gold Authenticity Stamp */}
            <div className="flex items-center gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200/90 shadow-xs">
              <RoyalGoldSeal size={86} />
            </div>

            {/* Right side: Total balance / Receive amount summary box */}
            <table className="summary-table" dir="rtl" style={{ margin: 0, width: '330px' }}>
              <tbody>
                <tr>
                  <th className="font-nastaliq" style={{ padding: '5px 12px', fontSize: '15px' }}>سونے کی رقم</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '5px 12px', fontSize: '15px' }}>{goldAmount.toLocaleString()}</td>
                </tr>
                <tr>
                  <th className="font-nastaliq" style={{ padding: '5px 12px', fontSize: '15px' }}>مزدوری</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '5px 12px', fontSize: '15px' }}>{mazdori.toLocaleString()}</td>
                </tr>
                <tr style={{ borderTop: '1.5px solid #ddd', borderBottom: '1.5px solid #ddd' }}>
                  <th className="font-nastaliq font-bold" style={{ padding: '5px 12px', fontSize: '15px' }}>کل رقم</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '5px 12px', fontSize: '15px' }}>{totalAmount.toLocaleString()}</td>
                </tr>
                <tr className="text-red-700">
                  <th className="font-nastaliq" style={{ padding: '5px 12px', fontSize: '15px' }}>پرانا سونا منہا (-)</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '5px 12px', fontSize: '15px' }}>{oldGoldMinus.toLocaleString()}</td>
                </tr>
                <tr className="text-green-700">
                  <th className="font-nastaliq" style={{ padding: '5px 12px', fontSize: '15px' }}>وصول شدہ رقم</th>
                  <td className="font-mono font-bold text-right" style={{ padding: '5px 12px', fontSize: '15px' }}>{paymentsSum.toLocaleString()}</td>
                </tr>
                <tr className="final-total-row">
                  <th className="font-nastaliq font-black text-right font-bold text-gold-dark" style={{ padding: '6px 12px', fontSize: '18px' }}>صاف بقایا</th>
                  <td className="font-black font-mono text-gold-dark text-right" style={{ padding: '6px 12px', fontSize: '18px' }}>
                    {order.rem <= 0 ? (
                      <span style={{ color: '#15803d' }}>0 (صاف / Clear)</span>
                    ) : (
                      order.rem.toLocaleString()
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start terms-container border-t border-zinc-300 pt-3 mt-4">
            <div className="terms font-nastaliq" style={{ border: 'none', marginTop: 0, paddingTop: 0, width: '68%', fontSize: '11px', lineHeight: '1.7' }}>
              <b>شرائط و ضوابط:</b><br />
              1۔ زیورات کی واپسی پر 25% کاٹ لیا جائے گا۔<br />
              2۔ کسٹمر اپنا تیار سامان 1 ہفتہ کے اندر وصول کرنے کا پابند ہوگا۔<br />
              3۔ تیار شدہ سامان چھوڑنے پر 20% کاٹ لیا جائے گا۔<br />
              4۔ فی تولہ 1 ماشہ پالش کاٹ ہوگا۔<br />
              5۔ آرڈر دیتے وقت 75-80% رقم لازمی دینا ہوگی۔<br />
              6۔ پرانے زیورات توڑ کر نئے زیورات تیار کرنے پر پانسہ 2 ماشہ اور پونڈ پانسہ 3 ماشہ فی تولہ کاٹ لیا جائے گا۔<br />
              7۔ استعمال سے پہلے بینگلز کے وزن کی تسلی کریں، گھس جانے کی وجہ سے بعد میں دکاندار ذمہ دار نہیں ہوگا۔
            </div>
            <div className="w-[28%] flex flex-col items-center justify-end text-center pr-2" dir="ltr" style={{ minHeight: '65px' }}>
              <div className="border-b-2 border-dashed border-amber-900/60 w-full mb-2"></div>
              <span className="text-[11px] font-bold text-amber-900 urdu-text block">دستخط دکاندار / تصدیق</span>
              <span className="text-[9px] font-semibold text-zinc-500 tracking-wider block uppercase">Authorized Signature</span>
            </div>
          </div>
        </div>
    );
  }

    if (type === 'repair') {
      const repair = data as Repair;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: '14.8cm', 
          minHeight: '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.5cm 1cm 1cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '15px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  
                  <span className="phone-number" style={{ color: '#996515' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">ریپیئرنگ رسید</div>
          </div>

          <table className="receipt-table">
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '20%' }}>کسٹمر</th>
                <td className="font-bold" style={{ width: '30%' }}>{repair.customerName}</td>
                <th className="font-nastaliq" style={{ width: '20%' }}>تاریخ</th>
                <td className="font-bold" style={{ width: '30%' }} dir="ltr">{formatDate(repair.date, 'ur-PK')}</td>
              </tr>
              <tr>
                <th className="font-nastaliq">فون</th>
                <td className="font-bold" dir="ltr">{repair.customerPhone}</td>
                <th className="font-nastaliq">حالت</th>
                <td className="font-bold">{repair.status === 'Done' ? 'تیار ہے' : 'انتظار'}</td>
              </tr>
            </tbody>
          </table>

          <table className="receipt-table" style={{ marginTop: '20px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%', background: '#fdfbf4' }}>آئٹم</th>
                <td className="font-nastaliq" style={{ width: '75%', textAlign: 'right', paddingRight: '15px' }}>{repair.item}</td>
              </tr>
              <tr>
                <th className="font-nastaliq" style={{ background: '#fdfbf4' }}>مسئلہ</th>
                <td className="font-nastaliq" style={{ textAlign: 'right', paddingRight: '15px' }}>{repair.issue}</td>
              </tr>
            </tbody>
          </table>

          {repair.img && (
            <div className="mt-4 text-center">
              <img src={repair.img} alt="" className="max-h-48 mx-auto border border-zinc-200 rounded" />
            </div>
          )}

          <div className="flex justify-between items-end mt-4 gap-4" dir="ltr">
            {/* Left side: Royal Gold Authenticity Stamp */}
            <div className="flex items-center gap-2 bg-amber-50/70 p-2 rounded-xl border border-amber-200/90 shadow-xs">
              <RoyalGoldSeal size={74} />
            </div>

            {/* Right side: Total charges box */}
            <table className="summary-table" dir="rtl" style={{ margin: 0 }}>
              <tbody>
                <tr className="final-total-row">
                  <th className="font-nastaliq font-black" style={{ padding: '6px 12px' }}>کل رقم / چارجز</th>
                  <td className="font-bold font-mono text-right" style={{ padding: '6px 12px', fontSize: '20px', color: '#996515' }}>Rs. {repair.charges.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start terms-container border-t border-zinc-300 pt-3 mt-4">
            <p className="text-[12px] font-nastaliq text-zinc-600 w-[68%]">
              * ریپیئرنگ کے دوران کسی بھی قسم کے نقصان کی صورت میں دکان ذمہ دار نہیں ہوگی۔ تمام کام ماہر کاریگروں کے ذریعے تسلی بخش کیا جاتا ہے۔
            </p>
            <div className="w-[28%] flex flex-col items-center justify-end text-center pr-2" dir="ltr" style={{ minHeight: '50px' }}>
              <div className="border-b-2 border-dashed border-amber-900/60 w-full mb-2"></div>
              <span className="text-[10px] font-bold text-amber-900 urdu-text block">دستخط دکاندار / تصدیق</span>
              <span className="text-[8px] font-semibold text-zinc-500 tracking-wider block uppercase">Authorized Signature</span>
            </div>
          </div>
        </div>
    );
  }

    if (type === 'karigar') {
      const karigar = data as KarigarRecord;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: '14.8cm', 
          minHeight: '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.5cm 1cm 1cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '15px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  
                  <span className="phone-number" style={{ color: '#996515' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">کاریگر رسید</div>
          </div>

          <table className="receipt-table">
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%' }}>کاریگر</th>
                <td className="font-nastaliq" style={{ width: '25%' }}>{karigar.name}</td>
                <th className="font-nastaliq" style={{ width: '25%' }}>تاریخ</th>
                <td className="font-mono" style={{ width: '25%' }}>{karigar.date}</td>
              </tr>
              <tr>
                <th className="font-nastaliq">فون</th>
                <td colSpan={3} className="font-mono" dir="ltr">{karigar.phone}</td>
              </tr>
            </tbody>
          </table>

          <table className="receipt-table" style={{ marginTop: '15px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%', background: '#fdfbf4' }}>ٹاسک (Task)</th>
                <td className="font-nastaliq" style={{ width: '75%', textAlign: 'right', paddingRight: '15px' }}>{karigar.task}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <table className="receipt-table">
              <thead>
                <tr>
                  <th className="font-nastaliq" style={{ width: '25%' }}>دیا گیا</th>
                  <th className="font-nastaliq" style={{ width: '25%' }}>وصول</th>
                  <th className="font-nastaliq" style={{ width: '25%' }}>کاٹ</th>
                  <th className="font-nastaliq" style={{ width: '25%' }}>صاف بقایا</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono">{karigar.given}g</td>
                  <td className="font-mono">{karigar.rec}g</td>
                  <td className="font-mono">{karigar.kaat}g</td>
                  <td className="font-bold font-mono" style={{ color: '#996515' }}>{karigar.net}g</td>
                </tr>
              </tbody>
            </table>
          </div>

          {karigar.img && (
            <div className="mt-4 text-center">
              <img src={karigar.img} alt="" className="max-h-48 mx-auto border border-zinc-200 rounded" />
            </div>
          )}

          <div className="flex justify-between items-center pt-4 mt-4 border-t border-zinc-200" dir="ltr">
            {/* Left side: Royal Gold Authenticity Stamp */}
            <div className="flex items-center gap-2 bg-amber-50/70 p-2 rounded-xl border border-amber-200/90 shadow-xs">
              <RoyalGoldSeal size={70} />
            </div>
            {/* Right side: Karigar Signature */}
            <div className="text-sm font-nastaliq font-bold text-zinc-700 text-right" dir="rtl">
              دستخط کاریگر: ____________________
            </div>
          </div>
        </div>
    );
  }

    if (type === 'stock') {
      const stock = data as StockItem;
      return (
        <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
          fontFamily: "'Inter', sans-serif", 
          width: '14.8cm', 
          minHeight: '21cm', 
          height: 'auto', 
          boxSizing: 'border-box', 
          position: 'relative', 
          padding: '0.5cm 1cm 1cm 1cm',
          paddingBottom: '2.5cm',
          backgroundColor: 'white'
        }}>
          {printStyles}
          <div className="receipt-border-decor" />
          <div className="header-section">
            <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
            <div style={{ height: '15px' }}></div>
            <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
            <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
            <div className="header-phone" dir="ltr">
              <div className="phone-brand-box">
                
                <span className="phone-number">{shopSettings.phone}</span>
              </div>
              {shopSettings.phone2 && (
                <div className="phone-brand-box-secondary">
                  
                  <span className="phone-number" style={{ color: '#996515' }}>{shopSettings.phone2}</span>
                </div>
              )}
            </div>
            <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">اسٹاک رسید</div>
          </div>

          <table className="receipt-table" style={{ marginTop: '20px' }}>
            <tbody>
              <tr>
                <th className="font-nastaliq" style={{ width: '25%', background: '#fdfbf4' }}>آئٹم</th>
                <td className="font-bold text-xl font-nastaliq" style={{ width: '75%' }}>{stock.name}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <table className="receipt-table">
            <thead>
              <tr>
                <th className="font-nastaliq" style={{ width: '33%' }}>ٹائپ</th>
                <th className="font-nastaliq" style={{ width: '33%' }}>صاف وزن</th>
                <th className="font-nastaliq" style={{ width: '34%' }}>تعداد</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-nastaliq">{stock.type}</td>
                <td className="font-bold text-lg font-mono">{stock.quantity} {stock.unit}</td>
                <td className="font-bold text-lg font-mono">{stock.pieces || 0} pcs</td>
              </tr>
            </tbody>
          </table>
        </div>

          {stock.img && (
            <div className="mt-6 text-center">
              <img src={stock.img} alt="" className="max-h-64 mx-auto border border-zinc-200 rounded" />
            </div>
          )}

          <div className="flex justify-between items-center pt-4 mt-4 border-t border-zinc-200" dir="ltr">
            <div className="flex items-center gap-3">
              <RoyalGoldSeal size={65} />
            </div>
            <span className="text-xs font-bold text-zinc-500 urdu-text text-right" dir="rtl">
              نفیس جیولرز تصدیق شدہ اسٹاک انوینٹری
            </span>
          </div>
        </div>
    );
  }

  if (type === 'purchase') {
    const purchase = data as GoldPurchase;
    return (
      <div ref={ref} className="print-receipt-container bg-white text-zinc-900" dir="rtl" style={{ 
        fontFamily: "'Inter', sans-serif", 
        width: '21cm', 
        minHeight: '29.7cm', 
        height: 'auto', 
        boxSizing: 'border-box', 
        position: 'relative', 
        padding: '0.5cm 1cm 1cm 1cm',
        paddingBottom: '2.5cm',
        backgroundColor: 'white'
      }}>
        {printStyles}
        <div className="receipt-border-decor" />
        <div className="header-section">
          <h1 className="shop-name text-center" style={{ width: '100%', display: 'block' }}>{shopSettings.name}</h1>
          <div style={{ height: '15px' }}></div>
          <p className="text-2xl font-bold m-1 font-nastaliq">ہمارے ہاں سنگاپور اور دبئی ورائٹی دستیاب ہے۔</p>
          <p className="text-lg m-1 font-nastaliq text-zinc-600">{shopSettings.address}</p>
          <div className="header-phone" dir="ltr">
            <div className="phone-brand-box">
              
              <span className="phone-number">{shopSettings.phone}</span>
            </div>
            {shopSettings.phone2 && (
              <div className="phone-brand-box-secondary">
                
                <span className="phone-number" style={{ color: '#996515' }}>{shopSettings.phone2}</span>
              </div>
            )}
          </div>
          <div className="bg-zinc-100 px-3 py-1 mt-4 font-bold rounded-lg text-gold text-lg font-nastaliq border border-gold-20 inline-block">پرانا سونا خریداری رسید</div>
        </div>

        <table className="receipt-table">
          <tbody>
            <tr>
              <th className="font-nastaliq" style={{ width: '20%' }}>بیچنے والے کا نام</th>
              <td className="font-bold font-nastaliq" style={{ width: '30%' }}>{purchase.name}</td>
              <th className="font-nastaliq" style={{ width: '20%' }}>فون نمبر</th>
              <td className="font-bold" style={{ width: '30%' }} dir="ltr">{purchase.phone}</td>
            </tr>
            <tr>
              <th className="font-nastaliq">تاریخ</th>
              <td>{purchase.date}</td>
              <th className="font-nastaliq">رسید نمبر</th>
              <td className="font-bold text-gold">#{5000 + (id || 0)}</td>
            </tr>
          </tbody>
        </table>

        <table className="receipt-table" style={{ marginTop: '20px' }}>
          <thead>
            <tr>
              <th className="font-nastaliq" style={{ width: '30%', background: '#996515', color: 'white' }}>آئٹم</th>
              <th className="font-nastaliq" style={{ width: '20%', background: '#996515', color: 'white' }}>وزن</th>
              <th className="font-nastaliq" style={{ width: '25%', background: '#996515', color: 'white' }}>ریٹ</th>
              <th className="font-nastaliq" style={{ width: '25%', background: '#996515', color: 'white' }}>کل قیمت</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-nastaliq font-bold" style={{ paddingRight: '15px' }}>پرانا سونا</td>
              <td className="font-mono font-bold text-lg">{purchase.weight}g</td>
              <td className="font-mono">{purchase.rate.toLocaleString()}</td>
              <td className="font-mono font-bold text-lg">{purchase.total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {purchase.img && (
          <div className="mt-4 text-center">
            <h4 className="text-xs font-bold font-nastaliq mb-2">خریدے گئے سونے کی تصویر</h4>
            <img src={purchase.img} alt="" className="max-h-64 mx-auto border-2 border-zinc-200 rounded-xl shadow-sm" />
          </div>
        )}

        <div className="flex justify-between items-end mt-6 gap-4" dir="ltr">
          {/* Left side: Royal Gold Authenticity Stamp */}
          <div className="flex items-center gap-2 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/90 shadow-xs">
            <RoyalGoldSeal size={82} />
          </div>

          {/* Right side: Cash Paid Amount Box */}
          <table className="summary-table" dir="rtl" style={{ margin: 0 }}>
            <tbody>
              <tr className="final-total-row">
                <th className="font-nastaliq font-black" style={{ fontSize: '18px' }}>نقد ادا شدہ رقم</th>
                <td className="font-black font-mono" style={{ fontSize: '24px' }}>Rs. {purchase.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-10 border-t-2 border-zinc-300 pt-6">
          <h3 className="text-center font-bold text-lg mb-4 font-nastaliq underline">اعلان و تصدیق</h3>
          <div className="text-[16px] leading-relaxed space-y-4 font-nastaliq text-justify mb-4">
            <p>
              فروخت کنندہ اس بات کی مکمل تصدیق کرتا/کرتی ہے کہ فروخت کیا جانے والا سونا اس کی جائز اور قانونی ملکیت ہے اور کسی بھی قسم کی چوری، گمشدگی یا غیر قانونی ذریعے سے حاصل شدہ نہیں ہے۔ فروخت کنندہ نے اپنی درست شناختی دستاویز (CNIC) فراہم کی ہے جس کی کاپی خریدار کے ریکارڈ میں محفوظ ہے۔
            </p>
            <p>
              خریدار (دکان) نے مناسب قانونی احتیاط (Due Diligence) کے طور پر شناخت، تصویر اور لین دین کا مکمل ریکارڈ محفوظ کیا ہے۔ اگر مستقبل میں یہ سونا چوری شدہ یا غیر قانونی ثابت ہوتا ہے تو اس کی مکمل قانونی ذمہ داری فروخت کنندہ پر عائد ہوگی اور وہ ہر قسم کے نقصان، دعویٰ یا قانونی کارروائی کا ذمہ دار ہوگا۔
            </p>
          </div>
          <div className="text-[14px] leading-tight space-y-3 mb-8 text-justify font-sans text-zinc-700 italic border-b border-zinc-200 pb-6">
            <p>
              The seller hereby declares that the gold being sold is his/her lawful property and is not stolen, lost, or obtained through any illegal means. A valid CNIC has been provided and a copy is retained in the buyer’s records.
            </p>
            <p>
              The buyer (shop) has exercised due diligence by recording identification details, photograph, and transaction data. In the event that the gold is later found to be stolen or illegal, full legal responsibility and liability shall rest with the seller, including compensation for any loss or legal claim.
            </p>
          </div>
          
          <div className="mt-12 grid grid-cols-2 gap-y-10 text-[13px] font-bold font-nastaliq">
            <div className="border-b border-zinc-400 pb-1">فروخت کنندہ کے دستخط:</div>
            <div className="border-b border-zinc-400 pb-1 text-left">انگوٹھے کا نشان:</div>
            <div className="border-b border-zinc-400 pb-1">شناختی کارڈ:</div>
            <div className="border-b border-zinc-400 pb-1 text-left">موبائل نمبر:</div>
            <div className="col-span-2 text-center mt-6 border-b border-zinc-400 pb-1 inline-block mx-auto px-12">تاریخ: {purchase.date}</div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 mt-8 border-t border-zinc-300" dir="ltr">
          <div className="text-left font-serif text-xs text-zinc-600">
            <p className="font-bold text-amber-900 text-sm">Nafees Jewellers • Official Purchase Document</p>
            <p className="text-[11px] text-zinc-500">Legal Ownership Declaration Kept On Official Record</p>
          </div>
          <div className="text-right">
            <div className="border-b-2 border-dashed border-amber-900/60 w-48 mb-2 ml-auto"></div>
            <span className="text-xs font-bold text-amber-900 urdu-text block">دستخط دکاندار / تصدیق شدہ</span>
            <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Authorized Signature</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
});

PrintReceipt.displayName = 'PrintReceipt';
