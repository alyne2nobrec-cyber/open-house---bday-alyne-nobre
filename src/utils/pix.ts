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

function crc16ccitt(payload: string): string {
  let crc = 0xffff;

  for (const char of payload) {
    crc ^= char.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }

  return (crc ^ 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export function buildPixPayload({
  pixKey,
  amount,
  description = 'Presente para Alyne',
  merchantName = 'Alyne Nobre',
  merchantCity = 'SAO PAULO',
  txId = 'OPENHOUSE',
}: PixPayloadOptions): string {
  const sanitizedPixKey = pixKey.trim();
  const sanitizedMerchantName = merchantName.trim().slice(0, 25) || 'Alyne Nobre';
  const sanitizedCity = merchantCity.trim().slice(0, 15) || 'SAO PAULO';
  const sanitizedDescription = description.trim().slice(0, 40) || 'Presente';
  const amountString = typeof amount === 'number' && Number.isFinite(amount) && amount > 0
    ? amount.toFixed(2)
    : '';

  const pixKeyValue = sanitizedPixKey.length.toString().padStart(2, '0') + sanitizedPixKey;
  const merchantAccountInfoValue = `00br.gov.bcb.pix01${pixKeyValue}`;
  const merchantAccountInfo = createField('26', merchantAccountInfoValue);

  const txIdValue = txId.trim().slice(0, 25) || 'OPENHOUSE';
  const txField = createField('62', `05${txIdValue.length.toString().padStart(2, '0')}${txIdValue}`);

  const payloadFields = [
    createField('00', '01'),
    merchantAccountInfo,
    createField('52', '0000'),
    createField('53', '986'),
    ...(amountString ? [createField('54', amountString)] : []),
    createField('58', 'BR'),
    createField('59', sanitizedMerchantName),
    createField('60', sanitizedCity),
    createField('61', `01${sanitizedDescription.length.toString().padStart(2, '0')}${sanitizedDescription}`),
    txField,
  ];

  const payload = payloadFields.join('');
  const crc = crc16ccitt(payload);
  return `${payload}6304${crc}`;
}
