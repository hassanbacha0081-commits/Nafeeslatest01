// Offline-first + live online English / Roman-Urdu to Urdu translator for jewelry & shop items

const URDU_SCRIPT_REGEX = /[\u0600-\u06FF]/;

export function hasUrduScript(text: string): boolean {
  return URDU_SCRIPT_REGEX.test(text);
}

// Comprehensive Sarafa / Jewelry & general item dictionary (English & Roman Urdu -> Urdu)
const JEWELRY_DICTIONARY: Record<string, string> = {
  // Core jewelry items
  ring: 'انگوٹھی',
  rings: 'انگوٹھیاں',
  angoothi: 'انگوٹھی',
  anguthi: 'انگوٹھی',
  challa: 'چھلا',
  band: 'بینڈ',
  'wedding band': 'شادی کا بینڈ',
  'couple ring': 'کپل انگوٹھی',
  'engagement ring': 'منگنی کی انگوٹھی',
  bangle: 'چوڑی',
  bangles: 'چوڑیاں',
  choori: 'چوڑی',
  chooriyan: 'چوڑیاں',
  chori: 'چوڑی',
  kara: 'کڑا',
  kangan: 'کنگن',
  bracelet: 'بریسلٹ',
  bracelets: 'بریسلٹ',
  necklace: 'نیکلس',
  'necklace set': 'نیکلس سیٹ',
  haar: 'ہار',
  'haar set': 'ہار سیٹ',
  'rani haar': 'رانی ہار',
  ranihaar: 'رانی ہار',
  choker: 'چوکر',
  'choker set': 'چوکر سیٹ',
  guluband: 'گلو بند',
  mala: 'مالا',
  'mala set': 'مالا سیٹ',
  pendant: 'لاکٹ / پینڈنٹ',
  locket: 'لاکٹ',
  'locket set': 'لاکٹ سیٹ',
  chain: 'چین',
  earring: 'کانٹا / بالی',
  earrings: 'کانٹے / بالیاں',
  bali: 'بالی',
  baliyan: 'بالیاں',
  kanta: 'کانٹا',
  kantay: 'کانٹے',
  tops: 'ٹاپس',
  stud: 'ٹاپس',
  studs: 'ٹاپس',
  jhumka: 'جھمکا',
  jhumkay: 'جھمکے',
  jhumki: 'جھمکی',
  anklet: 'پازیب',
  anklets: 'پازیب',
  payal: 'پازیب / پائل',
  pazaib: 'پازیب',
  pazeb: 'پازیب',
  'toe ring': 'بچھیا',
  bichiya: 'بچھیا',
  'nose pin': 'نتھ پن / لونگ',
  nosepin: 'نتھ پن',
  'nose ring': 'نتھ / نتھلی',
  nath: 'نتھ',
  nathli: 'نتھلی',
  natli: 'نتھلی',
  long: 'لونگ',
  laung: 'لونگ',
  koka: 'کوکا',
  tikka: 'ٹکا',
  'maang tikka': 'مانگ ٹکا',
  bindia: 'بندیا',
  jhumar: 'جھومر',
  jhumer: 'جھومر',
  passa: 'پاسا',
  'matha patti': 'ماتھا پٹی',
  armlet: 'بازو بند',
  bazuband: 'بازو بند',
  'bazu band': 'بازو بند',
  kamarband: 'کمر بند',
  waistband: 'کمر بند',
  brooch: 'بروچ',
  cufflink: 'کف لنک',
  cufflinks: 'کف لنکس',
  button: 'بٹن',
  buttons: 'بٹن',
  crown: 'تاج',
  tiara: 'تاج',
  hairpin: 'بالوں کی پن',
  'hair pin': 'بالوں کی پن',
  moran: 'مورن',
  watch: 'گھڑی',
  keychain: 'چابی کا چھلا',
  coin: 'سکہ',
  'gold coin': 'سونے کا سکہ',
  biscuit: 'بسکٹ',
  'gold bar': 'سونے کا بسکٹ',
  bar: 'بسکٹ',
  medal: 'تمغہ',
  taj: 'تاج',

  // Materials, stones & styles
  gold: 'سونا',
  'pure gold': 'خالص سونا',
  'white gold': 'وائٹ گولڈ',
  'rose gold': 'روز گولڈ',
  silver: 'چاندی',
  chandi: 'چاندی',
  platinum: 'پلاٹینم',
  diamond: 'ہیرا / ڈائمنڈ',
  diamonds: 'ہیرے',
  emerald: 'زمرد',
  ruby: 'یاقوت',
  sapphire: 'نیلم',
  pearl: 'موتی',
  pearls: 'موتی',
  moti: 'موتی',
  zircon: 'زرکون',
  stone: 'نگ',
  stones: 'نگ',
  nag: 'نگ',
  nug: 'نگ',
  kundan: 'کندن',
  polki: 'پولکی',
  meenakari: 'مینا کاری',
  meena: 'مینا',
  antique: 'اینٹیک',
  bridal: 'دلہن',
  dulhan: 'دلہن',
  wedding: 'شادی',
  fancy: 'فینسی',
  simple: 'سادہ',
  plain: 'سادہ',
  heavy: 'بھاری',
  light: 'ہلکا',
  baby: 'بچوں کا',
  kids: 'بچوں کا',
  child: 'بچوں کا',
  ladies: 'خواتین',
  women: 'خواتین',
  gents: 'مردانہ',
  men: 'مردانہ',
  mens: 'مردانہ',
  male: 'مردانہ',
  female: 'خواتین',
  pair: 'جوڑا',
  set: 'سیٹ',
  single: 'سنگل',
  double: 'ڈبل',
  triple: 'ٹرپل',
  full: 'مکمل',
  half: 'آدھا',
  small: 'چھوٹا',
  medium: 'درمیانہ',
  large: 'بڑا',
  big: 'بڑا',
  long_adj: 'لمبا',
  short: 'چھوٹا',
  new: 'نیا',
  old: 'پرانا',
  purana: 'پرانا',
  butterfly: 'تتلی',
  heart: 'دل',
  flower: 'پھول',
  star: 'ستارہ',
  moon: 'چاند',
  leaf: 'پتہ',
  name: 'نام والا',
  custom: 'کسٹم',
  polish: 'پالش',
  repair: 'مرمت',
  lock: 'لاک',
  clasp: 'کُنڈا',
  hook: 'ہُک',
  beads: 'دانے',
  bead: 'دانہ',
  casting: 'کاسٹنگ',
  handmade: 'ہاتھ کا کام',
  italian: 'اطالوی',
  dubai: 'دبئی',
  singapore: 'سنگاپور',
  turkish: 'ترکش',
  multani: 'ملتانی',
  collar: 'کالر',
  'collar set': 'کالر سیٹ',
  'dulhan set': 'دلہن سیٹ',
  'multani set': 'ملتانی سیٹ',
  'bridal set': 'دلہن سیٹ',
  'gold set': 'گولڈ سیٹ',
  'silver ring': 'چاندی کی انگوٹھی',
  'gold ring': 'سونے کی انگوٹھی',
  'diamond ring': 'ڈائمنڈ انگوٹھی',
  'gold chain': 'سونے کی چین',
  'gold bangle': 'سونے کی چوڑی',
  'gold bracelet': 'سونے کا بریسلٹ',
  'silver anklet': 'چاندی کی پازیب',
  'gold anklet': 'سونے کی پازیب'
};

