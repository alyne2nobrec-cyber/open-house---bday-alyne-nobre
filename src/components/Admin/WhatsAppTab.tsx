import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare,
  Search,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Phone,
  PhoneOff,
  UserCheck,
  Clock,
  UserX,
  Gift as GiftIcon,
  CheckCheck,
  Send,
  Edit2,
  X,
  AlertCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { Guest, GiftReservation, EventSettings, GuestStatus } from '../../types';
import { formatWhatsappUrl, formatPhoneDisplay, isValidWhatsappNumber } from '../../utils/phone';
import { updateGuest } from '../../services/guestService';

interface WhatsAppTabProps {
  guests: Guest[];
  reservations: GiftReservation[];
  settings: EventSettings;
}

type TemplateType =
  | 'rsvp_invite'
  | 'rsvp_reminder'
  | 'event_details'
  | 'gift_registry'
  | 'gift_thanks'
  | 'custom';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'declined' | 'with_gifts';
type PhoneFilter = 'all' | 'has_phone' | 'no_phone';
type SendStatusFilter = 'all' | 'not_sent' | 'sent';

const STORAGE_SENT_KEY = 'alyne_whatsapp_sent_guests';

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({
  guests,
  reservations,
  settings,
}) => {
  // 1. Sent status tracking (persisted in localStorage)
  const [sentIds, setSentIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SENT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveSentIds = (next: string[]) => {
    setSentIds(next);
    try {
      localStorage.setItem(STORAGE_SENT_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save sent IDs to localStorage', e);
    }
  };

  const toggleSentStatus = (id: string) => {
    const next = sentIds.includes(id)
      ? sentIds.filter((item) => item !== id)
      : [...sentIds, id];
    saveSentIds(next);
  };

  const handleClearSentHistory = () => {
    if (confirm('Deseja zerar o histórico de mensagens enviadas desta sessão?')) {
      saveSentIds([]);
    }
  };

  // 2. Templates definitions
  const defaultTemplates: Record<TemplateType, { title: string; defaultText: string }> = {
    rsvp_invite: {
      title: 'Convite Oficial & RSVP',
      defaultText:
        'Oi, {primeiro_nome}! Tudo bem? 🏠✨\n\nEstou muito feliz em te convidar para o meu Open House & Aniversário de Casa Nova! Vai ser um momento super especial e quero muito comemorar com você.\n\nPor favor, confirme sua presença pelo link abaixo:\n👉 {link_rsvp}\n\nConto com você! 💕',
    },
    rsvp_reminder: {
      title: 'Lembrete de Confirmação (RSVP Pendente)',
      defaultText:
        'Oi, {primeiro_nome}! Tudo bem por aí? 💖\n\nPassando só para te lembrar com muito carinho de confirmar sua presença no meu Open House! Estou organizando as comidinhas e bebidas e me ajuda muito saber se você vem.\n\nVocê pode confirmar rapidinho por aqui:\n👉 {link_rsvp}\n\nTe espero! ✨',
    },
    event_details: {
      title: 'Detalhes & Localização (Para Confirmados)',
      defaultText:
        'Oi, {primeiro_nome}! 🎉\n\nO nosso encontro está chegando! Nosso Open House será no dia {data}, a partir das {horario}.\n\n📍 Local: {local}\nEndereço: {endereco}\nComo chegar (Maps): {maps}\n\nQualquer dúvida é só me chamar. Até breve! 🥂',
    },
    gift_registry: {
      title: 'Lista de Presentes & Mimos',
      defaultText:
        'Oi, {primeiro_nome}! Tudo bem? 💕\n\nAlgumas pessoas queridas me pediram sugestões de mimos e itens para a casa nova. Preparei uma listinha com muito carinho com opções e cotas Pix:\n👉 {link_presentes}\n\nSua presença já é o maior presente pra mim, mas se quiser dar uma olhadinha o link está aí! 🥰',
    },
    gift_thanks: {
      title: 'Agradecimento pelo Presente Reservado',
      defaultText:
        'Oi, {primeiro_nome}! 🥺❤️\n\nVi que você me presenteou com "{presente}" para a casa nova! Fiquei muito emocionada e feliz com todo esse carinho. Muito obrigada de coração!\n\nMal posso esperar para te dar um abraço no dia {data}! ✨',
    },
    custom: {
      title: 'Mensagem Personalizada Livre',
      defaultText:
        'Oi, {primeiro_nome}!\n\nEspero que esteja tudo bem com você!\n\nAcesse as novidades do nosso encontro: {link}\n\nUm beijo com carinho,\n{anfitriã}',
    },
  };

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('rsvp_invite');
  const [templateText, setTemplateText] = useState<string>(defaultTemplates.rsvp_invite.defaultText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectTemplate = (type: TemplateType) => {
    setSelectedTemplate(type);
    setTemplateText(defaultTemplates[type].defaultText);
  };

  // 3. Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>('all');
  const [sendStatusFilter, setSendStatusFilter] = useState<SendStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 4. Quick Phone Edit Modal
  const [editingGuestPhone, setEditingGuestPhone] = useState<Guest | null>(null);
  const [phoneInputValue, setPhoneInputValue] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  // 5. Feedback banner
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setCopiedFeedback(msg);
    setTimeout(() => setCopiedFeedback(null), 3000);
  };

  // Base public site URL
  const publicBaseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      // If running on localhost or ais-dev, still provide fallback or current origin
      return window.location.origin;
    }
    return 'https://open-house-bday-alyne-nobre.vercel.app';
  }, []);

  // Formatted date string
  const formattedEventDate = useMemo(() => {
    if (!settings.eventDate) return 'Data a confirmar';
    try {
      const [year, month, day] = settings.eventDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return settings.eventDate;
    }
  }, [settings.eventDate]);

  // Helper to normalize names for loose comparison (removes accents, multiple spaces)
  const normalizeText = (text?: string): string => {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper to get raw phone digits stripped of any formatting and country code 55
  const getPhoneSuffix = (phone?: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 12 && digits.startsWith('55')) {
      return digits.slice(2);
    }
    return digits;
  };

  // Helper to match all reservations belonging to a guest
  const getReservationsForGuest = (guest: Guest): GiftReservation[] => {
    const gNormName = normalizeText(guest.name);
    const gPhoneSuffix = getPhoneSuffix(guest.whatsapp);
    const gFirstName = gNormName.split(' ')[0] || '';

    return reservations.filter((r) => {
      // 1. Check exact or trimmed name match
      const rNormName = normalizeText(r.guestName);
      if (rNormName && gNormName && rNormName === gNormName) {
        return true;
      }

      // 2. Check phone match (ignoring +55 prefix or formatting)
      const rPhoneSuffix = getPhoneSuffix(r.guestWhatsapp);
      if (
        gPhoneSuffix.length >= 8 &&
        rPhoneSuffix.length >= 8 &&
        (gPhoneSuffix === rPhoneSuffix ||
          gPhoneSuffix.endsWith(rPhoneSuffix) ||
          rPhoneSuffix.endsWith(gPhoneSuffix))
      ) {
        return true;
      }

      // 3. Check name containment (e.g. "Lucas" matches "Lucas Ferreira", or "The" / "Thé" nickname matches full name)
      if (gNormName.length >= 3 && rNormName.length >= 3) {
        if (gNormName.includes(rNormName) || rNormName.includes(gNormName)) {
          return true;
        }
      }

      // 4. First name match if at least 3 characters and unique
      if (gFirstName.length >= 3) {
        const rFirstName = rNormName.split(' ')[0] || '';
        if (rFirstName === gFirstName) {
          // If first names match, check if phone partially matches or if no conflicting full name
          if (rPhoneSuffix && gPhoneSuffix) {
            return gPhoneSuffix.slice(-6) === rPhoneSuffix.slice(-6);
          }
          return true;
        }
      }

      return false;
    });
  };

  // Generator of personalized message for a guest
  const generateMessageForGuest = (guest: Guest): string => {
    const rawName = guest.name.trim();
    const firstName = rawName.split(' ')[0] || rawName;
    const reserved = getReservationsForGuest(guest);
    const giftsString = reserved.length > 0
      ? reserved.map((r) => `${r.giftName}${r.quantity > 1 ? ` (${r.quantity}x)` : ''}`).join(', ')
      : 'um presente super especial';

    let msg = templateText;
    msg = msg.replace(/\{primeiro_nome\}/gi, firstName);
    msg = msg.replace(/\{nome\}/gi, firstName);
    msg = msg.replace(/\{nome_completo\}/gi, rawName);
    msg = msg.replace(/\{evento\}/gi, settings.eventName || 'Open House & Aniversário');
    msg = msg.replace(/\{anfitriã\}|\{anfitria\}/gi, settings.hostName || 'Alyne');
    msg = msg.replace(/\{data\}/gi, formattedEventDate);
    msg = msg.replace(/\{horario\}/gi, settings.eventTime || '17:00');
    msg = msg.replace(/\{local\}/gi, settings.locationName || 'Nosso Novo Lar');
    msg = msg.replace(/\{endereco\}/gi, settings.locationAddress || '');
    msg = msg.replace(/\{maps\}/gi, settings.googleMapsUrl || `${publicBaseUrl}/#local`);
    msg = msg.replace(/\{link\}/gi, publicBaseUrl);
    msg = msg.replace(/\{link_rsvp\}/gi, `${publicBaseUrl}/#rsvp`);
    msg = msg.replace(/\{link_presentes\}/gi, `${publicBaseUrl}/#presentes`);
    msg = msg.replace(/\{presente\}/gi, giftsString);

    return msg;
  };

  // Insert tag into textarea
  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setTemplateText((prev) => prev + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = templateText.substring(0, start);
    const after = templateText.substring(end);
    const nextText = `${before}${tag}${after}`;
    setTemplateText(nextText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Filtered guest list
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      // 1. Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.whatsapp || '').includes(searchQuery);

      if (!matchesSearch) return false;

      // 2. RSVP status filter
      if (statusFilter === 'confirmed' && g.status !== 'confirmed') return false;
      if (statusFilter === 'pending' && g.status !== 'pending') return false;
      if (statusFilter === 'declined' && g.status !== 'declined') return false;
      if (statusFilter === 'with_gifts') {
        const hasGifts = getReservationsForGuest(g).length > 0;
        if (!hasGifts) return false;
      }

      // 3. Phone filter
      const hasValidPhone = isValidWhatsappNumber(g.whatsapp);
      if (phoneFilter === 'has_phone' && !hasValidPhone) return false;
      if (phoneFilter === 'no_phone' && hasValidPhone) return false;

      // 4. Send status filter
      const isSent = sentIds.includes(g.id);
      if (sendStatusFilter === 'sent' && !isSent) return false;
      if (sendStatusFilter === 'not_sent' && isSent) return false;

      return true;
    });
  }, [
    guests,
    searchQuery,
    statusFilter,
    phoneFilter,
    sendStatusFilter,
    sentIds,
    reservations,
  ]);

  // Overall counts
  const totalGuests = guests.length;
  const validPhoneGuests = guests.filter((g) => isValidWhatsappNumber(g.whatsapp)).length;
  const sentCount = guests.filter((g) => sentIds.includes(g.id)).length;
  const pendingPhoneGuests = guests.filter(
    (g) => isValidWhatsappNumber(g.whatsapp) && !sentIds.includes(g.id)
  );

  // Next guest in line to message
  const nextPendingGuest = pendingPhoneGuests[0] || null;

  // Actions
  const handleOpenWhatsapp = (guest: Guest) => {
    const text = generateMessageForGuest(guest);
    const url = formatWhatsappUrl(guest.whatsapp || '', text);
    if (!url) return;

    // Auto mark as sent
    if (!sentIds.includes(guest.id)) {
      saveSentIds([...sentIds, guest.id]);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyMessage = async (guest: Guest) => {
    const text = generateMessageForGuest(guest);
    try {
      await navigator.clipboard.writeText(text);
      showFeedback(`Mensagem para ${guest.name.split(' ')[0]} copiada!`);
    } catch {
      showFeedback('Não foi possível copiar automaticamente.');
    }
  };

  const handleCopyAllPhones = async () => {
    const phones = guests
      .filter((g) => isValidWhatsappNumber(g.whatsapp))
      .map((g) => formatPhoneDisplay(g.whatsapp || ''))
      .join('\n');

    try {
      await navigator.clipboard.writeText(phones);
      showFeedback(`${validPhoneGuests} telefones copiados para a área de transferência!`);
    } catch {
      showFeedback('Erro ao copiar telefones.');
    }
  };

  // Save edited phone
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuestPhone) return;

    setSavingPhone(true);
    try {
      const cleanPhone = phoneInputValue.trim();
      await updateGuest(editingGuestPhone.id, { whatsapp: cleanPhone });
      showFeedback(`Telefone de ${editingGuestPhone.name} atualizado!`);
      setEditingGuestPhone(null);
      setPhoneInputValue('');
    } catch (err: any) {
      alert('Erro ao atualizar telefone: ' + (err?.message || 'Tente novamente'));
    } finally {
      setSavingPhone(false);
    }
  };

  // Sample guest for live preview
  const sampleGuest = useMemo(() => {
    if (filteredGuests.length > 0) return filteredGuests[0];
    if (guests.length > 0) return guests[0];
    return {
      id: 'preview',
      name: 'Camila Santos',
      whatsapp: '11987654321',
      maxCompanions: 1,
      attendees: 1,
      companions: [],
      status: 'pending' as GuestStatus,
    };
  }, [filteredGuests, guests]);

  const previewMessageText = useMemo(() => {
    return generateMessageForGuest(sampleGuest);
  }, [templateText, sampleGuest, settings, formattedEventDate, publicBaseUrl]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
              Comunicação por WhatsApp
            </h2>
            <span className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-emerald-600" />
              Envio 1-a-1 Seguro
            </span>
          </div>
          <p className="text-xs text-[#68625B] mt-1 max-w-2xl">
            Envie convites oficiais, lembretes de confirmação e agradecimentos personalizados com 1 clique direto no WhatsApp Web ou Celular, sem risco de bloqueio de número.
          </p>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-2">
          {nextPendingGuest && (
            <button
              onClick={() => handleOpenWhatsapp(nextPendingGuest)}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              title={`Chamar ${nextPendingGuest.name}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Chamar Próximo ({nextPendingGuest.name.split(' ')[0]})</span>
            </button>
          )}

          <button
            onClick={handleCopyAllPhones}
            className="h-9 px-3 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copiar lista de telefones válidos para bloco de notas"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copiar Telefones</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {copiedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2 transition-all">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{copiedFeedback}</span>
        </div>
      )}

      {/* Progress & Stats Card */}
      <div className="bg-white border border-[#EADBCE] rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <span className="text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider block">
              Progresso dos Envios nesta Sessão
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-serif text-2xl font-bold text-[#2D2A26] tabular-nums">
                {sentCount}
              </span>
              <span className="text-xs text-[#7D756C]">
                de {validPhoneGuests} contatos com WhatsApp chamados ({validPhoneGuests > 0 ? Math.round((sentCount / validPhoneGuests) * 100) : 0}%)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#7D756C]">
              {totalGuests - validPhoneGuests} convidados sem WhatsApp válido
            </span>
            {sentCount > 0 && (
              <button
                onClick={handleClearSentHistory}
                className="text-[11px] font-semibold text-[#C86D51] hover:underline flex items-center gap-1 cursor-pointer"
                title="Zerar marcações de mensagens enviadas"
              >
                <RotateCcw className="w-3 h-3" />
                Resetar progresso
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-[#F4EFEB] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{
              width: `${validPhoneGuests > 0 ? (sentCount / validPhoneGuests) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Template & Editor Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Template Selector & Message Editor */}
        <div className="lg:col-span-7 bg-white border border-[#EADBCE] rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#7D756C] mb-2">
              1. Escolha o Modelo da Mensagem
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(defaultTemplates) as TemplateType[]).map((tKey) => {
                const tmpl = defaultTemplates[tKey];
                const isSelected = selectedTemplate === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => handleSelectTemplate(tKey)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#C86D51] bg-[#FAF3F0] text-[#2D2A26] font-semibold'
                        : 'border-[#EADBCE] bg-[#FAF8F5] text-[#68625B] hover:bg-[#F4EFEB] hover:text-[#2D2A26]'
                    }`}
                  >
                    <div className="truncate">{tmpl.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#7D756C]">
                2. Edite o Texto da Mensagem
              </label>
              <button
                type="button"
                onClick={() => setTemplateText(defaultTemplates[selectedTemplate].defaultText)}
                className="text-[10px] font-semibold text-[#C86D51] hover:underline cursor-pointer"
              >
                Restaurar padrão
              </button>
            </div>

            <textarea
              ref={textareaRef}
              rows={8}
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-[#EADBCE] bg-[#FAF8F5] text-xs text-[#2D2A26] outline-none font-sans leading-relaxed resize-y focus:border-[#C86D51] focus:bg-white transition-colors"
              placeholder="Digite o texto da mensagem..."
            />

            {/* Quick Variable Insert Tags */}
            <div className="mt-2.5">
              <span className="text-[10px] font-semibold text-[#7D756C] uppercase tracking-wider block mb-1.5">
                Clique para inserir variáveis automáticas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{primeiro_nome}', label: 'Primeiro Nome' },
                  { tag: '{data}', label: 'Data da Festa' },
                  { tag: '{horario}', label: 'Horário' },
                  { tag: '{local}', label: 'Local' },
                  { tag: '{endereco}', label: 'Endereço' },
                  { tag: '{link_rsvp}', label: 'Link RSVP' },
                  { tag: '{link_presentes}', label: 'Link Presentes' },
                  { tag: '{presente}', label: 'Nome do Presente' },
                ].map(({ tag, label }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="h-6 px-2 rounded-md bg-[#F4EFEB] hover:bg-[#EADBCE] text-[10px] font-mono font-medium text-[#2D2A26] border border-[#EADBCE] transition-colors cursor-pointer"
                  >
                    +{label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live WhatsApp Chat Bubble Preview */}
        <div className="lg:col-span-5 bg-white border border-[#EADBCE] rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#EADBCE]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  A
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#2D2A26]">
                    Prévia no WhatsApp
                  </h3>
                  <span className="text-[10px] text-[#7D756C]">
                    Exemplo para: <strong>{sampleGuest.name}</strong>
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                wa.me pronto
              </span>
            </div>

            {/* Simulated Chat Window */}
            <div className="mt-4 p-4 rounded-xl bg-[#EFEAE2] border border-[#DDD6CE] min-h-[220px] flex flex-col justify-end relative overflow-hidden">
              {/* Subtle WhatsApp wallpaper doodle effect */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(#000 1px, transparent 1px), radial-gradient(#000 1px, #EFEAE2 1px)',
                  backgroundSize: '20px 20px',
                }}
              />

              {/* Chat Bubble */}
              <div className="relative self-end max-w-[95%] bg-[#DCF8C6] text-[#2D2A26] rounded-2xl rounded-tr-xs p-3 text-xs leading-relaxed shadow-xs whitespace-pre-wrap font-sans border border-[#c4e8a9]">
                {previewMessageText}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#557755]">
                  <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#EADBCE] text-[11px] text-[#7D756C] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C86D51] shrink-0" />
            <span>
              Ao clicar no botão verde de cada convidado, o WhatsApp abre automaticamente com este texto preenchido.
            </span>
          </div>
        </div>
      </div>

      {/* Guest List & Sending Conveyor Belt */}
      <div className="bg-white border border-[#EADBCE] rounded-2xl shadow-2xs overflow-hidden">
        {/* Controls and Filters Header */}
        <div className="p-4 sm:p-5 border-b border-[#EADBCE] bg-[#FAF8F5] space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#7D756C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar convidado por nome ou telefone..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none focus:border-[#C86D51]"
              />
            </div>

            <div className="text-xs text-[#7D756C]">
              Mostrando <strong>{filteredGuests.length}</strong> de <strong>{guests.length}</strong> convidados
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {/* Status RSVP */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EADBCE]">
              <span className="text-[10px] font-semibold text-[#7D756C] px-2 uppercase">RSVP:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Pendentes
              </button>
              <button
                onClick={() => setStatusFilter('confirmed')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'confirmed'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Confirmados
              </button>
              <button
                onClick={() => setStatusFilter('declined')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'declined'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Ausentes
              </button>
              <button
                onClick={() => setStatusFilter('with_gifts')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'with_gifts'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Com Presentes
              </button>
            </div>

            {/* Phone Filter */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EADBCE]">
              <span className="text-[10px] font-semibold text-[#7D756C] px-2 uppercase">Telefone:</span>
              <button
                onClick={() => setPhoneFilter('all')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  phoneFilter === 'all'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setPhoneFilter('has_phone')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  phoneFilter === 'has_phone'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Com WhatsApp
              </button>
              <button
                onClick={() => setPhoneFilter('no_phone')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  phoneFilter === 'no_phone'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Sem WhatsApp
              </button>
            </div>

            {/* Sent Status */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EADBCE]">
              <span className="text-[10px] font-semibold text-[#7D756C] px-2 uppercase">Envio:</span>
              <button
                onClick={() => setSendStatusFilter('all')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  sendStatusFilter === 'all'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSendStatusFilter('not_sent')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  sendStatusFilter === 'not_sent'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Não chamados
              </button>
              <button
                onClick={() => setSendStatusFilter('sent')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  sendStatusFilter === 'sent'
                    ? 'bg-[#C86D51] text-white'
                    : 'text-[#68625B] hover:text-[#2D2A26]'
                }`}
              >
                Já chamados
              </button>
            </div>
          </div>
        </div>

        {/* Guests Table / List */}
        <div className="overflow-x-auto">
          {filteredGuests.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#7D756C] space-y-2">
              <MessageSquare className="w-8 h-8 text-[#A59E95] mx-auto opacity-50" />
              <p className="font-medium text-[#2D2A26]">Nenhum convidado encontrado com os filtros selecionados.</p>
              <p>Tente ajustar a busca ou os filtros acima.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EADBCE] bg-[#FAF8F5] text-[11px] font-semibold uppercase tracking-wider text-[#7D756C]">
                  <th className="py-3 px-4 w-12 text-center">Status</th>
                  <th className="py-3 px-4">Convidado</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">RSVP</th>
                  <th className="py-3 px-4">Presente(s)</th>
                  <th className="py-3 px-4 text-right">Ações de Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADBCE]/60">
                {filteredGuests.map((g) => {
                  const hasValidPhone = isValidWhatsappNumber(g.whatsapp);
                  const isSent = sentIds.includes(g.id);
                  const reserved = getReservationsForGuest(g);

                  return (
                    <tr
                      key={g.id}
                      className={`hover:bg-[#FAF8F5]/80 transition-colors ${
                        isSent ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Checkbox toggle sent */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSentStatus(g.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer mx-auto ${
                            isSent
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-[#DDD6CE] hover:border-[#C86D51] bg-white text-transparent'
                          }`}
                          title={isSent ? 'Marcar como não enviado' : 'Marcar como já enviado'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Guest Name & Notes */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#2D2A26]">{g.name}</div>
                        {g.notes && (
                          <div className="text-[11px] text-[#7D756C] line-clamp-1 italic">
                            "{g.notes}"
                          </div>
                        )}
                        {g.companions && g.companions.length > 0 && (
                          <div className="text-[10px] text-[#A59E95]">
                            +{g.companions.join(', ')}
                          </div>
                        )}
                      </td>

                      {/* WhatsApp phone & Quick Edit */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {hasValidPhone ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-[#2D2A26]">
                            <span>{formatPhoneDisplay(g.whatsapp || '')}</span>
                            <button
                              onClick={() => {
                                setEditingGuestPhone(g);
                                setPhoneInputValue(g.whatsapp || '');
                              }}
                              className="text-[#A59E95] hover:text-[#C86D51] p-0.5 cursor-pointer"
                              title="Editar número"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <PhoneOff className="w-3 h-3 text-amber-600" />
                              Sem WhatsApp
                            </span>
                            <button
                              onClick={() => {
                                setEditingGuestPhone(g);
                                setPhoneInputValue('');
                              }}
                              className="text-[11px] font-semibold text-[#C86D51] hover:underline cursor-pointer"
                            >
                              + Adicionar
                            </button>
                          </div>
                        )}
                      </td>

                      {/* RSVP status badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {g.status === 'confirmed' && (
                          <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                            Confirmado ({g.attendees}p)
                          </span>
                        )}
                        {g.status === 'pending' && (
                          <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                            Pendente
                          </span>
                        )}
                        {g.status === 'declined' && (
                          <span className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-medium">
                            Não vai
                          </span>
                        )}
                      </td>

                      {/* Reserved gifts */}
                      <td className="py-3 px-4">
                        {reserved.length > 0 ? (
                          <div className="flex flex-col gap-1 max-w-[240px]">
                            {reserved.map((r) => (
                              <div
                                key={r.id}
                                className="text-[11px] flex items-center gap-1.5 flex-wrap"
                                title={`${r.giftName}${r.quantity > 1 ? ` (${r.quantity} cotas)` : ''}`}
                              >
                                <span className="font-medium text-[#2D2A26] flex items-center gap-1 truncate max-w-[170px]">
                                  <GiftIcon className="w-3 h-3 text-[#C86D51] shrink-0" />
                                  {r.giftName}
                                </span>
                                {r.quantity > 1 && (
                                  <span className="text-[#A59E95] text-[10px]">({r.quantity}x)</span>
                                )}
                                <span
                                  className={`px-1 py-0.2 rounded text-[9px] font-semibold ${
                                    r.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {r.paid ? 'Pago' : 'Pendente'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#A59E95]">—</span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(g)}
                            className="h-8 px-2.5 rounded-lg border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26] flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copiar texto da mensagem deste convidado"
                          >
                            <Copy className="w-3 h-3" />
                            <span className="hidden sm:inline">Copiar</span>
                          </button>

                          {hasValidPhone ? (
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsapp(g)}
                              className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                                isSent
                                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                              title={`Abrir WhatsApp para ${g.name}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{isSent ? 'Chamar Novamente' : 'Abrir WhatsApp'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="h-8 px-3 rounded-lg text-xs font-semibold bg-[#F4EFEB] text-[#A59E95] border border-[#DDD6CE] cursor-not-allowed"
                              title="Cadastre um telefone válido primeiro"
                            >
                              Sem Número
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Quick Edit Phone Number */}
      {editingGuestPhone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setEditingGuestPhone(null)}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-3">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-lg font-medium text-[#2D2A26]">
                Editar WhatsApp de {editingGuestPhone.name}
              </h3>
              <p className="text-xs text-[#68625B] mt-1">
                Digite o DDD e o número com 10 ou 11 dígitos.
              </p>
            </div>

            <form onSubmit={handleSavePhone} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                  Número do WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  autoFocus
                  value={phoneInputValue}
                  onChange={(e) => setPhoneInputValue(e.target.value)}
                  placeholder="Ex: (11) 98765-4321"
                  className="w-full h-11 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none font-mono"
                />
                <span className="text-[10px] text-[#A59E95] mt-1 block">
                  Não utilize '00000000' ou sequências repetidas.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGuestPhone(null)}
                  className="flex-1 h-10 rounded-xl border border-[#EADBCE] bg-white text-xs font-semibold text-[#68625B] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPhone || !phoneInputValue.trim()}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {savingPhone ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
