import React, { useState } from 'react';
import { MapPin, Calendar, Clock, Navigation, Copy, Check, Info } from 'lucide-react';
import { EventSettings } from '../types';

interface LocationDetailsProps {
  settings: EventSettings;
}

export const LocationDetails: React.FC<LocationDetailsProps> = ({ settings }) => {
  const [copied, setCopied] = useState(false);

  const fullAddress = `${settings.locationAddress}, ${settings.locationCity}`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(fullAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section id="local" className="py-16 sm:py-20 bg-[#F6EBD9] border-t border-[#E8D4B8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-semibold tracking-widest uppercase text-[#CF3B25] mb-3">
            <MapPin className="w-3.5 h-3.5 text-[#CF3B25]" />
            <span>Coordenadas da Celebração</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#1B2F4E] mb-3">
            Como Chegar
          </h2>
          <p className="text-sm sm:text-base text-[#4B5A72]">
            Coloque no seu GPS e venha sem pressa de ir embora!
          </p>
        </div>

        <div className="bg-[#FBF4E8] border border-[#E8D4B8] rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Left Column: Details */}
            <div className="space-y-5">
              <div>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#A82D1B] block mb-1">
                  Local
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#1B2F4E]">
                  {settings.locationName}
                </h3>
                <p className="text-sm text-[#4B5A72] mt-1">
                  {fullAddress}
                </p>
              </div>

              <div className="pt-3 border-t border-[#F7E6D0] space-y-2 text-sm text-[#3E5070]">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#CF3B25] shrink-0" />
                  <span>Data: <strong>{settings.eventDate}</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#CF3B25] shrink-0" />
                  <span>Horário: <strong>{settings.eventTime}</strong> {settings.eventEndTime ? `até ${settings.eventEndTime}` : ''}</span>
                </div>
              </div>

              {settings.locationNotes && (
                <div className="p-3.5 rounded-xl bg-[#F6EBD9] border border-[#E8D4B8] text-xs text-[#4B5A72] flex gap-2.5">
                  <Info className="w-4 h-4 text-[#CF3B25] shrink-0 mt-0.5" />
                  <span>{settings.locationNotes}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleCopyAddress}
                  className="h-10 px-4 rounded-full border border-[#E8D4B8] bg-white hover:bg-[#FBF4E8] text-xs font-semibold text-[#1B2F4E] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#8A9A86]" />
                      <span>Endereço copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#4B5A72]" />
                      <span>Copiar Endereço</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="h-10 px-4 rounded-full bg-[#1B2F4E] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Abrir no Google Maps</span>
                </a>
              </div>
            </div>

            {/* Right Column: Visual Map Card */}
            <div className="h-64 sm:h-72 rounded-2xl bg-[#F3E3CB] border border-[#E8D4B8] overflow-hidden relative flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-[#CF3B25] mb-3">
                <MapPin className="w-7 h-7" />
              </div>
              <span className="font-serif text-lg font-medium text-[#1B2F4E] mb-1">
                {settings.locationName}
              </span>
              <p className="text-xs text-[#5B6B82] max-w-xs mb-4">
                {fullAddress}
              </p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs font-semibold text-[#CF3B25] hover:underline"
              >
                Clique para traçar rota no Maps →
              </a>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