// Simple phonetic English/Roman-to-Urdu fallback for completely offline unknown words
function transliterateToUrduOffline(input: string): string {
  const words = input.trim().split(/\s+/);
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (JEWELRY_DICTIONARY[lower]) return JEWELRY_DICTIONARY[lower];

      let w = lower;
      // Common multi-char phonetic rules
      const rules: [RegExp, string][] = [
        [/sh/g, 'ش'],
        [/ch/g, 'چ'],
        [/th/g, 'تھ'],
        [/kh/g, 'خ'],
        [/gh/g, 'غ'],
        [/ph/g, 'ف'],
        [/zh/g, 'ژ'],
        [/ng/g, 'نگ'],
        [/ee|ii/g, 'ی'],
        [/oo|uu/g, 'و'],
        [/aa/g, 'ا'],
        [/ai|ay/g, 'ے'],
        [/au|aw/g, 'او'],
        [/tion/g, 'شن'],
        [/a/g, 'ا'],
        [/b/g, 'ب'],
        [/c/g, 'ک'],
        [/d/g, 'ڈ'],
        [/e/g, 'ی'],
        [/f/g, 'ف'],
        [/g/g, 'گ'],
        [/h/g, 'ہ'],
        [/i/g, 'ی'],
        [/j/g, 'ج'],
        [/k/g, 'ک'],
        [/l/g, 'ل'],
        [/m/g, 'م'],
        [/n/g, 'ن'],
        [/o/g, 'و'],
        [/p/g, 'پ'],
        [/q/g, 'ق'],
        [/r/g, 'ر'],
        [/s/g, 'س'],
        [/t/g, 'ٹ'],
        [/u/g, 'و'],
        [/v/g, 'و'],
        [/w/g, 'و'],
        [/x/g, 'کس'],
        [/y/g, 'ی'],
        [/z/g, 'ز']
      ];
      for (const [pattern, replacement] of rules) {
        w = w.replace(pattern, replacement);
      }
      return w;
    })
    .join(' ');
}

export function translateInstantLocal(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (hasUrduScript(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (JEWELRY_DICTIONARY[lower]) {
    return JEWELRY_DICTIONARY[lower];
  }

  // Check if all space-separated tokens exist in the dictionary
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => Boolean(JEWELRY_DICTIONARY[w]))) {
    return words.map((w) => JEWELRY_DICTIONARY[w]).join(' ');
  }

  return null;
}

const translationCache = new Map<string, string>();

export async function translateToUrdu(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (hasUrduScript(trimmed)) return trimmed;

  const cacheKey = trimmed.toLowerCase();
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // 1. Instant local dictionary match
  const localMatch = translateInstantLocal(trimmed);
  if (localMatch) {
    translationCache.set(cacheKey, localMatch);
    return localMatch;
  }

  // 2. Online translation via Google Translate public endpoint (no API key, CORS-enabled)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ur&dt=t&q=${encodeURIComponent(trimmed)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const translated = Array.isArray(data?.[0])
        ? data[0].map((part: any) => part?.[0] || '').join('').trim()
        : '';
      if (translated && hasUrduScript(translated)) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // Fall through to secondary / offline fallback
  }

  // 3. Fallback online endpoint (MyMemory)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|ur`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const translated = data?.responseData?.translatedText?.trim();
      if (translated && hasUrduScript(translated)) {
        translationCache.set(cacheKey, translated);
        return translated;
      }
    }
  } catch {
    // Fall through to offline transliteration
  }

  // 4. Offline word-by-word dictionary + phonetic Urdu script fallback
  const offlineFallback = transliterateToUrduOffline(trimmed);
  translationCache.set(cacheKey, offlineFallback);
  return offlineFallback;
}
