import React, { useState } from 'react';
import {
  Users,
  Gift as GiftIcon,
  Heart,
  Plus,
  Link as LinkIcon,
  Search,
  Download,
  Trash2,
  Edit2,
  Copy,
  Check,
  X,
  Settings,
  Sparkles,
  LogOut,
  QrCode,
  DollarSign,
  Upload,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  UserPlus,
  ListPlus,
  UserCheck,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { Gift, GiftCategory, GiftReservation, Guest, GuestStatus, EventSettings, GiftType, GiftStatus } from '../../types';
import {
  createGift,
  updateGift,
  deleteGift,
  duplicateGift,
  seedGiftsToFirestore,
} from '../../services/giftService';
import {
  addGuest,
  addGuestsBatch,
  updateGuest,
  deleteGuest,
  importGuestsFromList,
} from '../../services/guestService';
import { updateEventSettings } from '../../services/settingsService';
import { scrapeProductFromUrl } from '../../utils/scraper';
import { parseGuestsCsv, downloadSampleGuestsCsv, ParsedCsvGuest } from '../../utils/csvGuestParser';

interface AdminDashboardProps {
  gifts: Gift[];
  guests: Guest[];
  reservations: GiftReservation[];
  settings: EventSettings;
  onClose: () => void;
  onLogout: () => void;
}

type AdminTab = 'overview' | 'gifts' | 'guests' | 'whoGaveWhat' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  gifts,
  guests,
  reservations,
  settings,
  onClose,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Gift Form Modal state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<Gift | null>(null);

  // Scraper Modal state
  const [isScraperModalOpen, setIsScraperModalOpen] = useState(false);
  const [scraperUrl, setScraperUrl] = useState('');
  const [scrapingLoading, setScrapingLoading] = useState(false);

  // Settings edit state
  const [settingsForm, setSettingsForm] = useState<EventSettings>(settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Guest search and filter
  const [guestSearch, setGuestSearch] = useState('');
  const [guestFilter, setGuestFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>('all');

  // Guest modal state
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isBatchGuestModalOpen, setIsBatchGuestModalOpen] = useState(false);
  const [editingGuestItem, setEditingGuestItem] = useState<Guest | null>(null);

  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestWhatsappInput, setGuestWhatsappInput] = useState('');
  const [guestMaxCompanionsInput, setGuestMaxCompanionsInput] = useState(1);
  const [guestStatusInput, setGuestStatusInput] = useState<GuestStatus>('pending');

  const [batchNamesInput, setBatchNamesInput] = useState('');
  const [batchDefaultMaxInput, setBatchDefaultMaxInput] = useState(1);

  // CSV Import Modal state
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [csvParsedGuests, setCsvParsedGuests] = useState<ParsedCsvGuest[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImportMode, setCsvImportMode] = useState<'append' | 'replace'>('append');
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);

  // Gift search and category filter
  const [giftSearch, setGiftSearch] = useState('');
  const [giftFilterCategory, setGiftFilterCategory] = useState<string>('all');

  // 1. Calculations for Overview
  const confirmedGuests = guests.filter((g) => g.status === 'confirmed');
  const pendingGuests = guests.filter((g) => g.status === 'pending');
  const declinedGuests = guests.filter((g) => g.status === 'declined');
  const totalPeopleCount = confirmedGuests.reduce((acc, curr) => acc + (curr.attendees || 1), 0);
  const totalGiftsCount = gifts.length;
  const soldOutGiftsCount = gifts.filter((g) => g.status === 'sold_out' || g.availableQuantity <= 0).length;
  const availableGiftsCount = totalGiftsCount - soldOutGiftsCount;
  const totalReservedQuotas = reservations.reduce((acc, r) => acc + (r.quantity || 1), 0);

  // Export CSV
  const handleExportGuestsCsv = () => {
    const headers = ['Nome', 'WhatsApp', 'Limite Acomp', 'Pessoas Confirmadas', 'Status', 'Acompanhantes', 'Observação'];
    const rows = guests.map((g) => [
      `"${g.name.replace(/"/g, '""')}"`,
      `"${g.whatsapp || ''}"`,
      g.maxCompanions,
      g.attendees,
      g.status === 'confirmed' ? 'Confirmado' : g.status === 'pending' ? 'Pendente' : 'Ausente',
      `"${g.companions?.join(', ') || ''}"`,
      `"${(g.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `convidados_openhouse_alyne_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAddGuest = () => {
    setEditingGuestItem(null);
    setGuestNameInput('');
    setGuestWhatsappInput('');
    setGuestMaxCompanionsInput(1);
    setGuestStatusInput('pending');
    setIsGuestModalOpen(true);
  };

  const handleOpenEditGuest = (guest: Guest) => {
    setEditingGuestItem(guest);
    setGuestNameInput(guest.name);
    setGuestWhatsappInput(guest.whatsapp || '');
    setGuestMaxCompanionsInput(guest.maxCompanions ?? 1);
    setGuestStatusInput(guest.status);
    setIsGuestModalOpen(true);
  };

  const handleSaveGuestForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) return;

    if (editingGuestItem) {
      await updateGuest(editingGuestItem.id, {
        name: guestNameInput.trim(),
        whatsapp: guestWhatsappInput.trim(),
        maxCompanions: Number(guestMaxCompanionsInput),
        status: guestStatusInput,
      });
    } else {
      await addGuest({
        name: guestNameInput.trim(),
        whatsapp: guestWhatsappInput.trim(),
        maxCompanions: Number(guestMaxCompanionsInput),
        status: guestStatusInput,
      });
    }
    setIsGuestModalOpen(false);
    setEditingGuestItem(null);
  };

  const handleSaveBatchGuests = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = batchNamesInput.split('\n');
    await addGuestsBatch(lines, Number(batchDefaultMaxInput));
    setBatchNamesInput('');
    setIsBatchGuestModalOpen(false);
  };

  const handleOpenCsvModal = () => {
    setCsvParsedGuests([]);
    setCsvFileName('');
    setCsvErrors([]);
    setCsvImportMode('append');
    setIsCsvImportModalOpen(true);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      const result = parseGuestsCsv(content);
      setCsvParsedGuests(result.guests);
      setCsvErrors(result.errors);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmCsvImport = async () => {
    if (csvParsedGuests.length === 0) return;
    setCsvImporting(true);
    try {
      await importGuestsFromList(csvParsedGuests, csvImportMode);
      setIsCsvImportModalOpen(false);
      setCsvParsedGuests([]);
      setCsvFileName('');
      setCsvErrors([]);
    } finally {
      setCsvImporting(false);
    }
  };

  // Gift Form Handlers
  const handleOpenNewGiftModal = () => {
    setEditingGift(null);
    setIsGiftModalOpen(true);
  };

  const handleEditGift = (gift: Gift) => {
    setEditingGift(gift);
    setIsGiftModalOpen(true);
  };

  const handleDeleteGift = async (giftId: string) => {
    if (confirm('Tem certeza que deseja excluir este presente?')) {
      await deleteGift(giftId);
    }
  };

  const handleDuplicateGift = async (gift: Gift) => {
    await duplicateGift(gift);
  };

  const handleToggleStatus = async (gift: Gift) => {
    const nextStatus: GiftStatus =
      gift.status === 'available' ? 'unavailable' : gift.status === 'unavailable' ? 'sold_out' : 'available';
    await updateGift(gift.id, { status: nextStatus });
  };

  // Scraper action
  const handleScrapeProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scraperUrl.trim()) return;

    setScrapingLoading(true);
    try {
      const scraped = await scrapeProductFromUrl(scraperUrl.trim());
      setIsScraperModalOpen(false);
      setScraperUrl('');

      const category = (scraped.category as GiftCategory) || 'cozinha';

      // Open new gift modal prefilled
      setEditingGift({
        id: '',
        name: scraped.name,
        description: scraped.description,
        category,
        imageUrl: scraped.imageUrl,
        type: 'product',
        price: scraped.price || 150,
        totalQuantity: 1,
        availableQuantity: 1,
        reservedQuantity: 0,
        purchaseUrl: scraped.purchaseUrl,
        status: 'available',
      });
      setIsGiftModalOpen(true);
    } catch (err: unknown) {
      console.error('Error importing product:', err);
      alert('Não foi possível importar automaticamente as informações deste link. Você pode preencher manualmente!');
    } finally {
      setScrapingLoading(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateEventSettings(settingsForm);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handlePixQrCodeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettingsForm((prev) => ({ ...prev, pixQrCodeUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtered Guests
  const filteredGuests = guests.filter((g) => {
    const matchSearch =
      g.name.toLowerCase().includes(guestSearch.toLowerCase()) ||
      (g.whatsapp || '').includes(guestSearch);
    const matchFilter =
      guestFilter === 'all' ||
      (guestFilter === 'confirmed' && g.status === 'confirmed') ||
      (guestFilter === 'pending' && g.status === 'pending') ||
      (guestFilter === 'declined' && g.status === 'declined');
    return matchSearch && matchFilter;
  });

  // Filtered Gifts for Table
  const filteredGifts = gifts.filter((g) => {
    const matchSearch =
      g.name.toLowerCase().includes(giftSearch.toLowerCase()) ||
      g.description.toLowerCase().includes(giftSearch.toLowerCase());
    const matchCat = giftFilterCategory === 'all' || g.category === giftFilterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF8F5] overflow-y-auto flex flex-col">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EADBCE] px-4 sm:px-6 h-16 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center font-serif font-bold text-sm">
            AN
          </div>
          <div>
            <h1 className="font-serif text-lg font-medium text-[#2D2A26] leading-none">
              Painel Administrativo
            </h1>
            <span className="text-[11px] text-[#7D756C]">
              Open House & Chá de Casa Nova • Alyne Nobre
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg border border-[#EADBCE] text-xs font-semibold text-[#68625B] hover:text-[#2D2A26] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
          >
            Ver Site Público
          </button>

          <button
            onClick={onLogout}
            title="Sair do painel"
            className="h-9 w-9 rounded-lg border border-[#EADBCE] text-[#68625B] hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="bg-[#FAF8F5] border-b border-[#EADBCE] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto py-2.5 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#C86D51] text-white shadow-xs'
                : 'text-[#68625B] hover:text-[#2D2A26] hover:bg-[#F4EFEB]'
            }`}
          >
            Visão Geral
          </button>

          <button
            onClick={() => setActiveTab('gifts')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'gifts'
                ? 'bg-[#C86D51] text-white shadow-xs'
                : 'text-[#68625B] hover:text-[#2D2A26] hover:bg-[#F4EFEB]'
            }`}
          >
            Gerenciar Presentes ({gifts.length})
          </button>

          <button
            onClick={() => setActiveTab('whoGaveWhat')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'whoGaveWhat'
                ? 'bg-[#C86D51] text-white shadow-xs'
                : 'text-[#68625B] hover:text-[#2D2A26] hover:bg-[#F4EFEB]'
            }`}
          >
            Quem está me presenteando? ({reservations.length})
          </button>

          <button
            onClick={() => setActiveTab('guests')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'guests'
                ? 'bg-[#C86D51] text-white shadow-xs'
                : 'text-[#68625B] hover:text-[#2D2A26] hover:bg-[#F4EFEB]'
            }`}
          >
            Convidados ({guests.length})
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`h-9 px-4 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#C86D51] text-white shadow-xs'
                : 'text-[#68625B] hover:text-[#2D2A26] hover:bg-[#F4EFEB]'
            }`}
          >
            Personalizar Evento
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        
        {/* ===================== TAB 1: VISÃO GERAL ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
                Resumo do Evento
              </h2>
              <p className="text-xs text-[#68625B]">
                Métricas atualizadas em tempo real sobre os convidados e lista de presentes.
              </p>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-2xs">
                <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                  Confirmados
                </span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-[#2D2A26] tabular-nums mt-1 block">
                  {totalPeopleCount}
                </span>
                <span className="text-[11px] text-[#A95339]">
                  {confirmedGuests.length} respostas positivas
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-2xs">
                <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                  Total Presentes
                </span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-[#2D2A26] tabular-nums mt-1 block">
                  {totalGiftsCount}
                </span>
                <span className="text-[11px] text-[#7D756C]">
                  cadastrados no total
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-2xs">
                <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                  Disponíveis
                </span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-[#8A9A86] tabular-nums mt-1 block">
                  {availableGiftsCount}
                </span>
                <span className="text-[11px] text-[#7D756C]">
                  aguardando presente
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-2xs">
                <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                  Esgotados
                </span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-[#C86D51] tabular-nums mt-1 block">
                  {soldOutGiftsCount}
                </span>
                <span className="text-[11px] text-[#7D756C]">
                  100% garantidos! 🎉
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-2xs">
                <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                  Cotas Reservadas
                </span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-[#2D2A26] tabular-nums mt-1 block">
                  {totalReservedQuotas}
                </span>
                <span className="text-[11px] text-[#A95339]">
                  {reservations.length} amigos presentearam
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-[#EADBCE] shadow-2xs">
                <span className="text-[11px] font-medium text-[#7D756C] block uppercase tracking-wider">
                  Ausentes
                </span>
                <span className="font-serif text-2xl sm:text-3xl font-semibold text-stone-400 tabular-nums mt-1 block">
                  {guests.filter((g) => g.status === 'declined').length}
                </span>
                <span className="text-[11px] text-[#7D756C]">
                  não poderão ir 😭
                </span>
              </div>
            </div>

            {/* Quick Actions & Recent Activity Bento */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Quick Actions */}
              <div className="bg-white p-6 rounded-3xl border border-[#EADBCE] shadow-2xs">
                <h3 className="font-serif text-lg font-medium text-[#2D2A26] mb-4">
                  Ações Rápidas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleOpenNewGiftModal}
                    className="h-12 px-4 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Novo Presente</span>
                  </button>

                  <button
                    onClick={() => setIsScraperModalOpen(true)}
                    className="h-12 px-4 rounded-xl border border-[#EADBCE] hover:bg-[#FAF8F5] text-[#2D2A26] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LinkIcon className="w-4 h-4 text-[#C86D51]" />
                    <span>Importar por Link</span>
                  </button>

                  <button
                    onClick={handleExportGuestsCsv}
                    className="h-12 px-4 rounded-xl border border-[#EADBCE] hover:bg-[#FAF8F5] text-[#2D2A26] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#68625B]" />
                    <span>Exportar Convidados (CSV)</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('whoGaveWhat')}
                    className="h-12 px-4 rounded-xl border border-[#EADBCE] hover:bg-[#FAF8F5] text-[#2D2A26] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Heart className="w-4 h-4 text-[#C86D51]" />
                    <span>Ver Quem Me Presenteou</span>
                  </button>
                </div>
              </div>

              {/* Recent Reservations */}
              <div className="bg-white p-6 rounded-3xl border border-[#EADBCE] shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg font-medium text-[#2D2A26]">
                    Últimas Reservas Feitas
                  </h3>
                  <button
                    onClick={() => setActiveTab('whoGaveWhat')}
                    className="text-xs text-[#C86D51] hover:underline font-medium cursor-pointer"
                  >
                    Ver todas →
                  </button>
                </div>

                {reservations.length === 0 ? (
                  <p className="text-xs text-[#7D756C] py-6 text-center">
                    Ainda não há reservas registradas. Compartilhe o link com os amigos!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reservations.slice(0, 4).map((r, i) => (
                      <div
                        key={r.id || i}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#F0E6DE]"
                      >
                        <div>
                          <strong className="text-xs font-semibold text-[#2D2A26] block">
                            {r.guestName}
                          </strong>
                          <span className="text-[11px] text-[#68625B]">
                            {r.quantity} {r.quantity > 1 ? 'cotas' : 'cota'} de <strong>{r.giftName}</strong>
                          </span>
                        </div>
                        <span className="text-[11px] text-[#A59E95]">
                          {r.guestWhatsapp}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ===================== TAB 2: GERENCIAR PRESENTES ===================== */}
        {activeTab === 'gifts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
                  Gerenciamento de Presentes
                </h2>
                <p className="text-xs text-[#68625B]">
                  Adicione, edite, exclua ou altere cotas e links de produtos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScraperModalOpen(true)}
                  className="h-10 px-3.5 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span>Por Link</span>
                </button>

                <button
                  onClick={handleOpenNewGiftModal}
                  className="h-10 px-4 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Presente</span>
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A59E95]" />
                <input
                  type="text"
                  value={giftSearch}
                  onChange={(e) => setGiftSearch(e.target.value)}
                  placeholder="Buscar presente por nome..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                />
              </div>

              <select
                value={giftFilterCategory}
                onChange={(e) => setGiftFilterCategory(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none w-full sm:w-auto"
              >
                <option value="all">Todas as Categorias</option>
                <option value="cozinha">Cozinha</option>
                <option value="sala">Sala</option>
                <option value="quarto">Quarto</option>
                <option value="banheiro">Banheiro</option>
                <option value="pix">Pix</option>
                <option value="casa">Casa</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {/* Gifts Table */}
            <div className="bg-white rounded-3xl border border-[#EADBCE] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#EADBCE] text-[#7D756C] uppercase font-semibold">
                    <tr>
                      <th className="p-4">Presente</th>
                      <th className="p-4">Categoria</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4">Cotas Disp.</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E6DE]">
                    {filteredGifts.map((gift) => (
                      <tr key={gift.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {gift.imageUrl ? (
                              <img
                                src={gift.imageUrl}
                                alt={gift.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover border border-[#EADBCE] shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center shrink-0">
                                <GiftIcon className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <strong className="font-medium text-[#2D2A26] block text-sm">
                                {gift.name}
                              </strong>
                              <span className="text-[11px] text-[#7D756C] line-clamp-1">
                                {gift.description}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 capitalize text-[#68625B]">
                          {gift.category}
                        </td>
                        <td className="p-4 font-semibold text-[#2D2A26] tabular-nums">
                          R$ {gift.price.toLocaleString('pt-BR')}
                        </td>
                        <td className="p-4 tabular-nums">
                          <div>
                            <span className="font-semibold text-[#C86D51]">
                              {gift.availableQuantity}
                            </span>{' '}
                            / {gift.totalQuantity} cotas
                          </div>
                          {(() => {
                            const giftRes = reservations.filter((r) => r.giftId === gift.id);
                            if (giftRes.length === 0) return null;
                            const isSold = gift.status === 'sold_out' || gift.availableQuantity <= 0;
                            return (
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    isSold
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-[#FAF8F5] text-[#7D756C] border border-[#EADBCE]'
                                  }`}
                                >
                                  {isSold ? 'Garantido por:' : 'Reservas:'}
                                </span>
                                {giftRes.map((r, i) => (
                                  <span
                                    key={r.id || i}
                                    title={`${r.guestName} (${r.guestWhatsapp || 'Sem tel'}) - ${r.quantity} cota(s)`}
                                    className="inline-flex items-center text-[10px] font-medium bg-[#FBF0EB] text-[#A95339] border border-[#F0E6DE] px-1.5 py-0.5 rounded"
                                  >
                                    {r.guestName} ({r.quantity})
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleStatus(gift)}
                            title="Clique para alternar status"
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                              gift.status === 'available' && gift.availableQuantity > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : gift.status === 'sold_out' || gift.availableQuantity <= 0
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {gift.status === 'available' && gift.availableQuantity > 0
                              ? 'Disponível'
                              : gift.status === 'sold_out' || gift.availableQuantity <= 0
                              ? 'Esgotado'
                              : 'Indisponível'}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleDuplicateGift(gift)}
                              title="Duplicar presente"
                              className="h-8 w-8 rounded-lg text-[#68625B] hover:text-[#2D2A26] hover:bg-[#FAF8F5] flex items-center justify-center cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditGift(gift)}
                              title="Editar presente"
                              className="h-8 w-8 rounded-lg text-[#68625B] hover:text-[#2D2A26] hover:bg-[#FAF8F5] flex items-center justify-center cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGift(gift.id)}
                              title="Excluir presente"
                              className="h-8 w-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: QUEM ME PRESENTEOU ===================== */}
        {activeTab === 'whoGaveWhat' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
                Quem está me presenteando?
              </h2>
              <p className="text-xs text-[#68625B]">
                Lista detalhada de quem reservou cotas ou presentes físicos para você agradecer depois!
              </p>
            </div>

            {reservations.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-[#EADBCE] p-8">
                <Heart className="w-10 h-10 text-[#C86D51] mx-auto mb-2 opacity-50" />
                <p className="font-serif text-lg font-medium text-[#2D2A26]">
                  Nenhum presente reservado ainda
                </p>
                <p className="text-xs text-[#7D756C] mt-1">
                  Assim que os convidados escolherem um presente, o nome e contato aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reservations.map((res, idx) => (
                  <div
                    key={res.id || idx}
                    className="bg-white p-5 rounded-2xl border border-[#EADBCE] shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-serif text-base font-semibold text-[#2D2A26]">
                          {res.guestName}
                        </h4>
                        <span className="text-xs text-[#C86D51] font-medium">
                          {res.guestWhatsapp}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#EADBCE] text-[11px] font-semibold text-[#2D2A26] tabular-nums">
                        {res.quantity} {res.quantity > 1 ? 'cotas' : 'cota'}
                      </span>
                    </div>

                    {/* Associated Gift Card with photo and details */}
                    {(() => {
                      const associatedGift = gifts.find((g) => g.id === res.giftId);
                      const displayName = res.giftName || associatedGift?.name || 'Presente Especial';
                      const isSoldOut = associatedGift?.status === 'sold_out' || (associatedGift && associatedGift.availableQuantity <= 0);

                      return (
                        <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#F0E6DE] text-xs flex items-center gap-3">
                          {associatedGift?.imageUrl ? (
                            <img
                              src={associatedGift.imageUrl}
                              alt={displayName}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-lg object-cover border border-[#EADBCE] shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center shrink-0">
                              <GiftIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] text-[#A59E95] font-semibold uppercase tracking-wider">
                                {associatedGift?.category || 'Presente'}
                              </span>
                              {isSoldOut && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-800">
                                  Esgotado 🎉
                                </span>
                              )}
                            </div>
                            <strong className="text-[#2D2A26] block truncate">
                              {displayName}
                            </strong>
                            {associatedGift?.price ? (
                              <span className="text-[11px] text-[#7D756C]">
                                R$ {associatedGift.price.toLocaleString('pt-BR')} cada cota
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}

                    {res.message && (
                      <p className="text-xs italic text-[#5A544D] bg-[#FDFBF7] p-2.5 rounded-lg border border-[#F0E6DE]">
                        "{res.message}"
                      </p>
                    )}

                    <div className="pt-1 flex items-center justify-between text-[11px] text-[#A59E95]">
                      <span>{res.createdAt ? new Date(res.createdAt).toLocaleDateString('pt-BR') : 'Recentemente'}</span>
                      <a
                        href={`https://wa.me/55${res.guestWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Oi ${res.guestName}! Vi seu presente (${res.giftName}) para o meu apê novo e passei para te dar um abraço bem quentinho e agradecer! ❤️`
                        )}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#C86D51] hover:underline font-medium"
                      >
                        Agradecer no WhatsApp →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: CONVIDADOS (RSVP) ===================== */}
        {activeTab === 'guests' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
                  Lista de Convidados (RSVP)
                </h2>
                <p className="text-xs text-[#68625B]">
                  Controle oficial de quem foi convidado, limites de acompanhantes e confirmações de presença.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleOpenAddGuest}
                  className="h-10 px-4 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Adicionar Convidado</span>
                </button>

                <button
                  onClick={handleOpenCsvModal}
                  className="h-10 px-3.5 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#C86D51]" />
                  <span>Importar CSV</span>
                </button>

                <button
                  onClick={() => setIsBatchGuestModalOpen(true)}
                  className="h-10 px-3.5 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ListPlus className="w-4 h-4 text-[#68625B]" />
                  <span>Em Lote</span>
                </button>

                <button
                  onClick={handleExportGuestsCsv}
                  className="h-10 px-3.5 rounded-xl border border-[#EADBCE] bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#68625B]" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#EADBCE]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A59E95] block mb-1">
                  Total na Lista
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-bold text-[#2D2A26]">{guests.length}</span>
                  <span className="text-xs text-[#68625B]">convites</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-emerald-200 bg-emerald-50/30">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 block mb-1">
                  Confirmados 🎉
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-bold text-emerald-700">{totalPeopleCount}</span>
                  <span className="text-xs text-emerald-800">pessoas ({confirmedGuests.length} convites)</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-amber-200 bg-amber-50/30">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 block mb-1">
                  Pendentes ⏳
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-bold text-amber-700">{pendingGuests.length}</span>
                  <span className="text-xs text-amber-800">aguardando</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-stone-200 bg-stone-50/50">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600 block mb-1">
                  Ausentes 😭
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-serif text-2xl font-bold text-stone-700">{declinedGuests.length}</span>
                  <span className="text-xs text-stone-500">não irão</span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A59E95]" />
                <input
                  type="text"
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Buscar convidado por nome ou WhatsApp..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                />
              </div>

              <select
                value={guestFilter}
                onChange={(e) => setGuestFilter(e.target.value as any)}
                className="h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none w-full sm:w-auto"
              >
                <option value="all">Todos os Status ({guests.length})</option>
                <option value="confirmed">Confirmados 🎉 ({confirmedGuests.length})</option>
                <option value="pending">Pendentes ⏳ ({pendingGuests.length})</option>
                <option value="declined">Ausentes 😭 ({declinedGuests.length})</option>
              </select>
            </div>

            {/* Guests Table */}
            <div className="bg-white rounded-3xl border border-[#EADBCE] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#EADBCE] text-[#7D756C] uppercase font-semibold">
                    <tr>
                      <th className="p-4">Convidado</th>
                      <th className="p-4">WhatsApp</th>
                      <th className="p-4">Limite Convite</th>
                      <th className="p-4">Presença Confirmada</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Acompanhantes / Recado</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E6DE]">
                    {filteredGuests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-[#7D756C]">
                          Nenhum convidado encontrado com este filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredGuests.map((guest) => (
                        <tr key={guest.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                          <td className="p-4 font-semibold text-[#2D2A26]">
                            {guest.name}
                          </td>
                          <td className="p-4 font-mono text-[#68625B]">
                            {guest.whatsapp || <span className="text-[#A59E95] italic">Não informado</span>}
                          </td>
                          <td className="p-4 text-[#68625B]">
                            {guest.maxCompanions === 0 ? (
                              <span className="text-stone-600 font-medium">Individual</span>
                            ) : (
                              <span className="text-[#C86D51] font-medium">+ até {guest.maxCompanions} acomp.</span>
                            )}
                          </td>
                          <td className="p-4 tabular-nums">
                            {guest.status === 'confirmed' ? (
                              <>
                                <strong className="text-[#2D2A26] font-semibold">{guest.attendees}</strong>{' '}
                                {guest.attendees === 1 ? 'pessoa' : 'pessoas'}
                              </>
                            ) : (
                              <span className="text-[#A59E95]">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                                guest.status === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : guest.status === 'pending'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {guest.status === 'confirmed'
                                ? 'Confirmado 🎉'
                                : guest.status === 'pending'
                                ? 'Pendente ⏳'
                                : 'Ausente 😭'}
                            </span>
                          </td>
                          <td className="p-4 text-[#68625B]">
                            {guest.companions && guest.companions.length > 0 && (
                              <div className="text-[11px] mb-1">
                                <strong>Acomp:</strong> {guest.companions.join(', ')}
                              </div>
                            )}
                            {guest.notes && (
                              <div className="text-[11px] italic text-[#7D756C] line-clamp-1">
                                "{guest.notes}"
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEditGuest(guest)}
                                title="Editar convidado"
                                className="h-8 w-8 rounded-lg text-[#68625B] hover:text-[#2D2A26] hover:bg-[#FAF8F5] inline-flex items-center justify-center cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Remover "${guest.name}" da lista de convidados?`)) {
                                    deleteGuest(guest.id);
                                  }
                                }}
                                title="Remover convidado"
                                className="h-8 w-8 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 5: PERSONALIZAR EVENTO ===================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
                Personalização do Evento
              </h2>
              <p className="text-xs text-[#68625B]">
                Altere datas, horários, endereço, textos e fotos do site em tempo real sem alterar código.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="bg-white p-6 sm:p-8 rounded-3xl border border-[#EADBCE] shadow-2xs space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Nome da Anfitriã
                  </label>
                  <input
                    type="text"
                    value={settingsForm.hostName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hostName: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Instagram Handle (sem @)
                  </label>
                  <input
                    type="text"
                    value={settingsForm.instagramHandle}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instagramHandle: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Data do Evento
                  </label>
                  <input
                    type="date"
                    value={settingsForm.eventDate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, eventDate: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Horário Início
                  </label>
                  <input
                    type="text"
                    value={settingsForm.eventTime}
                    onChange={(e) => setSettingsForm({ ...settingsForm, eventTime: e.target.value })}
                    placeholder="17:00"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Horário Fim
                  </label>
                  <input
                    type="text"
                    value={settingsForm.eventEndTime || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, eventEndTime: e.target.value })}
                    placeholder="23:30"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Nome do Local
                  </label>
                  <input
                    type="text"
                    value={settingsForm.locationName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, locationName: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                    Cidade / Estado
                  </label>
                  <input
                    type="text"
                    value={settingsForm.locationCity}
                    onChange={(e) => setSettingsForm({ ...settingsForm, locationCity: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Endereço Completo
                </label>
                <input
                  type="text"
                  value={settingsForm.locationAddress}
                  onChange={(e) => setSettingsForm({ ...settingsForm, locationAddress: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Instruções de Acesso / Portaria
                </label>
                <input
                  type="text"
                  value={settingsForm.locationNotes || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, locationNotes: e.target.value })}
                  placeholder="Ex: Interfone 82, vagas na rua ao lado..."
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none"
                />
              </div>

              {/* Dados Bancários e Pix para Recebimento de Presentes */}
              <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#EADBCE] space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#A95339] flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#C86D51]" />
                    <span>Dados Bancários e Pix Oficial para Presentes</span>
                  </div>
                  <p className="text-[11px] text-[#68625B] mt-0.5">
                    Cadastre o link do seu banco, o código Pix Copia e Cola e a foto do QR Code oficial para os convidados pagarem sem erro.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1">
                      Chave Pix *
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.pixKey}
                      onChange={(e) => setSettingsForm({ ...settingsForm, pixKey: e.target.value })}
                      placeholder="alyne2.nobre.c@gmail.com"
                      className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1">
                      Tipo de Chave
                    </label>
                    <select
                      value={settingsForm.pixKeyType}
                      onChange={(e) => setSettingsForm({ ...settingsForm, pixKeyType: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                    >
                      <option value="E-mail">E-mail</option>
                      <option value="Celular">Celular / Telefone</option>
                      <option value="CPF">CPF</option>
                      <option value="Chave Aleatória">Chave Aleatória (EVP)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1">
                      Nome da Favorecida (como aparece no banco)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.pixReceiverName || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, pixReceiverName: e.target.value })}
                      placeholder="Ex: Alyne Nobre Custodio"
                      className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1">
                      Nome do Banco
                    </label>
                    <input
                      type="text"
                      value={settingsForm.pixBankName || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, pixBankName: e.target.value })}
                      placeholder="Ex: Nubank, Inter, Itaú, Bradesco..."
                      className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                    />
                  </div>
                </div>

                {/* Link de Pagamento do Banco */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1">
                    Link Direto do Banco para Pagamento (Opcional)
                  </label>
                  <input
                    type="url"
                    value={settingsForm.pixBankLink || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, pixBankLink: e.target.value })}
                    placeholder="Ex: https://nubank.com.br/cobrar/... ou link do seu app bancário"
                    className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                  />
                  <span className="text-[10px] text-[#A59E95] mt-1 block">
                    Se preenchido, os convidados verão um botão para abrir diretamente o aplicativo do seu banco!
                  </span>
                </div>

                {/* Código Pix Copia e Cola Oficial */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1">
                    Código Pix Copia e Cola Oficial (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={settingsForm.pixCopiaECola || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, pixCopiaECola: e.target.value })}
                    placeholder="Cole aqui o código que começa com 000201... gerado pelo aplicativo do seu banco"
                    className="w-full p-2.5 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none font-mono resize-none"
                  />
                  <span className="text-[10px] text-[#A59E95] mt-0.5 block">
                    Garante 100% de compatibilidade na hora do convidado colar no banco dele.
                  </span>
                </div>

                {/* Upload do QR Code Oficial do Banco */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#7D756C] uppercase tracking-wider mb-1.5">
                    Foto / Imagem do QR Code Oficial do seu Banco
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="flex-1 w-full flex items-center justify-center gap-2 h-11 px-4 border-2 border-dashed border-[#EADBCE] rounded-xl cursor-pointer bg-white hover:bg-[#FAF8F5] text-xs font-semibold text-[#2D2A26] transition-colors">
                      <Upload className="w-4 h-4 text-[#C86D51]" />
                      <span>{settingsForm.pixQrCodeUrl ? 'Trocar Imagem do QR Code' : 'Enviar Print do QR Code do Banco'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePixQrCodeUpload}
                        className="hidden"
                      />
                    </label>

                    {settingsForm.pixQrCodeUrl && (
                      <div className="flex items-center gap-2">
                        <div className="w-11 h-11 rounded-xl overflow-hidden border border-[#EADBCE] bg-white shrink-0">
                          <img
                            src={settingsForm.pixQrCodeUrl}
                            alt="QR Code"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSettingsForm({ ...settingsForm, pixQrCodeUrl: '' })}
                          className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-[#A59E95] mt-1 block">
                    Tire um print do QR Code no aplicativo do seu banco e suba aqui. Ele será exibido diretamente aos convidados!
                  </span>
                </div>
              </div>

              {settingsSaved && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Configurações salvas e aplicadas em tempo real!</span>
                </div>
              )}

              <button
                type="submit"
                className="h-11 px-6 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide uppercase transition-colors shadow-xs cursor-pointer"
              >
                Salvar Alterações
              </button>

            </form>
          </div>
        )}

      </main>

      {/* ===================== MODAL: ADICIONAR / EDITAR PRESENTE ===================== */}
      {isGiftModalOpen && (
        <GiftFormModal
          key={editingGift?.id || editingGift?.purchaseUrl || 'new-gift-modal'}
          gift={editingGift}
          onClose={() => {
            setIsGiftModalOpen(false);
            setEditingGift(null);
          }}
          onSaved={() => {
            setIsGiftModalOpen(false);
            setEditingGift(null);
          }}
        />
      )}

      {/* ===================== MODAL: SCRAPE POR LINK ===================== */}
      {isScraperModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsScraperModalOpen(false)}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center mb-3">
                <LinkIcon className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#2D2A26]">
                Adicionar Presente por Link
              </h3>
              <p className="text-xs text-[#68625B] mt-1">
                Cole a URL de qualquer produto da Amazon, Magalu, Tok&Stok ou outra loja para preenchimento automático.
              </p>
            </div>

            <form onSubmit={handleScrapeProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  URL do Produto
                </label>
                <input
                  type="url"
                  required
                  value={scraperUrl}
                  onChange={(e) => setScraperUrl(e.target.value)}
                  placeholder="https://www.amazon.com.br/..."
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={scrapingLoading}
                className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer"
              >
                {scrapingLoading ? 'Buscando informações da loja...' : 'Importar Informações'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADICIONAR / EDITAR CONVIDADO ===================== */}
      {isGuestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => {
                setIsGuestModalOpen(false);
                setEditingGuestItem(null);
              }}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#2D2A26]">
                {editingGuestItem ? 'Editar Convidado' : 'Novo Convidado'}
              </h3>
              <p className="text-xs text-[#68625B] mt-1">
                Configure o nome, WhatsApp e o limite de acompanhantes permitidos.
              </p>
            </div>

            <form onSubmit={handleSaveGuestForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Nome Completo do Convidado *
                </label>
                <input
                  type="text"
                  required
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="Ex: Beatriz Lima"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  value={guestWhatsappInput}
                  onChange={(e) => setGuestWhatsappInput(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Limite de Acompanhantes Permitidos
                </label>
                <select
                  value={guestMaxCompanionsInput}
                  onChange={(e) => setGuestMaxCompanionsInput(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                >
                  <option value={0}>0 - Individual (apenas o convidado)</option>
                  <option value={1}>1 acompanhante (convidado + 1)</option>
                  <option value={2}>2 acompanhantes (convidado + 2)</option>
                  <option value={3}>3 acompanhantes (convidado + 3)</option>
                  <option value={4}>4 acompanhantes (família)</option>
                </select>
                <p className="text-[11px] text-[#A59E95] mt-1">
                  O convidado só conseguirá adicionar acompanhantes até esse limite.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Status
                </label>
                <select
                  value={guestStatusInput}
                  onChange={(e) => setGuestStatusInput(e.target.value as GuestStatus)}
                  className="w-full h-11 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                >
                  <option value="pending">Pendente ⏳ (aguardando resposta)</option>
                  <option value="confirmed">Confirmado 🎉</option>
                  <option value="declined">Ausente 😭</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer"
              >
                {editingGuestItem ? 'Salvar Alterações' : 'Adicionar à Lista'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: ADICIONAR EM LOTE ===================== */}
      {isBatchGuestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsBatchGuestModalOpen(false)}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center mb-3">
                <ListPlus className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#2D2A26]">
                Adicionar Convidados em Lote
              </h3>
              <p className="text-xs text-[#68625B] mt-1">
                Cole uma lista com um nome por linha (copiado do WhatsApp, Bloco de Notas ou Excel).
              </p>
            </div>

            <form onSubmit={handleSaveBatchGuests} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Lista de Nomes (1 por linha)
                </label>
                <textarea
                  required
                  rows={6}
                  value={batchNamesInput}
                  onChange={(e) => setBatchNamesInput(e.target.value)}
                  placeholder="Camila Santos&#10;Lucas Ferreira&#10;Mariana Silva&#10;Rodrigo Costa"
                  className="w-full p-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Limite padrão de acompanhantes para estes convidados
                </label>
                <select
                  value={batchDefaultMaxInput}
                  onChange={(e) => setBatchDefaultMaxInput(Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
                >
                  <option value={0}>0 - Individual (apenas o convidado)</option>
                  <option value={1}>1 acompanhante (+1)</option>
                  <option value={2}>2 acompanhantes (+2)</option>
                  <option value={3}>3 acompanhantes (+3)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer"
              >
                Cadastrar Todos os Convidados
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL: IMPORTAR CSV ===================== */}
      {isCsvImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsCsvImportModalOpen(false);
                setCsvParsedGuests([]);
                setCsvFileName('');
              }}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#2D2A26]">
                Importar Lista de Convidados (CSV)
              </h3>
              <p className="text-xs text-[#68625B] mt-1">
                Suba uma planilha salva em CSV do Excel ou Google Sheets para cadastrar todos os convidados de uma vez.
              </p>
            </div>

            {/* Template download hint */}
            <div className="mb-5 p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#EADBCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-[#68625B]">
                <strong className="text-[#2D2A26] block">Ainda não tem a planilha no formato certo?</strong>
                Baixe nosso modelo com as colunas certinhas (Nome, WhatsApp, Limite Acompanhantes).
              </div>
              <button
                type="button"
                onClick={downloadSampleGuestsCsv}
                className="h-8 px-3 rounded-lg border border-[#C86D51] text-[#C86D51] hover:bg-[#FBF0EB] font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors"
              >
                Baixar Modelo CSV
              </button>
            </div>

            {/* File Upload Box */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                Selecione o arquivo .CSV do seu computador
              </label>
              <label className="flex flex-col items-center justify-center w-full h-32 px-4 border-2 border-dashed border-[#EADBCE] rounded-2xl cursor-pointer bg-white hover:bg-[#FAF8F5] transition-colors">
                <Upload className="w-6 h-6 text-[#C86D51] mb-2" />
                <span className="text-xs font-medium text-[#2D2A26]">
                  {csvFileName ? `Arquivo: ${csvFileName}` : 'Clique para escolher o arquivo CSV ou arraste aqui'}
                </span>
                <span className="text-[11px] text-[#A59E95] mt-1">
                  Formatos suportados: .csv (separado por vírgula ou ponto e vírgula)
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Preview of Parsed Guests */}
            {csvParsedGuests.length > 0 && (
              <div className="space-y-4 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2D2A26]">
                    Prévia: {csvParsedGuests.length} convidado(s) identificado(s)
                  </span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-semibold">
                    Pronto para importar
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-[#EADBCE] bg-white text-xs divide-y divide-[#F0E6DE]">
                  {csvParsedGuests.slice(0, 15).map((g, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-[#2D2A26] block">{g.name}</strong>
                        <span className="text-[11px] text-[#7D756C]">
                          {g.whatsapp ? `WhatsApp: ${g.whatsapp}` : 'Sem WhatsApp'} •{' '}
                          {g.maxCompanions === 0
                            ? 'Individual'
                            : `+ até ${g.maxCompanions} acomp.`}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                          g.status === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {g.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                  {csvParsedGuests.length > 15 && (
                    <div className="p-2 text-center text-[11px] text-[#7D756C] bg-[#FAF8F5]">
                      E mais {csvParsedGuests.length - 15} convidados...
                    </div>
                  )}
                </div>

                {/* Import Mode */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#EADBCE] space-y-2 text-xs">
                  <span className="font-semibold text-[#2D2A26] block">O que fazer com os convidados atuais?</span>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="csvMode"
                        checked={csvImportMode === 'append'}
                        onChange={() => setCsvImportMode('append')}
                        className="text-[#C86D51]"
                      />
                      <span>Adicionar à lista existente (mantém os convidados já cadastrados)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-stone-600">
                      <input
                        type="radio"
                        name="csvMode"
                        checked={csvImportMode === 'replace'}
                        onChange={() => setCsvImportMode('replace')}
                        className="text-[#C86D51]"
                      />
                      <span className="text-red-700">Substituir lista atual por esta nova lista</span>
                    </label>
                  </div>
                </div>

                {/* Confirm Button */}
                <button
                  type="button"
                  disabled={csvImporting}
                  onClick={handleConfirmCsvImport}
                  className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer shadow-xs"
                >
                  {csvImporting
                    ? 'Importando convidados...'
                    : `Confirmar e Importar ${csvParsedGuests.length} Convidados`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// Sub-component: Gift Form Modal (Add / Edit)
interface GiftFormModalProps {
  gift: Gift | null;
  onClose: () => void;
  onSaved: () => void;
}

const GiftFormModal: React.FC<GiftFormModalProps> = ({ gift, onClose, onSaved }) => {
  const [name, setName] = useState(gift?.name || '');
  const [description, setDescription] = useState(gift?.description || '');
  const [category, setCategory] = useState<GiftCategory>(gift?.category || 'cozinha');
  const [type, setType] = useState<GiftType>(gift?.type || 'shares');
  const [price, setPrice] = useState(gift?.price || 100);
  const [totalQuantity, setTotalQuantity] = useState(gift?.totalQuantity || 1);
  const [imageUrl, setImageUrl] = useState(gift?.imageUrl || '');
  const [purchaseUrl, setPurchaseUrl] = useState(gift?.purchaseUrl || '');
  const [pixKey, setPixKey] = useState(gift?.pixKey || 'alyne2.nobre.c@gmail.com');
  const [status, setStatus] = useState<GiftStatus>(gift?.status || 'available');
  const [saving, setSaving] = useState(false);

  // Quick image file upload handler (converts to base64 data url)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (gift && gift.id) {
        // Update
        await updateGift(gift.id, {
          name,
          description,
          category,
          type,
          price: Number(price),
          totalQuantity: Number(totalQuantity),
          availableQuantity: Math.max(0, Number(totalQuantity) - (gift.reservedQuantity || 0)),
          imageUrl,
          purchaseUrl,
          pixKey,
          status,
        });
      } else {
        // Create
        await createGift({
          name,
          description,
          category,
          type,
          price: Number(price),
          totalQuantity: Number(totalQuantity),
          availableQuantity: Number(totalQuantity),
          reservedQuantity: 0,
          imageUrl,
          purchaseUrl,
          pixKey,
          status,
        });
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 sm:p-8 shadow-2xl my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="font-serif text-2xl font-medium text-[#2D2A26] mb-1">
          {gift && gift.id ? 'Editar Presente' : 'Novo Presente'}
        </h3>
        <p className="text-xs text-[#68625B] mb-5">
          Configure as cotas, fotos e detalhes do presente.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
              Nome do Presente *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Uma ajudinha para a 1ª parcela da geladeira 🥹"
              className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
              Descrição com Humor / Motivo
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Para garantir que as visitas não passem calor!"
              className="w-full p-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GiftCategory)}
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              >
                <option value="cozinha">Cozinha</option>
                <option value="sala">Sala</option>
                <option value="quarto">Quarto</option>
                <option value="banheiro">Banheiro</option>
                <option value="casa">Casa</option>
                <option value="pix">Pix</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as GiftType)}
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              >
                <option value="shares">Cotas (Várias pessoas)</option>
                <option value="product">Produto Físico</option>
                <option value="pix">Pix Direto</option>
                <option value="external">Link de Loja</option>
                <option value="other">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GiftStatus)}
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              >
                <option value="available">Disponível</option>
                <option value="unavailable">Indisponível</option>
                <option value="sold_out">Esgotado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Valor Sugerido (R$ por cota ou total)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Quantidade Total de Cotas
              </label>
              <input
                type="number"
                min="1"
                required
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              />
            </div>
          </div>

          {/* Photo URL or Upload */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
              Foto do Presente
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="URL da imagem (ou envie do celular abaixo)"
                className="flex-1 h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              />
              <label className="h-10 px-3 rounded-xl border border-[#EADBCE] bg-[#F4EFEB] hover:bg-[#EADBCE] text-xs font-medium text-[#2D2A26] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {imageUrl && (
              <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden border border-[#EADBCE]">
                <img src={imageUrl} alt="Prévia" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Optional links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Link de Compra (se houver)
              </label>
              <input
                type="url"
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1">
                Chave Pix Específica (opcional)
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Deixe em branco para usar a chave padrão"
                className="w-full h-10 px-3 rounded-xl border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase transition-colors cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar Presente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
