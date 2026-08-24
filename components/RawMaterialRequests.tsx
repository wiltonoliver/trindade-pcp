'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MaterialRequest, MaterialPriority, MaterialRequestStatus, UserProfile, OrderItem } from '@/types/factory';
import { compressImageFile } from '@/lib/imageUtils';
import { ImageLightboxModal } from './ImageLightboxModal';
import {
  notifyMaterialRequested,
  notifyMaterialPurchased,
  notifyMaterialReceived,
} from '@/lib/notificationService';

interface RawMaterialRequestsProps {
  requests: MaterialRequest[];
  onSaveRequest: (request: MaterialRequest) => void;
  onDeleteRequest: (requestId: string) => void;
  currentUser?: UserProfile | null;
  orders?: OrderItem[];
  searchQuery?: string;
  onNavigateToDashboard?: () => void;
}

const MATERIAL_CATEGORIES = [
  'Perfis de Alumínio',
  'Vidros',
  'Ferragens & Fechaduras',
  'Acessórios & Borrachas de Vedação',
  'Parafusos & Fixadores',
  'Embalagens & Proteção',
  'Insumos Gerais & Ferramentas',
];

const SECTORS = [
  'Linha de Montagem de Portas',
  'Linha de Montagem de Janelas',
  'Setor de Corte & Usinagem',
  'Setor de Vidros & Montagem',
  'Setor de Pintura & Acabamento',
  'Expedição & Embalagem',
  'Geral / Todas as Linhas',
];

const UNITS = ['barras', 'un', 'kg', 'metros', 'chapas', 'rolos', 'caixas', 'pares', 'litros'];

const COMMON_SUPPLIERS = [
  'Alcoa Alumínio',
  'CBA (Cia Brasileira de Alumínio)',
  'Udinese Metais',
  'Cebrace Vidros',
  'GlassVetro',
  'Wurth do Brasil',
  'Perfil Alumínio Brasil',
  'Fise Ferragens',
  'Roto Fermax',
  'Outro Fornecedor',
];

