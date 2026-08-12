'use client';

import React, { useState, useMemo } from 'react';
import { OrderItem, UserProfile, AssemblyOperator, Store, KanbanColumnId, OrderStatusHistoryLog } from '@/types/factory';
import { OrderStatusModal } from './OrderStatusModal';
import { saveOrderToFirestore, deleteOrderFromFirestore } from '@/lib/firestoreSync';
import { notifyProductionDateSet } from '@/lib/notificationService';
import { normalizeDateToDDMMYYYY } from '@/lib/dateUtils';

interface PendingDateOrdersProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  stores?: Store[];
  operators?: AssemblyOperator[];
  searchQuery: string;
  onNavigateToOrderEntry: () => void;
  onNavigateToDashboard: () => void;
  currentUser?: UserProfile | null;
}

export const PendingDateOrders: React.FC<PendingDateOrdersProps> = ({
  orders,
  setOrders,
  stores = [],
  operators = [],
  searchQuery,
  onNavigateToOrderEntry,
  onNavigateToDashboard,
  currentUser,
}) => {
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedOrderForStatusModal, setSelectedOrderForStatusModal] = useState<OrderItem | null>(null);

  // Scheduling Modal state
  const [orderToSchedule, setOrderToSchedule] = useState<OrderItem | null>(null);
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<KanbanColumnId>('hoje');
  const [customDate, setCustomDate] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');

  // Delete Modal state
  const [orderToDelete, setOrderToDelete] = useState<OrderItem | null>(null);

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isVendasRole = userRole.includes('venda') || userRole.includes('lojista') || userRole.includes('representante');
  const isReadOnly = isVendasRole || currentUser?.permissions?.canEditProduction === false;

  // Compute 15 consecutive business days (skipping weekends)
  const getBusinessDays = () => {
    const days: { id: KanbanColumnId; date: Date; dateStr: string; formattedFull: string; dayName: string }[] = [];
    const curr = new Date();

    if (curr.getDay() === 6) {
      curr.setDate(curr.getDate() + 2);
    } else if (curr.getDay() === 0) {
      curr.setDate(curr.getDate() + 1);
    }

    const colIds: KanbanColumnId[] = [
      'hoje', 'amanha', 'dia_3', 'dia_4', 'dia_5',
      'dia_6', 'dia_7', 'dia_8', 'dia_9', 'dia_10',
      'dia_11', 'dia_12', 'dia_13', 'dia_14', 'dia_15',
    ];

    while (days.length < 15) {
      const dow = curr.getDay();
      if (dow !== 0 && dow !== 6) {
        const rawDay = curr.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dayName = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);
        const dateStr = curr.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        days.push({
          id: colIds[days.length],
          date: new Date(curr),
          dateStr,
          formattedFull: `${dayName} ${dateStr}`,
          dayName,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  };

  const businessDays = useMemo(() => getBusinessDays(), []);

  // Filter active orders that are waiting for a date
  const pendingDateOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (ord.executionStatus === 'concluido' || ord.progress === 100) return false;
      return ord.column === 'nao_planejado' || !ord.productionDate || ord.productionDate.toLowerCase().includes('aguardando');
    });
  }, [orders]);

  // Combined filtered orders (by search query & store filter)
  const filteredOrders = useMemo(() => {
    return pendingDateOrders.filter((ord) => {
      if (selectedStoreFilter !== 'ALL' && ord.store.toLowerCase() !== selectedStoreFilter.toLowerCase()) {
        return false;
      }
      const q = (searchQuery || localSearch).trim().toLowerCase();
      if (!q) return true;

      return (
        ord.orderId.toLowerCase().includes(q) ||
        ord.store.toLowerCase().includes(q) ||
        ord.itemDescription.toLowerCase().includes(q)
      );
    });
  }, [pendingDateOrders, selectedStoreFilter, searchQuery, localSearch]);

  // Group filtered orders by store
  const storeGroups = useMemo(() => {
    const map = new Map<string, OrderItem[]>();

    filteredOrders.forEach((ord) => {
      const key = ord.store.trim() || 'Outra Loja';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(ord);
    });

    const result: { storeName: string; storeInitials: string; orders: OrderItem[]; totalItems: number }[] = [];
    map.forEach((storeOrders, storeName) => {
      const storeInitials = storeOrders[0]?.storeInitials || storeName.substring(0, 2).toUpperCase();
      const totalItems = storeOrders.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
      result.push({
        storeName,
        storeInitials,
        orders: storeOrders,
        totalItems,
      });
    });

    // Sort store groups alphabetically
    return result.sort((a, b) => a.storeName.localeCompare(b.storeName));
  }, [filteredOrders]);

  // Total summary statistics
  const totalPendingOrders = pendingDateOrders.length;
  const totalStoresWithPending = new Set(pendingDateOrders.map((o) => o.store)).size;
  const totalPendingItems = pendingDateOrders.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
  const totalUrgencyRequests = pendingDateOrders.filter((o) => o.urgencyRequest?.status === 'pending').length;

  // Handle schedule confirmation
  const handleConfirmSchedule = () => {
    if (!orderToSchedule) return;

    const matchedDay = businessDays.find((b) => b.id === selectedTargetColumn);
    const rawDate = customDate.trim()
      ? customDate
      : (matchedDay?.dateStr || businessDays[0].dateStr);
    const assignedDate = normalizeDateToDDMMYYYY(rawDate);

    const now = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      author: currentUser?.name || 'Gestor de Operações',
      status: orderToSchedule.executionStatus,
      reason: 'Data de Produção Agendada',
      note: scheduleNote.trim()
        ? `Agendado para ${assignedDate}: ${scheduleNote.trim()}`
        : `Agendado para ${assignedDate}`,
      actionType: 'reschedule',
    };

    const updatedOrder: OrderItem = {
      ...orderToSchedule,
      column: selectedTargetColumn,
      productionDate: assignedDate,
      statusHistory: [...(orderToSchedule.statusHistory || []), newLog],
    };

    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    saveOrderToFirestore(updatedOrder);
    notifyProductionDateSet(updatedOrder.orderId, updatedOrder.store, assignedDate, currentUser?.name);

    setOrderToSchedule(null);
    setScheduleNote('');
    setCustomDate('');
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    const targetId = orderToDelete.id;
    setOrders((prev) => prev.filter((o) => o.id !== targetId));
    await deleteOrderFromFirestore(targetId);
    setOrderToDelete(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
            <span className="material-symbols-outlined text-2px text-2xl">pending_actions</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Pedidos Aguardando Data
              </h1>
              <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {totalPendingOrders} {totalPendingOrders === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Ordens de produção sem data de fabricação definida, organizadas exclusivamente por loja.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base text-blue-600">dashboard</span>
            <span>Painel de Planejamento</span>
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={onNavigateToOrderEntry}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>Cadastrar Pedido</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-2xl">schedule</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total sem Data</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalPendingOrders}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-2xl">store</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lojas com Pedidos</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalStoresWithPending}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-2xl">inventory_2</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Peças</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalPendingItems}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-2xl">bolt</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Urgências Pendentes</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{totalUrgencyRequests}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por OP, loja ou peça..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Store Dropdown Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-600 shrink-0 hidden md:inline">Filtrar por Loja:</span>
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Todas as Lojas ({pendingDateOrders.length} pedidos)</option>
            {Array.from(new Set(pendingDateOrders.map((o) => o.store))).map((storeName) => {
              const count = pendingDateOrders.filter((o) => o.store === storeName).length;
              return (
                <option key={storeName} value={storeName}>
                  {storeName} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Main Content: Store Group Lists */}
      {storeGroups.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-4xl">event_available</span>
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-bold text-slate-900">Nenhum Pedido Aguardando Data</h3>
            <p className="text-xs text-slate-500">
              {localSearch || selectedStoreFilter !== 'ALL'
                ? 'Nenhum pedido encontrado para os filtros selecionados.'
                : 'Excelente! Todas as ordens de produção estão devidamente agendadas no painel de planejamento.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            <span>Ver Painel de Planejamento</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {storeGroups.map((group) => (
            <div
              key={group.storeName}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
            >
              {/* Store Section Header */}
              <div className="p-5 bg-gradient-to-r from-slate-50 to-amber-50/30 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {group.storeInitials}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">{group.storeName}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {group.orders.length} {group.orders.length === 1 ? 'pedido pendente' : 'pedidos pendentes'} • Total de {group.totalItems} peças
                    </p>
                  </div>
                </div>

                <span className="bg-amber-100 text-amber-900 border border-amber-300/80 px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Aguardando Agendamento
                </span>
              </div>

              {/* Store Orders Table grouped by expected delivery date */}
              <div className="divide-y divide-slate-200/60">
                {(() => {
                  const deliveryMap = new Map<string, OrderItem[]>();
                  group.orders.forEach((ord) => {
                    const dateKey = ord.deliveryDate?.trim() || 'Sem Data Prevista';
                    if (!deliveryMap.has(dateKey)) {
                      deliveryMap.set(dateKey, []);
                    }
                    deliveryMap.get(dateKey)!.push(ord);
                  });

                  const sortedDeliveryKeys = Array.from(deliveryMap.keys()).sort((a, b) => {
                    if (a === 'Sem Data Prevista') return 1;
                    if (b === 'Sem Data Prevista') return -1;
                    const toKey = (d: string) => {
                      if (d.includes('/')) {
                        const parts = d.split('/');
                        return `${parts[2] || '9999'}${parts[1] || '01'}${parts[0] || '01'}`;
                      }
                      return d.replace(/-/g, '');
                    };
                    return toKey(a).localeCompare(toKey(b));
                  });

                  return sortedDeliveryKeys.map((deliveryKey) => {
                    const subOrders = deliveryMap.get(deliveryKey)!;
                    const subItemsCount = subOrders.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

                    return (
                      <div key={deliveryKey} className="space-y-0">
                        {/* Sub-header for Expected Delivery Date */}
                        <div className="bg-gradient-to-r from-amber-50/80 via-slate-50 to-white border-y border-amber-200/50 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-600 text-base">local_shipping</span>
                            <span className="text-xs font-bold text-slate-700">
                              Data Prevista de Entrega: <span className="text-amber-900 bg-amber-100 border border-amber-300/80 px-2.5 py-0.5 rounded-md font-extrabold ml-1">{deliveryKey}</span>
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                            {subOrders.length} {subOrders.length === 1 ? 'pedido' : 'pedidos'} ({subItemsCount} peças)
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 text-slate-400 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                                <th className="px-5 py-3.5">OP / Pedido</th>
                                <th className="px-5 py-3.5">Descrição da Peça</th>
                                <th className="px-5 py-3.5 text-center">Qtd</th>
                                <th className="px-5 py-3.5">Prev. Entrega</th>
                                <th className="px-5 py-3.5">Montador Atribuído</th>
                                <th className="px-5 py-3.5">Status / Urgência</th>
                                <th className="px-5 py-3.5 text-right">Agendar & Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {subOrders.map((ord, idx) => (
                                <tr
                                  key={ord.id ? `${ord.id}-${idx}` : `ord-${idx}`}
                                  className={`transition-colors ${
                                    ord.urgencyRequest?.status === 'pending'
                                      ? 'bg-amber-100/90 hover:bg-amber-200/80 border-l-4 border-l-amber-500 font-medium'
                                      : 'hover:bg-slate-50/80'
                                  }`}
                                >
                                  {/* OP Number */}
                                  <td className="px-5 py-4 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedOrderForStatusModal(ord)}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer"
                                      title="Clique para abrir histórico e status"
                                    >
                                      <span>OP: {ord.orderId}</span>
                                      <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                    </button>
                                  </td>

                                  {/* Item Description */}
                                  <td className="px-5 py-4 text-slate-800 font-semibold min-w-[200px]">
                                    {ord.itemDescription}
                                  </td>

                                  {/* Quantity */}
                                  <td className="px-5 py-4 text-center font-bold text-slate-900 whitespace-nowrap">
                                    {ord.quantity}
                                  </td>

                                  {/* Delivery Date */}
                                  <td className="px-5 py-4 whitespace-nowrap">
                                    {ord.deliveryDate ? (
                                      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg font-bold text-[11px]">
                                        <span className="material-symbols-outlined text-xs text-amber-600">event</span>
                                        {ord.deliveryDate}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic text-[11px]">Sem data</span>
                                    )}
                                  </td>

                                  {/* Operator */}
                                  <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                                    {ord.assignedOperatorName ? (
                                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                                        <span className="material-symbols-outlined text-xs text-slate-500">person</span>
                                        {ord.assignedOperatorName}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic text-[11px]">Não atribuído</span>
                                    )}
                                  </td>

                                  {/* Status / Urgency */}
                                  <td className="px-5 py-4 whitespace-nowrap">
                                    <div className="flex flex-col gap-1 items-start">
                                      {ord.urgencyRequest?.status === 'pending' && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOrderForStatusModal(ord)}
                                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-2 py-0.5 rounded-md text-[10px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                          title="Clique para avaliar urgência"
                                        >
                                          <span className="material-symbols-outlined text-[12px]">bolt</span>
                                          <span>Urgência Solicitada</span>
                                        </button>
                                      )}
                                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Aguardando Data
                                      </span>
                                    </div>
                                  </td>

                                  {/* Actions */}
                                  <td className="px-5 py-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-2">
                                      {/* Schedule Date Button */}
                                      {!isReadOnly && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOrderToSchedule(ord);
                                            setSelectedTargetColumn('hoje');
                                            setScheduleNote('');
                                            setCustomDate('');
                                          }}
                                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                                          title="Definir data de produção e mover para o Kanban"
                                        >
                                          <span className="material-symbols-outlined text-sm">event</span>
                                          <span>Agendar Data</span>
                                        </button>
                                      )}

                                      {/* View History / Status Modal */}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedOrderForStatusModal(ord)}
                                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                        title="Ver histórico e gerenciar"
                                      >
                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                      </button>

                                      {/* Delete Order Button */}
                                      {!isReadOnly && (
                                        <button
                                          type="button"
                                          onClick={() => setOrderToDelete(ord)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                          title="Excluir pedido"
                                        >
                                          <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Agendar Data de Produção */}
      {orderToSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn overflow-hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-100 my-auto animate-scaleUp overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">event</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Agendar Data de Produção</h3>
                  <p className="text-xs text-slate-500 font-medium">OP #{orderToSchedule.orderId} • {orderToSchedule.store}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToSchedule(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Scrollable Modal Content Body */}
            <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-4 my-1">
              {/* Order Item Details summary */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                <p className="font-bold text-slate-900">{orderToSchedule.itemDescription}</p>
                <p className="text-slate-500 font-medium">Quantidade: <strong className="text-slate-800">{orderToSchedule.quantity} peças</strong></p>
              </div>

              {/* Select Target Business Day */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Selecione um Dia da Programação (ou Data Personalizada):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {businessDays.map((day) => {
                    const isSelected = selectedTargetColumn === day.id && !customDate;
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => {
                          setSelectedTargetColumn(day.id);
                          setCustomDate('');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                        }`}
                      >
                        <p className="text-[10px] uppercase font-bold text-slate-400">{day.dayName}</p>
                        <p className="text-xs text-slate-900 font-bold">{day.dateStr}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Date Input Option */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Ou escolha outra data específica no calendário:
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Note Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Observação do Agendamento (opcional):
                </label>
                <input
                  type="text"
                  value={scheduleNote}
                  onChange={(e) => setScheduleNote(e.target.value)}
                  placeholder="Ex: Liberado pela loja, prioridade de montagem..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setOrderToSchedule(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSchedule}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Confirmar Agendamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão de Pedido */}
      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">delete_forever</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Excluir Pedido</h3>
                  <p className="text-xs text-slate-500 font-medium">OP #{orderToDelete.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Tem certeza que deseja excluir permanentemente o pedido <strong className="text-slate-900">OP #{orderToDelete.orderId}</strong> ({orderToDelete.itemDescription})? Esta ação não poderá ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Status & History Details Modal */}
      {selectedOrderForStatusModal && (
        <OrderStatusModal
          order={selectedOrderForStatusModal}
          isOpen={!!selectedOrderForStatusModal}
          onClose={() => setSelectedOrderForStatusModal(null)}
          onUpdateOrder={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            saveOrderToFirestore(updated);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
