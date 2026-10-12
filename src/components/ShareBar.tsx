import React, { useState } from 'react';
import { Share2, MessageCircle, Copy, Check } from 'lucide-react';
import { EventSettings } from '../types';
import { formatWhatsappUrl } from '../utils/phone';

interface ShareBarProps {
  settings?: EventSettings;
}

export const ShareBar: React.FC<ShareBarProps> = ({ settings }) => {
  const [copied, setCopied] = useState(false);

  const hostName = settings?.hostName || 'Alyne Nobre';
  const hostFirstName = hostName.split(' ')[0] || 'Alyne';
  const hostPhone = settings?.hostWhatsapp || settings?.shippingPhone || '11987654321';

  const shareText = "Quero comemorar meu aniversário e essa fase nova com você! 🏡❤️";
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: settings?.eventName || "Open House & Bday Alyne Nobre",
          text: shareText,
          url: shareUrl,
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      const inviteText = encodeURIComponent(`${shareText}\n\nConfirme sua presença e veja a lista de presentes aqui: ${shareUrl}`);
      window.open(`https://api.whatsapp.com/send?text=${inviteText}`, '_blank');
    }
  };

  const notifyHostMessage = `Oi ${hostFirstName}! Estava vendo o convite do seu Open House e lembrei de uma pessoa querida que acho que você esqueceu de convidar: `;

  const handleNotifyHostWhatsApp = () => {
    const whatsappUrl = formatWhatsappUrl(hostPhone, notifyHostMessage);
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(notifyHostMessage)}`, '_blank');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="py-12 bg-[#FBF4E8] border-t border-[#E8D4B8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        
        <h3 className="font-serif text-2xl font-medium text-[#1B2F4E] mb-2">
          Lembra de alguém querido que a {hostFirstName} esqueceu?
        </h3>
        <p className="text-sm text-[#4B5A72] mb-6">
          Envie uma mensagem para a {hostFirstName} no WhatsApp avisando! Ela vai adorar saber para não deixar ninguém especial de fora. Ou, se preferir, encaminhe o convite direto para a pessoa.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleShare}
            className="h-11 px-5 rounded-full bg-[#CF3B25] hover:bg-[#A82D1B] text-white text-xs font-semibold tracking-wide uppercase flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartilhar Convite</span>
          </button>

          <button
            onClick={handleNotifyHostWhatsApp}
            className="h-11 px-5 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold tracking-wide uppercase flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Avisar a {hostFirstName} no WhatsApp</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="h-11 px-4 rounded-full border border-[#E8D4B8] bg-white hover:bg-[#F6EBD9] text-[#1B2F4E] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#8A9A86]" />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#4B5A72]" />
                <span>Copiar Link</span>
              </>
            )}
          </button>
        </div>

      </div>
    </section>
  );
};
