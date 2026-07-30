'use client';

import React, { useState, useMemo } from 'react';
import { OrderItem, UserProfile } from '@/types/factory';
import { OrderStatusModal } from './OrderStatusModal';

interface ReplanningHistoryProps {
  orders?: OrderItem[];
  setOrders?: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  onReintroduceItemToPlanning?: (item: OrderItem) => void;
  onReintroduceAllToPlanning?: (items: OrderItem[]) => void;
  searchQuery?: string;
  currentUser?: UserProfile | null;
}

interface LogRow {
  logId: string;
  uniqueKey: string;
  orderId: string;
  orderCode: string;
  store: string;
  itemDescription: string;
  timestamp: string;
  author: string;
  status: string;
  reason: string;
  note?: string;
  orderObj: OrderItem;
}

export const ReplanningHistory: React.FC<ReplanningHistoryProps> = ({
  orders = [],
  setOrders,
  onReintroduceItemToPlanning,
  onReintroduceAllToPlanning,
  searchQuery = '',
  currentUser,
}) => {
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<OrderItem | null>(null);

  // Real pending items calculated from real orders
  const pendingItems = useMemo(() => {
    return orders.filter(
      (o) =>
        o.isPendingReposition ||
        o.executionStatus === 'nao_produzido' ||
        (!o.productionDate && o.column === 'nao_planejado' && Boolean(o.delayReason || o.pendingReason))
    );
  }, [orders]);

  // Real problem logs extracted from all orders' statusHistory & reasons
  const problemLogs = useMemo(() => {
    const logs: LogRow[] = [];

    orders.forEach((ord) => {
      if (ord.statusHistory && ord.statusHistory.length > 0) {
        ord.statusHistory.forEach((h, hIdx) => {
          logs.push({
            logId: h.id,
            uniqueKey: `${ord.id}-${h.id || 'log'}-${hIdx}`,
            orderId: ord.id,
            orderCode: ord.orderId,
            store: ord.store,
            itemDescription: ord.itemDescription,
            timestamp: h.timestamp,
            author: h.author || 'Gestor',
            status: h.status,
            reason: h.reason || ord.delayReason || 'Ocorrência registrada',
            note: h.note,
            orderObj: ord,
          });
        });
      } else if (ord.delayReason || ord.pendingReason) {
        logs.push({
          logId: `fallback-${ord.id}`,
          uniqueKey: `fallback-${ord.id}`,
          orderId: ord.id,
          orderCode: ord.orderId,
          store: ord.store,
          itemDescription: ord.itemDescription,
          timestamp: ord.productionDate || 'Sem data',
          author: 'Gestor',
          status: ord.executionStatus,
          reason: ord.delayReason || ord.pendingReason || 'Atraso / Não concluído',
          note: undefined,
          orderObj: ord,
        });
      }
    });

    return logs;
  }, [orders]);

  // Filtered problem history by search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return problemLogs;
    const q = searchQuery.toLowerCase();
    return problemLogs.filter(
      (item) =>
        item.orderCode.toLowerCase().includes(q) ||
        item.store.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.itemDescription.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q))
    );
  }, [problemLogs, searchQuery]);

  // Real Stats for "Problemas mais Comuns"
  const reasonStats = useMemo(() => {
    if (problemLogs.length === 0) return [];

    const counts: Record<string, number> = {};
    problemLogs.forEach((log) => {
      const r = log.reason || 'Outros Motivos';
      counts[r] = (counts[r] || 0) + 1;
    });

    const total = problemLogs.length;
    return Object.entries(counts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [problemLogs]);

  // Real Stats for "Eficiência Global"
  const efficiencyStats = useMemo(() => {
    if (orders.length === 0) {
      return { percentage: 100, completed: 0, total: 0 };
    }
    const completed = orders.filter((o) => o.executionStatus === 'concluido' || o.progress === 100).length;
    const total = orders.length;
    const percentage = Math.round((completed / total) * 100);
    return { percentage, completed, total };
  }, [orders]);

  // Actions
  const handleReintroduceSingle = (item: OrderItem) => {
    if (
      item.column === 'nao_planejado' &&
      item.executionStatus === 'pendente' &&
      !item.isPendingReposition &&
      !item.productionDate
    ) {
      setFeedbackToast(`OP #${item.orderId} já está na coluna Aguardando Data!`);
      setTimeout(() => setFeedbackToast(null), 3000);
      return;
    }

    if (onReintroduceItemToPlanning) {
      onReintroduceItemToPlanning(item);
    } else if (setOrders) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === item.id
            ? {
                ...o,
                column: 'nao_planejado',
                executionStatus: 'pendente',
                isPendingReposition: false,
                productionDate: '',
                pendingReason: '',
                delayReason: '',
              }
            : o
        )
      );
    }
    setFeedbackToast(`OP #${item.orderId} remanejada para Aguardando Data!`);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleReintroduceAll = () => {
    if (pendingItems.length === 0) return;

    if (onReintroduceAllToPlanning) {
      onReintroduceAllToPlanning(pendingItems);
    } else if (setOrders) {
      const pendingIds = new Set(pendingItems.map((p) => p.id));
      setOrders((prev) =>
        prev.map((o) =>
          pendingIds.has(o.id)
            ? {
                ...o,
                column: 'nao_planejado',
                executionStatus: 'pendente',
                isPendingReposition: false,
                productionDate: '',
                pendingReason: '',
                delayReason: '',
              }
            : o
        )
      );
    }
    setFeedbackToast('Todas as pendências foram remanejadas para Aguardando Data!');
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleDeletePending = (orderId: string) => {
    if (setOrders) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                isPendingReposition: false,
                pendingReason: '',
              }
            : o
        )
      );
    }
    setFeedbackToast('Item removido da lista de pendências.');
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleDeleteHistoryItem = (logId: string, orderId: string) => {
    if (setOrders) {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === orderId) {
            const newHistory = (o.statusHistory || []).filter((h) => h.id !== logId);
            return {
              ...o,
              statusHistory: newHistory,
              delayReason: newHistory.length > 0 ? newHistory[0].reason : '',
            };
          }
          return o;
        })
      );
    }
    setFeedbackToast('Registro do histórico excluído.');
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleExportCSV = () => {
    if (problemLogs.length === 0) {
      setFeedbackToast('Nenhum registro para exportar.');
      setTimeout(() => setFeedbackToast(null), 3000);
      return;
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Data,Autor,Loja,OP,Motivo/Problema,Observacao\n' +
      problemLogs
        .map(
          (e) =>
            `"${e.timestamp}","${e.author}","${e.store}","${e.orderCode}","${e.reason}","${
              e.note ? e.note.replace(/"/g, '""') : ''
            }"`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historico_ocorrencias_factoryops_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-emerald-500 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400">task_alt</span>
          <span className="text-sm font-semibold">{feedbackToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Re-planejamento e Histórico de Ocorrências
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie pendências em tempo real e analise o histórico de relatos gravados pelos gestores.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-blue-600">download</span>
            <span>Exportar CSV do Histórico</span>
          </button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Section 1: Recolocação de Pendências (5 Cols) */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-600 text-[22px]">
                    running_with_errors
                  </span>
                  <h3 className="font-bold text-lg text-slate-900">
                    Recolocação de Pendências
                  </h3>
                </div>
                <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-100">
                  {pendingItems.length} pendente(s)
                </span>
              </div>

              {/* Pending Items List */}
              <div className="space-y-3 overflow-y-auto max-h-[480px] custom-scrollbar pr-1">
                {pendingItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400">
                    <span className="material-symbols-outlined text-emerald-600 text-[40px] mb-2">
                      check_circle
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      Nenhuma pendência para recolocação!
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Todas as ordens de produção estão com datas definidas ou concluídas.
                    </p>
                  </div>
                ) : (
                  pendingItems.map((item, idx) => (
                    <div
                      key={item.id ? `${item.id}-${idx}` : `pending-${idx}`}
                      className="p-4 bg-slate-50 rounded-2xl border-l-4 border-amber-500 border border-slate-200/80 flex items-center justify-between hover:shadow-xs transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForModal(item)}
                            className="font-bold text-sm text-blue-700 hover:underline flex items-center gap-1"
                          >
                            <span>OP #{item.orderId}</span>
                            <span className="material-symbols-outlined text-[14px]">edit_note</span>
                          </button>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                            {item.store}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium mt-1 truncate max-w-xs">
                          {item.itemDescription}
                        </p>
                        <p className="text-[11px] text-amber-800 font-bold mt-1">
                          Motivo: {item.delayReason || item.pendingReason || 'Aguardando definição de data'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleReintroduceSingle(item)}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm mr-1">
                            refresh
                          </span>
                          <span>Reintroduzir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePending(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover das pendências"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bulk Action Footer */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReintroduceAll}
                disabled={pendingItems.length === 0}
                className="w-full py-3.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  playlist_add_check
                </span>
                <span>Reintroduzir Todos no Planejamento</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Histórico Real & Analytics (7 Cols) */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart: Problemas Mais Comuns (Real Data) */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm min-h-56 flex flex-col justify-between">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">
                  analytics
                </span>
                <span>Problemas Mais Comuns ({problemLogs.length} Relatos)</span>
              </h4>

              {reasonStats.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  Sem problemas registrados até o momento.
                </div>
              ) : (
                <div className="space-y-2.5 my-2">
                  {reasonStats.map((st, idx) => {
                    const colors = ['bg-amber-600', 'bg-rose-600', 'bg-blue-600', 'bg-slate-600'];
                    const colorClass = colors[idx % colors.length];
                    return (
                      <div key={st.reason} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span className="truncate max-w-[180px]">{st.reason}</span>
                          <span className="font-bold text-slate-900">
                            {st.count}x ({st.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${colorClass} transition-all duration-500`}
                            style={{ width: `${Math.max(st.percentage, 5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Overall Efficiency Banner Card (Real Data) */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-center text-center text-white">
              <div className="relative z-10">
                <p className="text-blue-400 text-5xl font-black tracking-tight mb-1">
                  {efficiencyStats.percentage}%
                </p>
                <p className="text-slate-100 text-xs font-bold uppercase tracking-wider">
                  Eficiência Global de Conclusão
                </p>
                <p className="text-slate-400 text-[11px] mt-3">
                  {efficiencyStats.completed} de {efficiencyStats.total} OPs concluídas no sistema
                </p>
              </div>
            </div>
          </div>

          {/* Data Table Section: Histórico de Problemas / Ocorrências */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50/60 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Histórico de Ocorrências e Relatos de Gestão
                </h3>
                <p className="text-xs text-slate-500">
                  Registro de alterações de status, falhas e observações por OP
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 shadow-2xs">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Data / Hora
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      OP / Loja
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Descrição da Peça
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Motivo Relatado
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl mb-2 text-slate-300">
                          find_in_page
                        </span>
                        <p className="font-bold text-slate-700">
                          Nenhum registro encontrado no histórico.
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Ao relatar o status de um pedido na lista de OPs ou relatórios, os motivos ficarão gravados aqui.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((row, idx) => {
                      const isConcluded = row.status === 'concluido' || row.orderObj.executionStatus === 'concluido';
                      return (
                        <tr key={row.uniqueKey || (row.logId ? `${row.logId}-${idx}` : `log-${idx}`)} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap">
                            {row.timestamp}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForModal(row.orderObj)}
                              className="font-black text-blue-700 hover:underline inline-flex items-center gap-1"
                              title="Ver / editar relato desta OP"
                            >
                              <span>#{row.orderCode}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                {row.store}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800 max-w-[240px] truncate" title={row.itemDescription}>
                            {row.itemDescription || 'Sem descrição'}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-amber-900">
                            {isConcluded ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200/80">
                                <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                                CONCLUÍDO
                              </span>
                            ) : (
                              <>
                                <div>{row.reason}</div>
                                {row.note && (
                                  <div className="text-[11px] font-normal text-slate-600 italic mt-0.5">
                                    &quot;{row.note}&quot;
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleDeleteHistoryItem(row.logId, row.orderId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir do histórico"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
              <span>
                Mostrando <strong>{filteredHistory.length}</strong> de <strong>{problemLogs.length}</strong> relato(s)
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Order Status Modal when clicked from History */}
      <OrderStatusModal
        key={selectedOrderForModal?.id || 'none'}
        order={selectedOrderForModal}
        isOpen={!!selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        onUpdateOrder={(updatedOrder) => {
          if (setOrders) {
            setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
          }
        }}
        currentUser={currentUser}
      />
    </div>
  );
};
