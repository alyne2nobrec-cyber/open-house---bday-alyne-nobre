import React, { useEffect, useState } from 'react';
import { Pin, Maximize2, X } from 'lucide-react';
import { EventSettings } from '../types';
import modernLivingRoom from '../assets/images/modern_living_room_1790969114799.jpg';
import kitchenDining from '../assets/images/kitchen_dining_bar_1790969125087.jpg';
import readingNook from '../assets/images/aesthetic_reading_nook_1790969135611.jpg';
import alynePortrait from '../assets/images/alyne_portrait_1790969104126.jpg';

interface HouseGalleryProps {
  settings: EventSettings;
}

export const HouseGallery: React.FC<HouseGalleryProps> = ({ settings }) => {
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const fallbackImages = [modernLivingRoom, kitchenDining, readingNook, alynePortrait];
  const images = settings.galleryImages && settings.galleryImages.length > 0
    ? settings.galleryImages
    : fallbackImages;

  const captions = [
    'A sala que vai abrigar as melhores conversas',
    'Cantinho do café e das comidinhas',
    'Espaço zen e leitura',
    'A anfitriã contando os dias pra receber vocês!',
  ];

  const rotations = [
    '-rotate-1 sm:-rotate-2',
    'rotate-[0.75deg] sm:rotate-[1.5deg]',
    '-rotate-[0.5deg] sm:-rotate-1',
    'rotate-[1.25deg] sm:rotate-[2.5deg]',
  ];

  const tapeRotations = [
    '-rotate-3',
    'rotate-2',
    '-rotate-2',
    'rotate-3',
  ];

  useEffect(() => {
    if (!activePhoto) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePhoto(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePhoto]);

  return (
    <section id="galeria" className="py-16 sm:py-24 bg-[#FBF4E8] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-semibold tracking-widest uppercase text-[#CF3B25] mb-3">
            <Pin className="w-4 h-4 text-[#CF3B25]" />
            <span>Tour Virtual do Novo Lar</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1B2F4E] mb-4">
            Um <span className="bg-gradient-to-t from-[#F2B84B] to-[#F2B84B] bg-[length:100%_40%] bg-no-repeat bg-bottom">spoiler</span> do nosso novo cantinho
          </h2>

          <p className="text-base text-[#4B5A72] leading-relaxed">
            Cada cantinho foi pensado com muito afeto. Aqui está uma prévia do que espera por vocês na nossa comemoração!
          </p>
        </div>

        {/* Gallery Polaroid Wall Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 pt-4 pb-8">
          {images.map((imgUrl, idx) => {
            const rotClass = rotations[idx % rotations.length];
            const tapeRot = tapeRotations[idx % tapeRotations.length];

            return (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setActivePhoto(imgUrl)}
                aria-label={`Abrir foto ${idx + 1}`}
                className={`group relative bg-white p-3 pb-12 rounded-sm shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CF3B25] focus-visible:ring-offset-2 min-h-[44px] ${rotClass} hover:rotate-0 hover:scale-105 hover:z-20 focus:rotate-0 focus:scale-105 focus:z-20`}
              >
                {/* 4.4 Decorative yellow washi tape on top of polaroid */}
                <span
                  aria-hidden="true"
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-[#F2B84B]/70 shadow-2xs pointer-events-none ${tapeRot}`}
                />

                {/* Photo container */}
                <div className="relative aspect-[4/5] overflow-hidden bg-[#F6EBD9]">
                  <img
                    src={imgUrl}
                    alt={captions[idx] || `Foto ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                  />
                  {/* Discreet zoom icon in the corner */}
                  <div className="absolute top-2 right-2 bg-white/80 p-1 rounded-sm text-[#1B2F4E] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* 4.5 Caption ALWAYS visible in Caveat handwritten font */}
                <p className="font-hand text-xl text-[#1B2F4E] line-clamp-2 text-center mt-3 px-1 leading-snug">
                  {captions[idx] || 'Ver foto ampliada'}
                </p>
              </button>
            );
          })}
        </div>

        {/* Photo Lightbox */}
        {activePhoto && (
          <div
            className="fixed inset-0 z-50 bg-[#1B2F4E]/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setActivePhoto(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Galeria ampliada"
          >
            <div
              className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setActivePhoto(null)}
                className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={activePhoto}
                alt="Foto ampliada"
                referrerPolicy="no-referrer"
                className="w-auto h-auto max-h-[85vh] max-w-full object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
