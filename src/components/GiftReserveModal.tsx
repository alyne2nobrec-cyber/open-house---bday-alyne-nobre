import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { X, Copy, Check, Heart, ExternalLink, QrCode as PixIcon, AlertCircle, ShoppingBag, ShieldCheck } from 'lucide-react';
import { Gift, EventSettings } from '../types';
import { reserveGiftWithTransaction } from '../services/giftService';
import { buildPixPayload } from '../utils/pix';

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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  if (!gift) return null;

  const isSoldOut = gift.availableQuantity <= 0;
  const maxAvailable = Math.max(1, gift.availableQuantity);

  const activePixKey = (gift.pixKey || '').trim() || settings?.pixKey || 'alyne2.nobre.c@gmail.com';
  const activePixKeyType = settings?.pixKeyType || 'E-mail';
  const activeReceiverName = settings?.pixReceiverName || 'Alyne Nobre';
  const activeBankName = settings?.pixBankName || '';
  const activeBankLink = (gift.pixBankLink || '').trim() || (settings?.pixBankLink || '').trim();
  const activeCopiaECola = (gift.pixCopiaECola || '').trim() || (settings?.pixCopiaECola || '').trim();
  const activeOfficialQrImage = (gift.pixQrCodeUrl || '').trim() || (settings?.pixQrCodeUrl || '').trim();

  useEffect(() => {
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
  }, [activeOfficialQrImage, activeCopiaECola, activePixKey, gift.price, gift.id, gift.name, quantity, activeReceiverName]);

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(activePixKey);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 3000);
    } catch {
      setError('Não foi possível copiar a chave Pix. Copie manualmente abaixo.');
    }
  };

  const handleCopyCopiaECola = async () => {
    if (!activeCopiaECola) return;
    try {
      await navigator.clipboard.writeText(activeCopiaECola);
      setCopiaEColaCopied(true);
      window.setTimeout(() => setCopiaEColaCopied(false), 3000);
    } catch {
      setError('Não foi possível copiar o código Pix Copia e Cola.');
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
        colors: ['#C86D51', '#E8D9CE', '#8A9A86', '#D4AF37'],
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
      <div className="relative w-full max-w-lg bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] hover:bg-[#EADBCE] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isReservedSuccess ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-[#FBF0EB] text-[#C86D51] flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 fill-[#C86D51]" />
            </div>

            <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#2D2A26] mb-2">
              Aeeee! Obrigada ❤️
            </h3>
            <p className="text-base text-[#68625B] leading-relaxed mb-6">
              Seu carinho com o presente <strong>“{gift.name}”</strong> foi registrado com sucesso! A Alyne já vai ficar sabendo.
            </p>

            {(gift.type === 'pix' || gift.type === 'shares' || gift.pixKey) && (
              <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-2xl p-5 mb-6 text-left space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#A95339]">
                    Próximo passo: Pagamento via Pix
                  </div>
                  {activeBankName && (
                    <span className="text-[11px] font-semibold text-[#68625B] bg-[#FAF8F5] border border-[#EADBCE] px-2 py-0.5 rounded-md">
                      {activeBankName}
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#68625B] leading-relaxed">
                  Para concluir sua contribuição de{' '}
                  <strong className="text-[#2D2A26]">R$ {(gift.price * quantity).toLocaleString('pt-BR')}</strong>,
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
                      className="w-full h-11 px-4 rounded-xl bg-[#2D2A26] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
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
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#7D756C] mb-1">
                    Chave Pix ({activePixKeyType}):
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#F0E6DE] text-xs font-mono text-[#2D2A26] gap-2">
                    <span className="truncate select-all">{activePixKey}</span>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="ml-2 px-3 py-1.5 rounded-lg bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-sans font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
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
                <div className="p-3 rounded-xl bg-[#F4EFEB] text-xs text-[#524B43] flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Favorecida: <strong>{activeReceiverName}</strong>
                    {activeBankName ? ` • Banco: ${activeBankName}` : ''}
                  </span>
                </div>

                {/* QR Code Section */}
                <div className="text-center pt-2">
                  <div className="inline-block p-3 bg-white rounded-2xl border border-[#EADBCE] shadow-xs">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="QR Code Pix"
                        className="w-44 h-44 object-contain mx-auto rounded-lg"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center text-[#A95339]">
                        <PixIcon className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[#7D756C] mt-2 font-medium">
                    {activeOfficialQrImage ? 'QR Code Oficial do Banco' : 'Escaneie o QR Code no aplicativo do seu banco'}
                  </p>
                </div>
              </div>
            )}

            {gift.purchaseUrl && (
              <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-2xl p-4 mb-6 text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#A95339] mb-1">
                  Comprar na loja
                </div>
                <p className="text-xs text-[#68625B] mb-3">
                  Você pode adquirir diretamente no link da loja indicada:
                </p>
                <a
                  href={gift.purchaseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="w-full h-11 rounded-xl bg-[#2D2A26] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Acessar Link do Produto na Loja</span>
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            >
              Fechar e Voltar à Lista
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-4 items-start mb-6">
              {gift.imageUrl ? (
                <img
                  src={gift.imageUrl}
                  alt={gift.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover border border-[#EADBCE] shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#F0E6DE] flex items-center justify-center shrink-0 text-[#C86D51]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
              )}
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-medium text-[#2D2A26] leading-tight">
                  {gift.name}
                </h3>
                <p className="text-xs text-[#68625B] mt-1 line-clamp-2">
                  {gift.description}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="font-semibold text-[#C86D51] text-sm tabular-nums">
                    R$ {gift.price.toLocaleString('pt-BR')}
                    {gift.totalQuantity > 1 ? ' / cota' : ''}
                  </span>
                  <span className="text-[#A59E95]">·</span>
                  <span className="text-[#68625B] tabular-nums">
                    {gift.availableQuantity} de {gift.totalQuantity} disponíveis
                  </span>
                </div>
              </div>
            </div>

            {isSoldOut ? (
              <div className="text-center py-6">
                <div className="p-4 rounded-2xl bg-[#FBF0EB] border border-[#EADBCE] text-[#A95339] font-medium text-sm mb-4">
                  🎉 Esse presente já está garantido! Todas as cotas foram reservadas por amigos incríveis.
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26]"
                >
                  Escolher outro presente
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmReservation} className="space-y-4">
                {gift.totalQuantity > 1 && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-2">
                      Quantas cotas você gostaria de presentear?
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-[#EADBCE] rounded-xl bg-white overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="h-11 w-11 flex items-center justify-center text-lg font-bold text-[#68625B] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-12 text-center text-sm font-semibold text-[#2D2A26] tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.min(maxAvailable, quantity + 1))}
                          className="h-11 w-11 flex items-center justify-center text-lg font-bold text-[#68625B] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-[#68625B]">
                        Total:{' '}
                        <strong className="text-[#2D2A26] font-semibold tabular-nums">
                          R$ {(gift.price * quantity).toLocaleString('pt-BR')}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="reserve-name" className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Seu Nome *
                  </label>
                  <input
                    id="reserve-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Como você quer aparecer na lista da Alyne?"
                    className="w-full h-11 px-4 rounded-xl border border-[#EADBCE] bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26]"
                  />
                </div>

                <div>
                  <label htmlFor="reserve-whatsapp" className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Seu WhatsApp *
                  </label>
                  <input
                    id="reserve-whatsapp"
                    type="tel"
                    required
                    value={guestWhatsapp}
                    onChange={(e) => setGuestWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full h-11 px-4 rounded-xl border border-[#EADBCE] bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26]"
                  />
                </div>

                <div>
                  <label htmlFor="reserve-message" className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Recadinho carinhoso (opcional)
                  </label>
                  <textarea
                    id="reserve-message"
                    rows={2}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escreva uma mensagem para aquecer o novo apê!"
                    className="w-full p-3 rounded-xl border border-[#EADBCE] bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26] resize-none"
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
                    className="w-full h-12 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
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
                  <p className="text-[11px] text-[#7D756C] text-center mt-2.5">
                    Não cobramos nada no site! É apenas um compromisso carinhoso para a Alyne saber quem vai dar o quê.
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
