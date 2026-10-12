import React, { useState, useEffect, useMemo } from 'react';
import { EventSettings, Gift, Guest } from '../types';
import { subscribeEventStats } from '../services/eventStatsService';

interface PartyPanelProps {
  settings: EventSettings;
  gifts: Gift[];
  guests?: Guest[];
}

export const PartyPanel: React.FC<PartyPanelProps> = ({ settings, gifts, guests }) => {
  const [statsConfirmedPeople, setStatsConfirmedPeople] = useState(0);

  useEffect(() => {
    const unsub = subscribeEventStats((stats) => {
      setStatsConfirmedPeople(stats.confirmedPeople || 0);
    });
    return () => unsub();
  }, []);

  const confirmedPeople = useMemo(() => {
    if (guests && guests.length > 0) {
      return guests
        .filter((g) => g.status === 'confirmed')
        .reduce((sum, g) => sum + (g.attendees || 1), 0);
    }
    return statsConfirmedPeople;
  }, [guests, statsConfirmedPeople]);

  const daysRemaining = useMemo(() => {
    if (!settings.eventDate) return null;
    try {
      const [year, month, day] = settings.eventDate.split('-').map(Number);
      const targetDate = new Date(
        year,
        month - 1,
        day,
        Number(settings.eventTime?.split(':')[0] || '17'),
        Number(settings.eventTime?.split(':')[1] || '00')
      ).getTime();
      const diff = targetDate - Date.now();
      if (diff <= 0) return 0;
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }, [settings.eventDate, settings.eventTime]);

  const soldOutGifts = useMemo(() => {
    if (!gifts || gifts.length === 0) return 0;
    return gifts.filter((g) => g.status === 'sold_out').length;
  }, [gifts]);

  const showDays = daysRemaining !== null;
  const showConfirmed = confirmedPeople > 0;
  const showGifts = gifts && gifts.length > 0;

  // If nothing to display at all, keep at least the days counter
  const anyVisible = showDays || showConfirmed || showGifts;
  if (!anyVisible) return null;

  const visibleCount = (showDays ? 1 : 0) + (showConfirmed ? 1 : 0) + (showGifts ? 1 : 0);

  const gridClass =
    visibleCount === 3
      ? 'grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#FBF4E8]/15 gap-6 sm:gap-4'
      : visibleCount === 2
        ? 'grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#FBF4E8]/15 gap-6 sm:gap-4 max-w-2xl mx-auto'
        : 'grid grid-cols-1 gap-4 max-w-xs mx-auto';

  return (
    <section
      role="region"
      aria-label="Painel da festa"
      className="w-full py-6 sm:py-10 px-4 sm:px-6 relative z-10"
    >
      <div className="max-w-4xl mx-auto bg-[#1B2F4E] text-[#FBF4E8] rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 shadow-lg border border-[#F2B84B]/25 relative overflow-hidden">
        {/* Subtle decorative glow in the corner */}
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-56 h-56 bg-[#F2B84B]/10 rounded-full blur-3xl pointer-events-none"
        />

        {/* Status header indicator */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 mb-6 border-b border-[#FBF4E8]/15">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-[#F2B84B] font-medium">
              status: festa em produção
            </span>
          </div>

          <div className="font-mono text-[10px] sm:text-[11px] text-[#FBF4E8]/60 uppercase tracking-wider">
            open house &middot; dados ao vivo
          </div>
        </div>

        {/* Metrics Grid */}
        <div className={`${gridClass} text-center`}>
          {/* Metric 1: Days remaining */}
          {showDays && (
            <div className="pt-3 sm:pt-0 sm:px-4 flex flex-col items-center justify-center">
              <span className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#F2B84B] font-bold tracking-tight tabular-nums">
                {daysRemaining}
              </span>
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-[#FBF4E8]/80 mt-1.5">
                {daysRemaining === 1 ? 'dia até o open house' : 'dias até o open house'}
              </span>
            </div>
          )}

          {/* Metric 2: Confirmed attendees (only shown if > 0) */}
          {showConfirmed && (
            <div className="pt-4 sm:pt-0 sm:px-4 flex flex-col items-center justify-center">
              <span
                aria-live="polite"
                className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#F2B84B] font-bold tracking-tight tabular-nums"
              >
                {confirmedPeople}
              </span>
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-[#FBF4E8]/80 mt-1.5">
                {confirmedPeople === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}
              </span>
            </div>
          )}

          {/* Metric 3: Gift list reserved items */}
          {showGifts && (
            <div className="pt-4 sm:pt-0 sm:px-4 flex flex-col items-center justify-center">
              <div className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#F2B84B] font-bold tracking-tight tabular-nums flex items-baseline justify-center gap-1">
                <span>{soldOutGifts}</span>
                <span className="text-xl sm:text-2xl font-sans text-[#FBF4E8]/60 font-light">
                  / {gifts.length}
                </span>
              </div>
              <span className="font-mono text-[11px] sm:text-xs uppercase tracking-wider text-[#FBF4E8]/80 mt-1.5">
                {soldOutGifts === 1 ? 'item da lista reservado' : 'itens da lista reservados'}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
