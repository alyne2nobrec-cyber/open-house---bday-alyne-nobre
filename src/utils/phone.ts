/**
 * Validates whether a phone number is a valid Brazilian or international WhatsApp phone.
 * Rejects empty, placeholders like '00000000', or invalid lengths.
 */
export function isValidWhatsappNumber(phone?: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return false;

  // Reject all identical repeating digits like '00000000', '00000000000', '11111111111'
  if (/^(\d)\1+$/.test(digits)) return false;

  // Brazilian numbers: 10 digits (DDD + 8 digits) or 11 digits (DDD + 9 digits)
  // If prefixed with 55: 12 or 13 digits
  if (digits.startsWith('55')) {
    return digits.length >= 12 && digits.length <= 13;
  }

  // Without 55 prefix: 10 or 11 digits
  return digits.length === 10 || digits.length === 11;
}

/**
 * Sanitizes and normalizes phone numbers for wa.me WhatsApp links.
 * Returns empty string if number is invalid or placeholder.
 */
export function formatWhatsappUrl(phone: string, text?: string): string {
  if (!isValidWhatsappNumber(phone)) return '';
  const digits = phone.replace(/\D/g, '');

  let clean = digits;
  // If user entered 10 or 11 digits (Brazilian DDD + number without country code 55), prepend 55
  if (!clean.startsWith('55') && (clean.length === 10 || clean.length === 11)) {
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
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
}
