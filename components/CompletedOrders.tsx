'use client';

import React, { useState, useMemo } from 'react';
import { OrderItem, UserProfile, OrderStatusHistoryLog } from '@/types/factory';
import { OrderStatusModal } from './OrderStatusModal';
import { saveOrderToFirestore, deleteOrderFromFirestore } from '@/lib/firestoreSync';

interface CompletedOrdersProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  searchQuery?: string;
  currentUser?: UserProfile | null;
}

export const CompletedOrders: React.FC<CompletedOrdersProps> = ({
  orders,
  setOrders,
  searchQuery: externalSearchQuery = '',
  currentUser,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<string>('ALL');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<OrderItem | null>(null);
  const [orderToRemake, setOrderToRemake] = useState<OrderItem | null>(null);
  const [remakeNote, setRemakeNote] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<OrderItem | null>(null);

  // Filter completed orders (executionStatus === 'concluido' or progress === 100)
  const completedOrders = useMemo(() => {
    return orders.filter(
      (ord) => ord.executionStatus === 'concluido' || ord.progress === 100
    );
  }, [orders]);

  // Extract unique store names for filter dropdown
  const storeOptions = useMemo(() => {
    const stores = Array.from(new Set(completedOrders.map((o) => o.store))).filter(Boolean);
    return stores.sort();
  }, [completedOrders]);

  // Apply search & store filters
  const filteredCompletedOrders = useMemo(() => {
    const query = (localSearch || externalSearchQuery).toLowerCase().trim();
    return completedOrders.filter((ord) => {
      // Store filter
      if (selectedStore !== 'ALL' && ord.store !== selectedStore) {
        return false;
      }

      // Search query filter (OP ID, Store, Item Description, Operator Code/Name)
      if (query) {
        const matchId = ord.orderId.toLowerCase().includes(query);
        const matchStore = ord.store.toLowerCase().includes(query);
        const matchDesc = ord.itemDescription.toLowerCase().includes(query);
        const matchOperator =
          (ord.assignedOperatorName && ord.assignedOperatorName.toLowerCase().includes(query)) ||
          (ord.assignedOperatorCode && ord.assignedOperatorCode.toLowerCase().includes(query));
        return matchId || matchStore || matchDesc || matchOperator;
      }

      return true;
    });
  }, [completedOrders, localSearch, externalSearchQuery, selectedStore]);

  // Handle order updates (e.g., if status is reverted or edited in modal)
  const handleUpdateOrder = (updatedOrder: OrderItem) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    setSelectedOrderForModal(updatedOrder);
    saveOrderToFirestore(updatedOrder);
  };

  // Confirm remaking order (sending piece back to production)
  const handleConfirmRemake = () => {
    if (!orderToRemake) return;

    const now = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const remakeLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      author: currentUser?.name || 'Gestor',
      status: 'pendente',
      reason: 'Enviado para refazer',
      note: remakeNote.trim() ? remakeNote.trim() : 'Pedido retornado para ser refeito na fábrica',
      actionType: 'return_to_pending',
    };

    const updatedOrder: OrderItem = {
      ...orderToRemake,
      executionStatus: 'pendente',
      progress: 0,
      column: 'hoje',
      statusHistory: [...(orderToRemake.statusHistory || []), remakeLog],
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    saveOrderToFirestore(updatedOrder);

    setOrderToRemake(null);
    setRemakeNote('');
  };

  // Confirm deleting order
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;

    const targetId = orderToDelete.id;
    setOrders((prev) => prev.filter((o) => o.id !== targetId));
    await deleteOrderFromFirestore(targetId);
    setOrderToDelete(null);
  };

  // Helper to format completion date from history
  const getCompletionDate = (ord: OrderItem) => {
    const log = ord.statusHistory?.find((h) => h.status === 'concluido');
    if (log && log.timestamp) return log.timestamp;
    if (ord.productionDate && ord.productionDate !== 'Aguardando Data') return ord.productionDate;
    return '100% Concluído';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Pedidos Concluídos</span>
              <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium border border-slate-200/60">
                {completedOrders.length}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Planilha e histórico final de todas as ordens de produção 100% finalizadas na fábrica.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Finalizados</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{completedOrders.length}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>100% Produzidos</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">fact_check</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Lojas Atendidas</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{storeOptions.length}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Pontos de venda atendidos</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">store</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Exibindo na Tabela</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{filteredCompletedOrders.length}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Filtrados na busca</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">table_rows</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por N° do Pedido / OP, Loja, Descrição da Esquadria ou Montador..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              title="Limpar busca"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Store selector */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap hidden sm:inline">Filtrar Loja:</span>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Todas as Lojas ({completedOrders.length})</option>
            {storeOptions.map((storeName) => {
              const count = completedOrders.filter((o) => o.store === storeName).length;
              return (
                <option key={storeName} value={storeName}>
                  {storeName} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Spreadsheet-like Table (`Planilha`) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-600">table_view</span>
            <span>Planilha de Pedidos Finalizados</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Clique em qualquer pedido para abrir o histórico detalhado
          </span>
        </div>

        {filteredCompletedOrders.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-3xl">assignment_late</span>
            </div>
            <p className="text-sm font-bold text-slate-700">Nenhum pedido concluído encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {completedOrders.length === 0
                ? 'Assim que os gestores marcarem os pedidos como 100% concluídos, eles serão listados automaticamente nesta página.'
                : 'Nenhum pedido atende aos filtros de busca informados.'}
            </p>
            {(localSearch || selectedStore !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setSelectedStore('ALL');
                }}
                className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-5">OP / N° Pedido</th>
                  <th className="py-3.5 px-5">Loja / Cliente</th>
                  <th className="py-3.5 px-5">Descrição da Esquadria / Item</th>
                  <th className="py-3.5 px-5 text-center">Qtd.</th>
                  <th className="py-3.5 px-5">Montador Responsável</th>
                  <th className="py-3.5 px-5">Data de Conclusão</th>
                  <th className="py-3.5 px-5 text-center">Status / Urgência</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCompletedOrders.map((ord) => {
                  const completionDate = getCompletionDate(ord);

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrderForModal(ord)}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                    >
                      {/* OP / N° Pedido */}
                      <td className="py-4 px-5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-slate-800 text-xs font-mono font-semibold">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">task_alt</span>
                          <span>OP #{ord.orderId}</span>
                        </div>
                      </td>

                      {/* Loja / Cliente */}
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span>{ord.store}</span>
                        </span>
                      </td>

                      {/* Descrição da Esquadria */}
                      <td className="py-4 px-5 font-medium text-slate-800 max-w-xs">
                        <div className="line-clamp-2" title={ord.itemDescription}>
                          {ord.itemDescription}
                        </div>
                      </td>

                      {/* Quantidade */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <span className="font-medium text-slate-700 text-xs">
                          {ord.quantity} {ord.unit || 'un'}
                        </span>
                      </td>

                      {/* Montador Responsável */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {ord.assignedOperatorName ? (
                          <div className="inline-flex items-center gap-1.5 text-slate-700 font-medium text-xs">
                            <span className="material-symbols-outlined text-slate-400 text-sm">engineering</span>
                            <span>
                              {ord.assignedOperatorCode ? `${ord.assignedOperatorCode} - ${ord.assignedOperatorName}` : ord.assignedOperatorName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Nenhum montador vinculado</span>
                        )}
                      </td>

                      {/* Data de Conclusão */}
                      <td className="py-4 px-5 whitespace-nowrap font-medium text-slate-600">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="material-symbols-outlined text-sm text-slate-400">event_available</span>
                          <span>{completionDate}</span>
                        </div>
                      </td>

                      {/* Status & Urgência */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                            <span>100% Concluído</span>
                          </span>

                          {ord.priority === 'ALTA PRIORIDADE' && (
                            <span className="text-amber-700 text-[10px] font-medium">
                              Alta Prioridade
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Voltar para Refazer */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToRemake(ord);
                            }}
                            title="Voltar pedido para ser refeito na fábrica"
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-sm text-amber-600">replay</span>
                            <span>Refazer</span>
                          </button>

                          {/* Excluir Pedido */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToDelete(ord);
                            }}
                            title="Excluir pedido definitivamente"
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-rose-600 border border-slate-200 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-sm text-slate-500">delete</span>
                            <span>Excluir</span>
                          </button>

                          {/* Ver Histórico */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderForModal(ord);
                            }}
                            title="Ver histórico detalhado do pedido"
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-sm">visibility</span>
                            <span className="hidden xl:inline">Histórico</span>
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

      {/* Modal: Confirmar Refazer Pedido */}
      {orderToRemake && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-bold shrink-0">
                  <span className="material-symbols-outlined text-xl">replay</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Voltar Pedido para Refazer</h3>
                  <p className="text-xs text-slate-500 font-medium">OP #{orderToRemake.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrderToRemake(null);
                  setRemakeNote('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Ao confirmar, a peça <strong className="text-slate-900">{orderToRemake.itemDescription}</strong> sairá do histórico de concluídos e retornará para a fila de produção ativa na coluna <strong className="text-slate-900">&quot;Hoje&quot;</strong>.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Motivo / Observação para a fábrica (opcional):
                </label>
                <textarea
                  value={remakeNote}
                  onChange={(e) => setRemakeNote(e.target.value)}
                  placeholder="Ex: Peça com incorreção nas medidas, refazer esquadria..."
                  rows={3}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setOrderToRemake(null);
                  setRemakeNote('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRemake}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">replay</span>
                <span>Confirmar e Refazer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Excluir Pedido */}
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

      {/* Order Details & History Modal */}
      {selectedOrderForModal && (
        <OrderStatusModal
          isOpen={!!selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
          order={selectedOrderForModal}
          onUpdateOrder={handleUpdateOrder}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
