import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Users, CheckCircle2, XCircle, Heart, Plus, Trash2, Send, Sparkles } from 'lucide-react';
import { Guest, GuestStatus } from '../types';
import { registerRsvp } from '../services/guestService';

interface RsvpSectionProps {
  guests: Guest[];
}

export const RsvpSection: React.FC<RsvpSectionProps> = ({ guests }) => {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<GuestStatus>('confirmed');
  const [attendeesCount, setAttendeesCount] = useState(1);
  const [companions, setCompanions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<GuestStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate confirmed people total
  const confirmedPeopleCount = guests
    .filter((g) => g.status === 'confirmed')
    .reduce((acc, curr) => acc + (curr.attendees || 1), 0);

  // Update companion inputs when attendeesCount changes
  const handleAttendeesChange = (val: number) => {
    const num = Math.max(1, Math.min(6, val));
    setAttendeesCount(num);
    const needed = num - 1;
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

    if (!name.trim()) {
      setErrorMessage('Por favor, informe seu nome completo.');
      return;
    }
    if (!whatsapp.trim() || whatsapp.length < 8) {
      setErrorMessage('Por favor, informe um WhatsApp válido.');
      return;
    }

    setSubmitting(true);
    try {
      await registerRsvp({
        name,
        whatsapp,
        attendees: status === 'confirmed' ? attendeesCount : 0,
        companions: status === 'confirmed' ? companions : [],
        status,
        notes,
      });

      if (status === 'confirmed') {
        // Trigger celebratory confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#C86D51', '#E8D9CE', '#8A9A86', '#D4AF37'],
        });
      }

      setSubmitted(status);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao registrar confirmação.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setWhatsapp('');
    setStatus('confirmed');
    setAttendeesCount(1);
    setCompanions([]);
    setNotes('');
    setSubmitted(null);
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
            Antes de qualquer coisa, preciso saber se você vem. Afinal, preciso calcular comida, bebida, espaço e o tamanho do meu desespero. 😂
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

        {/* Form or Success State */}
        <div className="bg-[#FFFFFF] border border-[#EADBCE] rounded-3xl p-6 sm:p-10 shadow-xs">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#FBF0EB] text-[#C86D51] flex items-center justify-center mx-auto mb-5">
                <Heart className="w-8 h-8 fill-[#C86D51]" />
              </div>

              {submitted === 'confirmed' ? (
                <>
                  <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#2D2A26] mb-3">
                    Presença confirmadíssima!
                  </h3>
                  <p className="text-base sm:text-lg text-[#68625B] max-w-md mx-auto leading-relaxed mb-8">
                    Agora você oficialmente faz parte da bagunça. ❤️ Já comecei a gelar as bebidas!
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#2D2A26] mb-3">
                    Poxa, que pena! 😭
                  </h3>
                  <p className="text-base sm:text-lg text-[#68625B] max-w-md mx-auto leading-relaxed mb-8">
                    Você fará muita falta no dia! Mas vamos marcar um café no apê em outra data com certeza. ❤️
                  </p>
                </>
              )}

              <button
                onClick={resetForm}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
              >
                Enviar outra confirmação
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Presença Status Radio/Buttons */}
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
                    <CheckCircle2 className={`w-4 h-4 ${status === 'confirmed' ? 'text-[#C86D51]' : 'text-stone-400'}`} />
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
                    <XCircle className={`w-4 h-4 ${status === 'declined' ? 'text-stone-700' : 'text-stone-400'}`} />
                    <span>Infelizmente não poderei ir 😭</span>
                  </button>
                </div>
              </div>

              {/* Nome Completo */}
              <div>
                <label htmlFor="guest-name" className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-2">
                  Seu Nome Completo *
                </label>
                <input
                  id="guest-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Amanda Silveira"
                  className="w-full h-12 px-4 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] focus:bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26]"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label htmlFor="guest-whatsapp" className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-2">
                  Seu WhatsApp com DDD *
                </label>
                <input
                  id="guest-whatsapp"
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full h-12 px-4 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] focus:bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26]"
                />
              </div>

              {/* Quantidade de Pessoas (se confirmado) */}
              {status === 'confirmed' && (
                <div className="space-y-4 pt-2 border-t border-[#F0E6DE]">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-2">
                      Quantidade total de pessoas (você + acompanhantes)
                    </label>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleAttendeesChange(num)}
                          className={`h-11 w-14 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                            attendeesCount === num
                              ? 'border-[#C86D51] bg-[#C86D51] text-white shadow-xs'
                              : 'border-[#EADBCE] bg-[#FAF8F5] text-[#68625B] hover:border-[#D5C6BA]'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nome dos acompanhantes */}
                  {attendeesCount > 1 && (
                    <div className="space-y-2.5 pt-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B]">
                        Nome dos acompanhantes
                      </label>
                      {companions.map((compName, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={compName}
                          onChange={(e) => handleCompanionNameChange(idx, e.target.value)}
                          placeholder={`Nome do ${idx + 1}º acompanhante`}
                          className="w-full h-11 px-4 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] focus:bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26]"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Observação Opcional */}
              <div>
                <label htmlFor="guest-notes" className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-2">
                  Observações ou Recadinho para a Alyne (opcional)
                </label>
                <textarea
                  id="guest-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Restrições alimentares, drink preferido ou apenas um abraço quentinho!"
                  className="w-full p-4 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] focus:bg-white focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all text-sm text-[#2D2A26] resize-none"
                />
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                {submitting ? (
                  <span>Registrando...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirmar Minha Resposta</span>
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
