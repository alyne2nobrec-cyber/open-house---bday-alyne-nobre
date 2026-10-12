import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  XCircle,
  Heart,
  Sparkles,
  AlertCircle,
  MessageCircle,
  Send,
} from 'lucide-react';
import { Guest, EventSettings } from '../types';
import { createGuestRsvp } from '../services/guestService';
import { subscribeEventStats } from '../services/eventStatsService';
import { formatWhatsappUrl } from '../utils/phone';

interface RsvpSectionProps {
  guests?: Guest[];
  settings?: EventSettings;
}

export const RsvpSection: React.FC<RsvpSectionProps> = ({ settings, guests }) => {
  // Form fields
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'declined'>('confirmed');
  const [attendeesCount, setAttendeesCount] = useState(1);
  const [companions, setCompanions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'confirmed' | 'declined' | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    name: string;
    attendees: number;
    companions: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Real confirmed attendees count: uses live guests list if available, falls back to eventStats
  const [confirmedPeopleCount, setConfirmedPeopleCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeEventStats((stats) => {
      setConfirmedPeopleCount(stats.confirmedPeople || 0);
    });
    return () => unsub();
  }, []);

  const effectiveConfirmedCount = useMemo(() => {
    if (guests && guests.length > 0) {
      return guests
        .filter((g) => g.status === 'confirmed')
        .reduce((sum, g) => sum + (g.attendees || 1), 0);
    }
    return confirmedPeopleCount;
  }, [guests, confirmedPeopleCount]);

  const handleAttendeesChange = (val: number) => {
    const safeCount = Math.max(1, Math.min(10, val));
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

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }

    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    if (status === 'confirmed' && attendeesCount > 1) {
      const emptyCompanions = companions.slice(0, attendeesCount - 1).some((c) => !c.trim());
      if (emptyCompanions) {
        setErrorMessage('Por favor, informe o nome de todos os acompanhantes do seu grupo.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const filteredCompanions = status === 'confirmed' ? companions.slice(0, attendeesCount - 1) : [];

      await createGuestRsvp({
        name: cleanName,
        whatsapp,
        status,
        attendees: status === 'confirmed' ? attendeesCount : 0,
        companions: filteredCompanions,
        notes: notes.trim(),
      });

      if (status === 'confirmed') {
        confetti({
          particleCount: 140,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#CF3B25', '#F2B84B', '#8A9A86', '#1B2F4E'],
        });
      }

      setSubmitted(status);
      setSubmittedData({
        name: cleanName,
        attendees: status === 'confirmed' ? attendeesCount : 0,
        companions: filteredCompanions,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível enviar a confirmação. Tente novamente.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitted(null);
    setSubmittedData(null);
    setName('');
    setWhatsapp('');
    setNotes('');
    setAttendeesCount(1);
    setCompanions([]);
    setErrorMessage('');
  };

  const hostPhone = settings?.hostWhatsapp || settings?.pixKey?.replace(/\D/g, '') || '';
  const hostWhatsappLink = formatWhatsappUrl(
    hostPhone,
    `Oi Alyne! Acabei de preencher a confirmação de presença no seu site do Open House! ${
      submitted === 'confirmed' ? 'Com certeza estarei lá comemorando com você! 🎉' : 'Infelizmente não poderei ir, mas deixei meu carinho registrado! ❤️'
    }`
  );

  return (
    <section id="rsvp" className="py-20 sm:py-28 bg-[#FBF4E8] relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3E3CB] text-[#CF3B25] font-mono text-xs font-semibold tracking-widest uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vossa Ilustríssima Presença</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1B2F4E] tracking-tight mb-4">
            Confirme sua Presença
          </h2>

          <p className="text-base text-[#4B5A72] max-w-xl mx-auto leading-relaxed">
            Sua presença é o maior presente! Por favor, confirme até{' '}
            <strong className="text-[#1B2F4E] font-semibold">10 dias antes</strong> para que eu possa planejar as comidinhas, bebidas e o espaço com todo o carinho.
          </p>

          {/* Real Confirmed Attendees Counter */}
          {effectiveConfirmedCount > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-[#E8D4B8] shadow-2xs text-xs sm:text-sm text-[#1B2F4E]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                <strong className="font-semibold text-emerald-700">{effectiveConfirmedCount}</strong>{' '}
                {effectiveConfirmedCount === 1 ? 'pessoa querida já confirmou' : 'pessoas queridas já confirmaram'} presença!
              </span>
            </div>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-[#E8D4B8] p-6 sm:p-10 shadow-xs">
          {submitted ? (
            /* Success State */
            <div className="text-center py-6 sm:py-8 space-y-5">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  submitted === 'confirmed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-[#F6EBD9] text-[#4B5A72]'
                }`}
              >
                {submitted === 'confirmed' ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : (
                  <Heart className="w-8 h-8 fill-current text-[#CF3B25]" />
                )}
              </div>

              <div>
                <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#1B2F4E]">
                  {submitted === 'confirmed' ? 'Presença Confirmada! 🎉' : 'Resposta Registrada ❤️'}
                </h3>
                <p className="text-sm text-[#4B5A72] mt-2 max-w-md mx-auto leading-relaxed">
                  {submitted === 'confirmed' ? (
                    <>
                      Obrigada por confirmar, <strong className="text-[#1B2F4E]">{submittedData?.name}</strong>! Mal posso esperar para comemorar essa nova fase com você.
                    </>
                  ) : (
                    <>
                      Poxa, <strong className="text-[#1B2F4E]">{submittedData?.name}</strong>, vamos sentir sua falta! Mas obrigada pelo carinho de avisar. Sempre que quiser etarei aqui por você!
                    </>
                  )}
                </p>
              </div>

              {submitted === 'confirmed' && submittedData && submittedData.attendees > 0 && (
                <div className="p-4 rounded-2xl bg-[#FBF4E8] border border-[#E8D4B8] text-xs text-left max-w-md mx-auto space-y-1.5">
                  <div className="flex justify-between text-[#4B5A72]">
                    <span>Total no seu grupo:</span>
                    <strong className="text-[#1B2F4E]">
                      {submittedData.attendees} {submittedData.attendees === 1 ? 'pessoa' : 'pessoas'}
                    </strong>
                  </div>
                  {submittedData.companions.length > 0 && (
                    <div className="flex justify-between text-[#4B5A72]">
                      <span>Acompanhante(s):</span>
                      <strong className="text-[#1B2F4E]">{submittedData.companions.join(', ')}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
                {hostPhone && (
                  <a
                    href={hostWhatsappLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="w-full sm:w-auto h-11 px-5 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Mandar recado no WhatsApp</span>
                  </a>
                )}

                <a
                  href="#presentes"
                  className="w-full sm:w-auto h-11 px-5 rounded-full bg-[#CF3B25] hover:bg-[#A82D1B] text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Ver Lista de Presentes</span>
                </a>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs text-[#6F7F97] hover:text-[#1B2F4E] transition-colors underline cursor-pointer"
                >
                  Enviar outra resposta ou atualizar dados
                </button>
              </div>
            </div>
          ) : (
            /* Open RSVP Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Nome Completo */}
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-1.5">
                  Seu Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Gabriela Ribeiro"
                  maxLength={80}
                  className="w-full h-12 px-4 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-sm text-[#1B2F4E] focus:bg-white focus:border-[#CF3B25] focus:ring-2 focus:ring-[#CF3B25]/15 outline-none transition-all"
                />
              </div>

              {/* 2. WhatsApp */}
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-1.5">
                  Seu WhatsApp (com DDD) *
                </label>
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  maxLength={25}
                  className="w-full h-12 px-4 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-sm text-[#1B2F4E] focus:bg-white focus:border-[#CF3B25] focus:ring-2 focus:ring-[#CF3B25]/15 outline-none transition-all font-mono"
                />
                <span className="text-[11px] text-[#6F7F97] mt-1 block">
                  Usado apenas para alinharmos detalhes e avisos sobre o evento.
                </span>
              </div>

              {/* 3. Confirmação de Presença (Sim ou Não) */}
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-2">
                  Você estará presente no evento? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStatus('confirmed')}
                    className={`h-13 px-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                      status === 'confirmed'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-[#E8D4B8] bg-[#FBF4E8] text-[#4B5A72] hover:bg-white'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${status === 'confirmed' ? 'text-emerald-700' : 'text-emerald-500'}`}
                    />
                    <span>Com certeza irei! 🎉</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('declined')}
                    className={`h-13 px-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                      status === 'declined'
                        ? 'border-stone-400 bg-stone-100 text-stone-800 shadow-xs ring-2 ring-stone-400/20'
                        : 'border-[#E8D4B8] bg-[#FBF4E8] text-[#4B5A72] hover:bg-white'
                    }`}
                  >
                    <XCircle
                      className={`w-5 h-5 ${status === 'declined' ? 'text-stone-700' : 'text-stone-400'}`}
                    />
                    <span>Infelizmente não poderei 😢</span>
                  </button>
                </div>
              </div>

              {/* 4. Se Confirmado: Quantidade de Pessoas e Acompanhantes */}
              {status === 'confirmed' && (
                <div className="space-y-4 pt-2 border-t border-[#F7E6D0]">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72]">
                        Quantas pessoas no seu grupo (incluindo você)?
                      </label>
                      <span className="text-xs font-bold text-[#CF3B25]">
                        {attendeesCount} {attendeesCount === 1 ? 'pessoa' : 'pessoas'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleAttendeesChange(num)}
                          className={`h-10 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            attendeesCount === num
                              ? 'bg-[#CF3B25] border-[#CF3B25] text-white shadow-xs'
                              : 'bg-[#FBF4E8] border-[#E8D4B8] text-[#4B5A72] hover:bg-white'
                          }`}
                        >
                          {num === 1 ? 'Apenas Eu' : `${num} pessoas`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic inputs for companions */}
                  {attendeesCount > 1 && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72]">
                        Nome dos Acompanhantes
                      </label>
                      {Array.from({ length: attendeesCount - 1 }).map((_, idx) => (
                        <div key={idx}>
                          <input
                            type="text"
                            required
                            value={companions[idx] || ''}
                            onChange={(e) => handleCompanionNameChange(idx, e.target.value)}
                            placeholder={`Nome completo do ${idx + 1}º acompanhante`}
                            maxLength={80}
                            className="w-full h-11 px-3.5 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-xs text-[#1B2F4E] focus:bg-white focus:border-[#CF3B25] outline-none transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Mensagem carinhosa ou restrição alimentar */}
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-[#4B5A72] mb-1.5">
                  Recado carinhoso para a Alyne ou restrição alimentar (opcional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Não como carne de porco / Mal posso esperar pra conhecer o apê novo e comemorar com você!"
                  maxLength={500}
                  className="w-full p-3.5 rounded-xl border border-[#E8D4B8] bg-[#FBF4E8] text-xs text-[#1B2F4E] focus:bg-white focus:border-[#CF3B25] outline-none transition-all resize-none"
                />
                <div className="text-right text-[10px] text-[#6F7F97] mt-1">
                  {notes.length}/500 caracteres
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-13 rounded-full bg-[#CF3B25] hover:bg-[#A82D1B] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold tracking-wide uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <span>Gravando sua confirmação...</span>
                ) : status === 'confirmed' ? (
                  <>
                    <Heart className="w-4 h-4 fill-white" />
                    <span>Confirmar Presença no Evento</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Resposta</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
