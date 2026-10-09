import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Users,
  CheckCircle2,
  XCircle,
  Heart,
  Sparkles,
  Search,
  UserCheck,
  AlertCircle,
  MessageCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Guest, GuestStatus } from '../types';
import { confirmGuestRsvp } from '../services/guestService';

interface RsvpSectionProps {
  guests: Guest[];
}

export const RsvpSection: React.FC<RsvpSectionProps> = ({ guests }) => {
  // Step 1: Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Step 2: Confirmation form state
  const [status, setStatus] = useState<GuestStatus>('confirmed');
  const [attendeesCount, setAttendeesCount] = useState(1);
  const [companions, setCompanions] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<GuestStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Total confirmed attendees across all confirmed guests
  const confirmedPeopleCount = useMemo(() => {
    return guests
      .filter((g) => g.status === 'confirmed')
      .reduce((acc, curr) => acc + (curr.attendees || 1), 0);
  }, [guests]);

  // Normalize string for searching (removes accents, lowercase)
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Search filtered suggestions
  const searchResults = useMemo(() => {
    const q = normalize(searchTerm);
    if (!q || q.length < 2) return [];
    return guests.filter((g) => normalize(g.name).includes(q));
  }, [guests, searchTerm]);

  // When a guest is selected from search
  const handleSelectGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setSearchTerm(guest.name);
    setHasSearched(true);
    setErrorMessage('');

    // Pre-populate fields from existing guest data
    const currentStatus = guest.status === 'declined' ? 'declined' : 'confirmed';
    setStatus(currentStatus);
    setWhatsapp(guest.whatsapp || '');
    setNotes(guest.notes || '');

    const initialAttendees = Math.max(1, Math.min(1 + guest.maxCompanions, guest.attendees || 1));
    setAttendeesCount(initialAttendees);

    const neededCompanions = initialAttendees - 1;
    const existingCompanions = Array.isArray(guest.companions) ? guest.companions : [];
    const compList: string[] = [];
    for (let i = 0; i < neededCompanions; i++) {
      compList.push(existingCompanions[i] || '');
    }
    setCompanions(compList);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setHasSearched(true);

    const exactOrFirst = searchResults[0];
    if (exactOrFirst && searchResults.length === 1) {
      handleSelectGuest(exactOrFirst);
    }
  };

  // Handle attendees count change (constrained strictly by guest.maxCompanions)
  const handleAttendeesChange = (val: number) => {
    if (!selectedGuest) return;
    const maxAllowed = 1 + (selectedGuest.maxCompanions || 0);
    const safeCount = Math.max(1, Math.min(maxAllowed, val));
    setAttendeesCount(safeCount);

    const needed = safeCount - 1;
    if (needed > companions.length) {
      const extra = Array(needed - companions.length).fill('');
      setCompanions([...companions, ...extra]);
    } else {
      setCompanions(companions.slice(0, needed));
    }
  };

  const handleCompanionNameChange = (index: number, val: string) => {
    const updated = [...companions];
    updated[index] = val;
    setCompanions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedGuest) {
      setErrorMessage('Por favor, localize seu nome na lista de convidados.');
      return;
    }

    if (!whatsapp.trim() || whatsapp.replace(/\D/g, '').length < 8) {
      setErrorMessage('Por favor, informe seu WhatsApp para alinharmos os detalhes.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmGuestRsvp({
        guestId: selectedGuest.id,
        name: selectedGuest.name,
        whatsapp,
        status,
        attendees: status === 'confirmed' ? attendeesCount : 0,
        companions: status === 'confirmed' ? companions : [],
        notes,
      });

      if (status === 'confirmed') {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#C86D51', '#E8D9CE', '#8A9A86', '#D4AF37'],
        });
      }

      setSubmitted(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar confirmação.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedGuest(null);
    setSearchTerm('');
    setHasSearched(false);
    setStatus('confirmed');
    setAttendeesCount(1);
    setCompanions([]);
    setWhatsapp('');
    setNotes('');
    setSubmitted(null);
    setErrorMessage('');
  };

  return (
    <section id="rsvp" className="py-16 sm:py-24 bg-[#FAF8F5]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#A95339] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#C86D51]" />
            <span>Confirmação de Presença</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-[#2D2A26] mb-4">
            Vossa Ilustríssima Presença
          </h2>

          <p className="text-base sm:text-lg text-[#68625B] max-w-xl mx-auto leading-relaxed">
            Esse evento é super intimista e exclusivo para amigos e família. Confirme sua presença para organizarmos os quitutes e bebidas na medida certa!
          </p>

          {/* Real Counter */}
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F4EFEB] border border-[#EADBCE] text-sm text-[#464039]">
            <Users className="w-4 h-4 text-[#C86D51]" />
            <span>
              <strong className="font-semibold text-[#2D2A26] tabular-nums">{confirmedPeopleCount}</strong>{' '}
              {confirmedPeopleCount === 1 ? 'pessoa já confirmou' : 'pessoas já confirmaram'} presença!
            </span>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-3xl p-6 sm:p-10 shadow-xs">
          {/* STATE 1: Submitted view */}
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#FBF0EB] text-[#C86D51] flex items-center justify-center mx-auto mb-5">
                <Heart className="w-8 h-8 fill-[#C86D51]" />
              </div>

              {submitted === 'confirmed' ? (
                <>
                  <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#2D2A26] mb-3">
                    Presença Confirmada, {selectedGuest?.name}! 🎉
                  </h3>
                  <p className="text-base text-[#68625B] max-w-md mx-auto leading-relaxed mb-6">
                    {attendeesCount > 1
                      ? `Confirmamos você e seus acompanhantes (${attendeesCount} pessoas no total). Contando os minutos!`
                      : 'Sua presença está confirmada com carinho. Mal vejo a hora de te receber no novo lar!'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#2D2A26] mb-3">
                    Resposta Registrada! 😭
                  </h3>
                  <p className="text-base text-[#68625B] max-w-md mx-auto leading-relaxed mb-6">
                    Poxa, você fará muita falta no dia! Mas vamos marcar um café ou almoço no novo apê em outra data com certeza. ❤️
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
              >
                Voltar à consulta de convidados
              </button>
            </div>
          ) : !selectedGuest ? (
            /* STATE 2: Search guest on guest list */
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#2D2A26]">
                  Localize seu Convite
                </h3>
                <p className="text-xs sm:text-sm text-[#68625B] mt-1 max-w-md mx-auto">
                  Digite seu nome abaixo para verificar seu convite e o número de acompanhantes permitidos.
                </p>
              </div>

              <form onSubmit={handleManualSearch} className="space-y-4 max-w-lg mx-auto">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A59E95]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setHasSearched(false);
                    }}
                    placeholder="Digite seu nome (ex: Camila Santos)..."
                    className="w-full h-12 pl-10 pr-24 rounded-2xl border border-[#EADBCE] bg-[#FAF8F5] text-sm text-[#2D2A26] focus:bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-4 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>Buscar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Suggestions List */}
                {searchTerm.trim().length >= 2 && searchResults.length > 0 && (
                  <div className="bg-white border border-[#EADBCE] rounded-2xl p-2 shadow-lg space-y-1">
                    <span className="block text-[11px] font-semibold text-[#A59E95] uppercase tracking-wider px-3 py-1">
                      Convidados encontrados ({searchResults.length}):
                    </span>
                    {searchResults.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleSelectGuest(g)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#FBF0EB] flex items-center justify-between text-sm transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-[#C86D51]" />
                          <span className="font-medium text-[#2D2A26]">{g.name}</span>
                        </div>
                        <span className="text-xs text-[#7D756C]">
                          {g.maxCompanions === 0
                            ? 'Convite Individual'
                            : `+ até ${g.maxCompanions} acomp.`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Not found warning */}
                {hasSearched && searchResults.length === 0 && searchTerm.trim().length >= 2 && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">
                          Não encontramos "{searchTerm}" na lista de convidados.
                        </strong>
                        <p className="mt-1 text-amber-800 leading-relaxed">
                          Apenas pessoas com nome na lista oficial podem confirmar presença e adicionar acompanhantes.
                          Por favor, verifique se digitou o nome como está no convite ou envie uma mensagem diretamente para a Alyne no WhatsApp!
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 text-center">
                      <a
                        href="https://wa.me/5511999999999?text=Oi%20Alyne!%20Tentei%20confirmar%20presenca%20no%20seu%20Open%20House%20mas%20nao%20achei%20meu%20nome%20na%20lista."
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Falar com a Alyne no WhatsApp</span>
                      </a>
                    </div>
                  </div>
                )}
              </form>
            </div>
          ) : (
            /* STATE 3: Confirmation for selected guest */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected guest header badge */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-serif text-base font-semibold text-[#2D2A26]">
                      {selectedGuest.name}
                    </h4>
                    <p className="text-xs text-[#7D756C]">
                      {selectedGuest.maxCompanions === 0
                        ? 'Convite individual (apenas você)'
                        : `Convite válido para você + até ${selectedGuest.maxCompanions} acompanhante(s)`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-[#C86D51] hover:underline font-medium cursor-pointer"
                >
                  Trocar nome
                </button>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-2">
                  Você vai conseguir vir?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('confirmed')}
                    className={`h-12 px-4 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-medium transition-all cursor-pointer ${
                      status === 'confirmed'
                        ? 'border-[#C86D51] bg-[#FBF0EB] text-[#A95339] shadow-xs'
                        : 'border-[#EADBCE] bg-white text-[#68625B] hover:border-[#D5C6BA]'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${status === 'confirmed' ? 'text-[#C86D51]' : 'text-stone-400'}`}
                    />
                    <span>Sim, estarei presente 🎉</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('declined')}
                    className={`h-12 px-4 rounded-xl border flex items-center justify-center gap-2.5 text-sm font-medium transition-all cursor-pointer ${
                      status === 'declined'
                        ? 'border-stone-400 bg-stone-100 text-stone-700 shadow-xs'
                        : 'border-[#EADBCE] bg-white text-[#68625B] hover:border-[#D5C6BA]'
                    }`}
                  >
                    <XCircle
                      className={`w-4 h-4 ${status === 'declined' ? 'text-stone-700' : 'text-stone-400'}`}
                    />
                    <span>Infelizmente não poderei ir 😭</span>
                  </button>
                </div>
              </div>

              {/* If Confirmed: Attendees & Companions */}
              {status === 'confirmed' && (
                <div className="space-y-4 pt-2 border-t border-[#F0E6DE]">
                  {/* Total attendees dropdown / buttons */}
                  {selectedGuest.maxCompanions > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#68625B]">
                          Total de Pessoas (Você + Acompanhantes)
                        </label>
                        <span className="text-[11px] text-[#A59E95]">
                          Máximo permitido: {1 + selectedGuest.maxCompanions}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {Array.from({ length: 1 + selectedGuest.maxCompanions }).map((_, i) => {
                          const count = i + 1;
                          const isSelected = attendeesCount === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => handleAttendeesChange(count)}
                              className={`h-10 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-[#C86D51] border-[#C86D51] text-white shadow-xs'
                                  : 'bg-white border-[#EADBCE] text-[#68625B] hover:border-[#D5C6BA]'
                              }`}
                            >
                              {count === 1 ? '1 (Apenas Eu)' : `${count} pessoas`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#EADBCE] text-xs text-[#68625B] flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#C86D51]" />
                      <span>Seu convite é individual (1 pessoa confirmada).</span>
                    </div>
                  )}

                  {/* Companion names inputs */}
                  {attendeesCount > 1 && (
                    <div className="space-y-2.5 pt-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B]">
                        Nome dos Acompanhantes
                      </label>
                      {companions.map((comp, idx) => (
                        <div key={idx}>
                          <input
                            type="text"
                            required
                            value={comp}
                            onChange={(e) => handleCompanionNameChange(idx, e.target.value)}
                            placeholder={`Nome completo do acompanhante ${idx + 1}`}
                            className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] text-xs text-[#2D2A26] focus:bg-white focus:border-[#C86D51] outline-none transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Seu WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] text-xs text-[#2D2A26] focus:bg-white focus:border-[#C86D51] outline-none transition-all"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Recado para a Alyne ou restrição alimentar
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Não como carne de porco / Estou muito animada pra conhecer o apê!"
                  className="w-full p-3 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] text-xs text-[#2D2A26] focus:bg-white focus:border-[#C86D51] outline-none transition-all resize-none"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? 'Salvando confirmação...' : status === 'confirmed' ? 'Confirmar Presença 🎉' : 'Salvar Resposta 😭'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
