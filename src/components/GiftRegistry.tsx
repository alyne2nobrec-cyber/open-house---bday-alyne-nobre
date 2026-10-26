import React, { useState, useMemo, useEffect } from 'react';
import { Search, Gift as GiftIcon, Heart, ExternalLink, QrCode, CheckCircle2, Sparkles, ArrowUpDown, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Gift, GiftCategory } from '../types';
import { getMemeKind, normalizeMemeUrl } from '../utils/memeMedia';

interface GiftRegistryProps {
  gifts: Gift[];
  onSelectGift: (gift: Gift) => void;
}

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'name';

const INITIAL_VISIBLE = 6;
const STEP = 6;

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
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeMemeGift, setActiveMemeGift] = useState<Gift | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const toggleDescription = (giftId: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [giftId]: !prev[giftId],
    }));
  };

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [selectedCategory, searchQuery, sortBy]);

  // Filtered and sorted gifts list
  const filteredGifts = useMemo(() => {
    const list = gifts.filter((gift) => {
      const matchCat =
        selectedCategory === 'todos' ||
        gift.category === selectedCategory ||
        (selectedCategory === 'pix' && (gift.type === 'pix' || !!gift.pixKey));

      const matchSearch =
        gift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gift.description.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchSearch;
    });

    return [...list].sort((a, b) => {
      // Prioritize available gifts over sold-out ones
      const aSoldOut = a.status === 'sold_out' || a.availableQuantity <= 0;
      const bSoldOut = b.status === 'sold_out' || b.availableQuantity <= 0;
      if (aSoldOut && !bSoldOut) return 1;
      if (!aSoldOut && bSoldOut) return -1;

      if (sortBy === 'price-asc') {
        return (a.price || 0) - (b.price || 0);
      }
      if (sortBy === 'price-desc') {
        return (b.price || 0) - (a.price || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'pt-BR');
      }
      return 0; // Default curated order
    });
  }, [gifts, selectedCategory, searchQuery, sortBy]);

  const isSearching = searchQuery.trim() !== '';
  const visibleGifts = isSearching
    ? filteredGifts
    : filteredGifts.slice(0, visibleCount);

  return (
    <section id="presentes" className="py-16 sm:py-24 bg-[#F6EBD9] border-t border-[#E8D4B8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-2 text-xs font-mono font-semibold tracking-widest uppercase text-[#CF3B25] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#CF3B25]" />
            <span>Lista de Presentes Inteligente</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1B2F4E] mb-4 text-balance">
            Minha casa precisa de vocês 😂
          </h2>

          <p className="text-base sm:text-lg text-[#4B5A72] leading-relaxed">
            Não existe inauguração de casa nova sem aquela ajudinha básica para transformar quatro paredes em um lar. Então preparei uma lista flexível de coisas que vão me ajudar nessa missão — de panelas a cotas de sobrevivência! Se quiser me presentear, fique à vontade para escolher algo da lista — e sem pressão, viu? O carinho de vocês já significa muito pra mim ❤️
          </p>

          <div className="mt-4">
            <a
              href="#rsvp"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium text-[#CF3B25] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Já sabe que vem? Confirme sua presença ↓
            </a>
          </div>
        </div>

        {/* Filter Bar, Search & Sort */}
        <div className="space-y-4 mb-10 max-w-4xl mx-auto">
          
          {/* Interactive Search Bar + Sort Selector */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6F7F97]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar presente (ex: geladeira, sofá, copos...)"
                className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] focus:bg-white focus:border-[#CF3B25] focus:ring-2 focus:ring-[#CF3B25]/15 text-sm text-[#1B2F4E] placeholder-[#5B6B82] outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
              <span className="text-xs font-mono font-medium text-[#5B6B82] flex items-center gap-1 sm:hidden">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#CF3B25]" />
                Ordenar por:
              </span>
              <div className="relative flex-1 sm:flex-initial">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Ordenar presentes por"
                  className="w-full sm:w-auto h-11 pl-9 pr-8 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-xs font-semibold text-[#1B2F4E] focus:bg-white focus:border-[#CF3B25] outline-none cursor-pointer shadow-2xs"
                >
                  <option value="default">Destaques da Alyne ✨</option>
                  <option value="price-asc">Menor Valor (R$)</option>
                  <option value="price-desc">Maior Valor (R$)</option>
                  <option value="name">Nome (A - Z)</option>
                </select>
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CF3B25] pointer-events-none" />
              </div>
            </div>
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
                      ? 'bg-[#CF3B25] text-white shadow-xs'
                      : 'bg-[#FBF4E8] text-[#4B5A72] hover:text-[#1B2F4E] border border-[#E8D4B8]'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick info: count and active sort indicator */}
          <div className="flex items-center justify-between text-xs text-[#5B6B82] px-1 pt-0.5">
            <span>
              {filteredGifts.length === 1
                ? '1 presente encontrado'
                : `${filteredGifts.length} presentes encontrados`}
            </span>
            {sortBy !== 'default' && (
              <button
                type="button"
                onClick={() => setSortBy('default')}
                className="text-[#CF3B25] hover:underline cursor-pointer font-medium"
              >
                Voltar à ordem padrão
              </button>
            )}
          </div>

        </div>

        {/* Gifts Grid */}
        {filteredGifts.length === 0 ? (
          <div className="text-center py-16 bg-[#FBF4E8] rounded-3xl border border-[#E8D4B8] p-8">
            <GiftIcon className="w-10 h-10 text-[#CF3B25] mx-auto mb-3 opacity-60" />
            <p className="font-serif text-lg font-medium text-[#1B2F4E]">
              Nenhum presente encontrado nessa categoria
            </p>
            <p className="text-xs text-[#4B5A72] mt-1">
              Tente buscar por outro termo ou selecione a categoria "Todos".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {visibleGifts.map((gift) => {
              const isUnavailable = gift.status === 'unavailable';
              const isSoldOut = !isUnavailable &&
                (gift.status === 'sold_out' || gift.availableQuantity <= 0);
              const hasExternalLink = !!gift.purchaseUrl;
              const isPixType = gift.type === 'pix' || (gift.pixKey && !hasExternalLink);

              const rawMemeUrl = (gift.memeUrl || (gift as { gifUrl?: string; gif?: string }).gifUrl || (gift as { gifUrl?: string; gif?: string }).gif || '').trim();
              const hasMeme = Boolean(rawMemeUrl && getMemeKind(rawMemeUrl) !== 'invalid');
              const memeKind = hasMeme ? getMemeKind(rawMemeUrl) : null;
              const normalizedMeme = hasMeme ? normalizeMemeUrl(rawMemeUrl) : '';

              return (
                <div
                  key={gift.id}
                  className={`flex flex-col bg-[#FBF4E8] rounded-3xl border overflow-hidden transition-all duration-200 ${
                    isSoldOut || isUnavailable
                      ? 'border-[#E8D4B8] opacity-80'
                      : 'border-[#E8D4B8] hover:border-[#DCC6A6] hover:shadow-md'
                  }`}
                >
                  {/* Photo Container */}
                  <div className="relative aspect-[16/10] bg-[#F3E3CB] overflow-hidden">
                    {hasMeme ? (
                      memeKind === 'video' ? (
                        <video
                          src={normalizedMeme}
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls={false}
                          className={`w-full h-full object-cover transition-transform duration-300 ${
                            isSoldOut || isUnavailable ? 'grayscale-40' : 'hover:scale-105'
                          }`}
                        />
                      ) : (
                        <img
                          src={normalizedMeme}
                          alt={gift.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className={`w-full h-full object-cover transition-transform duration-300 ${
                            isSoldOut || isUnavailable ? 'grayscale-40' : 'hover:scale-105'
                          }`}
                          onError={(e) => {
                            if (gift.imageUrl && (e.currentTarget as HTMLImageElement).src !== gift.imageUrl) {
                              (e.currentTarget as HTMLImageElement).src = gift.imageUrl;
                            }
                          }}
                        />
                      )
                    ) : gift.imageUrl ? (
                      <img
                        src={gift.imageUrl}
                        alt={gift.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isSoldOut || isUnavailable ? 'grayscale-40' : 'hover:scale-105'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#FBF4E8] text-[#CF3B25] p-4 text-center">
                        <GiftIcon className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs text-[#5B6B82]">Foto em breve</span>
                      </div>
                    )}

                    {/* Animated GIF badge */}
                    {hasMeme && !isSoldOut && !isUnavailable && (
                      <div className="absolute top-2.5 right-2.5 bg-[#1B2F4E]/85 backdrop-blur-xs text-[#F2B84B] font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1 border border-[#F2B84B]/30">
                        <span>GIF</span>
                      </div>
                    )}

                    {/* Sold out overlay tag or Category text */}
                    {isSoldOut ? (
                      <div className="absolute inset-0 bg-[#1B2F4E]/60 backdrop-blur-2xs flex items-center justify-center p-4">
                        <div className="bg-[#FBF4E8] text-[#1B2F4E] px-4 py-2 rounded-xl text-xs font-semibold tracking-wide shadow-md flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#8A9A86]" />
                          <span>{gift.availableQuantity <= 0 ? 'PRESENTE GARANTIDO! 🎉' : 'ESGOTADO'}</span>
                        </div>
                      </div>
                    ) : isUnavailable ? (
                      <div className="absolute inset-0 bg-[#1B2F4E]/50 backdrop-blur-2xs flex items-center justify-center p-4">
                        <div className="bg-[#FBF4E8] text-[#1B2F4E] px-4 py-2 rounded-xl text-xs font-semibold tracking-wide shadow-md">
                          INDISPONÍVEL NO MOMENTO
                        </div>
                      </div>
                    ) : (
                      <div className="absolute bottom-2.5 left-2.5 bg-[#1B2F4E]/70 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-md">
                        {gift.category.charAt(0).toUpperCase() + gift.category.slice(1)}
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Name */}
                      <h3 className="font-serif text-lg font-medium text-[#1B2F4E] leading-snug mb-2">
                        {gift.name}
                      </h3>

                      {/* Description */}
                      {(() => {
                        const isExpanded = !!expandedDescriptions[gift.id];
                        const isLong = (gift.description || '').length > 95;

                        return (
                          <div className="mb-3">
                            <p
                              className={`text-xs sm:text-sm text-[#4B5A72] leading-relaxed transition-all ${
                                !isExpanded && isLong ? 'line-clamp-3' : ''
                              }`}
                            >
                              {gift.description}
                            </p>
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => toggleDescription(gift.id)}
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#CF3B25] hover:text-[#A82D1B] transition-colors cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Ler menos</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    <span>Ler mais</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Meme badge if present */}
                      {hasMeme && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => setActiveMemeGift(gift)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FDE9E3] hover:bg-[#F7E6D0] border border-[#E8D4B8] text-xs font-semibold text-[#A82D1B] transition-colors cursor-pointer"
                          >
                            <span>😂</span>
                            <span>Ver animação ampliada</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      {/* Price & Quotas Info */}
                      <div className="pt-3 border-t border-[#E8D4B8] mb-4 flex items-baseline justify-between">
                        <div>
                          <span className="text-xs text-[#5B6B82] block">Valor sugerido</span>
                          <span className="font-serif text-xl font-semibold text-[#1B2F4E] tabular-nums">
                            R$ {gift.price.toLocaleString('pt-BR')}
                            {gift.totalQuantity > 1 && (
                              <span className="text-xs font-sans text-[#5B6B82] font-normal"> / cota</span>
                            )}
                          </span>
                        </div>

                        {/* Quotas status */}
                        <div className="text-right">
                          <span className="text-[11px] font-mono font-medium text-[#5B6B82] block uppercase tracking-wider">
                            Disponibilidade
                          </span>
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              isSoldOut || isUnavailable ? 'text-[#6F7F97]' : 'text-[#A82D1B]'
                            }`}
                          >
                            {isUnavailable
                              ? 'Indisponível'
                              : isSoldOut
                              ? 'Esgotado'
                              : `${gift.availableQuantity} de ${gift.totalQuantity} cotas`}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {isSoldOut || isUnavailable ? (
                        <div className="space-y-2">
                          <div className="w-full h-11 rounded-xl bg-[#F3E3CB] text-[#5B6B82] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                            <span>{isUnavailable ? 'Temporariamente indisponível' : 'Presente já garantido ❤️'}</span>
                          </div>

                          {isSoldOut && hasExternalLink && (
                            <button
                              type="button"
                              onClick={() => onSelectGift(gift)}
                              className="w-full h-9 rounded-xl bg-white hover:bg-[#FBF4E8] border border-[#E8D4B8] text-[#4B5A72] hover:text-[#1B2F4E] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#CF3B25]" />
                              <span>Ver link e endereço de entrega</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            onClick={() => onSelectGift(gift)}
                            className="w-full h-11 rounded-xl bg-[#CF3B25] hover:bg-[#A82D1B] text-white text-xs font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Heart className="w-4 h-4 fill-white" />
                            <span>Quero presentear com isso</span>
                          </button>

                          {hasExternalLink && (
                            <a
                              href={gift.purchaseUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="w-full h-9 rounded-xl bg-white hover:bg-[#FBF4E8] border border-[#E8D4B8] text-[#4B5A72] hover:text-[#1B2F4E] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#CF3B25]" />
                              <span>Ver produto na loja</span>
                            </a>
                          )}

                          {isPixType && (
                            <button
                              onClick={() => onSelectGift(gift)}
                              className="w-full h-9 rounded-xl bg-[#FBF4E8] hover:bg-[#F7E6D0] text-[#A82D1B] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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

        {/* Load more / Collapse controls */}
        {!isSearching && filteredGifts.length > INITIAL_VISIBLE && (
          <div className="mt-10 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-[#5B6B82] mb-3">
              Mostrando {visibleGifts.length} de {filteredGifts.length} presentes
            </p>
            {visibleCount < filteredGifts.length ? (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + STEP)}
                aria-expanded="false"
                className="h-11 px-6 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-[#A82D1B] hover:bg-[#F7E6D0] text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#CF3B25]/30"
              >
                <span>Ver mais presentes</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setVisibleCount(INITIAL_VISIBLE);
                  document.getElementById('presentes')?.scrollIntoView({ behavior: 'smooth' });
                }}
                aria-expanded="true"
                className="h-11 px-6 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-[#A82D1B] hover:bg-[#F7E6D0] text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-[#CF3B25]/30"
              >
                <span>Ver menos</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Modal / Overlay for viewing Gift Meme */}
        {activeMemeGift && (() => {
          const rawMeme = (activeMemeGift.memeUrl || (activeMemeGift as { gifUrl?: string; gif?: string }).gifUrl || (activeMemeGift as { gifUrl?: string; gif?: string }).gif || '').trim();
          if (!rawMeme || getMemeKind(rawMeme) === 'invalid') return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
              onClick={() => setActiveMemeGift(null)}
            >
              <div
                className="relative max-w-sm sm:max-w-md w-full bg-[#FBF4E8] border border-[#E8D4B8] rounded-3xl p-5 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">😂</span>
                    <h4 className="font-serif text-base font-semibold text-[#1B2F4E] truncate">
                      {activeMemeGift.name}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMemeGift(null)}
                    className="w-8 h-8 rounded-full bg-[#F6EBD9] hover:bg-[#E8D4B8] text-[#4B5A72] hover:text-[#1B2F4E] flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-2xl overflow-hidden bg-black/5 border border-[#E8D4B8] flex items-center justify-center min-h-[180px] max-h-[360px]">
                  {getMemeKind(rawMeme) === 'video' ? (
                    <video
                      src={normalizeMemeUrl(rawMeme)}
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls={false}
                      className="w-full h-auto max-h-[360px] object-contain"
                      onError={() => setActiveMemeGift(null)}
                    />
                  ) : (
                    <img
                      src={normalizeMemeUrl(rawMeme)}
                      alt={`Meme do presente ${activeMemeGift.name}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-auto max-h-[360px] object-contain"
                      onError={() => setActiveMemeGift(null)}
                    />
                  )}
                </div>

                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveMemeGift(null)}
                    className="w-full h-9 rounded-xl bg-[#F6EBD9] hover:bg-[#E8D4B8] text-xs font-semibold text-[#1B2F4E] transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </section>
  );
};
