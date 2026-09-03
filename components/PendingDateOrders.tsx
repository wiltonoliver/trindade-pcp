'use client';

import React, { useState, useMemo, useRef } from 'react';
import { OrderItem, UserProfile, AssemblyOperator, Store, KanbanColumnId, OrderStatusHistoryLog } from '@/types/factory';
import { OrderStatusModal } from './OrderStatusModal';
import { saveOrderToFirestore, deleteOrderFromFirestore, saveStoreToFirestore } from '@/lib/firestoreSync';
import { notifyProductionDateSet, notifyOrderDeleted } from '@/lib/notificationService';
import { normalizeDateToDDMMYYYY } from '@/lib/dateUtils';
import { compressImageFile } from '@/lib/imageUtils';

interface PendingDateOrdersProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  stores?: Store[];
  setStores?: React.Dispatch<React.SetStateAction<Store[]>>;
  operators?: AssemblyOperator[];
  searchQuery: string;
  onNavigateToOrderEntry: () => void;
  onNavigateToDashboard: () => void;
  currentUser?: UserProfile | null;
}

// Helper to parse date string (like "07/09/2026", "2026-09-07", "07/09/26") into YYYYMMDD integer for fast comparison
const parseDateToComparable = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const norm = normalizeDateToDDMMYYYY(dateStr);
  if (!norm || norm === 'Aguardando Data') return null;
  const parts = norm.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return year * 10000 + month * 100 + day;
};

const parseISOToComparable = (isoStr?: string): number | null => {
  if (!isoStr) return null;
  const parts = isoStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return year * 10000 + month * 100 + day;
};

