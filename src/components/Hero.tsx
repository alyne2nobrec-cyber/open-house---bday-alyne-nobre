import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Instagram, Sparkles, ArrowDown } from 'lucide-react';
import { EventSettings } from '../types';

interface HeroProps {
  settings: EventSettings;
  onScrollTo: (id: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ settings, onScrollTo }) => {
  // Countdown calculation
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const targetStr = `${settings.eventDate}T${settings.eventTime || '17:00'}:00`;
      const targetDate = new Date(targetStr).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, targetDate - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.eventDate, settings.eventTime]);

  // Format date nicely: "21 de Novembro, Sábado"
  const formattedDate = (() => {
    try {
      const parts = settings.eventDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'long',
          weekday: 'long',
        });
      }
    } catch {
      // fallback
    }
    return settings.eventDate;
  })();

  return (
    <section id="topo" className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden">
      {/* Subtle organic background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F3E7DE] rounded-full blur-3xl opacity-60 -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#EFE8DF] rounded-full blur-3xl opacity-50 -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Story & CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Concept Kicker - Clean unboxed text, no pills */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-widest uppercase text-[#A95339] mb-4">
              <span>Open House</span>
              <span aria-hidden="true" className="text-[#C86D51]">·</span>
              <span>Aniversário</span>
              <span aria-hidden="true" className="text-[#C86D51]">·</span>
              <span>Chá de Casa Nova</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-[3.25rem] font-medium leading-[1.15] text-[#2D2A26] mb-6 text-balance">
              Minha casa nova finalmente saiu do <span className="italic font-normal text-[#C86D51]">Pinterest</span> e está virando realidade.
            </h1>

            {/* Subhead with humor and warmth */}
            <p className="text-base sm:text-lg text-[#5A544D] leading-relaxed mb-6 max-w-xl">
              Esse ano a comemoração é tripla: aniversário + conquista do apê novo + a desculpa perfeita para reunir quem eu mais amo em volta de uma mesa cheia e boas risadas.
            </p>

            {/* Event Key Facts Bar */}
            <div className="flex flex-wrap items-center gap-y-3 gap-x-5 py-4 border-y border-[#EADBCE] text-sm text-[#464039] mb-8">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C86D51] shrink-0" />
                <span className="capitalize font-medium">{formattedDate}</span>
              </div>
              <span className="hidden sm:inline text-[#D5C6BA]" aria-hidden="true">/</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C86D51] shrink-0" />
                <span>A partir das <strong>{settings.eventTime}</strong></span>
              </div>
              <span className="hidden sm:inline text-[#D5C6BA]" aria-hidden="true">/</span>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#C86D51] shrink-0" />
                <span>{settings.locationName}</span>
              </div>
            </div>

            {/* Countdown Box */}
            <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-2xl p-5 mb-8 shadow-xs max-w-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wider uppercase text-[#7D756C]">
                  Contagem Regressiva para a Bagunça
                </span>
                <span className="text-xs text-[#A95339] font-medium">Contando cada minuto!</span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
                <div className="bg-[#FAF8F5] rounded-xl py-2 px-1 border border-[#F0E6DE]">
                  <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#2D2A26] tabular-nums">
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-medium text-[#7D756C] uppercase">dias</span>
                </div>
                <div className="bg-[#FAF8F5] rounded-xl py-2 px-1 border border-[#F0E6DE]">
                  <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#2D2A26] tabular-nums">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-medium text-[#7D756C] uppercase">horas</span>
                </div>
                <div className="bg-[#FAF8F5] rounded-xl py-2 px-1 border border-[#F0E6DE]">
                  <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#2D2A26] tabular-nums">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-medium text-[#7D756C] uppercase">min</span>
                </div>
                <div className="bg-[#FAF8F5] rounded-xl py-2 px-1 border border-[#F0E6DE]">
                  <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#C86D51] tabular-nums">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] font-medium text-[#7D756C] uppercase">seg</span>
                </div>
              </div>
            </div>

            {/* 3 Main Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => onScrollTo('rsvp')}
                className="h-12 px-6 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-sm font-semibold tracking-wide flex items-center justify-center transition-all shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                Confirmar Minha Presença
              </button>

              <button
                onClick={() => onScrollTo('presentes')}
                className="h-12 px-6 rounded-xl bg-[#FFFFFF] hover:bg-[#F4EFEB] text-[#2D2A26] border border-[#EADBCE] text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
              >
                Ver Lista de Presentes 😂
              </button>

              <button
                onClick={() => onScrollTo('galeria')}
                className="h-12 px-5 text-[#68625B] hover:text-[#2D2A26] text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                Conhecer o Apê
                <ArrowDown className="w-4 h-4 text-[#C86D51]" />
              </button>
            </div>
          </div>

          {/* Right Column: Alyne Portrait & Aesthetic Stamp */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              {/* Photo Frame */}
              <div className="relative rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-[4/5] bg-[#EFE8DF]">
                <img
                  src={settings.mainImageUrl || "/src/assets/images/alyne_portrait_1790969104126.jpg"}
                  alt="Alyne Nobre no apê novo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
                
                {/* Measured Scrim for warm bottom info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6 text-white">
                  <div className="font-serif text-2xl font-light tracking-wide">
                    {settings.hostName}
                  </div>
                  <p className="text-xs text-stone-200 mt-1">
                    “Vem comemorar comigo e, se quiser, ajuda a montar minha casa nova 😂”
                  </p>
                </div>
              </div>

              {/* Floating Instagram Anchor */}
              <a
                href={`https://www.instagram.com/${settings.instagramHandle}/`}
                target="_blank"
                rel="noreferrer noopener"
                className="absolute -bottom-4 right-4 bg-white/95 backdrop-blur-md border border-[#EADBCE] text-[#2D2A26] hover:text-[#C86D51] py-2.5 px-4 rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Instagram className="w-4 h-4 text-[#C86D51]" />
                <span>@{settings.instagramHandle}</span>
              </a>

              {/* Decorative note */}
              <div className="absolute -top-3 -left-3 bg-[#FAF8F5] border border-[#EADBCE] text-[#7D756C] px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-xs">
                ✨ Apê 82 • Casa Nova
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
