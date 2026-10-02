import React, { useState, useMemo } from 'react';
import { Search, Gift as GiftIcon, Heart, ExternalLink, QrCode, CheckCircle2, Sparkles } from 'lucide-react';
import { Gift, GiftCategory } from '../types';

interface GiftRegistryProps {
  gifts: Gift[];
  onSelectGift: (gift: Gift) => void;
}

const CATEGORIES: { id: GiftCategory; label: string; icon: string }[] = [
  { id: 'todos', label: 'Todos', icon: '✨' },
  { id: 'casa', label: 'Casa', icon: '🏠' },
  { id: 'cozinha', label: 'Cozinha', icon: '🍳' },
  { id: 'sala', label: 'Sala', icon: '🛋️' },
  { id: 'quarto', label: 'Quarto', icon: '🛏️' },
  { id: 'banheiro', label: 'Banheiro', icon: '🛁' },
  { id: 'pix', label: 'Pix', icon: '💰' },
  { id: 'outros', label: 'Outros', icon: '🎁' },
];

export const GiftRegistry: React.FC<GiftRegistryProps> = ({ gifts, onSelectGift }) => {
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered gifts list
  const filteredGifts = useMemo(() => {
    return gifts.filter((gift) => {
      const matchCat =
        selectedCategory === 'todos' ||
        gift.category === selectedCategory ||
        (selectedCategory === 'pix' && (gift.type === 'pix' || !!gift.pixKey));

      const matchSearch =
        gift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gift.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [gifts, selectedCategory, searchQuery]);

  return (
    <section id="presentes" className="py-16 sm:py-24 bg-[#F4EFEB] border-t border-[#EADBCE]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#A95339] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#C86D51]" />
            <span>Lista de Presentes Inteligente</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-[#2D2A26] mb-4 text-balance">
            Minha casa precisa de vocês 😂
          </h2>

          <p className="text-base sm:text-lg text-[#68625B] leading-relaxed">
            Não existe inauguração de casa nova sem aquela ajudinha básica para transformar quatro paredes em um lar. Então preparei uma lista flexível de coisas que vão me ajudar nessa missão — de panelas a cotas de sobrevivência!
          </p>
        </div>

        {/* Filter Bar & Search */}
        <div className="space-y-4 mb-10">
          
          {/* Interactive Search Bar */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A59E95]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="O que você está procurando? (Ex: geladeira, sofá, taças...)"
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] focus:bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 text-sm text-[#2D2A26] placeholder-[#8E867E] outline-none transition-all shadow-2xs"
            />
          </div>

          {/* Interactive Segmented Category Filter Buttons */}
          <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`h-9 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#C86D51] text-white shadow-xs'
                      : 'bg-[#FAF8F5] text-[#68625B] hover:text-[#2D2A26] border border-[#EADBCE]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

        </div>

        {/* Gifts Grid */}
        {filteredGifts.length === 0 ? (
          <div className="text-center py-16 bg-[#FAF8F5] rounded-3xl border border-[#EADBCE] p-8">
            <GiftIcon className="w-10 h-10 text-[#C86D51] mx-auto mb-3 opacity-60" />
            <p className="font-serif text-lg font-medium text-[#2D2A26]">
              Nenhum presente encontrado nessa categoria
            </p>
            <p className="text-xs text-[#68625B] mt-1">
              Tente buscar por outro termo ou selecione a categoria "Todos".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {filteredGifts.map((gift) => {
              const isSoldOut = gift.status === 'sold_out' || gift.availableQuantity <= 0;
              const hasExternalLink = !!gift.purchaseUrl;
              const isPixType = gift.type === 'pix' || (gift.pixKey && !hasExternalLink);

              return (
                <div
                  key={gift.id}
                  className={`flex flex-col bg-[#FAF8F5] rounded-3xl border overflow-hidden transition-all duration-200 ${
                    isSoldOut
                      ? 'border-[#EADBCE] opacity-80'
                      : 'border-[#EADBCE] hover:border-[#D5C6BA] hover:shadow-md'
                  }`}
                >
                  {/* Photo Container */}
                  <div className="relative aspect-[16/10] bg-[#EFE8DF] overflow-hidden">
                    {gift.imageUrl ? (
                      <img
                        src={gift.imageUrl}
                        alt={gift.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isSoldOut ? 'grayscale-40' : 'hover:scale-105'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAF8F5] text-[#C86D51] p-4 text-center">
                        <GiftIcon className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs text-[#7D756C]">Foto em breve</span>
                      </div>
                    )}

                    {/* Sold out overlay tag or Category text */}
                    {isSoldOut ? (
                      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
                        <div className="bg-[#FAF8F5] text-[#2D2A26] px-4 py-2 rounded-xl text-xs font-semibold tracking-wide shadow-md flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#8A9A86]" />
                          <span>PRESENTE GARANTIDO! 🎉</span>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute bottom-2.5 left-2.5 bg-black/50 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-md">
                        {gift.category.charAt(0).toUpperCase() + gift.category.slice(1)}
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Name */}
                      <h3 className="font-serif text-lg font-medium text-[#2D2A26] leading-snug mb-2">
                        {gift.name}
                      </h3>

                      {/* Description */}
                      <p className="text-xs sm:text-sm text-[#68625B] leading-relaxed line-clamp-3 mb-4">
                        {gift.description}
                      </p>
                    </div>

                    <div>
                      {/* Price & Quotas Info */}
                      <div className="pt-3 border-t border-[#EADBCE] mb-4 flex items-baseline justify-between">
                        <div>
                          <span className="text-xs text-[#7D756C] block">Valor sugerido</span>
                          <span className="font-serif text-xl font-semibold text-[#2D2A26] tabular-nums">
                            R$ {gift.price.toLocaleString('pt-BR')}
                            {gift.totalQuantity > 1 && (
                              <span className="text-xs font-sans text-[#7D756C] font-normal"> / cota</span>
                            )}
                          </span>
                        </div>

                        {/* Quotas status */}
                        <div className="text-right">
                          <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                            Disponibilidade
                          </span>
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              isSoldOut ? 'text-stone-400' : 'text-[#A95339]'
                            }`}
                          >
                            {isSoldOut
                              ? 'Esgotado'
                              : `${gift.availableQuantity} de ${gift.totalQuantity} cotas`}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {isSoldOut ? (
                        <div className="w-full h-11 rounded-xl bg-[#EFE8DF] text-[#7D756C] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                          <span>Presente já garantido ❤️</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={() => onSelectGift(gift)}
                            className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Heart className="w-4 h-4 fill-white" />
                            <span>Quero presentear com isso</span>
                          </button>

                          {hasExternalLink && (
                            <a
                              href={gift.purchaseUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="w-full h-9 rounded-xl bg-white hover:bg-[#FAF8F5] border border-[#EADBCE] text-[#68625B] hover:text-[#2D2A26] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#C86D51]" />
                              <span>Ver produto na loja</span>
                            </a>
                          )}

                          {isPixType && (
                            <button
                              onClick={() => onSelectGift(gift)}
                              className="w-full h-9 rounded-xl bg-[#FAF8F5] hover:bg-[#F0E6DE] text-[#A95339] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Presentear via Pix / QR Code</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
