import React, { useState } from 'react';
import { Share2, MessageCircle, Copy, Check } from 'lucide-react';

export const ShareBar: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const shareText = "Você recebeu um convite muito especial! 🏠❤️ Vem comemorar comigo meu aniversário + minha casa nova!";
  const shareUrl = window.location.href;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Open House & Bday Alyne Nobre",
          text: shareText,
          url: shareUrl,
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n\nConfirme sua presença e veja a lista de presentes aqui: ${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="py-12 bg-[#FAF8F5] border-t border-[#EADBCE]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        
        <h3 className="font-serif text-2xl font-medium text-[#2D2A26] mb-2">
          Compartilhe com quem vai comemorar com a gente!
        </h3>
        <p className="text-sm text-[#68625B] mb-6">
          Envie o convite diretamente no grupo da turma ou no privado.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={handleShare}
            className="h-11 px-5 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide uppercase flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Compartilhar Convite</span>
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="h-11 px-5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold tracking-wide uppercase flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar no WhatsApp</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="h-11 px-4 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#F4EFEB] text-[#2D2A26] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#8A9A86]" />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#68625B]" />
                <span>Copiar Link</span>
              </>
            )}
          </button>
        </div>

      </div>
    </section>
  );
};
