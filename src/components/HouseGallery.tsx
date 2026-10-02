import React, { useState } from 'react';
import { Sparkles, Maximize2, X, Camera } from 'lucide-react';
import { EventSettings } from '../types';

interface HouseGalleryProps {
  settings: EventSettings;
}

export const HouseGallery: React.FC<HouseGalleryProps> = ({ settings }) => {
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const images = settings.galleryImages && settings.galleryImages.length > 0
    ? settings.galleryImages
    : [
        "/src/assets/images/modern_living_room_1790969114799.jpg",
        "/src/assets/images/kitchen_dining_bar_1790969125087.jpg",
        "/src/assets/images/aesthetic_reading_nook_1790969135611.jpg",
        "/src/assets/images/alyne_portrait_1790969104126.jpg",
      ];

  const captions = [
    "A sala que vai abrigar as melhores conversas",
    "Cantinho do café e das comidinhas",
    "Espaço zen e leitura",
    "A anfitriã contando os dias pra receber vocês!",
  ];

  return (
    <section id="galeria" className="py-16 sm:py-24 bg-[#FAF8F5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#A95339] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#C86D51]" />
            <span>Tour Virtual do Novo Lar</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-[#2D2A26] mb-4">
            Um spoiler do nosso novo cantinho
          </h2>

          <p className="text-base text-[#68625B] leading-relaxed">
            Cada cantinho foi pensado com muito afeto. Aqui está uma prévia do que espera por vocês na nossa comemoração!
          </p>
        </div>

        {/* Gallery Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {images.map((imgUrl, idx) => (
            <div
              key={idx}
              onClick={() => setActivePhoto(imgUrl)}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#EFE8DF] border border-[#EADBCE] cursor-pointer shadow-2xs hover:shadow-md transition-all"
            >
              <img
                src={imgUrl}
                alt={captions[idx] || `Foto ${idx + 1}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4 text-white">
                <span className="text-xs font-medium line-clamp-1">
                  {captions[idx] || 'Ver foto ampliada'}
                </span>
                <Maximize2 className="w-3.5 h-3.5 ml-auto text-white shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Photo Lightbox */}
        {activePhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setActivePhoto(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black">
              <button
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
