import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string, locale: string = 'en-GB') {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale).format(d);
  } catch (e) {
    return String(date);
  }
}

export async function compressImage(base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      console.error('Image compression failed');
      resolve(base64Str); // Fallback to original
    };
  });
}

export function formatWhatsAppUrl(phone: string, message: string) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned) return '';
  
  // Handle common Pakistan number formats
  if (cleaned.startsWith('0092')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  } else if (cleaned.length === 10 && (cleaned.startsWith('3'))) {
    // Likely a 10-digit number without country code (e.g. 315...)
    cleaned = '92' + cleaned;
  } else if (!cleaned.startsWith('92') && cleaned.length < 12 && cleaned.length > 0) {
    // Fallback: prepend 92 if not present and length is short
    cleaned = '92' + cleaned;
  }

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/**
 * Converts grams into traditional Pakistani Sarafa units: Tola, Masha, Ratti
 * 1 Tola = 11.664g
 * 1 Masha = 0.972g (1/12th of tola)
 * 1 Ratti = 0.1215g (1/8th of masha)
 */
export function gramsToTolaMashaRatti(grams: number, lang: 'ur' | 'en' = 'ur'): string {
  if (!grams || isNaN(grams) || grams <= 0) {
    return lang === 'ur' ? '0 گرام' : '0g';
  }
  const tolaFloat = grams / 11.664;
  const tola = Math.floor(tolaFloat);
  const remAfterTola = grams - (tola * 11.664);
  const mashaFloat = remAfterTola / 0.972;
  const masha = Math.floor(mashaFloat);
  const remAfterMasha = remAfterTola - (masha * 0.972);
  const rattiFloat = remAfterMasha / 0.1215;
  const ratti = Math.floor(rattiFloat);

  if (lang === 'ur') {
    const parts = [];
    if (tola > 0) parts.push(`${tola} تولہ`);
    if (masha > 0) parts.push(`${masha} ماشہ`);
    if (ratti > 0) parts.push(`${ratti} رتی`);
    return parts.length > 0 ? parts.join(' ') : `${grams.toFixed(3)} گرام`;
  } else {
    const parts = [];
    if (tola > 0) parts.push(`${tola}T`);
    if (masha > 0) parts.push(`${masha}M`);
    if (ratti > 0) parts.push(`${ratti}R`);
    return parts.length > 0 ? parts.join(' ') : `${grams.toFixed(3)}g`;
  }
}
