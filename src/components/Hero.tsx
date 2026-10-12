import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, Instagram, ArrowDown, Home } from 'lucide-react';
import { EventSettings } from '../types';

interface HeroProps {
  settings: EventSettings;
  onScrollTo: (id: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ settings, onScrollTo }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>(
    { days: 0, hours: 0, minutes: 0, seconds: 0 }
  );

  const targetTimestamp = useMemo(() => {
    if (!settings.eventDate) return null;
    try {
      const [year, month, day] = settings.eventDate.split('-').map(Number);
      return new Date(
        year,
        month - 1,
        day,
        Number(settings.eventTime?.split(':')[0] || '17'),
        Number(settings.eventTime?.split(':')[1] || '00')
      ).getTime();
    } catch {
      return null;
    }
  }, [settings.eventDate, settings.eventTime]);

  useEffect(() => {
    const calculateTime = () => {
      if (!targetTimestamp) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const diff = Math.max(0, targetTimestamp - Date.now());
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTime();
    const interval = window.setInterval(calculateTime, 1000);
    return () => window.clearInterval(interval);
  }, [targetTimestamp]);

  const formattedDate = (() => {
    const fallbackDate = settings.eventDate || '2026-11-21';
    try {
      const [year, month, day] = fallbackDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch {
      return fallbackDate;
    }
  })();

  const eventDateFormattedShort = (() => {
    if (!settings.eventDate) return '';
    try {
      const parts = settings.eventDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}`;
      }
      return '';
    } catch {
      return '';
    }
  })();

  const rotatingBadgeText = eventDateFormattedShort
    ? `OPEN HOUSE • ${eventDateFormattedShort} • ANIVERSÁRIO • CASA NOVA • `
    : `OPEN HOUSE • ANIVERSÁRIO • CASA NOVA • `;

  const eventHasPassed = targetTimestamp ? targetTimestamp < Date.now() : false;
  const heroHeading = settings.heroHeading || 'Minha casa nova finalmente saiu do Pinterest!';
  const heroSubheading = settings.heroSubheading || 'Esse ano a comemoração é diferente: aniversário + casa nova + a desculpa perfeita para reunir quem eu amo.';
  const heroQuote = settings.quote || 'Vem comemorar comigo e, se quiser, ajuda a montar minha casa nova 😂';

  return (
    <section id="topo" className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden">
      {/* 2.1 Two blurred background blobs: yellow-sun soft and coral soft */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F2B84B]/25 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#CF3B25]/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* 2.2 Kicker in DM Mono, uppercase, tracking-widest, color #CF3B25 with #F2B84B dots */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-mono font-semibold tracking-widest uppercase text-[#CF3B25] mb-4">
              <span>Open House</span>
              <span aria-hidden="true" className="text-[#F2B84B]">·</span>
              <span>Aniversário</span>
              <span aria-hidden="true" className="text-[#F2B84B]">·</span>
              <span>Chá de Casa Nova</span>
            </div>

            {/* 2.3 Headline h1: Fraunces, text-4xl sm:text-5xl lg:text-6xl, leading-[1.08], text-[#1B2F4E] */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.08] text-[#1B2F4E] mb-6 text-balance">
              {heroHeading}
            </h1>

            <p className="text-base sm:text-lg text-[#3E5070] leading-relaxed mb-6 max-w-xl">
              {heroSubheading}
            </p>

            <div className="flex flex-wrap items-center gap-y-3 gap-x-5 py-4 border-y border-[#E8D4B8] text-sm text-[#2F4468] mb-8">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#CF3B25] shrink-0" />
                <span className="capitalize font-medium">{formattedDate}</span>
              </div>
              <span className="hidden sm:inline text-[#DCC6A6]" aria-hidden="true">/</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#CF3B25] shrink-0" />
                <span>A partir das <strong>{settings.eventTime}</strong></span>
              </div>
              <span className="hidden sm:inline text-[#DCC6A6]" aria-hidden="true">/</span>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#CF3B25] shrink-0" />
                <span>{settings.locationName}</span>
              </div>
            </div>

            {/* 2.8 Countdown card: border 2px #1B2F4E, solid offset shadow, rounded-2xl */}
            <div className="bg-[#FFFFFF] border-2 border-[#1B2F4E] rounded-2xl p-5 mb-8 shadow-[4px_4px_0_0_#1B2F4E] max-w-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-semibold tracking-wider uppercase text-[#5B6B82]">
                  {eventHasPassed ? 'Evento' : 'Contagem Regressiva para a Bagunça'}
                </span>
                <span className="text-xs font-mono text-[#CF3B25] font-medium">
                  {eventHasPassed ? 'Celebramos com carinho' : 'faltam estes minutos pra festa'}
                </span>
              </div>

              {/* 2.10 Corrected text for ended event */}
              {eventHasPassed ? (
                <p className="font-serif text-xl text-[#1B2F4E]">
                  O evento já aconteceu. Obrigada por fazer parte desse dia comigo!! ❤️
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
                  <div className="bg-[#FBF4E8] rounded-xl py-2 px-1 border border-[#E8D4B8]">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#1B2F4E] tabular-nums">
                      {String(timeLeft.days).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-[#5B6B82] uppercase">dias</span>
                  </div>
                  <div className="bg-[#FBF4E8] rounded-xl py-2 px-1 border border-[#E8D4B8]">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#1B2F4E] tabular-nums">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-[#5B6B82] uppercase">horas</span>
                  </div>
                  <div className="bg-[#FBF4E8] rounded-xl py-2 px-1 border border-[#E8D4B8]">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#1B2F4E] tabular-nums">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-[#5B6B82] uppercase">min</span>
                  </div>
                  <div className="bg-[#FBF4E8] rounded-xl py-2 px-1 border border-[#E8D4B8]">
                    <span className="block font-serif text-2xl sm:text-3xl font-semibold text-[#CF3B25] tabular-nums">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-[#5B6B82] uppercase">seg</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2.9 Buttons: primary coral, secondary outline ink, discrete apê link */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => onScrollTo('rsvp')}
                className="h-12 px-6 rounded-full bg-[#CF3B25] hover:bg-[#A82D1B] text-white text-sm font-semibold tracking-wide flex items-center justify-center transition-all shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                Confirmar Minha Presença
              </button>

              <button
                onClick={() => onScrollTo('presentes')}
                className="h-12 px-6 rounded-full bg-transparent hover:bg-[#1B2F4E] text-[#1B2F4E] hover:text-white border-2 border-[#1B2F4E] text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap"
              >
                Ver Lista de Presentes
              </button>

              <button
                onClick={() => onScrollTo('galeria')}
                className="h-12 px-5 text-[#4B5A72] hover:text-[#1B2F4E] text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                Conhecer o Apê
                <ArrowDown className="w-4 h-4 text-[#CF3B25]" />
              </button>
            </div>
          </div>

          {/* 2.4 Right column: Arch photo with magazine cutout outline, badge and tags */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              {/* Magazine cutout outline offset behind */}
              <div
                aria-hidden="true"
                className="absolute inset-0 translate-x-3 translate-y-3 rounded-t-[999px] rounded-b-3xl border-2 border-[#1B2F4E] -z-10 pointer-events-none"
              />

              {/* Arch container */}
              <div className="relative rounded-t-[999px] rounded-b-3xl overflow-hidden shadow-xl aspect-[4/5] bg-[#F6EBD9]">
                <img
                  src={settings.mainImageUrl || 'default'}
                  alt="Alyne Nobre no apê novo"
                  referrerPolicy="no-referrer"
                  fetchPriority="high"
                  className="w-full h-full object-cover object-center"
                />

                {/* Scrim gradient in ink tone */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1B2F4E]/70 via-[#1B2F4E]/10 to-transparent flex flex-col justify-end p-6 text-white">
                  <div className="font-serif text-2xl font-light tracking-wide text-white">
                    {settings.hostName}
                  </div>
                  <p className="text-xs text-[#FBF4E8]/90 mt-1 font-sans">
                    {heroQuote}
                  </p>
                </div>
              </div>

              {/* 2.5 Rotating Seal (aria-hidden, slow spin, Home icon center) */}
              <div
                aria-hidden="true"
                className="absolute -top-4 -right-2 w-24 h-24 sm:w-26 sm:h-26 pointer-events-none z-20"
              >
                <div className="relative w-full h-full">
                  {/* Rotating SVG with circular text */}
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full animate-[spin_24s_linear_infinite]"
                  >
                    <path
                      id="hero-seal-path"
                      d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
                      fill="none"
                    />
                    <circle cx="50" cy="50" r="48" fill="#F2B84B" stroke="#1B2F4E" strokeWidth="1.5" />
                    <text className="font-mono text-[7px] uppercase font-bold tracking-widest fill-[#1B2F4E]">
                      <textPath href="#hero-seal-path" startOffset="0%">
                        {rotatingBadgeText}
                      </textPath>
                    </text>
                  </svg>
                  {/* Center static Home icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#1B2F4E]" />
                  </div>
                </div>
              </div>

              {/* 2.7 Instagram link: bg #1B2F4E, white text, icon #F2B84B, rotate 2deg */}
              <a
                href={`https://www.instagram.com/${settings.instagramHandle}/`}
                target="_blank"
                rel="noreferrer noopener"
                className="absolute -bottom-4 right-4 bg-[#1B2F4E] text-white py-2.5 px-4 rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] rotate-2 hover:rotate-0"
              >
                <Instagram className="w-4 h-4 text-[#F2B84B]" />
                <span>@{settings.instagramHandle}</span>
              </a>

              {/* 2.6 Location label: moodboard tape style, bg #F2B84B, text #1B2F4E, rotate -3deg */}
              <div className="absolute -top-3 -left-3 bg-[#F2B84B] text-[#1B2F4E] px-3.5 py-1.5 rounded-sm text-xs font-medium shadow-sm -rotate-3">
                {settings.locationName || 'Apê 82'} • {settings.locationCity || 'Casa Nova'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
