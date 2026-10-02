import React from 'react';
import { Heart, Instagram, Lock } from 'lucide-react';
import { EventSettings } from '../types';

interface FooterProps {
  settings: EventSettings;
  onOpenAdmin: () => void;
  isAdmin: boolean;
}

export const Footer: React.FC<FooterProps> = ({ settings, onOpenAdmin, isAdmin }) => {
  return (
    <footer className="py-12 bg-[#FAF8F5] border-t border-[#EADBCE] text-[#7D756C] text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Left: Brand & Concept */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <span className="font-serif text-base font-medium text-[#2D2A26]">
            {settings.hostName}
          </span>
          <span className="hidden sm:inline text-[#D5C6BA]">·</span>
          <span>Open House & Bday 2026</span>
          <span className="hidden sm:inline text-[#D5C6BA]">·</span>
          <a
            href={`https://www.instagram.com/${settings.instagramHandle}/`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[#C86D51] hover:underline flex items-center gap-1"
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>@{settings.instagramHandle}</span>
          </a>
        </div>

        {/* Right: Admin login link and subtle credit */}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            Feito com <Heart className="w-3.5 h-3.5 text-[#C86D51] fill-[#C86D51]" /> para celebrar uma nova fase
          </span>
          <span className="text-[#D5C6BA]">·</span>
          <button
            onClick={onOpenAdmin}
            className="hover:text-[#2D2A26] flex items-center gap-1 transition-colors cursor-pointer"
            title="Acesso Administrativo"
          >
            <Lock className="w-3 h-3 text-[#A59E95]" />
            <span>{isAdmin ? 'Painel Admin' : 'Admin'}</span>
          </button>
        </div>

      </div>
    </footer>
  );
};
