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
    <footer className="pt-12 pb-24 sm:pb-12 bg-[#FBF4E8] border-t border-[#E8D4B8] text-[#5B6B82] text-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: Brand & Concept */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span className="font-serif text-base font-medium text-[#1B2F4E]">
              {settings.hostName}
            </span>
            <span className="hidden sm:inline text-[#DCC6A6]">·</span>
            <span>Open House & Bday 2026</span>
            <span className="hidden sm:inline text-[#DCC6A6]">·</span>
            <a
              href={`https://www.instagram.com/${settings.instagramHandle}/`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[#CF3B25] hover:underline flex items-center gap-1"
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>@{settings.instagramHandle}</span>
            </a>
          </div>

          {/* Right: Admin login link and subtle credit */}
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              Feito com <Heart className="w-3.5 h-3.5 text-[#CF3B25] fill-[#CF3B25]" /> para celebrar uma nova fase
            </span>
            <span className="text-[#DCC6A6]">·</span>
            <button
              onClick={onOpenAdmin}
              className="hover:text-[#1B2F4E] flex items-center gap-1 transition-colors cursor-pointer"
              title="Acesso Administrativo"
            >
              <Lock className="w-3 h-3 text-[#6F7F97]" />
              <span>{isAdmin ? 'Painel Admin' : 'Admin'}</span>
            </button>
          </div>
        </div>

        {/* 6.3 Discrete engineering status line in DM Mono */}
        <div className="text-center sm:text-left pt-2 font-mono text-[10px] uppercase tracking-widest text-[#6F7F97]">
          v2026.11 · status: em produção
        </div>
      </div>
    </footer>
  );
};
