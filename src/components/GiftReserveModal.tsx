import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { X, Copy, Check, Heart, ExternalLink, QrCode, AlertCircle, ShoppingBag } from 'lucide-react';
import { Gift } from '../types';
import { reserveGiftWithTransaction } from '../services/giftService';

interface GiftReserveModalProps {
  gift: Gift | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const GiftReserveModal: React.FC<GiftReserveModalProps> = ({
  gift,
  onClose,
  onSuccess,
}) => {
  if (!gift) return null;

  const [guestName, setGuestName] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReservedSuccess, setIsReservedSuccess] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const isSoldOut = gift.availableQuantity <= 0;
  const maxAvailable = Math.max(1, gift.availableQuantity);

  const activePixKey = gift.pixKey || 'alyne2.nobre.c@gmail.com';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(activePixKey);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
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
    if (quantity > gift.availableQuantity) {
      setError(`Restam apenas ${gift.availableQuantity} cotas disponíveis.`);
      return;
    }

    setLoading(true);
    try {
      await reserveGiftWithTransaction({
        giftId: gift.id,
        guestName,
        guestWhatsapp,
        quantity,
        message,
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
      setError(err.message || 'Não foi possível reservar este presente.');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR code URL if not custom uploaded
  const qrCodeUrl =
    gift.pixQrCodeUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
      activePixKey
    )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] hover:bg-[#EADBCE] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isReservedSuccess ? (
          /* Success Screen */
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

            {/* Next steps depending on gift type */}
            {(gift.type === 'pix' || gift.type === 'shares' || gift.pixKey) && (
              <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-2xl p-5 mb-6 text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#A95339] mb-2">
                  Próximo passo: Chave Pix
                </div>
                <p className="text-xs text-[#68625B] mb-3">
                  Como é um presente em cota/Pix, você pode fazer a transferência quando quiser:
                </p>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#F0E6DE] text-xs font-mono text-[#2D2A26] mb-3">
                  <span className="truncate">{activePixKey}</span>
                  <button
                    onClick={handleCopyPix}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-sans font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {pixCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                {pixCopied && (
                  <p className="text-xs text-[#C86D51] font-medium mb-3">
                    Chave Pix copiada com sucesso! ❤️
                  </p>
                )}

                {/* QR Code preview */}
                <div className="text-center pt-2">
                  <div className="inline-block p-2 bg-white rounded-xl border border-[#EADBCE] shadow-xs">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code Pix"
                      className="w-40 h-40 object-contain mx-auto"
                    />
                  </div>
                  <p className="text-[11px] text-[#7D756C] mt-2">
                    Abra o app do seu banco e escaneie o código
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
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer"
            >
              Fechar e Voltar à Lista
            </button>
          </div>
        ) : (
          /* Reservation Form */
          <div>
            {/* Header Gift Info */}
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
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26]"
                >
                  Escolher outro presente
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmReservation} className="space-y-4">
                
                {/* Cotas Selector (if totalQuantity > 1) */}
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
                          onClick={() => setQuantity(Math.min(gift.availableQuantity, quantity + 1))}
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

                {/* Nome */}
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

                {/* WhatsApp */}
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

                {/* Mensagem Opcional */}
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
