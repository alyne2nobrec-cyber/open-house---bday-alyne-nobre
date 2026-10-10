export interface PixPayloadOptions {
  pixKey: string;
  amount?: number;
  description?: string;
  merchantName?: string;
  merchantCity?: string;
  txId?: string;
}

function createField(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

/**
 * Standard CRC16-CCITT for Pix / EMV BR Code:
 * - Polynomial: 0x1021
 * - Initial value: 0xFFFF
 * - No final XOR
 */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates an official, bank-compliant EMV BR Code (Pix Copia e Cola / QR Code payload)
 * following the Central Bank of Brazil (BACEN) standard.
 */
export function buildPixPayload({
  pixKey,
  amount,
  description = 'Presente',
  merchantName = 'Alyne Nobre',
  merchantCity = 'SAO PAULO',
  txId = '***',
}: PixPayloadOptions): string {
  const sanitizedPixKey = (pixKey || '').trim();
  if (!sanitizedPixKey) return '';

  const cleanName = (merchantName || 'Alyne Nobre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, 25) || 'ALYNE NOBRE';

  const cleanCity = (merchantCity || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .slice(0, 15) || 'SAO PAULO';

  // Subfield 00: GUI 'br.gov.bcb.pix' (tag 00 + length 14 + value)
  const subfieldGui = createField('00', 'br.gov.bcb.pix');
  // Subfield 01: Chave Pix (tag 01 + length + value)
  const subfieldKey = createField('01', sanitizedPixKey);
  // Optional Subfield 02: Descrição adicional
  const cleanDesc = description
    ? description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().slice(0, 25)
    : '';
  const subfieldDesc = cleanDesc ? createField('02', cleanDesc) : '';

  // Field 26: Informações da Conta do Recebedor (subcampos 00, 01 e opcionalmente 02)
  const merchantAccountInfo = createField('26', `${subfieldGui}${subfieldKey}${subfieldDesc}`);

  const amountString =
    typeof amount === 'number' && Number.isFinite(amount) && amount > 0
      ? amount.toFixed(2)
      : '';

  const cleanTxId = (txId || '***')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25) || '***';
  const subfieldTxId = createField('05', cleanTxId);
  const additionalDataField = createField('62', subfieldTxId);

  const payloadFields = [
    createField('00', '01'),                       // Payload Format Indicator
    merchantAccountInfo,                           // Merchant Account Information
    createField('52', '0000'),                     // Merchant Category Code
    createField('53', '986'),                      // Transaction Currency: 986 = BRL
    ...(amountString ? [createField('54', amountString)] : []), // Transaction Amount
    createField('58', 'BR'),                       // Country Code
    createField('59', cleanName),                  // Merchant Name
    createField('60', cleanCity),                  // Merchant City
    additionalDataField,                           // Additional Data Field (txId)
  ];

  const rawPayload = `${payloadFields.join('')}6304`;
  const crc = crc16ccitt(rawPayload);
  return `${rawPayload}${crc}`;
}
