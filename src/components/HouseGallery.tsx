import React, { useEffect, useState } from 'react';
import { Pin, Maximize2, X, Play, Film } from 'lucide-react';
import { EventSettings, GalleryMediaItem } from '../types';
import { subscribeGalleryMedia } from '../services/galleryService';
import modernLivingRoom from '../assets/images/modern_living_room_1790969114799.jpg';
import kitchenDining from '../assets/images/kitchen_dining_bar_1790969125087.jpg';
import readingNook from '../assets/images/aesthetic_reading_nook_1790969135611.jpg';
import alynePortrait from '../assets/images/alyne_portrait_1790969104126.jpg';

interface HouseGalleryProps {
  settings: EventSettings;
}

interface DisplayItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  caption: string;
}

export const HouseGallery: React.FC<HouseGalleryProps> = ({ settings }) => {
  const [customMedia, setCustomMedia] = useState<GalleryMediaItem[]>([]);
  const [activeItem, setActiveItem] = useState<DisplayItem | null>(null);

  // Subscribe to uploaded gallery media
  useEffect(() => {
    const unsub = subscribeGalleryMedia((items) => {
      setCustomMedia(items);
    });
    return () => unsub();
  }, []);

  const fallbackImages = [modernLivingRoom, kitchenDining, readingNook, alynePortrait];
  const fallbackCaptions = [
    'A sala que vai abrigar as melhores conversas',
    'Cantinho do café e das comidinhas',
    'Espaço zen e leitura',
    'A anfitriã contando os dias pra receber vocês!',
  ];

  // If custom media is uploaded in Firestore, use it; otherwise use default fallback photos
  const displayItems: DisplayItem[] =
    customMedia.length > 0
      ? customMedia.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          caption: m.caption || (m.type === 'video' ? 'Vídeo do nosso cantinho' : 'Nosso novo cantinho'),
        }))
      : (settings.galleryImages && settings.galleryImages.length > 0
          ? settings.galleryImages
          : fallbackImages
        ).map((imgUrl, idx) => ({
          id: `fallback-${idx}`,
          type: 'image' as const,
          url: imgUrl,
          caption: fallbackCaptions[idx] || `Foto ${idx + 1}`,
        }));

  const rotations = [
    '-rotate-1 sm:-rotate-2',
    'rotate-[0.75deg] sm:rotate-[1.5deg]',
    '-rotate-[0.5deg] sm:rotate-1',
    'rotate-[1.25deg] sm:rotate-[2.5deg]',
  ];

  const tapeRotations = [
    '-rotate-3',
    'rotate-2',
    '-rotate-2',
    'rotate-3',
  ];

  useEffect(() => {
    if (!activeItem) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveItem(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeItem]);

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
          {displayItems.map((item, idx) => {
            const rotClass = rotations[idx % rotations.length];
            const tapeRot = tapeRotations[idx % tapeRotations.length];
            const isVideo = item.type === 'video';

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveItem(item)}
                aria-label={isVideo ? `Assistir vídeo: ${item.caption}` : `Abrir foto: ${item.caption}`}
                className={`group relative bg-white p-3 pb-12 rounded-sm shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CF3B25] focus-visible:ring-offset-2 min-h-[44px] ${rotClass} hover:rotate-0 hover:scale-105 hover:z-20 focus:rotate-0 focus:scale-105 focus:z-20`}
              >
                {/* Decorative yellow washi tape on top of polaroid */}
                <span
                  aria-hidden="true"
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-5 bg-[#F2B84B]/70 shadow-2xs pointer-events-none ${tapeRot}`}
                />

                {/* Media container */}
                <div className="relative aspect-[4/5] overflow-hidden bg-[#F6EBD9]">
                  {isVideo ? (
                    <div className="relative w-full h-full bg-black/10">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.caption}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                      ) : (
                        <video
                          src={item.url}
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Play Button Overlay on video */}
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center transition-all group-hover:bg-black/35">
                        <div className="w-12 h-12 rounded-full bg-white/95 text-[#CF3B25] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Video badge in corner */}
                      <div className="absolute top-2 left-2 bg-[#1B2F4E]/80 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] text-white font-mono flex items-center gap-1">
                        <Film className="w-3 h-3 text-[#F2B84B]" />
                        <span>VÍDEO</span>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.caption}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                    />
                  )}

                  {/* Discreet zoom icon in the corner */}
                  <div className="absolute top-2 right-2 bg-white/80 p-1 rounded-sm text-[#1B2F4E] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Caption ALWAYS visible in Caveat handwritten font */}
                <p className="font-hand text-xl text-[#1B2F4E] line-clamp-2 text-center mt-3 px-1 leading-snug">
                  {item.caption || (isVideo ? 'Assistir vídeo' : 'Ver foto ampliada')}
                </p>
              </button>
            );
          })}
        </div>

        {/* Media Lightbox / Fullscreen Modal */}
        {activeItem && (
          <div
            className="fixed inset-0 z-50 bg-[#1B2F4E]/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setActiveItem(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Galeria ampliada"
          >
            <div
              className="relative max-w-4xl max-h-[90vh] w-full rounded-2xl overflow-hidden shadow-2xl bg-black flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setActiveItem(null)}
                className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 flex items-center justify-center overflow-hidden bg-black min-h-[300px]">
                {activeItem.type === 'video' ? (
                  <video
                    src={activeItem.url}
                    controls
                    autoPlay
                    playsInline
                    className="w-auto h-auto max-h-[75vh] max-w-full object-contain"
                  />
                ) : (
                  <img
                    src={activeItem.url}
                    alt={activeItem.caption}
                    referrerPolicy="no-referrer"
                    className="w-auto h-auto max-h-[75vh] max-w-full object-contain"
                  />
                )}
              </div>

              {activeItem.caption && (
                <div className="bg-[#1B2F4E] p-4 text-center">
                  <p className="font-hand text-xl sm:text-2xl text-white">
                    {activeItem.caption}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
