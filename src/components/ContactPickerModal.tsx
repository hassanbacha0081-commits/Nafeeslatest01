import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { type Language } from '../translations';
import { X, Search, UserCheck } from 'lucide-react';

interface ContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: { name: string; phone: string }) => void;
  lang: Language;
}

export default function ContactPickerModal({ isOpen, onClose, onSelect, lang }: ContactPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const contacts = useLiveQuery(async () => {
    if (!isOpen) return [];
    const sales = await db.sales.toArray();
    const orders = await db.orders.toArray();
    const karigars = await db.karigars.toArray();
    const purchases = await db.goldPurchases.toArray();

    const contactMap = new Map<string, { name: string; phone: string }>();

    sales.forEach(s => {
      if (s.name && s.phone && !contactMap.has(s.phone)) {
        contactMap.set(s.phone, { name: s.name, phone: s.phone });
      }
    });
    orders.forEach(o => {
      if (o.name && o.phone && !contactMap.has(o.phone)) {
        contactMap.set(o.phone, { name: o.name, phone: o.phone });
      }
    });
    karigars.forEach(k => {
      if (k.name && k.phone && !contactMap.has(k.phone)) {
        contactMap.set(k.phone, { name: k.name, phone: k.phone });
      }
    });
    purchases.forEach(p => {
      if (p.name && p.phone && !contactMap.has(p.phone)) {
        contactMap.set(p.phone, { name: p.name, phone: p.phone });
      }
    });

    return Array.from(contactMap.values());
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredContacts = contacts?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-sky-950 text-white">
          <h3 className="text-lg font-bold urdu-text flex items-center gap-2">
            <UserCheck size={20} className="text-gold" />
            {lang === 'ur' ? 'رابطہ منتخب کریں' : 'Select Contact'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b bg-sky-50">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={lang === 'ur' ? 'نام یا فون سے تلاش کریں...' : 'Search by name or phone...'}
              className="w-full p-3 pr-10 bg-white border border-sky-200 rounded-xl outline-none focus:border-gold text-sm text-black"
              dir={lang === 'ur' ? 'rtl' : 'ltr'}
            />
            <Search size={18} className={`absolute ${lang === 'ur' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-zinc-400`} />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-4 space-y-2 divide-y divide-zinc-100">
          {filteredContacts.map((contact, idx) => (
            <div
              key={idx}
              onClick={() => {
                onSelect(contact);
                onClose();
              }}
              className="p-3 hover:bg-sky-50 rounded-xl cursor-pointer transition-colors flex justify-between items-center pt-3"
            >
              <div>
                <p className="font-bold text-sky-950 text-sm urdu-text">{contact.name}</p>
                <p className="text-xs font-mono text-zinc-500" dir="ltr">{contact.phone}</p>
              </div>
              <span className="text-xs font-bold text-gold-dark bg-gold/10 px-3 py-1 rounded-full urdu-text">
                {lang === 'ur' ? 'منتخب کریں' : 'Select'}
              </span>
            </div>
          ))}

          {filteredContacts.length === 0 && (
            <div className="py-8 text-center text-zinc-400 text-xs urdu-text font-medium">
              {lang === 'ur' ? 'کوئی محفوظ رابطہ نہیں ملا۔' : 'No saved contacts found.'}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-zinc-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-200 text-zinc-700 font-bold rounded-xl hover:bg-zinc-300 transition-colors text-sm urdu-text"
          >
            {lang === 'ur' ? 'بند کریں' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
