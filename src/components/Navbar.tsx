import React, { useState } from 'react';
import { Menu, X, Gift, CalendarCheck, Home, MapPin, Lock } from 'lucide-react';

interface NavbarProps {
  onOpenAdmin: () => void;
  isAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAdmin, isAdmin }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#EADBCE]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text wordmark */}
        <a
          href="#topo"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#2D2A26] hover:text-[#C86D51] transition-colors"
        >
          Alyne Nobre
        </a>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#68625B]">
          <button
            onClick={() => scrollTo('evento')}
            className="hover:text-[#2D2A26] transition-colors cursor-pointer"
          >
            O Evento
          </button>
          <button
            onClick={() => scrollTo('presentes')}
            className="hover:text-[#2D2A26] transition-colors cursor-pointer"
          >
            Lista de Presentes
          </button>
          <button
            onClick={() => scrollTo('rsvp')}
            className="hover:text-[#2D2A26] transition-colors cursor-pointer"
          >
            Confirmar Presença
          </button>
          <button
            onClick={() => scrollTo('galeria')}
            className="hover:text-[#2D2A26] transition-colors cursor-pointer"
          >
            Novo Apê
          </button>
          <button
            onClick={() => scrollTo('local')}
            className="hover:text-[#2D2A26] transition-colors cursor-pointer"
          >
            Local
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => scrollTo('rsvp')}
            className="hidden sm:inline-flex items-center justify-center h-10 px-5 text-xs font-semibold tracking-wide uppercase text-white bg-[#C86D51] hover:bg-[#A95339] rounded-lg transition-colors shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            Confirmar Presença
          </button>

          <button
            onClick={onOpenAdmin}
            aria-label="Acessar painel administrativo"
            title="Painel Administrativo"
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[#EADBCE] text-[#68625B] hover:text-[#2D2A26] hover:bg-[#F2ECE6] transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu"
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg text-[#2D2A26] hover:bg-[#F2ECE6] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FAF8F5] border-b border-[#EADBCE] px-4 pt-3 pb-6 space-y-3">
          <button
            onClick={() => scrollTo('evento')}
            className="w-full text-left py-2.5 text-base font-medium text-[#2D2A26] flex items-center gap-3 border-b border-[#F0E6DE]"
          >
            <Home className="w-4 h-4 text-[#C86D51]" />
            O Evento
          </button>
          <button
            onClick={() => scrollTo('presentes')}
            className="w-full text-left py-2.5 text-base font-medium text-[#2D2A26] flex items-center gap-3 border-b border-[#F0E6DE]"
          >
            <Gift className="w-4 h-4 text-[#C86D51]" />
            Lista de Presentes
          </button>
          <button
            onClick={() => scrollTo('rsvp')}
            className="w-full text-left py-2.5 text-base font-medium text-[#2D2A26] flex items-center gap-3 border-b border-[#F0E6DE]"
          >
            <CalendarCheck className="w-4 h-4 text-[#C86D51]" />
            Confirmar Presença (RSVP)
          </button>
          <button
            onClick={() => scrollTo('galeria')}
            className="w-full text-left py-2.5 text-base font-medium text-[#2D2A26] flex items-center gap-3 border-b border-[#F0E6DE]"
          >
            <Home className="w-4 h-4 text-[#C86D51]" />
            Galeria do Apê
          </button>
          <button
            onClick={() => scrollTo('local')}
            className="w-full text-left py-2.5 text-base font-medium text-[#2D2A26] flex items-center gap-3"
          >
            <MapPin className="w-4 h-4 text-[#C86D51]" />
            Como Chegar
          </button>
          <div className="pt-2">
            <button
              onClick={() => scrollTo('rsvp')}
              className="w-full h-11 rounded-lg bg-[#C86D51] text-white text-sm font-semibold flex items-center justify-center shadow-xs"
            >
              Confirmar Minha Presença 🎉
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
