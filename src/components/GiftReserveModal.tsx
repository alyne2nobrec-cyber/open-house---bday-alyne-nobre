import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { X, Copy, Check, Heart, ExternalLink, QrCode as PixIcon, AlertCircle, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import { Gift, EventSettings } from '../types';
import { DEFAULT_SETTINGS } from '../data/defaultData';
import { reserveGiftWithTransaction } from '../services/giftService';
import { buildPixPayload } from '../utils/pix';
import { getMemeKind, normalizeMemeUrl } from '../utils/memeMedia';

interface GiftReserveModalProps {
  gift: Gift | null;
  settings?: EventSettings;
  onClose: () => void;
  onSuccess: () => void;
}

export const GiftReserveModal: React.FC<GiftReserveModalProps> = ({
  gift,
  settings,
  onClose,
  onSuccess,
}) => {
  const [guestName, setGuestName] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReservedSuccess, setIsReservedSuccess] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [copiaEColaCopied, setCopiaEColaCopied] = useState(false);
  const [shippingCopied, setShippingCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const giftPixKey = (gift?.pixKey || '').trim();
  const activePixKey = giftPixKey && giftPixKey !== DEFAULT_SETTINGS.pixKey
    ? giftPixKey
    : settings?.pixKey || DEFAULT_SETTINGS.pixKey;
  const activePixKeyType = settings?.pixKeyType || 'E-mail';
  const activeReceiverName = settings?.pixReceiverName || 'Alyne Nobre';
  const activeBankName = settings?.pixBankName || '';
  const activeBankLink = (settings?.pixBankLink || '').trim() || (gift?.pixBankLink || '').trim();
  const activeCopiaECola = (settings?.pixCopiaECola || '').trim() || (gift?.pixCopiaECola || '').trim();
  const activeOfficialQrImage = (settings?.pixQrCodeUrl || '').trim() || (gift?.pixQrCodeUrl || '').trim();

  useEffect(() => {
    if (!gift) return;

    // Priority 1: Host uploaded official QR Code image from bank
    if (activeOfficialQrImage) {
      setQrCodeDataUrl(activeOfficialQrImage);
      return;
    }

    // Priority 2: Host provided official Pix Copia e Cola from bank
    if (activeCopiaECola) {
      QRCode.toDataURL(activeCopiaECola, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        type: 'image/png',
      })
        .then((dataUrl) => setQrCodeDataUrl(dataUrl))
        .catch(() => setQrCodeDataUrl(''));
      return;
    }

    // Priority 3: Fallback synthetic QR code
    if (activePixKey) {
      const payload = buildPixPayload({
        pixKey: activePixKey,
        amount: gift.price * quantity,
        description: `${gift.name}`.slice(0, 40),
        merchantName: activeReceiverName || 'Alyne Nobre',
        merchantCity: 'SAO PAULO',
        txId: `OPENHOUSE-${gift.id}`.slice(0, 25),
      });

      QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
        type: 'image/png',
      })
        .then((dataUrl) => setQrCodeDataUrl(dataUrl))
        .catch(() => setQrCodeDataUrl(''));
    }
  }, [activeOfficialQrImage, activeCopiaECola, activePixKey, gift?.price, gift?.id, gift?.name, quantity, activeReceiverName, gift]);

  if (!gift) return null;

  const isSoldOut = gift.availableQuantity <= 0;
  const maxAvailable = Math.max(1, gift.availableQuantity);

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(activePixKey);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 3000);
    } catch {
      setError('Não foi possível copiar a chave Pix.');
    }
  };

  const handleCopyCopiaECola = async () => {
    try {
      await navigator.clipboard.writeText(activeCopiaECola);
      setCopiaEColaCopied(true);
      window.setTimeout(() => setCopiaEColaCopied(false), 3000);
    } catch {
      setError('Não foi possível copiar o código Pix Copia e Cola.');
    }
  };

  const handleCopyShippingAddress = async () => {
    if (!settings) return;
    try {
      const lines = [
        settings.shippingRecipientName ? `Destinatário: ${settings.shippingRecipientName}` : '',
        `Endereço: ${settings.shippingStreet}${settings.shippingComplement ? `, ${settings.shippingComplement}` : ''}`,
        settings.shippingNeighborhood ? `Bairro: ${settings.shippingNeighborhood}` : '',
        settings.shippingCity ? `Cidade: ${settings.shippingCity}` : '',
        settings.shippingZip ? `CEP: ${settings.shippingZip}` : '',
        settings.shippingPhone ? `Telefone para contato: ${settings.shippingPhone}` : '',
        settings.shippingNotes ? `Observações de entrega: ${settings.shippingNotes}` : '',
      ].filter(Boolean).join('\n');

      await navigator.clipboard.writeText(lines);
      setShippingCopied(true);
      window.setTimeout(() => setShippingCopied(false), 3000);
    } catch {
      setError('Não foi possível copiar o endereço.');
    }
  };

  const handleConfirmReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!guestName.trim()) {
      setError('Por favor, informe seu nome.');
      return;
    }
    if (!guestWhatsapp.trim()) {
      setError('Por favor, informe seu WhatsApp.');
      return;
    }
    if (quantity < 1 || quantity > maxAvailable) {
      setError(`Escolha entre 1 e ${maxAvailable} cota${maxAvailable > 1 ? 's' : ''}.`);
      return;
    }
    if (quantity > gift.availableQuantity) {
      setError(`Restam apenas ${gift.availableQuantity} cotas disponíveis.`);
      return;
    }

    setLoading(true);
    try {
      await reserveGiftWithTransaction({
        giftId: gift.id,
        giftName: gift.name,
        guestName: guestName.trim(),
        guestWhatsapp: guestWhatsapp.trim(),
        quantity,
        message: message.trim(),
      });

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#CF3B25', '#F2B84B', '#8A9A86', '#1B2F4E'],
      });

      setIsReservedSuccess(true);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível reservar este presente.');
    } finally {
      setLoading(false);
    }
  };

  const qrCodeUrl = qrCodeDataUrl || (gift.pixQrCodeUrl ? gift.pixQrCodeUrl : '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#FBF4E8] border border-[#E8D4B8] rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-[#F6EBD9] text-[#4B5A72] hover:text-[#1B2F4E] hover:bg-[#E8D4B8] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isReservedSuccess ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#FDE9E3] text-[#CF3B25] flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 fill-[#CF3B25]" />
            </div>

            <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#1B2F4E] mb-2">
              Aeeee! Obrigada ❤️
            </h3>
            <p className="text-base text-[#4B5A72] leading-relaxed mb-6">
              Seu carinho com o presente <strong>“{gift.name}”</strong> foi registrado com sucesso! A Alyne já vai ficar sabendo.
            </p>

            {(gift.type === 'pix' || gift.type === 'shares' || gift.pixKey) && (
              <div className="bg-[#FFFFFF] border border-[#E8D4B8] rounded-2xl p-5 mb-6 text-left space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A82D1B]">
                    Próximo passo: Pagamento via Pix
                  </div>
                  {activeBankName && (
                    <span className="text-[11px] font-semibold text-[#4B5A72] bg-[#FBF4E8] border border-[#E8D4B8] px-2 py-0.5 rounded-md">
                      {activeBankName}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#4B5A72] leading-relaxed">
                  Para concluir sua contribuição de{' '}
                  <strong className="text-[#1B2F4E]">R$ {(gift.price * quantity).toLocaleString('pt-BR')}</strong>,
                  escolha a opção mais conveniente no seu banco:
                </p>

                {/* Option 1: Direct Bank Payment Link (if available) */}
                {activeBankLink && (
                  <div>
                    <a
                      href={activeBankLink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="w-full h-11 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir Link Direto do Banco ({activeBankName || 'Pagar'}) ↗</span>
                    </a>
                  </div>
                )}

                {/* Option 2: Pix Copia e Cola (if available) */}
                {activeCopiaECola && (
                  <div>
                    <button
                      type="button"
                      onClick={handleCopyCopiaECola}
                      className="w-full h-11 px-4 rounded-xl bg-[#1B2F4E] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                    >
                      {copiaEColaCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Código Pix Copia e Cola Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Código Pix Copia e Cola Oficial</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Option 3: Chave Pix (E-mail, CPF, Celular, etc.) */}
                <div>
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#5B6B82] mb-1">
                    Chave Pix ({activePixKeyType}):
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FBF4E8] border border-[#F7E6D0] text-xs font-mono text-[#1B2F4E] gap-2">
                    <span className="truncate select-all">{activePixKey}</span>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="ml-2 px-3 py-1.5 rounded-lg bg-[#CF3B25] hover:bg-[#A82D1B] text-white text-xs font-sans font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      {pixCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Chave</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Account Holder Verification */}
                <div className="p-3 rounded-xl bg-[#F6EBD9] text-xs text-[#3E5070] flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Favorecida: <strong>{activeReceiverName}</strong>
                    {activeBankName ? ` • Banco: ${activeBankName}` : ''}
                  </span>
                </div>

                {/* QR Code Section */}
                <div className="text-center pt-2">
                  <div className="inline-block p-3 bg-white rounded-2xl border border-[#E8D4B8] shadow-xs">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="QR Code Pix"
                        className="w-44 h-44 object-contain mx-auto rounded-lg"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-[#A82D1B]">
                        <PixIcon className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[#5B6B82] mt-2 font-medium">
                    {activeOfficialQrImage ? 'QR Code Oficial do Banco' : 'Escaneie o QR Code no aplicativo do seu banco'}
                  </p>
                </div>
              </div>
            )}

            {gift.purchaseUrl && (
              <div className="bg-[#FFFFFF] border border-[#E8D4B8] rounded-2xl p-4 mb-4 text-left">
                <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A82D1B] mb-1">
                  Comprar na loja
                </div>
                <p className="text-xs text-[#4B5A72] mb-3">
                  Você pode adquirir diretamente no link da loja indicada:
                </p>
                <a
                  href={gift.purchaseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full h-11 rounded-xl bg-[#1B2F4E] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Acessar Link do Produto na Loja</span>
                </a>
              </div>
            )}

            {gift.purchaseUrl && settings?.shippingStreet?.trim() && (
              <div className="bg-[#FFFFFF] border-2 border-[#CF3B25]/30 rounded-2xl p-5 mb-6 text-left shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FDE9E3] flex items-center justify-center text-[#CF3B25] shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#A82D1B]">
                      Aviso: Para onde enviar o presente
                    </div>
                    <p className="text-[11px] text-[#4B5A72]">
                      Ao comprar online, solicite a entrega diretamente neste endereço:
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FBF4E8] border border-[#F7E6D0] text-xs text-[#1B2F4E] space-y-1.5 mt-3">
                  {settings.shippingRecipientName && (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[#5B6B82] font-medium shrink-0">Destinatário:</span>
                      <strong className="text-[#1B2F4E] font-semibold">{settings.shippingRecipientName}</strong>
                    </div>
                  )}
                  <div className="flex items-start gap-1.5">
                    <span className="text-[#5B6B82] font-medium shrink-0">Endereço:</span>
                    <span className="font-semibold text-[#1B2F4E]">
                      {settings.shippingStreet}
                      {settings.shippingComplement ? `, ${settings.shippingComplement}` : ''}
                    </span>
                  </div>
                  {(settings.shippingNeighborhood || settings.shippingCity) && (
                    <div className="text-[#3E5070]">
                      {settings.shippingNeighborhood ? `${settings.shippingNeighborhood} — ` : ''}
                      {settings.shippingCity || ''}
                    </div>
                  )}
                  {settings.shippingZip && (
                    <div>
                      <span className="text-[#5B6B82] font-medium">CEP:</span>{' '}
                      <strong className="font-mono text-[#1B2F4E]">{settings.shippingZip}</strong>
                    </div>
                  )}
                  {settings.shippingPhone && (
                    <div>
                      <span className="text-[#5B6B82] font-medium">Contato entrega:</span>{' '}
                      <span className="font-medium text-[#1B2F4E]">{settings.shippingPhone}</span>
                    </div>
                  )}
                  {settings.shippingNotes && (
                    <div className="pt-1 text-[11px] text-[#5B6B82] italic border-t border-[#F7E6D0] mt-1.5">
                      <strong>Instruções de entrega:</strong> {settings.shippingNotes}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCopyShippingAddress}
                  className="w-full mt-3 h-11 px-4 rounded-xl bg-[#FBF4E8] hover:bg-[#F7E6D0] border border-[#E8D4B8] text-[#1B2F4E] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.99]"
                >
                  {shippingCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Endereço Completo Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#A82D1B]" />
                      <span>Copiar Endereço Completo de Entrega</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-full bg-[#CF3B25] hover:bg-[#A82D1B] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            >
              Fechar e Voltar à Lista
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-4 items-start mb-6">
              {(() => {
                const rawMeme = (gift.memeUrl || (gift as { gifUrl?: string; gif?: string }).gifUrl || (gift as { gifUrl?: string; gif?: string }).gif || '').trim();
                const hasMeme = Boolean(rawMeme && getMemeKind(rawMeme) !== 'invalid');
                const memeKind = hasMeme ? getMemeKind(rawMeme) : null;
                const normalizedMeme = hasMeme ? normalizeMemeUrl(rawMeme) : '';

                if (hasMeme) {
                  return memeKind === 'video' ? (
                    <video
                      src={normalizedMeme}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-20 h-20 rounded-2xl object-cover border border-[#E8D4B8] shrink-0"
                    />
                  ) : (
                    <img
                      src={normalizedMeme}
                      alt={gift.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-2xl object-cover border border-[#E8D4B8] shrink-0"
                      onError={(e) => {
                        if (gift.imageUrl && (e.currentTarget as HTMLImageElement).src !== gift.imageUrl) {
                          (e.currentTarget as HTMLImageElement).src = gift.imageUrl;
                        }
                      }}
                    />
                  );
                }

                if (gift.imageUrl) {
                  return (
                    <img
                      src={gift.imageUrl}
                      alt={gift.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-2xl object-cover border border-[#E8D4B8] shrink-0"
                    />
                  );
                }

                return (
                  <div className="w-20 h-20 rounded-2xl bg-[#F7E6D0] flex items-center justify-center shrink-0 text-[#CF3B25]">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-[#1B2F4E] leading-tight">
                  {gift.name}
                </h3>
                <p className="text-xs text-[#4B5A72] mt-1 line-clamp-2">
                  {gift.description}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="font-semibold text-[#CF3B25] text-sm tabular-nums">
                    R$ {gift.price.toLocaleString('pt-BR')}
                    {gift.totalQuantity > 1 ? ' / cota' : ''}
                  </span>
                  <span className="text-[#6F7F97]">·</span>
                  <span className="text-[#4B5A72] tabular-nums">
                    {gift.availableQuantity} de {gift.totalQuantity} disponíveis
                  </span>
                </div>

                {(() => {
                  const rawMeme = (gift.memeUrl || (gift as { gifUrl?: string; gif?: string }).gifUrl || (gift as { gifUrl?: string; gif?: string }).gif || '').trim();
                  if (!rawMeme || getMemeKind(rawMeme) === 'invalid') return null;
                  const isVideo = getMemeKind(rawMeme) === 'video';
                  return (
                    <div className="mt-3">
                      <div className="inline-block rounded-xl overflow-hidden border border-[#E8D4B8] bg-black/5 max-h-36 max-w-[200px]">
                        {isVideo ? (
                          <video
                            src={normalizeMemeUrl(rawMeme)}
                            autoPlay
                            loop
                            muted
                            playsInline
                            controls={false}
                            className="w-full h-auto max-h-36 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <img
                            src={normalizeMemeUrl(rawMeme)}
                            alt="Meme do presente"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-auto max-h-36 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {isSoldOut ? (
              <div className="text-center py-6">
                <div className="p-4 rounded-2xl bg-[#FDE9E3] border border-[#E8D4B8] text-[#A82D1B] font-medium text-sm mb-4">
                  🎉 Esse presente já está garantido! Todas as cotas foram reservadas por amigos incríveis.
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-[#E8D4B8] text-xs font-semibold text-[#4B5A72] hover:text-[#1B2F4E]"
                >
                  Escolher outro presente
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmReservation} className="space-y-4">
                {gift.totalQuantity > 1 && (
                  <div>
                    <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-2">
                      Quantas cotas você gostaria de presentear?
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-[#E8D4B8] rounded-xl bg-white overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="h-11 w-11 flex items-center justify-center text-lg font-bold text-[#4B5A72] hover:bg-[#FBF4E8] transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-12 text-center text-sm font-semibold text-[#1B2F4E] tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.min(maxAvailable, quantity + 1))}
                          className="h-11 w-11 flex items-center justify-center text-lg font-bold text-[#4B5A72] hover:bg-[#FBF4E8] transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-[#4B5A72]">
                        Total:{' '}
                        <strong className="text-[#1B2F4E] font-semibold tabular-nums">
                          R$ {(gift.price * quantity).toLocaleString('pt-BR')}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="reserve-name" className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-1.5">
                    Seu Nome *
                  </label>
                  <input
                    id="reserve-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Como você quer aparecer na lista da Alyne?"
                    className="w-full h-11 px-4 rounded-xl border border-[#E8D4B8] bg-white focus:border-[#CF3B25] focus:ring-2 focus:ring-[#CF3B25]/15 outline-none transition-all text-sm text-[#1B2F4E]"
                  />
                </div>

                <div>
                  <label htmlFor="reserve-whatsapp" className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-1.5">
                    Seu WhatsApp *
                  </label>
                  <input
                    id="reserve-whatsapp"
                    type="tel"
                    required
                    value={guestWhatsapp}
                    onChange={(e) => setGuestWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full h-11 px-4 rounded-xl border border-[#E8D4B8] bg-white focus:border-[#CF3B25] focus:ring-2 focus:ring-[#CF3B25]/15 outline-none transition-all text-sm text-[#1B2F4E]"
                  />
                </div>

                <div>
                  <label htmlFor="reserve-message" className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-1.5">
                    Recadinho carinhoso (opcional)
                  </label>
                  <textarea
                    id="reserve-message"
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escreva o que quiser — vou adorar ler!"
                    className="w-full p-3 rounded-xl border border-[#E8D4B8] bg-white focus:border-[#CF3B25] focus:ring-2 focus:ring-[#CF3B25]/15 outline-none transition-all text-sm text-[#1B2F4E] resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-full bg-[#CF3B25] hover:bg-[#A82D1B] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {loading ? (
                      <span>Garantindo reserva...</span>
                    ) : (
                      <>
                        <Heart className="w-4 h-4 fill-white" />
                        <span>Confirmar Reserva do Presente</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-[#5B6B82] text-center mt-2.5">
                    Não cobramos nada no site! A reserva só ajuda a organizar a lista. O pagamento é feito diretamente pelo seu banco para o da Alyne, se você escolher uma opção via Pix.
                  </p>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
