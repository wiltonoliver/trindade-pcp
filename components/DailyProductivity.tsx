'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { OrderItem, ExecutionStatus } from '@/types/factory';
import { OrderStatusModal } from './OrderStatusModal';
import { sanitizeUnit } from '@/lib/utils';

interface DailyProductivityProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  searchQuery: string;
}

export const DailyProductivity: React.FC<DailyProductivityProps> = ({
  orders,
  setOrders,
  searchQuery,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [selectedOrderForStatusModal, setSelectedOrderForStatusModal] = useState<OrderItem | null>(null);

  // Filter orders for "Hoje" or general scheduled
  const todayOrders = orders.filter((ord) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        ord.orderId.toLowerCase().includes(q) ||
        ord.store.toLowerCase().includes(q) ||
        ord.itemDescription.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSetStatus = (
    id: string,
    status: ExecutionStatus,
    reason?: string
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === id) {
          let updatedProgress = ord.progress;
          if (status === 'concluido') updatedProgress = 100;
          else if (status === 'parcial') updatedProgress = 50;
          else if (status === 'nao_produzido') updatedProgress = 0;

          return {
            ...ord,
            executionStatus: status,
            progress: updatedProgress,
            delayReason: reason !== undefined ? reason : ord.delayReason,
          };
        }
        return ord;
      })
    );
  };

  const handleSaveProgress = (isEndShift = false) => {
    setSaveToast(
      isEndShift
        ? 'Turno encerrado e relatório de produção sincronizado com sucesso!'
        : 'Rascunho de produtividade salvo localmente.'
    );
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Stats calculation based exclusively on real orders
  const completedCount = orders.filter((o) => o.executionStatus === 'concluido').length;
  const pendingCount = orders.filter((o) => o.executionStatus === 'pendente' || o.executionStatus === 'parcial').length;
  const errorCount = orders.filter((o) => o.executionStatus === 'nao_produzido').length;
  const totalCount = orders.length;
  const efficiency = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 pb-32 animate-fadeIn">
      {/* Toast Feedback */}
      {saveToast && (
        <div className="fixed top-20 right-8 bg-[#191b23] text-white px-5 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 border border-blue-500 animate-bounce">
          <span className="material-symbols-outlined text-green-400">check_circle</span>
          <span className="text-sm font-semibold">{saveToast}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Produtividade Diária
          </h2>
          <nav className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-semibold">
            <span>Dashboard</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="text-blue-600 font-bold">Produção Hoje</span>
          </nav>
        </div>

        <div className="bg-slate-100 rounded-xl p-3 flex items-center gap-4 border border-slate-200">
          <div className="text-right">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Turno Atual
            </p>
            <p className="text-sm font-bold text-slate-900">Manhã (06:00 - 14:00)</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
            <span className="material-symbols-outlined text-blue-600 text-[18px]">
              event
            </span>
            <span className="text-xs font-bold text-blue-600">21 de Julho de 2026</span>
          </div>
        </div>
      </div>

      {/* Production Stats Overview (Bento Style) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Eficiência Geral */}
        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Eficiência Geral
            </p>
            <span className="text-emerald-600 font-bold flex items-center text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              <span className="material-symbols-outlined text-xs mr-1">trending_up</span>
              +4.2%
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-4xl font-bold text-slate-900">{efficiency}%</h3>
            <div className="w-full bg-slate-100 mt-3 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${efficiency}%` }}
              />
            </div>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-3 gap-6">
          <div className="flex flex-col justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Concluídos
            </p>
            <h4 className="text-3xl font-bold text-emerald-600 mt-2">{completedCount}</h4>
            <p className="text-xs text-slate-400 mt-1 font-medium">De {totalCount} total</p>
          </div>

          <div className="flex flex-col justify-between border-x border-slate-100 px-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pendentes
            </p>
            <h4 className="text-3xl font-bold text-amber-600 mt-2">{pendingCount}</h4>
            <p className="text-xs text-slate-400 mt-1 font-medium">Aguardando execução</p>
          </div>

          <div className="flex flex-col justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Atrasos/Falhas
            </p>
            <h4 className="text-3xl font-bold text-slate-700 mt-2">{errorCount}</h4>
            <p className="text-xs text-slate-400 mt-1 font-medium">Não produzidos</p>
          </div>
        </div>
      </div>

      {/* Orders Execution Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
          <h3 className="font-bold text-lg text-slate-900">Pedidos Agendados (Hoje)</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => alert('Filtro de ordens aplicado')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt</span>
              <span>Filtrar</span>
            </button>
            <button
              onClick={() => handleSaveProgress(false)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>Atualizar Lista</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-100">
                <th className="px-6 py-4">Pedido / Loja</th>
                <th className="px-6 py-4">Itens</th>
                <th className="px-6 py-4">Qtd</th>
                <th className="px-6 py-4">Status de Execução</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {todayOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">
                      fact_check
                    </span>
                    <p className="font-semibold text-slate-700 text-sm">Nenhum pedido cadastrado para hoje</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Cadastre novos pedidos na aba &quot;Entrada de Pedidos&quot; ou adicione no Painel de Planejamento.
                    </p>
                  </td>
                </tr>
              ) : (
                todayOrders.map((ord, idx) => {
                  const isConcluido = ord.executionStatus === 'concluido';
                  const isParcial = ord.executionStatus === 'parcial';
                  const isNao = ord.executionStatus === 'nao_produzido';

                  return (
                    <tr
                      key={ord.id ? `${ord.id}-${idx}` : `ord-${idx}`}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isParcial || isNao ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForStatusModal(ord)}
                          className="flex flex-col text-left group/op cursor-pointer"
                          title="Clique para relatar status / motivo desta OP"
                        >
                          <span className="font-bold text-blue-600 group-hover/op:underline inline-flex items-center gap-1">
                            <span>{ord.orderId}</span>
                            <span className="material-symbols-outlined text-[14px]">edit_note</span>
                          </span>
                          <span className="text-xs text-slate-400 font-medium uppercase tracking-tight">
                            {ord.store}
                          </span>
                        </button>
                      </td>

                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {ord.itemDescription}
                      </td>

                      <td className="px-6 py-4">
                        <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-900 truncate inline-block max-w-[120px]">
                          {ord.quantity} {sanitizeUnit(ord.unit)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleSetStatus(ord.id, 'concluido')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              isConcluido
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs scale-105'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-emerald-50/50'
                            }`}
                          >
                            Concluído
                          </button>

                          <button
                            onClick={() => handleSetStatus(ord.id, 'parcial')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              isParcial
                                ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs scale-105'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-amber-50/50'
                            }`}
                          >
                            Parcial
                          </button>

                          <button
                            onClick={() => handleSetStatus(ord.id, 'nao_produzido')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                              isNao
                                ? 'bg-slate-100 text-slate-800 border-slate-300 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            Não Produzido
                          </button>
                        </div>

                        {/* Motivo do Atraso Dropdown if Parcial or Não Produzido */}
                        {(isParcial || isNao) && (
                          <div className="mt-3 p-2 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                            <label className="block text-[10px] font-bold text-amber-900 uppercase">
                              Motivo do Atraso / Parada:
                            </label>
                            <select
                              value={ord.delayReason || ''}
                              onChange={(e) =>
                                handleSetStatus(ord.id, ord.executionStatus, e.target.value)
                              }
                              className="w-full text-xs p-1.5 border border-amber-300 rounded-lg bg-white text-slate-900 focus:ring-1 focus:ring-amber-500 outline-none font-medium"
                            >
                              <option value="">Selecione um motivo...</option>
                              <option value="Falta de Insumo">Falta de Insumo</option>
                              <option value="Quebra de Máquina">Quebra de Máquina</option>
                              <option value="Falta de Pessoal">Falta de Pessoal</option>
                              <option value="Qualidade / Refugo">Qualidade / Refugo</option>
                            </select>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-blue-600 transition-colors p-1">
                          <span className="material-symbols-outlined text-[20px]">
                            more_vert
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
          <span>Mostrando {todayOrders.length} de {todayOrders.length} pedidos em produção</span>
          <div className="flex space-x-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold">
              1
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white text-xs">
              2
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white text-xs">
              3
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Sticky Footer Bar */}
      <footer className="fixed bottom-0 right-0 left-0 ml-[260px] bg-white border-t border-slate-200 p-4 flex justify-between items-center shadow-lg z-50">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden relative">
              <Image
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuApFJX6cQ0gq-aQWRigIwr8cZNdb8J1xH_SN3zMWtIi72r_zysu8nHPJpIMPXT_bioRYqw5FVxwNNlCWlcn46B0k4D10bBfLvufWjMaWm2M-GgBguD7rKhDQuvC-E9MQFjO92udRh-Hp_07Y_KzwoRXMir9bi50GozrF0fG-iLLp5LqhCzdT5dDWB1SKKDpXGyOr5XA_MZXEeDewgOttsMHoi9zIxuPNEyhoxALeNEJNY746f_STdVODxACdMjlWbWHl_71aXQFDT4"
                alt="Manager Shift A"
                fill
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 text-[10px] flex items-center justify-center text-white font-bold">
              +12
            </div>
          </div>
          <p className="text-xs text-slate-600 font-semibold">
            Equipe sincronizada com 14 operadores ativos
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSaveProgress(false)}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Salvar Rascunho
          </button>
          <button
            onClick={() => handleSaveProgress(true)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">task_alt</span>
            <span>Encerrar Turno / Salvar Progresso</span>
          </button>
        </div>
      </footer>

      <OrderStatusModal
        key={selectedOrderForStatusModal?.id || 'none'}
        order={selectedOrderForStatusModal}
        isOpen={!!selectedOrderForStatusModal}
        onClose={() => setSelectedOrderForStatusModal(null)}
        onUpdateOrder={(updatedOrder) => {
          setOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );
        }}
      />
    </div>
  );
};
