/**
 * Sanitizes and normalizes phone numbers for wa.me WhatsApp links
 */
export function formatWhatsappUrl(phone: string, text?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

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
