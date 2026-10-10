/**
 * Validates whether a phone number is a valid Brazilian or international WhatsApp phone.
 * Rejects empty, placeholders like '00000000', or invalid lengths.
 */
export function isValidWhatsappNumber(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  if (phone.trim().startsWith('+')) {
    const intlDigits = digits;
    return intlDigits.length >= 8 && intlDigits.length <= 15 && !/^0+$/.test(intlDigits);
  }

  if (digits.startsWith('55')) {
    const noCountry = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    return noCountry.length === 10 || noCountry.length === 11;
  }

  return digits.length === 10 || digits.length === 11;
}

/**
 * Sanitizes and normalizes phone numbers for wa.me WhatsApp links.
 * Returns empty string if number is invalid or placeholder.
 */
export function formatWhatsappUrl(phone: string, text?: string): string {
  if (!isValidWhatsappNumber(phone)) return '';
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  let clean = digits;
  if (raw.startsWith('+')) {
    clean = `+${digits}`;
  } else if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
    clean = `55${clean}`;
  }

  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${clean}${encodedText}`;
}

/**
 * Formats a phone number for display (e.g. (11) 98765-4321)
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits || /^0+$/.test(digits)) return '';
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }
  return phone;
}

export function normalizePhoneId(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits === '00000000' || /^\d$/.test(digits) || digits === '0000000000' || /^0+$/.test(digits)) {
    return null;
  }

  const normalized = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  const last11 = normalized.length > 11 ? normalized.slice(-11) : normalized;
  if (!last11 || /^\d$/.test(last11) || /^0+$/.test(last11)) {
    return null;
  }

  return last11;
}