const formatISOToDDMMYYYY = (isoStr?: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const PendingDateOrders: React.FC<PendingDateOrdersProps> = ({
  orders,
  setOrders,
  stores = [],
  setStores,
  operators = [],
  searchQuery,
  onNavigateToOrderEntry,
  onNavigateToDashboard,
  currentUser,
}) => {
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');
  const [deliveryStartDate, setDeliveryStartDate] = useState<string>('');
  const [deliveryEndDate, setDeliveryEndDate] = useState<string>('');
  const [onlyWithoutDeliveryDate, setOnlyWithoutDeliveryDate] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState('');
  const [selectedOrderForStatusModal, setSelectedOrderForStatusModal] = useState<OrderItem | null>(null);

  // Scheduling Modal state
  const [orderToSchedule, setOrderToSchedule] = useState<OrderItem | null>(null);
  const [selectedTargetColumn, setSelectedTargetColumn] = useState<KanbanColumnId>('hoje');
  const [customDate, setCustomDate] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');

  // Delete Modal state
  const [orderToDelete, setOrderToDelete] = useState<OrderItem | null>(null);

  // Full Order Edit Modal state
  const [orderToEdit, setOrderToEdit] = useState<OrderItem | null>(null);

  // Quick Operator Selection Modal state
  const [orderForOperatorSelect, setOrderForOperatorSelect] = useState<OrderItem | null>(null);

  // Quick Delivery Date Selection Modal/Popover state
  const [orderForDeliveryDate, setOrderForDeliveryDate] = useState<OrderItem | null>(null);
  const [quickDateValue, setQuickDateValue] = useState<string>('');

  // Inline editing state: tracks which order and which field is currently edited inline
  const [inlineEditState, setInlineEditState] = useState<{
    orderId: string;
    field: 'orderId' | 'itemDescription' | 'quantity' | 'store';
    value: string;
  } | null>(null);

  // Store Group Edit Modal state (to rename store across orders and store registry)
  const [storeGroupToEdit, setStoreGroupToEdit] = useState<{
    oldStoreName: string;
    newStoreName: string;
    storeInitials: string;
    ordersCount: number;
    updateGlobalStores: boolean;
  } | null>(null);

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
      if (ord.executionStatus === 'concluido' || ord.progress === 100 || ord.isClosedUncompleted) return false;
      return ord.column === 'nao_planejado' || !ord.productionDate || ord.productionDate.toLowerCase().includes('aguardando');
    });
  }, [orders]);

  // Extract available distinct delivery dates from pending orders
  const availableDeliveryDates = useMemo(() => {
    const datesMap = new Map<string, number>();
    pendingDateOrders.forEach((o) => {
      const dateKey = o.deliveryDate?.trim() || 'Sem Data Prevista';
      datesMap.set(dateKey, (datesMap.get(dateKey) || 0) + 1);
    });
    return Array.from(datesMap.entries()).sort((a, b) => {
      if (a[0] === 'Sem Data Prevista') return 1;
      if (b[0] === 'Sem Data Prevista') return -1;
      const toKey = (d: string) => {
        if (d.includes('/')) {
          const parts = d.split('/');
          return `${parts[2] || '9999'}${parts[1] || '01'}${parts[0] || '01'}`;
        }
        return d.replace(/-/g, '');
      };
      return toKey(a[0]).localeCompare(toKey(b[0]));
    });
  }, [pendingDateOrders]);

  // Combined filtered orders (by search query, store filter & delivery date period range)
  const filteredOrders = useMemo(() => {
    const startComp = parseISOToComparable(deliveryStartDate);
    const endComp = parseISOToComparable(deliveryEndDate);
    const isDateRangeActive = startComp !== null || endComp !== null;

    return pendingDateOrders.filter((ord) => {
      if (selectedStoreFilter !== 'ALL' && ord.store.toLowerCase() !== selectedStoreFilter.toLowerCase()) {
        return false;
      }

      if (onlyWithoutDeliveryDate) {
        const d = ord.deliveryDate?.trim();
        if (d && d !== 'Sem Data Prevista' && d !== 'Aguardando Data' && d !== '') {
          return false;
        }
      } else if (isDateRangeActive) {
        const orderDateComp = parseDateToComparable(ord.deliveryDate);
        if (orderDateComp === null) return false;
        if (startComp !== null && orderDateComp < startComp) return false;
        if (endComp !== null && orderDateComp > endComp) return false;
      }

      const q = (searchQuery || localSearch).trim().toLowerCase();
      if (!q) return true;

      return (
        ord.orderId.toLowerCase().includes(q) ||
        ord.store.toLowerCase().includes(q) ||
        ord.itemDescription.toLowerCase().includes(q) ||
        (ord.deliveryDate && ord.deliveryDate.toLowerCase().includes(q))
      );
    });
  }, [
    pendingDateOrders,
    selectedStoreFilter,
    deliveryStartDate,
    deliveryEndDate,
    onlyWithoutDeliveryDate,
    searchQuery,
    localSearch,
  ]);

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
    const orderInfo = { ...orderToDelete };
    setOrders((prev) => prev.filter((o) => o.id !== targetId));
    await deleteOrderFromFirestore(targetId);
    notifyOrderDeleted(orderInfo.orderId, orderInfo.store, currentUser?.name, 'Excluído da fila de Aguardando Data');
    setOrderToDelete(null);
  };

  // Direct order field updater
  const handleUpdateOrder = (updatedOrder: OrderItem) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      if (typeof window !== 'undefined') {
        localStorage.setItem('factoryops_orders', JSON.stringify(next));
      }
      return next;
    });
    saveOrderToFirestore(updatedOrder).catch(console.error);
  };

  // Commit inline edit
  const handleCommitInlineEdit = (ord: OrderItem) => {
    if (!inlineEditState || inlineEditState.orderId !== ord.id) return;
    const { field, value } = inlineEditState;
    const trimmed = value.trim();

    let updated: OrderItem = { ...ord };

    if (field === 'orderId') {
      if (!trimmed) {
        setInlineEditState(null);
        return;
      }
      updated.orderId = trimmed;
    } else if (field === 'itemDescription') {
      if (!trimmed) {
        setInlineEditState(null);
        return;
      }
      updated.itemDescription = trimmed;
    } else if (field === 'quantity') {
      const parsedQty = parseInt(trimmed, 10);
      if (isNaN(parsedQty) || parsedQty < 1) {
        setInlineEditState(null);
        return;
      }
      updated.quantity = parsedQty;
    } else if (field === 'store') {
      if (!trimmed) {
        setInlineEditState(null);
        return;
      }
      const matchingStore = stores.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
      updated.store = trimmed;
      if (matchingStore) {
        updated.storeInitials = matchingStore.code || matchingStore.name.substring(0, 2).toUpperCase();
      }
    }

    handleUpdateOrder(updated);
    setInlineEditState(null);
  };

  // Quick increment/decrement quantity
  const handleQuickUpdateQuantity = (ord: OrderItem, delta: number) => {
    if (isReadOnly) return;
    const currentQty = ord.quantity || 1;
    const newQty = Math.max(1, currentQty + delta);
    if (newQty === currentQty) return;
    const updated: OrderItem = { ...ord, quantity: newQty };
    handleUpdateOrder(updated);
  };

  // Quick delivery date update
  const handleQuickUpdateDeliveryDate = (ord: OrderItem, newDateStr: string) => {
    if (isReadOnly) return;
    const normalized = normalizeDateToDDMMYYYY(newDateStr) || 'Sem Data Prevista';
    const updated: OrderItem = {
      ...ord,
      deliveryDate: normalized === 'Sem Data Prevista' || !newDateStr.trim() ? 'Sem Data Prevista' : normalized,
    };
    handleUpdateOrder(updated);
    setOrderForDeliveryDate(null);
    setQuickDateValue('');
  };

  // Quick operator assignment
  const handleQuickUpdateOperator = (ord: OrderItem, op: AssemblyOperator | null) => {
    if (isReadOnly) return;
    const current = orders.find((o) => o.id === ord.id) || ord;
    const now = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const updated: OrderItem = {
      ...current,
      assignedOperatorName: op ? op.name : undefined,
      assignedOperatorCode: op ? op.code : undefined,
      assignedOperatorId: op ? op.id : undefined,
      assignedAt: op ? now : undefined,
    };
    handleUpdateOrder(updated);
    setOrderForOperatorSelect(null);
  };

  // Open Edit Store Name Modal for a store group
  const handleOpenEditStore = (storeName: string, storeInitials: string, ordersCount: number) => {
    setStoreGroupToEdit({
      oldStoreName: storeName,
      newStoreName: storeName,
      storeInitials: storeInitials || 'OP',
      ordersCount,
      updateGlobalStores: true,
    });
  };

  // Save Store Name changes across orders and store registry
  const handleSaveStoreGroupEdit = () => {
    if (!storeGroupToEdit) return;
    const cleanNewName = storeGroupToEdit.newStoreName.trim();
    if (!cleanNewName) return;

    const cleanOldName = storeGroupToEdit.oldStoreName.trim();
    const words = cleanNewName.split(/\s+/).filter(Boolean);
    const finalInitials =
      (storeGroupToEdit.storeInitials || '').trim().toUpperCase() ||
      (words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : cleanNewName.substring(0, 2).toUpperCase()) ||
      'OP';

    const authorName = currentUser?.name || currentUser?.role || 'Usuário';
    const now = new Date();
    const nowStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    // 1. Update all orders in state with oldStoreName
    const updatedOrders = orders.map((ord) => {
      if (ord.store.trim().toLowerCase() === cleanOldName.toLowerCase()) {
        const updated: OrderItem = {
          ...ord,
          store: cleanNewName,
          storeInitials: finalInitials,
          statusHistory: [
            ...(ord.statusHistory || []),
            {
              id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              timestamp: nowStr,
              author: authorName,
              status: ord.executionStatus,
              reason: 'Edição de Loja',
              note: `Loja alterada de "${cleanOldName}" para "${cleanNewName}"`,
              actionType: 'status_update',
            },
          ],
        };
        saveOrderToFirestore(updated).catch(console.error);
        return updated;
      }
      return ord;
    });

    setOrders(updatedOrders);

    // 2. If updateGlobalStores is checked, update or add to stores list and Firestore
    if (storeGroupToEdit.updateGlobalStores) {
      const existingStore = stores.find((s) => s.name.trim().toLowerCase() === cleanOldName.toLowerCase());
      if (existingStore) {
        const updatedStore: Store = {
          ...existingStore,
          name: cleanNewName,
          code: finalInitials,
        };
        saveStoreToFirestore(updatedStore).catch(console.error);
        if (setStores) {
          setStores((prev) => prev.map((s) => (s.id === existingStore.id ? updatedStore : s)));
        }
      } else {
        const newStore: Store = {
          id: `store-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: cleanNewName,
          code: finalInitials,
          status: 'Ativa',
        };
        saveStoreToFirestore(newStore).catch(console.error);
        if (setStores) {
          setStores((prev) => [...prev, newStore]);
        }
      }

      // Sync with localStorage
      try {
        const saved = localStorage.getItem('factoryops_stores');
        if (saved) {
          const parsed: Store[] = JSON.parse(saved);
          const idx = parsed.findIndex((s) => s.name.trim().toLowerCase() === cleanOldName.toLowerCase());
          if (idx >= 0) {
            parsed[idx].name = cleanNewName;
            parsed[idx].code = finalInitials;
          } else {
            parsed.push({
              id: `store-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              name: cleanNewName,
              code: finalInitials,
              status: 'Ativa',
            });
          }
          localStorage.setItem('factoryops_stores', JSON.stringify(parsed));
        }
      } catch (e) {
        console.error('Error syncing localStorage stores:', e);
      }
    }

    setStoreGroupToEdit(null);
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5">
        {/* Left: Search Field */}
        <div className="relative w-full xl:w-72 2xl:w-80 shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por OP, loja, peça ou data..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="Limpar busca"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        {/* Right: Dropdowns & Action Reset */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full xl:w-auto">
          {/* Store Dropdown Filter */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
            <span className="material-symbols-outlined text-slate-400 text-base hidden sm:inline">store</span>
            <select
              value={selectedStoreFilter}
              onChange={(e) => setSelectedStoreFilter(e.target.value)}
              className="w-full sm:w-48 lg:w-56 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Todas as Lojas ({pendingDateOrders.length})</option>
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

          {/* Delivery Date Range Filter */}
          <div
            className={`flex flex-wrap sm:flex-nowrap items-center gap-2 p-1.5 px-3 rounded-xl border text-xs transition-all shadow-2xs ${
              deliveryStartDate || deliveryEndDate || onlyWithoutDeliveryDate
                ? 'border-amber-400 bg-amber-50/70 text-amber-950 font-bold'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 shrink-0 text-amber-800">
              <span className="material-symbols-outlined text-amber-600 text-base">local_shipping</span>
              <span className="text-[11px] font-bold text-slate-700 hidden md:inline">Entrega:</span>
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">De</span>
              <input
                type="date"
                value={deliveryStartDate}
                onChange={(e) => {
                  setDeliveryStartDate(e.target.value);
                  setOnlyWithoutDeliveryDate(false);
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                title="Data inicial da entrega prevista"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Até</span>
              <input
                type="date"
                value={deliveryEndDate}
                min={deliveryStartDate || undefined}
                onChange={(e) => {
                  setDeliveryEndDate(e.target.value);
                  setOnlyWithoutDeliveryDate(false);
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                title="Data final da entrega prevista"
              />
            </div>

            {/* Quick Presets / Sem Data Dropdown */}
            <select
              value={
                onlyWithoutDeliveryDate
                  ? 'WITHOUT_DATE'
                  : deliveryStartDate && deliveryEndDate && deliveryStartDate === deliveryEndDate
                  ? 'CUSTOM'
                  : 'CUSTOM'
              }
              onChange={(e) => {
                const val = e.target.value;
                const now = new Date();
                const toISO = (d: Date) => {
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                };

                if (val === 'ALL') {
                  setDeliveryStartDate('');
                  setDeliveryEndDate('');
                  setOnlyWithoutDeliveryDate(false);
                } else if (val === 'TODAY') {
                  const today = toISO(now);
                  setDeliveryStartDate(today);
                  setDeliveryEndDate(today);
                  setOnlyWithoutDeliveryDate(false);
                } else if (val === 'THIS_WEEK') {
                  const curr = new Date(now);
                  const day = curr.getDay();
                  const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
                  const monday = new Date(curr.setDate(diffToMonday));
                  const friday = new Date(curr.setDate(diffToMonday + 4));
                  setDeliveryStartDate(toISO(monday));
                  setDeliveryEndDate(toISO(friday));
                  setOnlyWithoutDeliveryDate(false);
                } else if (val === 'NEXT_7') {
                  const end = new Date(now);
                  end.setDate(end.getDate() + 7);
                  setDeliveryStartDate(toISO(now));
                  setDeliveryEndDate(toISO(end));
                  setOnlyWithoutDeliveryDate(false);
                } else if (val === 'NEXT_15') {
                  const end = new Date(now);
                  end.setDate(end.getDate() + 15);
                  setDeliveryStartDate(toISO(now));
                  setDeliveryEndDate(toISO(end));
                  setOnlyWithoutDeliveryDate(false);
                } else if (val === 'THIS_MONTH') {
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setDeliveryStartDate(toISO(start));
                  setDeliveryEndDate(toISO(end));
                  setOnlyWithoutDeliveryDate(false);
                } else if (val === 'WITHOUT_DATE') {
                  setDeliveryStartDate('');
                  setDeliveryEndDate('');
                  setOnlyWithoutDeliveryDate(true);
                }
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs hidden lg:inline-block"
              title="Atalhos rápidos de período"
            >
              <option value="CUSTOM">Atalhos...</option>
              <option value="ALL">Qualquer Data</option>
              <option value="TODAY">Hoje</option>
              <option value="THIS_WEEK">Esta Semana (Seg-Sex)</option>
              <option value="NEXT_7">Próximos 7 dias</option>
              <option value="NEXT_15">Próximos 15 dias</option>
              <option value="THIS_MONTH">Este Mês</option>
              <option value="WITHOUT_DATE">Sem Data Prevista</option>
            </select>

            {/* Clear Date Range */}
            {(deliveryStartDate || deliveryEndDate || onlyWithoutDeliveryDate) && (
              <button
                type="button"
                onClick={() => {
                  setDeliveryStartDate('');
                  setDeliveryEndDate('');
                  setOnlyWithoutDeliveryDate(false);
                }}
                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer shrink-0"
                title="Limpar período de entrega"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>

          {/* Reset Filters Button */}
          {(selectedStoreFilter !== 'ALL' || deliveryStartDate || deliveryEndDate || onlyWithoutDeliveryDate || localSearch.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setSelectedStoreFilter('ALL');
                setDeliveryStartDate('');
                setDeliveryEndDate('');
                setOnlyWithoutDeliveryDate(false);
                setLocalSearch('');
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-bold border border-rose-200 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              title="Limpar todos os filtros"
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Store Group Lists */}
      {storeGroups.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-4xl">event_available</span>
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {localSearch || selectedStoreFilter !== 'ALL' || deliveryStartDate || deliveryEndDate || onlyWithoutDeliveryDate
                ? 'Nenhum Pedido Encontrado'
                : 'Nenhum Pedido Aguardando Data'}
            </h3>
            <p className="text-xs text-slate-500">
              {localSearch || selectedStoreFilter !== 'ALL' || deliveryStartDate || deliveryEndDate || onlyWithoutDeliveryDate
                ? 'Nenhum pedido atende aos filtros de busca, loja ou período de entrega selecionados.'
                : 'Excelente! Todas as ordens de produção estão devidamente agendadas no painel de planejamento.'}
            </p>
          </div>
          {localSearch || selectedStoreFilter !== 'ALL' || deliveryStartDate || deliveryEndDate || onlyWithoutDeliveryDate ? (
            <button
              type="button"
              onClick={() => {
                setSelectedStoreFilter('ALL');
                setDeliveryStartDate('');
                setDeliveryEndDate('');
                setOnlyWithoutDeliveryDate(false);
                setLocalSearch('');
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">filter_alt_off</span>
              <span>Limpar Filtros</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              <span>Ver Painel de Planejamento</span>
            </button>
          )}
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-slate-900">{group.storeName}</h2>
                      {!isReadOnly && (
                        <button
                          type="button"
                          id={`btn-edit-store-${group.storeName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                          onClick={() => handleOpenEditStore(group.storeName, group.storeInitials, group.orders.length)}
                          className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1 group/btn"
                          title={`Editar nome da loja "${group.storeName}"`}
                        >
                          <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover/btn:text-blue-600">edit</span>
                          <span className="text-[11px] font-semibold">Editar Loja</span>
                        </button>
                      )}
                    </div>
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
                              <tr className="bg-slate-50/70 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100">
                                <th className="px-2.5 py-2.5 whitespace-nowrap">OP / Pedido</th>
                                <th className="px-2.5 py-2.5">Descrição da Peça</th>
                                <th className="px-2 py-2.5 text-center whitespace-nowrap w-12">Qtd</th>
                                <th className="px-2.5 py-2.5 whitespace-nowrap">Prev. Entrega</th>
                                <th className="px-2.5 py-2.5 whitespace-nowrap">Montador</th>
                                <th className="px-2.5 py-2.5 whitespace-nowrap">Status / Urgência</th>
                                <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Agendar & Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {subOrders.map((ord, idx) => {
                                const isEditingOp = inlineEditState?.orderId === ord.id && inlineEditState?.field === 'orderId';
                                const isEditingDesc = inlineEditState?.orderId === ord.id && inlineEditState?.field === 'itemDescription';
                                const isEditingQty = inlineEditState?.orderId === ord.id && inlineEditState?.field === 'quantity';

                                return (
                                  <tr
                                    key={ord.id ? `${ord.id}-${idx}` : `ord-${idx}`}
                                    className={`transition-colors ${
                                      ord.urgencyRequest?.status === 'pending'
                                        ? 'bg-amber-100/90 hover:bg-amber-200/80 border-l-4 border-l-amber-500 font-medium'
                                        : 'hover:bg-slate-50/80'
                                    }`}
                                  >
                                    {/* OP Number (Editable) */}
                                    <td className="px-2.5 py-2.5 whitespace-nowrap font-bold text-blue-600">
                                      {isEditingOp ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            autoFocus
                                            value={inlineEditState.value}
                                            onChange={(e) =>
                                              setInlineEditState({
                                                ...inlineEditState,
                                                value: e.target.value,
                                              })
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleCommitInlineEdit(ord);
                                              if (e.key === 'Escape') setInlineEditState(null);
                                            }}
                                            className="w-24 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border-2 border-blue-500 rounded focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleCommitInlineEdit(ord)}
                                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                                            title="Salvar OP"
                                          >
                                            <span className="material-symbols-outlined text-[12px] block">check</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setInlineEditState(null)}
                                            className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                                            title="Cancelar"
                                          >
                                            <span className="material-symbols-outlined text-[12px] block">close</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1 group">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedOrderForStatusModal(ord)}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold font-mono text-xs transition-colors cursor-pointer"
                                            title="Clique para abrir histórico e status"
                                          >
                                            <span>OP: {ord.orderId}</span>
                                          </button>
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setInlineEditState({
                                                  orderId: ord.id,
                                                  field: 'orderId',
                                                  value: ord.orderId,
                                                })
                                              }
                                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity cursor-pointer"
                                              title="Editar número da OP"
                                            >
                                              <span className="material-symbols-outlined text-[13px] block">edit</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Item Description (Editable) */}
                                    <td className="px-2.5 py-2.5 text-slate-800 font-semibold min-w-[160px] max-w-[280px]">
                                      {isEditingDesc ? (
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            autoFocus
                                            value={inlineEditState.value}
                                            onChange={(e) =>
                                              setInlineEditState({
                                                ...inlineEditState,
                                                value: e.target.value,
                                              })
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleCommitInlineEdit(ord);
                                              if (e.key === 'Escape') setInlineEditState(null);
                                            }}
                                            className="w-full px-2 py-1 text-xs font-semibold bg-white border-2 border-blue-500 rounded-lg focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleCommitInlineEdit(ord)}
                                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer shrink-0"
                                            title="Salvar descrição"
                                          >
                                            <span className="material-symbols-outlined text-[12px] block">check</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setInlineEditState(null)}
                                            className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer shrink-0"
                                            title="Cancelar"
                                          >
                                            <span className="material-symbols-outlined text-[12px] block">close</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 group">
                                          {ord.imageUrl && (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedOrderForStatusModal(ord)}
                                              className="relative w-6 h-6 rounded overflow-hidden border border-blue-200 shrink-0 group/img cursor-pointer hover:border-blue-500 transition-all"
                                              title="Ver imagem / desenho técnico"
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={ord.imageUrl}
                                                alt="Miniatura OP"
                                                className="w-full h-full object-cover group-hover/img:scale-110 transition-transform"
                                              />
                                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                <span className="material-symbols-outlined text-white text-[10px]">zoom_in</span>
                                              </div>
                                            </button>
                                          )}
                                          <span
                                            className="truncate block text-xs cursor-pointer hover:text-blue-600 transition-colors"
                                            title={ord.itemDescription}
                                            onClick={() => {
                                              if (!isReadOnly) {
                                                setInlineEditState({
                                                  orderId: ord.id,
                                                  field: 'itemDescription',
                                                  value: ord.itemDescription,
                                                });
                                              }
                                            }}
                                          >
                                            {ord.itemDescription}
                                          </span>
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setInlineEditState({
                                                  orderId: ord.id,
                                                  field: 'itemDescription',
                                                  value: ord.itemDescription,
                                                })
                                              }
                                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-600 rounded transition-opacity cursor-pointer shrink-0"
                                              title="Editar descrição da peça"
                                            >
                                              <span className="material-symbols-outlined text-[13px] block">edit</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Quantity (Editable Stepper & Inline) */}
                                    <td className="px-2 py-2.5 text-center font-bold text-slate-900 whitespace-nowrap">
                                      {isEditingQty ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <input
                                            type="number"
                                            autoFocus
                                            min="1"
                                            value={inlineEditState.value}
                                            onChange={(e) =>
                                              setInlineEditState({
                                                ...inlineEditState,
                                                value: e.target.value,
                                              })
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleCommitInlineEdit(ord);
                                              if (e.key === 'Escape') setInlineEditState(null);
                                            }}
                                            className="w-14 px-1 py-0.5 text-center text-xs font-bold bg-white border-2 border-blue-500 rounded focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleCommitInlineEdit(ord)}
                                            className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                                          >
                                            <span className="material-symbols-outlined text-[12px] block">check</span>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-0.5">
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => handleQuickUpdateQuantity(ord, -1)}
                                              disabled={ord.quantity <= 1}
                                              className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-white rounded font-bold disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                                              title="Diminuir quantidade"
                                            >
                                              -
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!isReadOnly) {
                                                setInlineEditState({
                                                  orderId: ord.id,
                                                  field: 'quantity',
                                                  value: String(ord.quantity),
                                                });
                                              }
                                            }}
                                            className="px-1 text-xs font-black text-slate-800 hover:text-blue-600 cursor-pointer transition-colors"
                                            title="Clique para digitar quantidade"
                                          >
                                            {ord.quantity}
                                          </button>
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => handleQuickUpdateQuantity(ord, 1)}
                                              className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-white rounded font-bold cursor-pointer transition-colors"
                                              title="Aumentar quantidade"
                                            >
                                              +
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Delivery Date (Editable Button) */}
                                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => {
                                          if (!isReadOnly) {
                                            setOrderForDeliveryDate(ord);
                                            setQuickDateValue(ord.deliveryDate && ord.deliveryDate !== 'Sem Data Prevista' ? ord.deliveryDate : '');
                                          }
                                        }}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer border ${
                                          ord.deliveryDate && ord.deliveryDate !== 'Sem Data Prevista' && ord.deliveryDate !== 'Aguardando Data'
                                            ? 'bg-amber-50 text-amber-900 border-amber-200/90 hover:bg-amber-100 hover:border-amber-300'
                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
                                        }`}
                                        title={isReadOnly ? 'Data prevista' : 'Clique para alterar a data prevista de entrega'}
                                      >
                                        <span className="material-symbols-outlined text-[13px] text-amber-600">event</span>
                                        <span>{ord.deliveryDate && ord.deliveryDate !== 'Aguardando Data' ? ord.deliveryDate : 'Sem Data Prevista'}</span>
                                        {!isReadOnly && (
                                          <span className="material-symbols-outlined text-[11px] text-slate-400 ml-0.5">edit</span>
                                        )}
                                      </button>
                                    </td>

                                    {/* Operator (Editable Button) */}
                                    <td className="px-2.5 py-2.5 whitespace-nowrap text-slate-600">
                                      <button
                                        type="button"
                                        disabled={isReadOnly}
                                        onClick={() => {
                                          if (!isReadOnly) {
                                            setOrderForOperatorSelect(ord);
                                          }
                                        }}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-[11px] max-w-[150px] truncate transition-all cursor-pointer border ${
                                          ord.assignedOperatorName
                                            ? 'bg-indigo-50 text-indigo-900 border-indigo-200/80 hover:bg-indigo-100'
                                            : 'bg-slate-50 text-slate-400 border-dashed border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                                        }`}
                                        title={isReadOnly ? 'Montador' : 'Clique para atribuir ou alterar o montador'}
                                      >
                                        <span className="material-symbols-outlined text-[13px] text-indigo-600 shrink-0">person</span>
                                        <span className="truncate font-semibold">{ord.assignedOperatorName || 'Atribuir Montador'}</span>
                                        {!isReadOnly && (
                                          <span className="material-symbols-outlined text-[11px] text-slate-400 ml-0.5 shrink-0">expand_more</span>
                                        )}
                                      </button>
                                    </td>

                                    {/* Status / Urgency */}
                                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                                      <div className="flex flex-col gap-0.5 items-start">
                                        {ord.urgencyRequest?.status === 'pending' && (
                                          <button
                                            type="button"
                                            onClick={() => setSelectedOrderForStatusModal(ord)}
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-1.5 py-0.2 rounded text-[9px] inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                            title="Clique para avaliar urgência"
                                          >
                                            <span className="material-symbols-outlined text-[10px]">bolt</span>
                                            <span>Urgência</span>
                                          </button>
                                        )}
                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                          Aguardando
                                        </span>
                                      </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-2.5 py-2.5 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1">
                                        {/* Edit Order Modal Button */}
                                        {!isReadOnly && (
                                          <button
                                            type="button"
                                            onClick={() => setOrderToEdit(ord)}
                                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            title="Editar dados completos do pedido"
                                          >
                                            <span className="material-symbols-outlined text-base">edit</span>
                                          </button>
                                        )}

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
                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                            title="Definir data de produção e mover para o Kanban"
                                          >
                                            <span className="material-symbols-outlined text-[14px]">event</span>
                                            <span>Agendar</span>
                                          </button>
                                        )}

                                        {/* View History / Status Modal */}
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOrderForStatusModal(ord)}
                                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
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
                                );
                              })}
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

      {/* Modal: Editar Dados Completos do Pedido */}
      {orderToEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn overflow-hidden">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-100 my-auto animate-scaleUp overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">edit</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Editar Dados do Pedido</h3>
                  <p className="text-xs text-slate-500 font-medium">OP #{orderToEdit.orderId} • {orderToEdit.store}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderToEdit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="edit-order-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateOrder(orderToEdit);
                setOrderToEdit(null);
              }}
              className="flex-1 overflow-y-auto py-3 pr-1 space-y-4 my-1"
            >
              {/* Row 1: OP & Loja */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Número da OP *</label>
                  <input
                    type="text"
                    required
                    value={orderToEdit.orderId}
                    onChange={(e) => setOrderToEdit({ ...orderToEdit, orderId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Loja / Cliente *</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="edit-order-stores-datalist"
                      required
                      value={orderToEdit.store}
                      onChange={(e) => {
                        const newName = e.target.value;
                        const selStore = stores.find((s) => s.name.trim().toLowerCase() === newName.trim().toLowerCase());
                        const words = newName.trim().split(/\s+/).filter(Boolean);
                        const initials = selStore?.code || (words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : newName.substring(0, 2).toUpperCase()) || orderToEdit.storeInitials;
                        setOrderToEdit({
                          ...orderToEdit,
                          store: newName,
                          storeInitials: initials,
                        });
                      }}
                      placeholder="Selecione ou digite o nome da loja..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none pr-8"
                    />
                    {stores.length > 0 && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <span className="material-symbols-outlined text-[16px]">unfold_more</span>
                      </div>
                    )}
                    <datalist id="edit-order-stores-datalist">
                      {stores.map((s) => (
                        <option key={s.id || s.name} value={s.name}>
                          {s.code ? `${s.name} (${s.code})` : s.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Row 2: Descrição da Peça */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Descrição da Peça *</label>
                <input
                  type="text"
                  required
                  value={orderToEdit.itemDescription}
                  onChange={(e) => setOrderToEdit({ ...orderToEdit, itemDescription: e.target.value })}
                  placeholder="Ex: Armário Superior 2 Portas Vidro Reflecta"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Row 3: Quantidade & Data Prevista */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Quantidade (peças) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={orderToEdit.quantity}
                    onChange={(e) => setOrderToEdit({ ...orderToEdit, quantity: parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Data Prevista de Entrega</label>
                  <input
                    type="date"
                    value={
                      orderToEdit.deliveryDate && orderToEdit.deliveryDate.includes('/')
                        ? orderToEdit.deliveryDate.split('/').reverse().join('-')
                        : orderToEdit.deliveryDate || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setOrderToEdit({ ...orderToEdit, deliveryDate: 'Sem Data Prevista' });
                      } else {
                        const parts = val.split('-');
                        const dmy = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        setOrderToEdit({ ...orderToEdit, deliveryDate: dmy });
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Montador & Prioridade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Montador Responsável</label>
                  <select
                    value={orderToEdit.assignedOperatorName || ''}
                    onChange={(e) => {
                      const opName = e.target.value;
                      const matchedOp = operators.find((op) => op.name === opName);
                      setOrderToEdit({
                        ...orderToEdit,
                        assignedOperatorName: opName || undefined,
                        assignedOperatorCode: matchedOp?.code,
                        assignedOperatorId: matchedOp?.id,
                        assignedAt: opName
                          ? new Date().toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : undefined,
                      });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Não atribuído</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.name}>
                        {op.name} ({op.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">Prioridade</label>
                  <select
                    value={orderToEdit.priority || 'NORMAL'}
                    onChange={(e) =>
                      setOrderToEdit({
                        ...orderToEdit,
                        priority: e.target.value as 'NORMAL' | 'ALTA PRIORIDADE',
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA PRIORIDADE">Alta Prioridade ⚡</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Imagem / Desenho Técnico */}
              <div className="space-y-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-700">Desenho Técnico / Foto da OP</label>
                {orderToEdit.imageUrl ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={orderToEdit.imageUrl}
                      alt="Desenho técnico"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOrderToEdit({ ...orderToEdit, imageUrl: undefined })}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        <span>Remover Imagem</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImageFile(file);
                            setOrderToEdit({ ...orderToEdit, imageUrl: compressed });
                          } catch (err) {
                            console.error('Erro ao comprimir imagem:', err);
                          }
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </form>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setOrderToEdit(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="edit-order-form"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Atribuir Montador Rápido */}
      {orderForOperatorSelect && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
          onClick={() => setOrderForOperatorSelect(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">person_add</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Atribuir Montador</h3>
                  <p className="text-xs text-slate-500 font-medium">OP #{orderForOperatorSelect.orderId} • {orderForOperatorSelect.itemDescription}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderForOperatorSelect(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {/* Option: Unassign */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickUpdateOperator(orderForOperatorSelect, null);
                }}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  !orderForOperatorSelect.assignedOperatorName
                    ? 'bg-slate-100 border-slate-300 font-bold text-slate-800'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-lg">person_off</span>
                  <span className="text-xs">Não atribuído (Sem montador)</span>
                </div>
                {!orderForOperatorSelect.assignedOperatorName && (
                  <span className="material-symbols-outlined text-blue-600 text-base">check</span>
                )}
              </button>

              {/* Operator List */}
              {operators.map((op) => {
                const isSelected = orderForOperatorSelect.assignedOperatorName === op.name;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickUpdateOperator(orderForOperatorSelect, op);
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900 font-bold'
                        : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {op.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{op.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Código: {op.code}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-indigo-600 text-base">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOrderForOperatorSelect(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alterar Data Prevista de Entrega Rápida */}
      {orderForDeliveryDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">calendar_month</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Data Prevista de Entrega</h3>
                  <p className="text-xs text-slate-500 font-medium">OP #{orderForDeliveryDate.orderId} • {orderForDeliveryDate.store}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderForDeliveryDate(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Atalhos rápidos de entrega:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const str = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    handleQuickUpdateDeliveryDate(orderForDeliveryDate, str);
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-colors text-left"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    const str = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    handleQuickUpdateDeliveryDate(orderForDeliveryDate, str);
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-colors text-left"
                >
                  Amanhã
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    const str = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    handleQuickUpdateDeliveryDate(orderForDeliveryDate, str);
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-colors text-left"
                >
                  Em 7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 15);
                    const str = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    handleQuickUpdateDeliveryDate(orderForDeliveryDate, str);
                  }}
                  className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 transition-colors text-left"
                >
                  Em 15 Dias
                </button>
              </div>
            </div>

            {/* Custom Date Input */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-slate-700">Ou escolha a data exata:</label>
              <input
                type="date"
                value={
                  quickDateValue.includes('/')
                    ? quickDateValue.split('/').reverse().join('-')
                    : quickDateValue
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const parts = val.split('-');
                    setQuickDateValue(`${parts[2]}/${parts[1]}/${parts[0]}`);
                  } else {
                    setQuickDateValue('');
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleQuickUpdateDeliveryDate(orderForDeliveryDate, 'Sem Data Prevista')}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Limpar Data
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrderForDeliveryDate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickUpdateDeliveryDate(orderForDeliveryDate, quickDateValue)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Salvar Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Store Name Group Modal */}
      {storeGroupToEdit && (
        <div
          id="modal-edit-store-group"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl">store</span>
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-tight text-white">Editar Nome da Loja</h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    Atualizar cadastro e pedidos agrupados
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-close-edit-store-modal"
                onClick={() => setStoreGroupToEdit(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Form Content */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveStoreGroupEdit();
              }}
              className="p-6 space-y-4"
            >
              {/* Notice */}
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-lg shrink-0 mt-0.5">info</span>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  Você está alterando o nome para todos os{' '}
                  <strong className="font-black">{storeGroupToEdit.ordersCount} pedidos pendentes</strong> de{' '}
                  <span className="font-bold underline">&quot;{storeGroupToEdit.oldStoreName}&quot;</span> nesta fila.
                </p>
              </div>

              {/* Store Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Nome da Loja / Cliente</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="input-edit-store-name"
                    required
                    list="stores-edit-datalist"
                    value={storeGroupToEdit.newStoreName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      const matched = stores.find((s) => s.name.trim().toLowerCase() === newName.trim().toLowerCase());
                      const words = newName.trim().split(/\s+/).filter(Boolean);
                      const derivedInitials =
                        matched?.code ||
                        (words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : newName.substring(0, 2).toUpperCase());
                      setStoreGroupToEdit({
                        ...storeGroupToEdit,
                        newStoreName: newName,
                        storeInitials: derivedInitials || storeGroupToEdit.storeInitials,
                      });
                    }}
                    placeholder="Ex: Loja Matriz, Cliente Silva..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all pr-8"
                  />
                  {stores.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[16px]">unfold_more</span>
                    </div>
                  )}
                  <datalist id="stores-edit-datalist">
                    {stores.map((s) => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.code ? `${s.name} (${s.code})` : s.name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Store Initials / Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Sigla / Código (2 a 4 letras)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    id="input-edit-store-initials"
                    maxLength={5}
                    value={storeGroupToEdit.storeInitials}
                    onChange={(e) =>
                      setStoreGroupToEdit({
                        ...storeGroupToEdit,
                        storeInitials: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Ex: LM, CS"
                    className="w-28 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 uppercase tracking-wider focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-center"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {storeGroupToEdit.storeInitials || 'OP'}
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">Pré-visualização do badge</span>
                  </div>
                </div>
              </div>

              {/* Checkbox: Update Global Stores */}
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="checkbox-update-global-stores"
                  checked={storeGroupToEdit.updateGlobalStores}
                  onChange={(e) =>
                    setStoreGroupToEdit({
                      ...storeGroupToEdit,
                      updateGlobalStores: e.target.checked,
                    })
                  }
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Sincronizar e salvar também no cadastro geral de Lojas
                </span>
              </label>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  id="btn-cancel-edit-store"
                  onClick={() => setStoreGroupToEdit(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-save-edit-store"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Salvar Alterações</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Status & History Details Modal */}
      {selectedOrderForStatusModal && (
        <OrderStatusModal
          order={selectedOrderForStatusModal}
          isOpen={!!selectedOrderForStatusModal}
          onClose={() => setSelectedOrderForStatusModal(null)}
          stores={stores}
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
