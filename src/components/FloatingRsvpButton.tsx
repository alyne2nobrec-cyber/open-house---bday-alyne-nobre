import React, { useState, useEffect } from 'react';

interface FloatingRsvpButtonProps {
  hidden?: boolean;
}

export const FloatingRsvpButton: React.FC<FloatingRsvpButtonProps> = ({ hidden = false }) => {
  const [heroVisible, setHeroVisible] = useState(true);
  const [rsvpVisible, setRsvpVisible] = useState(false);
  const [rsvpExists, setRsvpExists] = useState(true);

  useEffect(() => {
    const rsvpEl = document.getElementById('rsvp');
    const heroEl = document.getElementById('topo');

    if (!rsvpEl) {
      setRsvpExists(false);
      return;
    }
    setRsvpExists(true);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === 'topo') {
            setHeroVisible(entry.isIntersecting);
          } else if (entry.target.id === 'rsvp') {
            setRsvpVisible(entry.isIntersecting);
          }
        });
      },
      {
        threshold: 0.05,
      }
    );

    if (heroEl) observer.observe(heroEl);
    if (rsvpEl) observer.observe(rsvpEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!rsvpExists) return null;

  const shouldHide = hidden || heroVisible || rsvpVisible;

  const handleClick = () => {
    const rsvpEl = document.getElementById('rsvp');
    if (rsvpEl) {
      rsvpEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`fixed bottom-4 inset-x-4 z-40 sm:hidden transition-all duration-300 ease-in-out ${
        shouldHide
          ? 'opacity-0 translate-y-3 pointer-events-none'
          : 'opacity-100 translate-y-0 pointer-events-auto'
      }`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="w-full h-12 rounded-xl bg-[#C86D51] hover:bg-[#A95339] active:scale-[0.98] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#C86D51]/25 border border-white/20 transition-all cursor-pointer focus:outline-hidden"
      >
        <span>Confirmar presença 🎉</span>
      </button>
    </div>
  );
};
