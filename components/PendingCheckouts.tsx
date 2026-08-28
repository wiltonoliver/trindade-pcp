'use client';

import React, { useState, useMemo } from 'react';
import { OrderItem, UserProfile, AssemblyOperator, Store, OrderStatusHistoryLog } from '@/types/factory';
import { isOrderOverdueForCheckoff, normalizeDateToDDMMYYYY, getLocalDateFormatted } from '@/lib/dateUtils';
import { OrderStatusModal } from './OrderStatusModal';
import { saveOrderToFirestore } from '@/lib/firestoreSync';
import {
  notifyOrderCompleted,
  notifyBatchOrdersCompleted,
  notifyProductionRescheduled,
} from '@/lib/notificationService';

interface PendingCheckoutsProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  stores?: Store[];
  operators?: AssemblyOperator[];
  searchQuery?: string;
  currentUser?: UserProfile | null;
  onNavigateToDashboard: () => void;
}

export const PendingCheckouts: React.FC<PendingCheckoutsProps> = ({
  orders,
  setOrders,
  stores = [],
  operators = [],
  searchQuery = '',
  currentUser,
  onNavigateToDashboard,
}) => {
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<OrderItem | null>(null);
  
  // Batch selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // Feedback toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  const todayStr = useMemo(() => getLocalDateFormatted(), []);

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isVendasRole = userRole.includes('venda') || userRole.includes('lojista') || userRole.includes('representante');
  const isReadOnly = isVendasRole || currentUser?.permissions?.canEditProduction === false;

  // Filter orders that are overdue for check-off
  const overdueOrders = useMemo(() => {
    return orders.filter((ord) => isOrderOverdueForCheckoff(ord.productionDate, ord.executionStatus, ord.progress, todayStr, ord.isClosedUncompleted));
  }, [orders, todayStr]);

  // Unique past dates present in overdue list
  const uniquePastDates = useMemo(() => {
    const datesSet = new Set<string>();
    overdueOrders.forEach((ord) => {
      if (ord.productionDate) {
        datesSet.add(normalizeDateToDDMMYYYY(ord.productionDate));
      }
    });
    return Array.from(datesSet).sort();
  }, [overdueOrders]);

  // Combined filtered overdue orders
  const filteredOrders = useMemo(() => {
    return overdueOrders.filter((ord) => {
      // Store filter
      if (selectedStoreFilter !== 'ALL' && ord.store.toLowerCase() !== selectedStoreFilter.toLowerCase()) {
        return false;
      }

      // Date filter
      if (selectedDateFilter !== 'ALL') {
        const norm = normalizeDateToDDMMYYYY(ord.productionDate);
        if (norm !== selectedDateFilter) return false;
      }

      // Search term
      const query = (localSearch || searchQuery).trim().toLowerCase();
      if (query) {
        const matchId = ord.orderId?.toLowerCase().includes(query);
        const matchStore = ord.store?.toLowerCase().includes(query);
        const matchDesc = ord.itemDescription?.toLowerCase().includes(query);
        const matchOp = ord.assignedOperatorName?.toLowerCase().includes(query);
        if (!matchId && !matchStore && !matchDesc && !matchOp) {
          return false;
        }
      }

      return true;
    });
  }, [overdueOrders, selectedStoreFilter, selectedDateFilter, localSearch, searchQuery]);

  // Summary Metrics
  const totalPieces = useMemo(() => {
    return overdueOrders.reduce((sum, ord) => sum + (ord.quantity || 0), 0);
  }, [overdueOrders]);

  const uniqueStoresCount = useMemo(() => {
    const storesSet = new Set(overdueOrders.map((ord) => ord.store));
    return storesSet.size;
  }, [overdueOrders]);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Quick action: Give 100% Baixa
  const handleQuickBaixa = (ord: OrderItem) => {
    if (isReadOnly) return;

    const author = currentUser?.name || 'Gerente de Operações';
    const nowISO = new Date().toISOString();

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: nowISO,
      author,
      status: 'concluido',
      note: 'Baixa efetuada diretamente pela tela de Baixas Pendentes',
      actionType: 'status_update',
    };

    const updatedOrder: OrderItem = {
      ...ord,
      progress: 100,
      executionStatus: 'concluido',
      statusHistory: [...(ord.statusHistory || []), newLog],
    };

    setOrders((prev) => prev.map((o) => (o.id === ord.id ? updatedOrder : o)));
    saveOrderToFirestore(updatedOrder).catch(() => {});
    notifyOrderCompleted(ord.orderId, ord.store, author);
    showToast(`Baixa concluída com sucesso para o pedido ${ord.orderId}!`);
  };

  // Quick action: Reschedule order to today
  const handleRescheduleToToday = (ord: OrderItem) => {
    if (isReadOnly) return;

    const author = currentUser?.name || 'Gerente de Operações';
    const nowISO = new Date().toISOString();

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: nowISO,
      author,
      status: ord.executionStatus || 'pendente',
      note: `Reagendado da data ${ord.productionDate} para Hoje (${todayStr})`,
      previousDate: ord.productionDate,
      actionType: 'reschedule',
    };

    const updatedOrder: OrderItem = {
      ...ord,
      productionDate: todayStr,
      column: 'hoje',
      statusHistory: [...(ord.statusHistory || []), newLog],
    };

    setOrders((prev) => prev.map((o) => (o.id === ord.id ? updatedOrder : o)));
    saveOrderToFirestore(updatedOrder).catch(() => {});
    notifyProductionRescheduled(ord.orderId, ord.store, todayStr, ord.productionDate, 'Reagendado via Baixas Pendentes', author);
    showToast(`Pedido ${ord.orderId} reagendado para Hoje (${todayStr})!`, 'info');
  };

  // Toggle selection for batch
  const handleToggleSelect = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  };

  // Batch action: Complete all selected
  const handleBatchComplete = () => {
    if (isReadOnly || selectedOrderIds.length === 0) return;

    const author = currentUser?.name || 'Gerente de Operações';
    const nowISO = new Date().toISOString();
    const count = selectedOrderIds.length;

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (selectedOrderIds.includes(ord.id)) {
          const newLog: OrderStatusHistoryLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: nowISO,
            author,
            status: 'concluido',
            note: 'Baixa em lote efetuada na tela de Baixas Pendentes',
            actionType: 'status_update',
          };
          const itemUpdated: OrderItem = {
            ...ord,
            progress: 100,
            executionStatus: 'concluido',
            statusHistory: [...(ord.statusHistory || []), newLog],
          };
          saveOrderToFirestore(itemUpdated).catch(() => {});
          return itemUpdated;
        }
        return ord;
      });
      return updated;
    });

    notifyBatchOrdersCompleted(count, author);
    showToast(`${count} pedidos receberam baixa coletiva com sucesso!`);
    setSelectedOrderIds([]);
  };

  // Batch action: Reschedule selected to today
  const handleBatchRescheduleToToday = () => {
    if (isReadOnly || selectedOrderIds.length === 0) return;

    const author = currentUser?.name || 'Gerente de Operações';
    const nowISO = new Date().toISOString();
    const count = selectedOrderIds.length;

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (selectedOrderIds.includes(ord.id)) {
          const newLog: OrderStatusHistoryLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            timestamp: nowISO,
            author,
            status: ord.executionStatus || 'pendente',
            note: `Reagendado em lote da data ${ord.productionDate} para Hoje (${todayStr})`,
            previousDate: ord.productionDate,
            actionType: 'reschedule',
          };
          const itemUpdated: OrderItem = {
            ...ord,
            productionDate: todayStr,
            column: 'hoje',
            statusHistory: [...(ord.statusHistory || []), newLog],
          };
          saveOrderToFirestore(itemUpdated).catch(() => {});
          return itemUpdated;
        }
        return ord;
      });
      return updated;
    });

    notifyProductionRescheduled(
      `${count} OPs`,
      'Múltiplas Lojas',
      todayStr,
      undefined,
      'Reagendamento coletivo para hoje',
      author
    );
    showToast(`${count} pedidos foram reagendados para Hoje (${todayStr})!`, 'info');
    setSelectedOrderIds([]);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold flex items-center gap-3 transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700/80 shadow-emerald-950/20'
              : 'bg-blue-900 text-blue-100 border-blue-700/80 shadow-blue-950/20'
          }`}
        >
          <span className="material-symbols-outlined text-xl">
            {toastMessage.type === 'success' ? 'check_circle' : 'info'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-900/90 via-slate-900 to-amber-950 text-white rounded-2xl p-6 shadow-lg border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Pendências de Produção
            </span>
            <span className="text-xs text-amber-200/70 font-medium">Data Atual: {todayStr}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-3xl">history_toggle_off</span>
            Baixas Pendentes
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Pedidos programados para datas anteriores que não tiveram baixa registrada no sistema.
            Dê baixa para atualizar o estoque e histórico sem poluir a produção vigente de hoje.
          </p>
        </div>

        <button
          onClick={onNavigateToDashboard}
          className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-2 shrink-0 cursor-pointer self-start md:self-center"
        >
          <span className="material-symbols-outlined text-[18px]">dashboard</span>
          <span>Voltar ao Planejamento</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Pendências</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{overdueOrders.length} {overdueOrders.length === 1 ? 'pedido' : 'pedidos'}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Aguardando confirmação de baixa</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-between justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">pending_actions</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peças / Unidades</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalPieces} <span className="text-sm font-normal text-slate-500">unid</span></h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Volume físico pendente</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lojas com Atraso</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{uniqueStoresCount} {uniqueStoresCount === 1 ? 'loja' : 'lojas'}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Clientes aguardando baixa</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">store</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Mais Antiga</p>
            <h3 className="text-lg font-black text-rose-600 mt-1">
              {uniquePastDates.length > 0 ? uniquePastDates[0] : 'Nenhuma'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {uniquePastDates.length > 0 ? `${uniquePastDates.length} datas passadas com pendência` : 'Tudo em dia'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">event_busy</span>
          </div>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar por OP, loja, item ou montador..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:bg-white transition-all"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Store Filter */}
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 font-medium focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="ALL">Todas as Lojas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-700 font-medium focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="ALL">Todas as Datas Anteriores</option>
            {uniquePastDates.map((dt) => (
              <option key={dt} value={dt}>
                Data: {dt}
              </option>
            ))}
          </select>
        </div>

        {/* Select All Checkbox */}
        {filteredOrders.length > 0 && !isReadOnly && (
          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedOrderIds.length > 0 && selectedOrderIds.length === filteredOrders.length}
                onChange={() => {}}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 pointer-events-none"
              />
              <span>
                {selectedOrderIds.length === filteredOrders.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Batch Actions Bar (when 1 or more items selected) */}
      {selectedOrderIds.length > 0 && !isReadOnly && (
        <div className="bg-amber-500 text-slate-950 p-4 rounded-2xl shadow-lg border border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="material-symbols-outlined text-xl">fact_check</span>
            <span>{selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'item selecionado' : 'itens selecionados'} para ação coletiva</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleBatchComplete}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
              <span>Dar Baixa Selecionados (100%)</span>
            </button>

            <button
              onClick={handleBatchRescheduleToToday}
              className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 border border-amber-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-blue-600">today</span>
              <span>Reagendar para Hoje ({todayStr})</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders List / Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-inner">
            <span className="material-symbols-outlined text-3xl">task_alt</span>
          </div>
          <h3 className="text-xl font-black text-slate-800">
            {overdueOrders.length === 0 ? 'Nenhuma Baixa Pendente!' : 'Nenhum resultado com o filtro selecionado'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mt-1 mb-6 leading-relaxed">
            {overdueOrders.length === 0
              ? 'Todas as produções de datas anteriores foram baixadas no sistema. Seu planejamento está 100% atualizado sem pendências em atraso.'
              : 'Tente alterar os termos de busca ou filtros selecionados acima para encontrar os pedidos.'}
          </p>
          {overdueOrders.length === 0 && (
            <button
              onClick={onNavigateToDashboard}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Ir para o Painel de Planejamento</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((ord) => {
            const isSelected = selectedOrderIds.includes(ord.id);
            const normDate = normalizeDateToDDMMYYYY(ord.productionDate);

            return (
              <div
                key={ord.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col justify-between p-5 relative overflow-hidden group ${
                  isSelected ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10' : 'border-slate-200/80 hover:border-amber-300'
                }`}
              >
                {/* Top Accent Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500" />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {!isReadOnly && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(ord.id)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      )}
                      <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                        {ord.orderId}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        Programado: {normDate}
                      </span>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900 text-slate-100 shrink-0">
                      {ord.store}
                    </span>
                  </div>

                  {/* Description & Quantity */}
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug">
                      {ord.itemDescription}
                    </h4>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-medium">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md border border-slate-200">
                        Qtd: {ord.quantity} {ord.unit || 'unid'}
                      </span>
                      {ord.assignedOperatorName && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                          {ord.assignedOperatorName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Current Status Badge */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-4 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Status Atual:</span>
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        ord.executionStatus === 'parcial'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : ord.executionStatus === 'nao_produzido'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {ord.executionStatus === 'parcial'
                        ? 'Produção Parcial'
                        : ord.executionStatus === 'nao_produzido'
                        ? 'Não Produzido'
                        : 'Pendente Baixa'}
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  {!isReadOnly ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleQuickBaixa(ord)}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">check</span>
                          <span>Baixa Rápida</span>
                        </button>

                        <button
                          onClick={() => handleRescheduleToToday(ord)}
                          className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">today</span>
                          <span>Mover p/ Hoje</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedOrderForModal(ord)}
                        className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">tune</span>
                        <span>Dar Baixa Detalhada (5S / Motivo)</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-2 text-xs text-slate-400 font-medium">
                      Modo somente leitura para o seu perfil.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Order Status Modal */}
      {selectedOrderForModal && (
        <OrderStatusModal
          order={selectedOrderForModal}
          isOpen={!!selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
          currentUser={currentUser}
          onUpdateOrder={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            saveOrderToFirestore(updated).catch(() => {});
            setSelectedOrderForModal(null);
            showToast(`Baixa/Atualização gravada para o pedido ${updated.orderId}!`);
          }}
        />
      )}
    </div>
  );
};
