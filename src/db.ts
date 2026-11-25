import Dexie, { type Table } from 'dexie';

export interface SalesItem {
  n: string; // Item name
  w: number; // Weight
  p: number; // Pieces/Count
  mk: number; // Polish (per gram)
  r: number; // Rate
  t: number; // Total for item
  mz?: number; // Mazdori/Labor
  img?: string | null;
  imgs?: string[];
}

export interface Sale {
  id?: number;
  name: string;
  phone: string;
  items: SalesItem[];
  total: number;
  rec: number;
  discount?: number;
  paidToCustomer?: number;
  rem: number;
  date: string;
}

export interface OrderPayment {
  amt: number;
  date: string;
  type?: 'cash' | 'gold';
  goldWeight?: number;
  goldRatePerTola?: number;
  goldRatePerGram?: number;
  tolaDivisor?: number;
}

export interface Order {
  id?: number;
  name: string;
  phone: string;
  date: string;
  due: string;
  item: string;
  karigar: string;
  oldWt: string;
  readyWt: string;
  total: number;
  payments: OrderPayment[];
  rem: number;
  status: string;
  measurements?: string;
  pricePerTola?: string;
  img?: string | null;
  imgs?: string[];
  makingCharges?: string;
  weightPolish?: string;
  totalWt?: string;
  izafiWt?: string;
  goldAmount?: number;
  mazdori?: number;
  oldGoldMinus?: number;
  discount?: number;
}

export interface KarigarRecord {
  id?: number;
  name: string;
  phone: string;
  task: string;
  given: number;
  rec: number;
  kaat: number;
  net: number;
  img?: string | null;
  imgs?: string[];
  date: string;
}

export interface Repair {
  id?: number;
  customerName: string;
  customerPhone: string;
  item: string;
  issue: string;
  charges: number;
  status: 'Pending' | 'Done';
  date: Date;
  img?: string | null;
  imgs?: string[];
}

export interface StockItem {
  id?: number;
  name: string;
  type: 'Gold' | 'Item';
  quantity: number; // grams for gold, count for items
  unit: string;
  pieces?: number;
  img?: string | null;
  imgs?: string[];
}

export interface GoldPurchase {
  id?: number;
  name: string;
  phone: string;
  weight: number;
  rate: number;
  total: number;
  date: string;
  img?: string | null;
  imgs?: string[];
}

export interface Expense {
  id?: number;
  category: string;
  description: string;
  amount: number;
  date: string;
}

export interface KhaataAccount {
  id?: number;
  name: string;
  phone: string;
  notes?: string;
  date?: string;
  createdAt?: string;
  _syncId?: string;
  _updatedAt?: number;
  _deletedAt?: number | null;
}

export interface KhaataEntry {
  id?: number;
  accountId: number;
  type?: 'give' | 'receive' | string;
  details?: string;
  itemDetail?: string;
  mixWeight?: number;
  mixWazan?: number;
  pakaye?: number;
  kaatRati?: number;
  kaatInRati?: number;
  pureWeight?: number;
  itemPasa?: number;
  pasaDia?: number;
  totalBaqaya?: number;
  date: string;
  img?: string | null;
  _syncId?: string;
  _updatedAt?: number;
  _deletedAt?: number | null;
}

export type Khaata = KhaataEntry;

export interface Setting {
  id?: string;
  key: string;
  value: any;
}

export interface ContactItem {
  id?: number;
  name: string;
  phone: string;
}

export class MyDatabase extends Dexie {
  sales!: Table<Sale>;
  orders!: Table<Order>;
  karigars!: Table<KarigarRecord>;
  repairs!: Table<Repair>;
  stock!: Table<StockItem>;
  settings!: Table<Setting>;
  goldPurchases!: Table<GoldPurchase>;
  expenses!: Table<Expense>;
  khaataAccounts!: Table<KhaataAccount>;
  khaata!: Table<KhaataEntry>;
  contacts!: Table<ContactItem>;

  get khaataEntries(): Table<KhaataEntry> {
    return this.khaata;
  }

  constructor() {
    super('NafeesERP_V58_Final');
    this.version(9).stores({
      sales: '++id, name, phone, date',
      orders: '++id, name, phone, status, due, karigar',
      karigars: '++id, name, phone, date',
      repairs: '++id, customerName, status, date',
      stock: '++id, name, type, [name+type]',
      settings: 'key',
      goldPurchases: '++id, name, phone, date',
      expenses: '++id, category, date',
      khaataAccounts: '++id, name',
      khaata: '++id, accountId, date',
      contacts: '++id, name, phone'
    });
  }
}

const db = new MyDatabase();

// Safety: Ensure tables are accessible even if shortcut properties are delayed
export function sanitizeShopAddress(addr: string): string {
  if (!addr) return addr;
  return addr
    .replace(/عبداللہ/g, 'عبدل اے')
    .replace(/abdullah/gi, 'Abdul A');
}

export { db };

db.on('ready', async () => {
  console.log('Database is ready');
  try {
    const savedAddress = await db.settings.get('shopAddress');
    if (savedAddress && typeof savedAddress.value === 'string') {
      const sanitized = sanitizeShopAddress(savedAddress.value);
      if (sanitized !== savedAddress.value) {
        await db.settings.put({ key: 'shopAddress', value: sanitized });
      }
    }
  } catch (err) {
    console.error('Failed to migrate shopAddress:', err);
  }
});

db.open().catch((err) => {
  console.error('Failed to open db:', err);
});
