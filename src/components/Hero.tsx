import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, MapPin, Instagram, Sparkles, ArrowDown } from 'lucide-react';
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

  const eventHasPassed = targetTimestamp ? targetTimestamp < Date.now() : false;
  const heroHeading = settings.heroHeading || 'Minha casa nova finalmente saiu do Pinterest!';
  const heroSubheading = settings.heroSubheading || 'Esse ano a comemoração é diferente: aniversário + casa nova + a desculpa perfeita para reunir quem eu amo.';
  const heroQuote = settings.quote || 'Vem comemorar comigo e, se quiser, ajuda a montar minha casa nova 😂';

  return (
    <section id="topo" className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F3E7DE] rounded-full blur-3xl opacity-60 -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#EFE8DF] rounded-full blur-3xl opacity-50 -z-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-widest uppercase text-[#A95339] mb-4">
              <span>Open House</span>
              <span aria-hidden="true" className="text-[#C86D51]">·</span>
              <span>Aniversário</span>
              <span aria-hidden="true" className="text-[#C86D51]">·</span>
              <span>Chá de Casa Nova</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-[3.25rem] font-medium leading-[1.15] text-[#2D2A26] mb-6 text-balance">
              {heroHeading}
            </h1>

            <p className="text-base sm:text-lg text-[#5A544D] leading-relaxed mb-6 max-w-xl">
              {heroSubheading}
            </p>

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

            <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-2xl p-5 mb-8 shadow-xs max-w-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold tracking-wider uppercase text-[#7D756C]">
                  {eventHasPassed ? 'Evento' : 'Contagem Regressiva para a Bagunça'}
                </span>
                <span className="text-xs text-[#A95339] font-medium">
                  {eventHasPassed ? 'Celebramos com carinho' : 'Contando cada minuto!'}
                </span>
              </div>

              {eventHasPassed ? (
                <p className="font-serif text-xl text-[#2D2A26]">O evento já aconteceu — obrigada por celebrar com a gente! ❤️</p>
              ) : (
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
              )}
            </div>

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

          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border-4 border-white aspect-[4/5] bg-[#EFE8DF]">
                <img
                  src={settings.mainImageUrl || 'default'}
                  alt="Alyne Nobre no apê novo"
                  referrerPolicy="no-referrer"
                  fetchPriority="high"
                  className="w-full h-full object-cover object-center"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-6 text-white">
                  <div className="font-serif text-2xl font-light tracking-wide">
                    {settings.hostName}
                  </div>
                  <p className="text-xs text-stone-200 mt-1">
                    {heroQuote}
                  </p>
                </div>
              </div>

              <a
                href={`https://www.instagram.com/${settings.instagramHandle}/`}
                target="_blank"
                rel="noreferrer noopener"
                className="absolute -bottom-4 right-4 bg-white/95 backdrop-blur-md border border-[#EADBCE] text-[#2D2A26] hover:text-[#C86D51] py-2.5 px-4 rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <Instagram className="w-4 h-4 text-[#C86D51]" />
                <span>@{settings.instagramHandle}</span>
              </a>

              <div className="absolute -top-3 -left-3 bg-[#FAF8F5] border border-[#EADBCE] text-[#7D756C] px-3.5 py-1.5 rounded-lg text-xs font-medium shadow-xs">
                ✨ {settings.locationName || 'Apê 82'} • {settings.locationCity || 'Casa Nova'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
