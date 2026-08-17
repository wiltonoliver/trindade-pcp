'use client';

import React, { useState } from 'react';
import { OrderItem, KanbanColumnId, PriorityLevel, AssemblyOperator, UserProfile } from '@/types/factory';
import { INITIAL_OPERATORS } from '@/lib/factory-store';
import { OrderStatusModal } from './OrderStatusModal';
import { deleteOrderFromFirestore, saveOrderToFirestore } from '@/lib/firestoreSync';
import { normalizeDateToDDMMYYYY, isDateBefore, isOrderOverdueForCheckoff } from '@/lib/dateUtils';

interface PlanningDashboardProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  operators?: AssemblyOperator[];
  searchQuery: string;
  onNavigateToOrderEntry: () => void;
  onNavigateToPendingCheckouts?: () => void;
  onOpenDevModal?: () => void;
  currentUser?: UserProfile | null;
}

export const PlanningDashboard: React.FC<PlanningDashboardProps> = ({
  orders,
  setOrders,
  operators = INITIAL_OPERATORS,
  searchQuery,
  onNavigateToOrderEntry,
  onNavigateToPendingCheckouts,
  onOpenDevModal,
  currentUser,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'mes' | 'semana'>('mes');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState<number>(1); // 1, 2, or 3 (3 screens = 15 business days)
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<OrderItem | null>(null);

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isVendasRole = userRole.includes('venda') || userRole.includes('lojista') || userRole.includes('representante');
  const isReadOnly = isVendasRole || currentUser?.permissions?.canEditProduction === false;

  // Operator assignment modal state
  const [selectedOrderForOperator, setSelectedOrderForOperator] = useState<OrderItem | null>(null);
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [operatorSearchQuery, setOperatorSearchQuery] = useState('');
  const [selectedOrderForStatusModal, setSelectedOrderForStatusModal] = useState<OrderItem | null>(null);

  const handleAssignOperator = (orderId: string, operator: AssemblyOperator | null) => {
    if (isReadOnly) return;
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const updated = {
            ...ord,
            assignedOperatorId: operator ? operator.id : undefined,
            assignedOperatorName: operator ? operator.name : undefined,
            assignedOperatorCode: operator ? operator.code : undefined,
          };
          saveOrderToFirestore(updated).catch(() => {});
          return updated;
        }
        return ord;
      })
    );
    if (selectedOrderForOperator && selectedOrderForOperator.id === orderId) {
      setSelectedOrderForOperator((prev) =>
        prev
          ? {
              ...prev,
              assignedOperatorId: operator ? operator.id : undefined,
              assignedOperatorName: operator ? operator.name : undefined,
              assignedOperatorCode: operator ? operator.code : undefined,
            }
          : null
      );
    }
  };

  // New Order Form state
  const [newOrderId, setNewOrderId] = useState('');
  const [newStore, setNewStore] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newQty, setNewQty] = useState<number | ''>('');
  const [newColumn, setNewColumn] = useState<KanbanColumnId>('nao_planejado');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('NORMAL');

  const handleOpenAddModal = () => {
    setNewOrderId('');
    setNewStore('');
    setNewItemDesc('');
    setNewQty('');
    setNewColumn('nao_planejado');
    setIsAddModalOpen(true);
  };

  // Compute 15 consecutive business days (skipping weekends)
  const get15BusinessDays = () => {
    const days: { date: Date; dateStr: string; formattedFull: string; dayName: string; index: number }[] = [];
    const curr = new Date();

    // Skip weekend to next business day if today is weekend
    if (curr.getDay() === 6) {
      curr.setDate(curr.getDate() + 2);
    } else if (curr.getDay() === 0) {
      curr.setDate(curr.getDate() + 1);
    }

    while (days.length < 15) {
      const dow = curr.getDay();
      if (dow !== 0 && dow !== 6) {
        const rawDay = curr.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dayName = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);
        const day = String(curr.getDate()).padStart(2, '0');
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const year = curr.getFullYear();
        const dateStr = `${day}/${month}/${year}`;

        days.push({
          date: new Date(curr),
          dateStr,
          formattedFull: `${dayName} ${dateStr}`,
          dayName,
          index: days.length + 1,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  };

  const allBusinessDays = get15BusinessDays();

  const getColumnIdForIndex = (index: number): KanbanColumnId => {
    if (index === 0) return 'hoje';
    if (index === 1) return 'amanha';
    if (index === 2) return 'dia_3';
    if (index === 3) return 'dia_4';
    if (index === 4) return 'dia_5';
    return `dia_${index + 1}` as KanbanColumnId;
  };

  const colorPalette = [
    { dotColor: 'bg-blue-600', badgeBg: 'bg-blue-50', badgeText: 'text-blue-600', borderHighlight: 'border-blue-500/30 bg-blue-50/30' },
    { dotColor: 'bg-indigo-600', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-600' },
    { dotColor: 'bg-purple-600', badgeBg: 'bg-purple-50', badgeText: 'text-purple-600' },
    { dotColor: 'bg-teal-600', badgeBg: 'bg-teal-50', badgeText: 'text-teal-600' },
    { dotColor: 'bg-slate-600', badgeBg: 'bg-slate-100', badgeText: 'text-slate-600' },

    { dotColor: 'bg-amber-600', badgeBg: 'bg-amber-50', badgeText: 'text-amber-700' },
    { dotColor: 'bg-emerald-600', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700' },
    { dotColor: 'bg-cyan-600', badgeBg: 'bg-cyan-50', badgeText: 'text-cyan-700' },
    { dotColor: 'bg-violet-600', badgeBg: 'bg-violet-50', badgeText: 'text-violet-700' },
    { dotColor: 'bg-fuchsia-600', badgeBg: 'bg-fuchsia-50', badgeText: 'text-fuchsia-700' },

    { dotColor: 'bg-rose-600', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700' },
    { dotColor: 'bg-sky-600', badgeBg: 'bg-sky-50', badgeText: 'text-sky-700' },
    { dotColor: 'bg-lime-600', badgeBg: 'bg-lime-50', badgeText: 'text-lime-700' },
    { dotColor: 'bg-orange-600', badgeBg: 'bg-orange-50', badgeText: 'text-orange-700' },
    { dotColor: 'bg-zinc-600', badgeBg: 'bg-zinc-100', badgeText: 'text-zinc-700' },
  ];

  // All 15 business day column configurations
  const allColumnsConfig = allBusinessDays.map((day, idx) => {
    const colId = getColumnIdForIndex(idx);
    const colors = colorPalette[idx % colorPalette.length];
    let title = day.formattedFull;
    if (idx === 0) title = `Hoje ${day.formattedFull}`;
    else if (idx === 1) title = `Amanhã ${day.formattedFull}`;

    return {
      id: colId,
      title,
      dotColor: colors.dotColor,
      badgeBg: colors.badgeBg,
      badgeText: colors.badgeText,
      borderHighlight: colors.borderHighlight,
      defaultDateStr: day.dateStr,
      dayNumber: idx + 1,
    };
  });

  // Current screen / page columns (5 days per screen)
  const pageStartIndex = (currentPage - 1) * 5;
  const currentPageDays = allBusinessDays.slice(pageStartIndex, pageStartIndex + 5);
  const columnsConfig = allColumnsConfig.slice(pageStartIndex, pageStartIndex + 5);

  // Filter active orders (excluding completed ones) and filter by search query
  const activeOrders = orders.filter((ord) => ord.executionStatus !== 'concluido' && ord.progress !== 100);

  // Orders overdue for check-off from past dates
  const overdueCheckouts = orders.filter((ord) =>
    isOrderOverdueForCheckoff(ord.productionDate, ord.executionStatus, ord.progress)
  );

  const filteredOrders = activeOrders.filter((ord) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ord.orderId.toLowerCase().includes(q) ||
      ord.store.toLowerCase().includes(q) ||
      ord.itemDescription.toLowerCase().includes(q)
    );
  });

  const getOrdersByColumn = (col: { id: string; defaultDateStr: string; dayNumber?: number }) => {
    const colDateNorm = normalizeDateToDDMMYYYY(col.defaultDateStr);

    return filteredOrders.filter((ord) => {
      if (!ord.productionDate || ord.productionDate.toLowerCase().includes('aguardando')) {
        return false;
      }

      const ordDateNorm = normalizeDateToDDMMYYYY(ord.productionDate);

      // Exact calendar date match for this column
      return ordDateNorm === colDateNorm;
    });
  };

  const getPageOrdersCount = (pageIndex: number) => {
    const pStart = (pageIndex - 1) * 5;
    const pageCols = allColumnsConfig.slice(pStart, pStart + 5);
    let count = 0;
    pageCols.forEach((col) => {
      count += getOrdersByColumn(col).length;
    });
    return count;
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isReadOnly) return;
    setDraggedOrderId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCol: KanbanColumnId) => {
    e.preventDefault();
    if (isReadOnly) return;
    const id = draggedOrderId || e.dataTransfer.getData('text/plain');
    if (!id) return;

    const matchedCol = allColumnsConfig.find((c) => c.id === targetCol);
    const dateToAssign = matchedCol?.defaultDateStr || '';

    setOrders((prev) => {
      const updatedList = prev.map((ord) => {
        if (ord.id === id) {
          const isAguardando = targetCol === 'nao_planejado';
          const updated = {
            ...ord,
            column: targetCol,
            productionDate: isAguardando ? 'Aguardando Data' : (dateToAssign || ord.productionDate),
            executionStatus: isAguardando ? 'pendente' : ord.executionStatus,
          };
          saveOrderToFirestore(updated).catch(() => {});
          return updated;
        }
        return ord;
      });
      return updatedList;
    });
    setDraggedOrderId(null);
  };

  const handleQuickMove = (id: string, targetCol: KanbanColumnId) => {
    if (isReadOnly) return;
    const matchedCol = allColumnsConfig.find((c) => c.id === targetCol);
    const dateToAssign = matchedCol?.defaultDateStr || '';

    setOrders((prev) => {
      const updatedList = prev.map((ord) => {
        if (ord.id === id) {
          const isAguardando = targetCol === 'nao_planejado';
          const updated = {
            ...ord,
            column: targetCol,
            productionDate: isAguardando ? 'Aguardando Data' : (dateToAssign || ord.productionDate),
            executionStatus: isAguardando ? 'pendente' : ord.executionStatus,
          };
          saveOrderToFirestore(updated).catch(() => {});
          return updated;
        }
        return ord;
      });
      return updatedList;
    });
  };

  const handleUpdateDate = (id: string, dateStr: string) => {
    if (isReadOnly) return;
    setOrders((prev) => {
      const updatedList = prev.map((ord) => {
        if (ord.id === id) {
          const isEmptyOrAguardando = !dateStr.trim() || dateStr.toLowerCase().includes('aguardando');
          const updated = {
            ...ord,
            productionDate: dateStr,
            column: isEmptyOrAguardando ? 'nao_planejado' : ord.column,
            executionStatus: isEmptyOrAguardando ? 'pendente' : ord.executionStatus,
          };
          saveOrderToFirestore(updated).catch(() => {});
          return updated;
        }
        return ord;
      });
      return updatedList;
    });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const isAguardando = newColumn === 'nao_planejado';
    const matchedCol = allColumnsConfig.find((c) => c.id === newColumn);
    const initialDate = isAguardando ? 'Aguardando Data' : (matchedCol?.defaultDateStr || '');

    const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ord-${String(new Date().valueOf())}`;
    const fallbackOrderId = `#ORD-${String(Math.floor(Number(new Date().valueOf() % 9000)) + 1000)}`;

    const newOrd: OrderItem = {
      id: `ord-${generatedId}`,
      orderId: (newOrderId.trim() || fallbackOrderId).toUpperCase(),
      store: newStore.trim().toUpperCase(),
      storeInitials: newStore.trim()
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'OP',
      storeColorClass: 'bg-[#dae2fd] text-[#131b2e]',
      itemDescription: newItemDesc.trim().toUpperCase(),
      quantity: Number(newQty) || 1,
      progress: 0,
      column: newColumn,
      priority: newPriority,
      executionStatus: 'pendente',
      productionDate: initialDate,
    };

    setOrders((prev) => [newOrd, ...prev]);
    saveOrderToFirestore(newOrd).catch(() => {});
    setNewOrderId('');
    setNewStore('');
    setNewItemDesc('');
    setNewQty('');
    setIsAddModalOpen(false);
  };

  const pendingUrgencyOrders = orders.filter((o) => o.urgencyRequest?.status === 'pending');

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard de Planejamento
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Otimize a sequência de produção e gerencie prazos de entrega.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white shadow-xs text-blue-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_kanban</span>
              <span>Quadros (Kanban)</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white shadow-xs text-blue-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              <span>Lista por Etapa</span>
            </button>
          </div>

          {!isReadOnly && (
            <button
              onClick={handleOpenAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Novo Pedido</span>
            </button>
          )}
        </div>
      </div>

      {/* Overdue Check-offs Alert Banner */}
      {overdueCheckouts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 border-l-4 border-l-amber-500 text-amber-950 px-4 py-3.5 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-lg">history_toggle_off</span>
            </div>
            <div>
              <p className="font-bold text-amber-950 text-xs">
                {overdueCheckouts.length} {overdueCheckouts.length === 1 ? 'Baixa Pendente de dia anterior' : 'Baixas Pendentes de dias anteriores'}
              </p>
              <p className="text-amber-900/80 text-[11px] font-medium mt-0.5">
                Existem produções programadas em datas passadas que não foram baixadas. Dê baixa para não misturar com as produções vigentes de hoje.
              </p>
            </div>
          </div>
          {onNavigateToPendingCheckouts && (
            <button
              type="button"
              onClick={onNavigateToPendingCheckouts}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 self-end sm:self-auto"
            >
              <span>Ir para Baixas Pendentes</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
        </div>
      )}
      {pendingUrgencyOrders.length > 0 && (
        <div className="bg-amber-100/90 border border-amber-400 border-l-4 border-l-amber-500 text-amber-950 px-4 py-3.5 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-lg animate-pulse">bolt</span>
            </div>
            <div>
              <p className="font-bold text-amber-950 text-xs">
                {pendingUrgencyOrders.length} {pendingUrgencyOrders.length === 1 ? 'Solicitação de Urgência Pendente' : 'Solicitações de Urgência Pendentes'}
              </p>
              <p className="text-amber-900 text-[11px] font-medium mt-0.5">
                {isReadOnly 
                  ? 'Sua solicitação de urgência foi enviada aos gestores e está aguardando avaliação.'
                  : 'O setor de Vendas solicitou urgência em pedido(s). Clique abaixo para avaliar as justificativas.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedOrderForStatusModal(pendingUrgencyOrders[0])}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1 self-end sm:self-auto"
          >
            <span>Analisar Pedido</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      )}



      {/* 15 Business Days Horizon Page Navigation Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Active Horizon Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">calendar_month</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">
                Horizonte de Planejamento (15 Dias Úteis)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-medium text-xs">
                Dias {pageStartIndex + 1} a {pageStartIndex + 5} <span className="text-slate-400 font-normal">({currentPageDays[0]?.dateStr} a {currentPageDays[currentPageDays.length - 1]?.dateStr})</span>
              </span>
              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md font-bold text-xs">
                {getPageOrdersCount(currentPage)} {getPageOrdersCount(currentPage) === 1 ? 'pedido agendado' : 'pedidos agendados'}
              </span>
            </div>
          </div>
        </div>

        {/* Page Switcher Tabs & Previous / Next Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`p-1.5 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-0.5 border ${
              currentPage === 1
                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 border-slate-200 shadow-2xs cursor-pointer'
            }`}
            title="Ver 5 dias úteis anteriores"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {[1, 2, 3].map((pageNum) => {
              const pCount = getPageOrdersCount(pageNum);
              const pDays = allBusinessDays.slice((pageNum - 1) * 5, pageNum * 5);
              const startStr = pDays[0]?.dateStr.substring(0, 5) || '';
              const endStr = pDays[pDays.length - 1]?.dateStr.substring(0, 5) || '';
              const isSelected = currentPage === pageNum;

              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-white shadow-2xs text-blue-600 border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={`Tela ${pageNum}: ${startStr} até ${endStr}`}
                >
                  <span>Tela {pageNum}</span>
                  <span className="text-[10px] opacity-75 font-normal hidden sm:inline">({startStr}-{endStr})</span>
                  {pCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {pCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(3, prev + 1))}
            disabled={currentPage === 3}
            className={`p-1.5 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-0.5 border ${
              currentPage === 3
                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 border-slate-200 shadow-2xs cursor-pointer'
            }`}
            title="Ver próximos 5 dias úteis (Próxima Tela)"
          >
            <span className="hidden sm:inline">Próxima</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* View Mode Switching: Kanban vs List View */}
      {viewMode === 'kanban' ? (
        /* Kanban Board */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[520px]">
          {columnsConfig.map((col) => {
            const colOrders = getOrdersByColumn(col);
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="flex flex-col gap-3 min-w-0"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dotColor}`} />
                    <h3
                      suppressHydrationWarning
                      className="font-bold text-[11px] text-slate-700 uppercase tracking-tight truncate"
                      title={col.title}
                    >
                      {col.title}
                    </h3>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${col.badgeBg} ${col.badgeText}`}
                    >
                      {colOrders.length < 10 ? `0${colOrders.length}` : colOrders.length}
                    </span>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={() => {
                        setNewColumn(col.id);
                        setIsAddModalOpen(true);
                      }}
                      className="material-symbols-outlined text-slate-300 hover:text-blue-600 transition-colors text-[18px] cursor-pointer shrink-0"
                      title="Adicionar à coluna"
                    >
                      add_circle
                    </button>
                  )}
                </div>

                {/* Kanban Droppable Column Container */}
                <div
                  className={`kanban-column space-y-3 p-2.5 rounded-2xl border flex-1 ${
                    col.borderHighlight
                      ? col.borderHighlight
                      : 'bg-slate-100/50 border-slate-200/60'
                  } transition-all`}
                >
                  {colOrders.length === 0 ? (
                    <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-white/60 flex flex-col items-center justify-center text-center text-slate-400 min-h-[120px]">
                      <span className="material-symbols-outlined text-[28px] mb-1 opacity-50">
                        inventory_2
                      </span>
                      <p className="text-[11px] font-medium">{isReadOnly ? 'Nenhum pedido nesta etapa' : 'Arraste para agendar'}</p>
                    </div>
                  ) : (
                    colOrders.map((ord, idx) => (
                      <div
                        key={ord.id ? `${ord.id}-${idx}` : `ord-${idx}`}
                        draggable={!isReadOnly}
                        onDragStart={(e) => handleDragStart(e, ord.id)}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                        } group relative ${
                          ord.urgencyRequest?.status === 'pending'
                            ? 'bg-amber-100/90 border-amber-400 border-l-4 border-l-amber-500 ring-2 ring-amber-400/30 shadow-xs'
                            : ord.column === 'hoje'
                            ? 'bg-white border-blue-200 shadow-2xs'
                            : 'bg-white border-slate-100 shadow-2xs'
                        }`}
                      >
                        {/* Card Actions (Delete & Drag Handle) */}
                        {!isReadOnly && (
                          <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOrderToDelete(ord);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Excluir pedido"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                            <span className="material-symbols-outlined text-slate-300 text-[16px]">
                              drag_indicator
                            </span>
                          </div>
                        )}

                        {/* Store Header */}
                        <div className="flex items-start gap-2.5 mb-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {ord.storeInitials}
                          </div>
                          <div className="overflow-hidden pr-3">
                            <h4 className="font-semibold text-xs text-slate-900 truncate">
                              {ord.store}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderForStatusModal(ord);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                              title="Clique para relatar status / motivo desta OP"
                            >
                              <span>OP: {ord.orderId}</span>
                              <span className="material-symbols-outlined text-[12px] text-slate-400">edit_note</span>
                            </button>
                          </div>
                        </div>

                        {/* Items & Progress */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">
                              inventory_2
                            </span>
                            <span className="text-[11px] font-medium truncate">{ord.itemDescription}</span>
                          </div>

                          {/* Badges for Priority and Urgency Request Status */}
                          {(ord.priority === 'ALTA PRIORIDADE' || ord.urgencyRequest) && (
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {ord.priority === 'ALTA PRIORIDADE' && (
                                <span className="bg-amber-50/80 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 rounded-md text-[9px] font-medium inline-block">
                                  Alta Prioridade
                                </span>
                              )}
                              {ord.urgencyRequest?.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrderForStatusModal(ord);
                                  }}
                                  className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2 py-0.5 rounded-md text-[9px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                  title="Solicitação de Urgência Pendente - Clique para avaliar"
                                >
                                  <span className="material-symbols-outlined text-[11px] text-white">bolt</span>
                                  <span>Urgência Solicitada</span>
                                </button>
                              )}
                              {ord.urgencyRequest?.status === 'approved' && (
                                <span
                                  className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[9px] font-medium inline-flex items-center gap-1"
                                  title={`Urgência Aprovada por ${ord.urgencyRequest.evaluatedBy}`}
                                >
                                  <span className="material-symbols-outlined text-[11px] text-emerald-600">verified</span>
                                  <span>Urgência Aceita</span>
                                </span>
                              )}
                              {ord.urgencyRequest?.status === 'rejected' && (
                                <span
                                  className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-md text-[9px] font-medium inline-flex items-center gap-1"
                                  title={`Urgência Recusada por ${ord.urgencyRequest.evaluatedBy}: ${ord.urgencyRequest.evaluatorNote}`}
                                >
                                  <span className="material-symbols-outlined text-[11px] text-slate-400">info</span>
                                  <span>Urgência Recusada</span>
                                </span>
                              )}
                            </div>
                          )}

                          {ord.column === 'hoje' ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>Status</span>
                                <span className="text-blue-600 font-bold">
                                  {ord.progress}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: `${ord.progress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full bg-slate-100 rounded-full h-1">
                              <div
                                className="bg-blue-600 h-1 rounded-full"
                                style={{ width: `${ord.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View (Detailed tables for each schedule section) */
        <div className="space-y-8 animate-fadeIn">
          {columnsConfig.map((col, index) => {
            const colOrders = getOrdersByColumn(col);
            const totalQty = colOrders.reduce((sum, item) => sum + (item.quantity || 0), 0);

            let sectionTitle = `${col.dayNumber}. Programação para ${col.title}`;
            let sectionDesc = `Fila de ordens de produção programadas para o dia útil ${col.dayNumber} do planejamento.`;
            let sectionIcon = 'calendar_month';

            if (col.dayNumber === 1) {
              sectionTitle = `1. Produção de Hoje (${col.title})`;
              sectionDesc = 'Ordens de produção ativas em corte, costura ou acabamento com meta de conclusão para hoje.';
              sectionIcon = 'today';
            } else if (col.dayNumber === 2) {
              sectionTitle = `2. Produção do Próximo Dia (${col.title})`;
              sectionDesc = 'Planejamento e preparação de materiais para as ordens agendadas para o próximo dia útil.';
              sectionIcon = 'event_upcoming';
            }

            return (
              <div key={col.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {/* Section Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[22px]">{sectionIcon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 suppressHydrationWarning className="font-bold text-base text-slate-900">{sectionTitle}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${col.badgeBg} ${col.badgeText}`}>
                          {colOrders.length} {colOrders.length === 1 ? 'pedido' : 'pedidos'}
                        </span>
                        {totalQty > 0 && (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                            {totalQty} peças
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{sectionDesc}</p>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <button
                      onClick={() => {
                        setNewColumn(col.id);
                        setIsAddModalOpen(true);
                      }}
                      className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px] text-blue-600">add</span>
                      <span>Adicionar Pedido</span>
                    </button>
                  )}
                </div>

                {/* Section Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                        <th className="px-5 py-3.5">Pedido / OP</th>
                        <th className="px-5 py-3.5">Loja / Cliente</th>
                        <th className="px-5 py-3.5">Descrição do Item</th>
                        <th className="px-5 py-3.5 text-center">Qtd</th>
                        <th className="px-5 py-3.5">Montador Responsável</th>
                        <th className="px-5 py-3.5">Prioridade</th>
                        <th className="px-5 py-3.5">Progresso</th>
                        <th className="px-5 py-3.5">Data Programada</th>
                        <th className="px-5 py-3.5">Mover de Etapa</th>
                        <th className="px-5 py-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {colOrders.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-6 py-8 text-center text-slate-400 bg-white">
                            <span className="material-symbols-outlined text-[32px] text-slate-300 block mb-1">
                              inbox
                            </span>
                            <p className="font-semibold text-slate-600 text-xs">Nenhum pedido nesta etapa</p>
                            {!isReadOnly && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Clique em &quot;+ Adicionar Pedido&quot; para inserir itens nesta lista.
                              </p>
                            )}
                          </td>
                        </tr>
                      ) : (
                        colOrders.map((ord, idx) => (
                          <tr
                            key={ord.id ? `${ord.id}-${idx}` : `ord-${idx}`}
                            className={`transition-colors ${
                              ord.urgencyRequest?.status === 'pending'
                                ? 'bg-amber-100/90 hover:bg-amber-200/80 border-l-4 border-l-amber-500 font-medium'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="px-5 py-4 font-bold text-blue-600">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForStatusModal(ord)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer"
                                title="Clique para abrir e relatar status / motivo da OP"
                              >
                                <span>{ord.orderId}</span>
                                <span className="material-symbols-outlined text-[14px]">edit_note</span>
                              </button>
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {ord.storeInitials}
                                </span>
                                <span>{ord.store}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-700 font-medium">
                              {ord.itemDescription}
                            </td>
                            <td className="px-5 py-4 text-center font-bold text-slate-900">
                              {ord.quantity}
                            </td>
                            <td className="px-5 py-4">
                              {isReadOnly ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
                                  <span className="material-symbols-outlined text-[14px] text-slate-500">engineering</span>
                                  <span>{ord.assignedOperatorName ? (ord.assignedOperatorCode ? `${ord.assignedOperatorCode} - ${ord.assignedOperatorName}` : ord.assignedOperatorName) : 'Não designado'}</span>
                                </span>
                              ) : ord.assignedOperatorName ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderForOperator(ord);
                                    setIsOperatorModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                                  title="Clique para alterar montador"
                                >
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">engineering</span>
                                  <span>{ord.assignedOperatorCode ? `${ord.assignedOperatorCode} - ${ord.assignedOperatorName}` : ord.assignedOperatorName}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOrderForOperator(ord);
                                    setIsOperatorModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 text-xs font-medium transition-colors cursor-pointer"
                                  title="Designar montador"
                                >
                                  <span className="material-symbols-outlined text-[14px] text-blue-500">person_add</span>
                                  <span>Designar</span>
                                </button>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1 items-start">
                                {ord.priority === 'ALTA PRIORIDADE' ? (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    ALTA
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">
                                    NORMAL
                                  </span>
                                )}

                                {ord.urgencyRequest?.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrderForStatusModal(ord)}
                                    className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-2 py-0.5 rounded text-[10px] cursor-pointer shadow-2xs transition-colors"
                                    title="Urgência Solicitada pelo Vendedor - Clique para avaliar"
                                  >
                                    <span className="material-symbols-outlined text-[12px] text-white">bolt</span>
                                    <span>Urgência Solicitada</span>
                                  </button>
                                )}
                                {ord.urgencyRequest?.status === 'approved' && (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-medium">
                                    <span>Urgência Aceita</span>
                                  </span>
                                )}
                                {ord.urgencyRequest?.status === 'rejected' && (
                                  <span
                                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-medium"
                                    title={`Recusada por ${ord.urgencyRequest.evaluatedBy}: ${ord.urgencyRequest.evaluatorNote}`}
                                  >
                                    <span className="material-symbols-outlined text-[11px] text-slate-400">info</span>
                                    <span>Urgência Recusada</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 w-36">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                  <span>{ord.progress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${ord.progress}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 text-xs w-40">
                                <span className={`material-symbols-outlined text-[14px] shrink-0 ${ord.column === 'nao_planejado' ? 'text-amber-600' : 'text-blue-600'}`}>
                                  calendar_today
                                </span>
                                <input
                                  type="text"
                                  readOnly={isReadOnly}
                                  disabled={isReadOnly}
                                  value={ord.column === 'nao_planejado' && (!ord.productionDate || ord.productionDate === 'Aguardando Data') ? 'Aguardando Data' : (ord.productionDate || '')}
                                  onChange={(e) => handleUpdateDate(ord.id, e.target.value)}
                                  placeholder="Aguardando Data"
                                  className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 w-full text-slate-900 placeholder:text-slate-400"
                                />
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {isReadOnly ? (
                                <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold max-w-[160px] truncate">
                                  {allColumnsConfig.find(c => c.id === ord.column)?.title || ord.column}
                                </span>
                              ) : (
                                <select
                                  value={ord.column}
                                  onChange={(e) => handleQuickMove(ord.id, e.target.value as KanbanColumnId)}
                                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[160px] truncate"
                                >
                                  {allColumnsConfig.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForStatusModal(ord)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Relatar status / motivo da OP"
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                </button>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => setOrderToDelete(ord)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir pedido"
                                  >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* Modal: Manual Add Order */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-slate-200 animate-scaleUp max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 shrink-0">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">add_box</span>
                <span>Novo Pedido de Produção</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  ID do Pedido
                </label>
                <input
                  type="text"
                  required
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  placeholder="Ex: #ORD-9950"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Loja / Cliente
                </label>
                <input
                  type="text"
                  required
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  placeholder="Ex: Loja E - Flamboyant"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={newStore.toUpperCase() === 'PD. ESTOQUE'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewStore('PD. ESTOQUE');
                      } else if (newStore.toUpperCase() === 'PD. ESTOQUE') {
                        setNewStore('');
                      }
                    }}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">inventory_2</span>
                    Pedido Para Estoque
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Descrição dos Itens
                </label>
                <input
                  type="text"
                  required
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Ex: 50x Camisas Polo"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 30"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Coluna Kanban
                  </label>
                  <select
                    value={newColumn}
                    onChange={(e) => setNewColumn(e.target.value as KanbanColumnId)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="nao_planejado">⏳ Aguardando Data (Fila de Programação)</option>
                    {allColumnsConfig.map((c) => (
                      <option key={c.id} value={c.id} suppressHydrationWarning>
                        📅 {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Prioridade
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA PRIORIDADE">Alta Prioridade</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
                >
                  Criar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Order Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-scaleUp text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Excluir Pedido?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Tem certeza que deseja remover o pedido <strong className="text-slate-900">{orderToDelete.orderId}</strong> ({orderToDelete.itemDescription}) da loja <strong>{orderToDelete.store}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer w-full"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedId = orderToDelete.id;
                  if (deletedId) {
                    if (typeof window !== 'undefined') {
                      const deletedIdsStr = localStorage.getItem('trindade_deleted_order_ids');
                      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
                      if (!deletedIds.includes(deletedId)) {
                        deletedIds.push(deletedId);
                        localStorage.setItem('trindade_deleted_order_ids', JSON.stringify(deletedIds));
                      }
                    }
                    deleteOrderFromFirestore(deletedId).catch((err) => console.error('Erro ao excluir pedido do Firestore:', err));
                  }
                  setOrders((prev) => prev.filter((o) => o.id !== deletedId));
                  setOrderToDelete(null);
                }}
                className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs cursor-pointer w-full flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Operator / Montador Modal */}
      {isOperatorModalOpen && selectedOrderForOperator && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl border border-slate-200 animate-scaleUp flex flex-col max-h-[85vh] sm:max-h-[90vh] my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">engineering</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Designar Operador / Montador</h3>
                  <p className="text-xs text-slate-500">Selecione o funcionário responsável pela montagem desta peça</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOperatorModalOpen(false);
                  setSelectedOrderForOperator(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 my-1">
              {/* Selected Order Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-600">{selectedOrderForOperator.orderId}</span>
                  <span className="text-slate-500 font-medium">{selectedOrderForOperator.store}</span>
                </div>
                <p className="font-semibold text-sm text-slate-900">{selectedOrderForOperator.itemDescription}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                  <span>Qtd: <strong>{selectedOrderForOperator.quantity} peças</strong></span>
                  <span>Data Programada: <strong>{selectedOrderForOperator.productionDate || 'Aguardando data'}</strong></span>
                </div>
              </div>

              {/* Current Assignment Badge or Notice */}
              {selectedOrderForOperator.assignedOperatorName ? (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                    <div>
                      <span className="font-bold block text-[11px]">Montador Atribuído:</span>
                      <span className="font-semibold">{selectedOrderForOperator.assignedOperatorCode ? `${selectedOrderForOperator.assignedOperatorCode} - ` : ''}{selectedOrderForOperator.assignedOperatorName}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssignOperator(selectedOrderForOperator.id, null)}
                    className="px-2.5 py-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">info</span>
                  <span>Nenhum operador atribuído a esta ordem de produção ainda.</span>
                </div>
              )}

              {/* Operators Search & Selection List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Selecione o Montador Apto:</label>
                  <span className="text-[11px] text-slate-400">
                    {operators.filter((op) => op.status === 'Ativo').length} montadores ativos
                  </span>
                </div>

                {/* Search filter */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={operatorSearchQuery}
                    onChange={(e) => setOperatorSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, código (OP-101) ou especialidade..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Operators list */}
                <div className="max-h-48 sm:max-h-56 overflow-y-auto space-y-2 pr-1">
                  {operators
                    .filter((op) => op.status === 'Ativo')
                    .filter((op) => {
                      if (!operatorSearchQuery) return true;
                      const q = operatorSearchQuery.toLowerCase();
                      return (
                        op.name.toLowerCase().includes(q) ||
                        op.code.toLowerCase().includes(q) ||
                        op.specialty.toLowerCase().includes(q) ||
                        op.role.toLowerCase().includes(q)
                      );
                    })
                    .map((op) => {
                      const isSelected = selectedOrderForOperator.assignedOperatorId === op.id;
                      return (
                        <div
                          key={op.id}
                          onClick={() => handleAssignOperator(selectedOrderForOperator.id, op)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {op.code}
                            </div>
                            <div className="truncate">
                              <h4 className="font-bold text-xs text-slate-900 truncate">{op.name}</h4>
                              <p className="text-[10px] text-slate-500 truncate">{op.specialty}</p>
                              <span className="text-[9px] text-slate-400 block">{op.shift || '1º Turno'} • {op.plant || 'Matriz'}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white'
                            }`}
                          >
                            {isSelected ? 'Selecionado' : 'Designar'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOperatorModalOpen(false);
                  setSelectedOrderForOperator(null);
                }}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Status & Delay History Modal */}
      <OrderStatusModal
        key={selectedOrderForStatusModal?.id || 'none'}
        order={selectedOrderForStatusModal}
        isOpen={!!selectedOrderForStatusModal}
        onClose={() => setSelectedOrderForStatusModal(null)}
        currentUser={currentUser}
        onUpdateOrder={(updatedOrder) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );
          setSelectedOrderForStatusModal(updatedOrder);
          saveOrderToFirestore(updatedOrder);
        }}
      />
    </div>
  );
};
