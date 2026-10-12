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
    <header className="sticky top-0 z-40 bg-[#FBF4E8]/90 backdrop-blur-md border-b border-[#E8D4B8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text wordmark with coral dot */}
        <a
          href="#topo"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#1B2F4E] hover:text-[#CF3B25] transition-colors flex items-center"
        >
          <span>Alyne Nobre</span>
          <span className="w-2 h-2 rounded-full bg-[#CF3B25] inline-block ml-1" aria-hidden="true" />
        </a>

        {/* Zone 2: Clean text navigation links with sun-yellow underline on hover */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4B5A72]">
          <button
            onClick={() => scrollTo('evento')}
            className="hover:text-[#1B2F4E] hover:underline hover:decoration-[#F2B84B] hover:underline-offset-4 hover:decoration-2 transition-colors cursor-pointer"
          >
            O Evento
          </button>
          <button
            onClick={() => scrollTo('presentes')}
            className="hover:text-[#1B2F4E] hover:underline hover:decoration-[#F2B84B] hover:underline-offset-4 hover:decoration-2 transition-colors cursor-pointer"
          >
            Lista de Presentes
          </button>
          <button
            onClick={() => scrollTo('rsvp')}
            className="hover:text-[#1B2F4E] hover:underline hover:decoration-[#F2B84B] hover:underline-offset-4 hover:decoration-2 transition-colors cursor-pointer"
          >
            Confirmar Presença
          </button>
          <button
            onClick={() => scrollTo('galeria')}
            className="hover:text-[#1B2F4E] hover:underline hover:decoration-[#F2B84B] hover:underline-offset-4 hover:decoration-2 transition-colors cursor-pointer"
          >
            Novo Apê
          </button>
          <button
            onClick={() => scrollTo('local')}
            className="hover:text-[#1B2F4E] hover:underline hover:decoration-[#F2B84B] hover:underline-offset-4 hover:decoration-2 transition-colors cursor-pointer"
          >
            Local
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => scrollTo('rsvp')}
            className="hidden sm:inline-flex items-center justify-center h-10 px-5 text-xs font-semibold tracking-wide uppercase text-white bg-[#CF3B25] hover:bg-[#A82D1B] rounded-full transition-colors shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            Confirmar Presença
          </button>

          <button
            onClick={onOpenAdmin}
            aria-label="Acessar painel administrativo"
            title={isAdmin ? "Painel da Anfitriã (Conectado)" : "Área da Anfitriã (Admin)"}
            className={`h-10 px-3 inline-flex items-center justify-center gap-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
              isAdmin
                ? 'bg-[#FDE9E3] border-[#CF3B25]/30 text-[#CF3B25] hover:bg-[#F3E3CB]'
                : 'border-[#E8D4B8] text-[#4B5A72] hover:text-[#1B2F4E] hover:bg-[#F6EBD9]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{isAdmin ? 'Painel' : 'Anfitriã'}</span>
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu"
            className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg text-[#1B2F4E] hover:bg-[#F6EBD9] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FBF4E8] border-b border-[#E8D4B8] px-4 pt-3 pb-6 space-y-3">
          <button
            onClick={() => scrollTo('evento')}
            className="w-full text-left py-2.5 text-base font-medium text-[#1B2F4E] flex items-center gap-3 border-b border-[#F7E6D0]"
          >
            <Home className="w-4 h-4 text-[#CF3B25]" />
            O Evento
          </button>
          <button
            onClick={() => scrollTo('presentes')}
            className="w-full text-left py-2.5 text-base font-medium text-[#1B2F4E] flex items-center gap-3 border-b border-[#F7E6D0]"
          >
            <Gift className="w-4 h-4 text-[#CF3B25]" />
            Lista de Presentes
          </button>
          <button
            onClick={() => scrollTo('rsvp')}
            className="w-full text-left py-2.5 text-base font-medium text-[#1B2F4E] flex items-center gap-3 border-b border-[#F7E6D0]"
          >
            <CalendarCheck className="w-4 h-4 text-[#CF3B25]" />
            Confirmar Presença (RSVP)
          </button>
          <button
            onClick={() => scrollTo('galeria')}
            className="w-full text-left py-2.5 text-base font-medium text-[#1B2F4E] flex items-center gap-3 border-b border-[#F7E6D0]"
          >
            <Home className="w-4 h-4 text-[#CF3B25]" />
            Galeria do Apê
          </button>
          <button
            onClick={() => scrollTo('local')}
            className="w-full text-left py-2.5 text-base font-medium text-[#1B2F4E] flex items-center gap-3"
          >
            <MapPin className="w-4 h-4 text-[#CF3B25]" />
            Como Chegar
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAdmin();
            }}
            className="w-full text-left py-2.5 text-base font-medium text-[#CF3B25] flex items-center gap-3 border-t border-[#F7E6D0] pt-3"
          >
            <Lock className="w-4 h-4 text-[#CF3B25]" />
            {isAdmin ? 'Painel da Anfitriã' : 'Área da Anfitriã (Admin)'}
          </button>
          <div className="pt-2">
            <button
              onClick={() => scrollTo('rsvp')}
              className="w-full h-11 rounded-full bg-[#CF3B25] text-white text-sm font-semibold flex items-center justify-center shadow-xs"
            >
              Confirmar Minha Presença
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