export const RawMaterialRequests: React.FC<RawMaterialRequestsProps> = ({
  requests = [],
  onSaveRequest,
  onDeleteRequest,
  currentUser,
  orders = [],
  searchQuery: externalSearchQuery = '',
  onNavigateToDashboard,
}) => {
  // Navigation tabs inside the feature
  const [activeTab, setActiveTab] = useState<'pending' | 'purchased' | 'received' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);

  // Lightbox modal state
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string; subtitle?: string; orderId?: string } | null>(null);

  // Form states - New Request
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newCategory, setNewCategory] = useState(MATERIAL_CATEGORIES[0]);
  const [newQuantity, setNewQuantity] = useState<number | ''>(1);
  const [newUnit, setNewUnit] = useState(UNITS[0]);
  const [newPriority, setNewPriority] = useState<MaterialPriority>('NORMAL');
  const [newSector, setNewSector] = useState(SECTORS[0]);
  const [newLinkedOrderId, setNewLinkedOrderId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states - Purchase (Gestor de Compras)
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseExpectedDelivery, setPurchaseExpectedDelivery] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Form states - Receive (Expedição)
  const [receivedQuantity, setReceivedQuantity] = useState<number | ''>('');
  const [receivedInvoiceNumber, setReceivedInvoiceNumber] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiveDate, setReceiveDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const userName = currentUser?.name || 'Gerente de Produção';

  // Quick suggestions for fast typing
  const quickSuggestions = [
    { name: 'Perfil BL-3052 Branco', cat: 'Perfis de Alumínio', unit: 'barras' },
    { name: 'Fechadura Bico de Papagaio Udinese', cat: 'Ferragens & Fechaduras', unit: 'un' },
    { name: 'Vidro Temperado Incolor 8mm', cat: 'Vidros', unit: 'chapas' },
    { name: 'Borracha de Vedação EPDM Preta', cat: 'Acessórios & Borrachas de Vedação', unit: 'metros' },
    { name: 'Parafuso Inox 4.2x38mm', cat: 'Parafusos & Fixadores', unit: 'caixas' },
    { name: 'Braço Maxim-ar 300mm Inox', cat: 'Ferragens & Fechaduras', unit: 'pares' },
  ];

  // Image Upload Handler
  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      setIsProcessingImage(true);
      const compressed = await compressImageFile(file);
      setNewImage(compressed);
    } catch (err) {
      console.error('Erro ao processar foto:', err);
    } finally {
      setIsProcessingImage(false);
    }
  }, []);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Tab filter
      if (activeTab === 'pending' && req.status !== 'pendente') return false;
      if (activeTab === 'purchased' && req.status !== 'comprado') return false;
      if (activeTab === 'received' && req.status !== 'recebido') return false;

      // Category filter
      if (selectedCategory !== 'all' && req.category !== selectedCategory) return false;

      // Priority filter
      if (selectedPriority !== 'all' && req.priority !== selectedPriority) return false;

      // Search query
      const effectiveSearch = (searchQuery.trim() || externalSearchQuery.trim()).toLowerCase();
      if (effectiveSearch) {
        const matchCode = req.code?.toLowerCase().includes(effectiveSearch);
        const matchName = req.materialName?.toLowerCase().includes(effectiveSearch);
        const matchSector = req.sector?.toLowerCase().includes(effectiveSearch);
        const matchOp = req.linkedOrderId?.toLowerCase().includes(effectiveSearch);
        const matchSupplier = req.supplier?.toLowerCase().includes(effectiveSearch);
        const matchRequester = req.requestedBy?.toLowerCase().includes(effectiveSearch);
        return matchCode || matchName || matchSector || matchOp || matchSupplier || matchRequester;
      }

      return true;
    });
  }, [requests, activeTab, selectedCategory, selectedPriority, searchQuery, externalSearchQuery]);

  // Summary counts
  const pendingCount = requests.filter((r) => r.status === 'pendente').length;
  const purchasedCount = requests.filter((r) => r.status === 'comprado').length;
  const receivedCount = requests.filter((r) => r.status === 'recebido').length;
  const urgentCount = requests.filter((r) => r.status === 'pendente' && r.priority === 'ALTA PRIORIDADE').length;

  // Handler: Open New Request Modal
  const handleOpenNewModal = () => {
    setNewMaterialName('');
    setNewCategory(MATERIAL_CATEGORIES[0]);
    setNewQuantity(1);
    setNewUnit(UNITS[0]);
    setNewPriority('NORMAL');
    setNewSector(SECTORS[0]);
    setNewLinkedOrderId('');
    setNewNotes('');
    setNewImage(null);
    setIsNewModalOpen(true);
  };

  // Handler: Save New Request
  const handleSaveNewRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialName.trim() || !newQuantity || Number(newQuantity) <= 0) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const generatedId = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nextCodeNumber = 1000 + (requests.length + 1);
    const code = `REQ-${nextCodeNumber}`;

    const newReq: MaterialRequest = {
      id: generatedId,
      code,
      materialName: newMaterialName.trim(),
      category: newCategory,
      quantity: Number(newQuantity),
      unit: newUnit,
      priority: newPriority,
      sector: newSector,
      linkedOrderId: newLinkedOrderId.trim() ? (newLinkedOrderId.startsWith('#') ? newLinkedOrderId.trim() : `#${newLinkedOrderId.trim()}`) : undefined,
      notes: newNotes.trim() || undefined,
      requestedBy: userName,
      requestedAt: `${dateStr} ${timeStr}`,
      requestedTimestamp: Date.now(),
      imageUrl: newImage || undefined,
      status: 'pendente',
    };

    onSaveRequest(newReq);
    notifyMaterialRequested(code, newReq.materialName, newReq.quantity, newReq.unit, userName, newReq.sector, newReq.priority);

    setIsNewModalOpen(false);
  };

  // Handler: Open Purchase Modal
  const handleOpenPurchaseModal = (req: MaterialRequest) => {
    setSelectedRequest(req);
    setPurchaseSupplier(req.supplier || '');
    if (req.expectedDeliveryDate) {
      // If formatted as DD/MM/YYYY, convert to YYYY-MM-DD
      if (req.expectedDeliveryDate.includes('/')) {
        const parts = req.expectedDeliveryDate.split('/');
        if (parts.length === 3) {
          setPurchaseExpectedDelivery(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          setPurchaseExpectedDelivery(req.expectedDeliveryDate);
        }
      } else {
        setPurchaseExpectedDelivery(req.expectedDeliveryDate);
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      setPurchaseExpectedDelivery(d.toISOString().split('T')[0]);
    }
    setPurchaseOrderNumber(req.purchaseOrderNumber || '');
    setPurchaseNotes(req.purchaseNotes || '');
    setIsPurchaseModalOpen(true);
  };

  // Handler: Confirm Purchase
  const handleConfirmPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !purchaseExpectedDelivery) return;

    const formattedDelivery = purchaseExpectedDelivery.includes('-')
      ? purchaseExpectedDelivery.split('-').reverse().join('/')
      : purchaseExpectedDelivery;

    const now = new Date();
    const purchaseDateStr = now.toLocaleDateString('pt-BR');

    const updated: MaterialRequest = {
      ...selectedRequest,
      status: 'comprado',
      purchaseDate: purchaseDateStr,
      supplier: purchaseSupplier.trim() || 'Fornecedor Homologado',
      expectedDeliveryDate: formattedDelivery,
      purchaseOrderNumber: purchaseOrderNumber.trim() || undefined,
      purchasedBy: userName,
      purchaseNotes: purchaseNotes.trim() || undefined,
    };

    onSaveRequest(updated);
    notifyMaterialPurchased(updated.code, updated.materialName, formattedDelivery, userName, updated.supplier);

    setIsPurchaseModalOpen(false);
    setSelectedRequest(null);
  };

  // Handler: Open Receive Modal
  const handleOpenReceiveModal = (req: MaterialRequest) => {
    setSelectedRequest(req);
    setReceivedQuantity(req.quantity);
    setReceivedInvoiceNumber(req.purchaseOrderNumber || req.invoiceNumber || '');
    setReceiptNotes('');
    const today = new Date().toISOString().split('T')[0];
    setReceiveDate(today);
    setIsReceiveModalOpen(true);
  };

  // Handler: Confirm Receipt (Expedição dá baixa)
  const handleConfirmReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !receivedQuantity || Number(receivedQuantity) <= 0) return;

    const formattedReceiveDate = receiveDate.includes('-')
      ? receiveDate.split('-').reverse().join('/')
      : receiveDate;

    const updated: MaterialRequest = {
      ...selectedRequest,
      status: 'recebido',
      receivedDate: formattedReceiveDate,
      receivedQuantity: Number(receivedQuantity),
      receivedBy: userName,
      invoiceNumber: receivedInvoiceNumber.trim() || undefined,
      receiptNotes: receiptNotes.trim() || undefined,
    };

    onSaveRequest(updated);
    notifyMaterialReceived(updated.code, updated.materialName, Number(receivedQuantity), updated.unit, userName);

    setIsReceiveModalOpen(false);
    setSelectedRequest(null);
  };

  // Handler: Print Report
  const handlePrint = () => {
    window.print();
  };

  // Helper: Calculate days until delivery or if overdue
  const getDeliveryStatus = (expectedDateStr?: string) => {
    if (!expectedDateStr) return { label: 'Sem data', color: 'text-slate-500 bg-slate-50' };
    const parts = expectedDateStr.split('/');
    if (parts.length !== 3) return { label: expectedDateStr, color: 'text-slate-600 bg-slate-50' };

    const exp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);

    const diffDays = Math.round((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return {
        label: `Atrasado há ${Math.abs(diffDays)} dia(s)`,
        color: 'text-rose-700 bg-rose-50 border-rose-200 font-bold',
        isOverdue: true,
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Chega Hoje!',
        color: 'text-amber-700 bg-amber-50 border-amber-200 font-bold animate-pulse',
        isToday: true,
      };
    }
    if (diffDays === 1) {
      return {
        label: 'Chega Amanhã',
        color: 'text-blue-700 bg-blue-50 border-blue-200 font-bold',
      };
    }
    return {
      label: `Previsto em ${diffDays} dias (${expectedDateStr})`,
      color: 'text-slate-700 bg-slate-100 border-slate-200',
    };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <span className="material-symbols-outlined text-[24px]">inventory_2</span>
            </span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Solicitação de Matéria-Prima & Compras
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Fluxo integrado: Solicitação pela Produção → Compra & Prazo pelo Gestor → Baixa no Recebimento pela Expedição.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Imprimir lista de solicitações"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span className="hidden sm:inline">Imprimir Relatório</span>
          </button>

          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Nova Solicitação de Material</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pendentes */}
        <div
          onClick={() => setActiveTab('pending')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeTab === 'pending' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">1. Aguardando Compra</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">pending</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{pendingCount}</span>
            <span className="text-xs text-slate-500 font-medium">solicitações abertas</span>
          </div>
          {urgentCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-md">
              <span className="material-symbols-outlined text-[13px]">warning</span>
              <span>{urgentCount} Urgentes na Linha</span>
            </div>
          )}
        </div>

        {/* Card 2: Comprados */}
        <div
          onClick={() => setActiveTab('purchased')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeTab === 'purchased' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">2. Compras Realizadas</span>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">local_shipping</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{purchasedCount}</span>
            <span className="text-xs text-slate-500 font-medium">em trânsito / aguardando</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Aguardando baixa pela Expedição</p>
        </div>

        {/* Card 3: Recebidos */}
        <div
          onClick={() => setActiveTab('received')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeTab === 'received' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">3. Recebidos na Fábrica</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{receivedCount}</span>
            <span className="text-xs text-slate-500 font-medium">itens entregues</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-2">Disponíveis para produção</p>
        </div>

        {/* Card 4: Total de Insumos */}
        <div
          onClick={() => setActiveTab('all')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
            activeTab === 'all' ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Histórico Completo</span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">list_alt</span>
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{requests.length}</span>
            <span className="text-xs text-slate-500 font-medium">pedidos totais</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Rastreabilidade ponta a ponta</p>
        </div>
      </div>

      {/* Main Container: Filters & Table/Cards */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-100 px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-3">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              <span>1. Solicitações Pendentes (Gestor)</span>
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('purchased')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'purchased'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
              <span>2. Compras Realizadas (Aguardando Entrega)</span>
              {purchasedCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'purchased' ? 'bg-blue-800 text-white' : 'bg-blue-200 text-blue-900'}`}>
                  {purchasedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('received')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'received'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>3. Recebidos & Baixados (Expedição)</span>
              {receivedCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${activeTab === 'received' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
                  {receivedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">list</span>
              <span>Todos os Registros</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código, material, setor, OP..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as Prioridades</option>
              <option value="ALTA PRIORIDADE">🚨 Alta Prioridade</option>
              <option value="NORMAL">Normal</option>
            </select>
          </div>
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px]">inventory_2</span>
            </div>
            <h4 className="font-bold text-base text-slate-800">Nenhuma solicitação encontrada</h4>
            <p className="text-xs text-slate-500 max-w-md">
              {activeTab === 'pending'
                ? 'Nenhum material pendente de compra no momento. Todas as solicitações foram atendidas!'
                : activeTab === 'purchased'
                ? 'Nenhuma compra em trânsito aguardando entrega.'
                : activeTab === 'received'
                ? 'Nenhum material baixado no histórico recente.'
                : 'Nenhum registro corresponde aos filtros selecionados.'}
            </p>
            {activeTab === 'pending' && (
              <button
                onClick={handleOpenNewModal}
                className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Criar Nova Solicitação</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Código / Status</th>
                  <th className="py-3 px-4">Material / Insumo</th>
                  <th className="py-3 px-4">Qtd. Solicitada</th>
                  <th className="py-3 px-4">Setor / Solicitante</th>
                  <th className="py-3 px-4">Status da Compra / Prazo</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const isUrgent = req.priority === 'ALTA PRIORIDADE';
                  const deliveryStatus = req.status === 'comprado' ? getDeliveryStatus(req.expectedDeliveryDate) : null;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Column: Code & Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {req.code}
                          </span>
                          {isUrgent && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded border border-rose-200 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">bolt</span>
                              <span>URGENTE</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          {req.status === 'pendente' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              <span>Aguardando Compra</span>
                            </span>
                          )}
                          {req.status === 'comprado' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                              <span className="material-symbols-outlined text-[12px]">local_shipping</span>
                              <span>Compra Realizada</span>
                            </span>
                          )}
                          {req.status === 'recebido' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="material-symbols-outlined text-[12px]">check_circle</span>
                              <span>Recebido / Baixado</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column: Material & Category */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="flex items-start gap-2.5">
                          {req.imageUrl && (
                            <div
                              onClick={() =>
                                setLightboxData({
                                  url: req.imageUrl!,
                                  title: req.materialName,
                                  subtitle: `Código: ${req.code} • Setor: ${req.sector}`,
                                  orderId: req.linkedOrderId,
                                })
                              }
                              className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 group cursor-pointer"
                              title="Clique para ampliar a foto do material"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={req.imageUrl}
                                alt="Foto do material"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="material-symbols-outlined text-white text-[12px]">zoom_in</span>
                              </div>
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs leading-snug">
                              {req.materialName}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {req.category || 'Insumo'}
                              </span>
                              {req.linkedOrderId && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  OP {req.linkedOrderId}
                                </span>
                              )}
                            </div>
                            {req.notes && (
                              <p className="text-[11px] text-slate-500 italic mt-1 truncate" title={req.notes}>
                                &ldquo;{req.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Column: Quantity & Unit */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-extrabold text-sm text-slate-900">
                          {req.quantity} <span className="text-xs font-semibold text-slate-600">{req.unit}</span>
                        </div>
                        {req.status === 'recebido' && req.receivedQuantity !== undefined && (
                          <span className="text-[10px] font-bold text-emerald-700">
                            Recebido: {req.receivedQuantity} {req.unit}
                          </span>
                        )}
                      </td>

                      {/* Column: Sector & Requester */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">
                          {req.sector || 'Geral'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Por: <strong className="text-slate-700">{req.requestedBy}</strong>
                        </p>
                        <span className="text-[10px] text-slate-400">{req.requestedAt}</span>
                      </td>

                      {/* Column: Purchase info & Delivery countdown */}
                      <td className="py-3.5 px-4">
                        {req.status === 'pendente' && (
                          <div className="text-amber-800 bg-amber-50/80 border border-amber-200/80 px-2.5 py-1.5 rounded-lg text-[11px] max-w-[220px]">
                            <p className="font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                              <span>Pendente de Compra</span>
                            </p>
                            <p className="text-[10px] text-amber-700 mt-0.5">
                              Aguardando o gestor verificar fornecedor e prazo.
                            </p>
                          </div>
                        )}

                        {req.status === 'comprado' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 text-xs">{req.supplier || 'Fornecedor'}</span>
                              {req.purchaseOrderNumber && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                                  {req.purchaseOrderNumber}
                                </span>
                              )}
                            </div>
                            {deliveryStatus && (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${deliveryStatus.color}`}>
                                <span className="material-symbols-outlined text-[12px]">event</span>
                                <span>{deliveryStatus.label}</span>
                              </span>
                            )}
                            <p className="text-[10px] text-slate-400">
                              Comprado por {req.purchasedBy} em {req.purchaseDate}
                            </p>
                          </div>
                        )}

                        {req.status === 'recebido' && (
                          <div className="space-y-0.5">
                            <p className="font-bold text-emerald-800 text-xs flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">done_all</span>
                              <span>Entregue na Fábrica</span>
                            </p>
                            <p className="text-[11px] text-slate-600">
                              Data: <strong>{req.receivedDate}</strong>
                            </p>
                            <p className="text-[10px] text-slate-400">
                              Baixa por: {req.receivedBy} {req.invoiceNumber ? `(NF: ${req.invoiceNumber})` : ''}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Column: Action Buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Action 1: Inform Purchase (for Gestor when pending) */}
                          {req.status === 'pendente' && (
                            <button
                              onClick={() => handleOpenPurchaseModal(req)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                              title="Informar que a compra foi realizada e definir prazo de entrega"
                            >
                              <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
                              <span>Informar Compra</span>
                            </button>
                          )}

                          {/* Action 2: Baixa no Recebimento (for Expedição when comprado) */}
                          {req.status === 'comprado' && (
                            <button
                              onClick={() => handleOpenReceiveModal(req)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                              title="Expedição/Almoxarifado dá baixa no recebimento do material"
                            >
                              <span className="material-symbols-outlined text-[15px]">inventory</span>
                              <span>Dar Baixa no Recebimento</span>
                            </button>
                          )}

                          {/* Action 3: View Details */}
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Ver detalhes completos do pedido de material"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>

                          {/* Action 4: Delete */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Deseja realmente excluir a solicitação ${req.code} (${req.materialName})?`)) {
                                onDeleteRequest(req.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir solicitação"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: NOVA SOLICITAÇÃO DE MATÉRIA-PRIMA (GERENTE DE PRODUÇÃO)           */}
      {/* ========================================================================= */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-white/10 rounded-xl">
                  <span className="material-symbols-outlined text-[22px]">add_shopping_cart</span>
                </span>
                <div>
                  <h3 className="font-bold text-base leading-tight">Nova Solicitação de Matéria-Prima</h3>
                  <p className="text-xs text-indigo-100">
                    Solicite os insumos necessários para manter as linhas de produção ativas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="px-6 pt-4 pb-1 bg-indigo-50/50 border-b border-indigo-100/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 block mb-1.5">
                Sugestões Rápidas:
              </span>
              <div className="flex flex-wrap gap-1.5 pb-2">
                {quickSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNewMaterialName(item.name);
                      setNewCategory(item.cat);
                      setNewUnit(item.unit);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-100/70 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-950 transition-colors cursor-pointer"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveNewRequest} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Material Name */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>Nome do Material / Insumo *</span>
                  <span className="text-[11px] text-slate-400 font-normal">Ex: Perfil BL-3052, Vidro 8mm, Fechadura...</span>
                </label>
                <input
                  type="text"
                  required
                  value={newMaterialName}
                  onChange={(e) => setNewMaterialName(e.target.value)}
                  placeholder="Ex: Perfil de Alumínio BL-3052 Branco 6m"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Categoria do Material</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {MATERIAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Nível de Prioridade</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as MaterialPriority)}
                    className={`w-full px-3 py-2.5 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                      newPriority === 'ALTA PRIORIDADE'
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="NORMAL">Normal (Reposição Padrão)</option>
                    <option value="ALTA PRIORIDADE">🚨 ALTA PRIORIDADE (Falta na Linha / Urgente)</option>
                  </select>
                </div>
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Quantidade Necessária *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 10"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Unidade de Medida</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sector + Linked OP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Setor / Linha Solicitante</label>
                  <select
                    value={newSector}
                    onChange={(e) => setNewSector(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700 flex items-center justify-between">
                    <span>OP Vinculada (Opcional)</span>
                    <span className="text-[10px] text-slate-400">Ex: #5376</span>
                  </label>
                  <input
                    type="text"
                    value={newLinkedOrderId}
                    onChange={(e) => setNewLinkedOrderId(e.target.value)}
                    placeholder="Ex: #5376"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Notes / Justification */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">Observações / Justificativa</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Material necessário para atender lote urgente da loja Matriz..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 resize-none font-medium"
                />
              </div>

              {/* Image / Technical Drawing Attachment */}
              <div className="space-y-1 pt-1">
                <label className="font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>Foto / Desenho Técnico (Opcional)</span>
                  <span className="text-[10px] text-slate-400">JPG, PNG</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                    if (e.target) e.target.value = '';
                  }}
                  className="hidden"
                />

                {!newImage ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/40 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isProcessingImage ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin text-indigo-600">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">add_photo_alternate</span>
                    )}
                    <span>{isProcessingImage ? 'Compactando imagem...' : 'Clique para anexar foto do perfil ou desenho'}</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-indigo-200" />
                      <span className="text-xs font-bold text-indigo-950">Foto anexada com sucesso</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewImage(null)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover foto"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Requester info reminder */}
              <div className="p-3 bg-slate-100 rounded-xl text-slate-600 text-[11px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-500">person</span>
                <span>Solicitante registrado: <strong>{userName}</strong> (Planta PCP)</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>Enviar Solicitação ao Gestor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INFORMAR COMPRA REALIZADA & PRAZO DE ENTREGA (GESTOR)             */}
      {/* ========================================================================= */}
      {isPurchaseModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-white/10 rounded-xl">
                  <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                </span>
                <div>
                  <h3 className="font-bold text-base leading-tight">Registrar Compra do Material</h3>
                  <p className="text-xs text-blue-100">
                    {selectedRequest.code} • {selectedRequest.materialName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Request Summary Banner */}
            <div className="p-4 bg-blue-50/80 border-b border-blue-100 text-xs text-blue-900 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Quantidade:</span>
                <strong className="text-slate-900">{selectedRequest.quantity} {selectedRequest.unit}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Setor Solicitante:</span>
                <strong className="text-slate-900">{selectedRequest.sector}</strong>
              </div>
              {selectedRequest.linkedOrderId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">OP Vinculada:</span>
                  <strong className="text-blue-700">{selectedRequest.linkedOrderId}</strong>
                </div>
              )}
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmPurchase} className="p-6 space-y-4">
              {/* Fornecedor */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">Fornecedor / Loja Fornecedora *</label>
                <input
                  type="text"
                  required
                  list="suppliers-list"
                  value={purchaseSupplier}
                  onChange={(e) => setPurchaseSupplier(e.target.value)}
                  placeholder="Ex: Alcoa Alumínio, Udinese, Cebrace..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <datalist id="suppliers-list">
                  {COMMON_SUPPLIERS.map((sup) => (
                    <option key={sup} value={sup} />
                  ))}
                </datalist>
              </div>

              {/* Prazo de Entrega Previsto */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">event</span>
                  <span>Prazo / Previsão de Chegada na Fábrica *</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseExpectedDelivery}
                  onChange={(e) => setPurchaseExpectedDelivery(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  A produção e expedição acompanharão esta data de chegada.
                </p>
              </div>

              {/* Pedido de Compra / NF */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">Nº do Pedido de Compra / NF (Opcional)</label>
                <input
                  type="text"
                  value={purchaseOrderNumber}
                  onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                  placeholder="Ex: PED-10492 ou NF-5542"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Observações da Compra */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">Notas da Compra</label>
                <textarea
                  rows={2}
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="Ex: Frete expresso contratado com entrega no portão 2..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 resize-none font-medium"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Confirmar Compra & Mover p/ Em Trânsito</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DAR BAIXA NO RECEBIMENTO (EXPEDIÇÃO / ALMOXARIFADO)               */}
      {/* ========================================================================= */}
      {isReceiveModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-white/10 rounded-xl">
                  <span className="material-symbols-outlined text-[22px]">inventory</span>
                </span>
                <div>
                  <h3 className="font-bold text-base leading-tight">Dar Baixa no Recebimento (Expedição)</h3>
                  <p className="text-xs text-emerald-100">
                    {selectedRequest.code} • {selectedRequest.materialName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Request Summary Banner */}
            <div className="p-4 bg-emerald-50/80 border-b border-emerald-100 text-xs text-emerald-950 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Fornecedor:</span>
                <strong className="text-slate-900">{selectedRequest.supplier || 'Homologado'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantidade Solicitada:</span>
                <strong className="text-slate-900">{selectedRequest.quantity} {selectedRequest.unit}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Setor de Destino:</span>
                <strong className="text-emerald-800">{selectedRequest.sector}</strong>
              </div>
            </div>

            {/* Form Body */}
            <form onSubmit={handleConfirmReceive} className="p-6 space-y-4">
              {/* Quantidade Recebida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Quantidade Recebida *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={receivedQuantity}
                    onChange={(e) => setReceivedQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Data do Recebimento *</label>
                  <input
                    type="date"
                    required
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Nota Fiscal / Lote */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">Nota Fiscal / Romaneio de Entrada</label>
                <input
                  type="text"
                  value={receivedInvoiceNumber}
                  onChange={(e) => setReceivedInvoiceNumber(e.target.value)}
                  placeholder="Ex: NF-10892"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Observação da Conferência */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">Observação da Conferência Físcia</label>
                <textarea
                  rows={2}
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="Ex: Material conferido no almoxarifado sem avarias, pronto para a produção..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 resize-none font-medium"
                />
              </div>

              {/* Responsável */}
              <div className="p-3 bg-slate-100 rounded-xl text-slate-600 text-[11px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-500">badge</span>
                <span>Conferente responsável: <strong>{userName}</strong> (Expedição)</span>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">done_all</span>
                  <span>Confirmar Recebimento & Finalizar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DETALHES COMPLETOS DA SOLICITAÇÃO                                 */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-indigo-400 bg-white/10 px-2 py-0.5 rounded">
                  {selectedRequest.code}
                </span>
                <h3 className="font-bold text-base">{selectedRequest.materialName}</h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs text-slate-700">
              {/* Etapa 1: Dados da Solicitação */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-indigo-900 uppercase text-[10px] tracking-wider">
                    1. Dados da Solicitação (Produção)
                  </span>
                  <span className="text-slate-400 text-[11px]">{selectedRequest.requestedAt}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-800">
                  <p><strong>Quantidade:</strong> {selectedRequest.quantity} {selectedRequest.unit}</p>
                  <p><strong>Categoria:</strong> {selectedRequest.category}</p>
                  <p><strong>Setor:</strong> {selectedRequest.sector}</p>
                  <p><strong>Prioridade:</strong> {selectedRequest.priority}</p>
                  <p><strong>Solicitante:</strong> {selectedRequest.requestedBy}</p>
                  <p><strong>OP Vinculada:</strong> {selectedRequest.linkedOrderId || 'Nenhuma'}</p>
                </div>
                {selectedRequest.notes && (
                  <p className="pt-1 text-slate-600">
                    <strong>Observações:</strong> &ldquo;{selectedRequest.notes}&rdquo;
                  </p>
                )}
                {selectedRequest.imageUrl && (
                  <div className="pt-2">
                    <span className="block font-bold text-[11px] text-slate-700 mb-1">Foto / Anexo:</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRequest.imageUrl}
                      alt="Anexo"
                      onClick={() =>
                        setLightboxData({
                          url: selectedRequest.imageUrl!,
                          title: selectedRequest.materialName,
                        })
                      }
                      className="w-32 h-24 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </div>
                )}
              </div>

              {/* Etapa 2: Dados da Compra */}
              <div className={`p-4 rounded-xl border space-y-2 ${selectedRequest.purchaseDate ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                  <span className="font-bold text-blue-950 uppercase text-[10px] tracking-wider">
                    2. Dados da Compra (Gestão de Suprimentos)
                  </span>
                  {selectedRequest.purchaseDate && <span className="text-blue-800 text-[11px]">Comprado em {selectedRequest.purchaseDate}</span>}
                </div>
                {selectedRequest.purchaseDate ? (
                  <div className="grid grid-cols-2 gap-2 text-slate-800">
                    <p><strong>Fornecedor:</strong> {selectedRequest.supplier}</p>
                    <p><strong>Previsão de Entrega:</strong> <span className="text-blue-700 font-bold">{selectedRequest.expectedDeliveryDate}</span></p>
                    <p><strong>Nº Pedido / NF:</strong> {selectedRequest.purchaseOrderNumber || 'Não informado'}</p>
                    <p><strong>Comprador:</strong> {selectedRequest.purchasedBy}</p>
                    {selectedRequest.purchaseNotes && (
                      <p className="col-span-2 text-slate-600">
                        <strong>Notas:</strong> &ldquo;{selectedRequest.purchaseNotes}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Compra ainda não realizada. Aguardando ação do gestor.</p>
                )}
              </div>

              {/* Etapa 3: Dados do Recebimento */}
              <div className={`p-4 rounded-xl border space-y-2 ${selectedRequest.receivedDate ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                  <span className="font-bold text-emerald-950 uppercase text-[10px] tracking-wider">
                    3. Baixa de Recebimento (Expedição & Almoxarifado)
                  </span>
                  {selectedRequest.receivedDate && <span className="text-emerald-800 text-[11px]">Recebido em {selectedRequest.receivedDate}</span>}
                </div>
                {selectedRequest.receivedDate ? (
                  <div className="grid grid-cols-2 gap-2 text-slate-800">
                    <p><strong>Qtd. Recebida:</strong> {selectedRequest.receivedQuantity} {selectedRequest.unit}</p>
                    <p><strong>Conferente:</strong> {selectedRequest.receivedBy}</p>
                    <p><strong>Nota Fiscal:</strong> {selectedRequest.invoiceNumber || 'Conferido'}</p>
                    {selectedRequest.receiptNotes && (
                      <p className="col-span-2 text-slate-600">
                        <strong>Conferência:</strong> &ldquo;{selectedRequest.receiptNotes}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Material ainda não entregue na fábrica.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={!!lightboxData}
        onClose={() => setLightboxData(null)}
        imageUrl={lightboxData?.url || null}
        title={lightboxData?.title}
        subtitle={lightboxData?.subtitle}
        orderId={lightboxData?.orderId}
      />
    </div>
  );
};
