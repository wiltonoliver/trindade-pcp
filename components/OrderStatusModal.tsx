'use client';

import React, { useState } from 'react';
import { OrderItem, ExecutionStatus, OrderStatusHistoryLog, UserProfile } from '@/types/factory';
import { sanitizeUnit } from '@/lib/utils';

interface OrderStatusModalProps {
  order: OrderItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOrder: (updatedOrder: OrderItem) => void;
  currentUser?: UserProfile | null;
}

const COMMON_REASONS = [
  'FALTA DE PERFIL',
  'FALTA DE VIDRO',
  'FALTA DE ACESSÓRIO',
  'FUNCIONÁRIO FALTA/ATRAZO',
  'QUEBRA DE MAQUINÁRIO',
  'QUEDA DE ENERGIA',
  'PROBLEMAS COMPRESSOR',
  'ERRO PCP',
  'ERRO DE CORTE',
  'ERRO DE USINAGEM',
  'OPERACIONAL',
  'Outro Motivo (descrever abaixo)',
];

export const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateOrder,
  currentUser,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ExecutionStatus | 'retornado_aguardando'>(
    order?.executionStatus || (order?.progress === 100 ? 'concluido' : 'nao_produzido')
  );
  const [selectedReason, setSelectedReason] = useState<string>(order?.delayReason || order?.pendingReason || '');
  const [customNote, setCustomNote] = useState<string>('');
  const [returnToPendingDate, setReturnToPendingDate] = useState<boolean>(!order?.productionDate);

  // 5S Operational Evaluation State (1 to 5)
  const [cleanlinessScore, setCleanlinessScore] = useState<number>(order?.cleanlinessScore || 5);
  const [organizationScore, setOrganizationScore] = useState<number>(order?.organizationScore || 5);
  const [disciplineScore, setDisciplineScore] = useState<number>(order?.disciplineScore || 5);

  if (!isOpen || !order) return null;

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isVendas = userRole.includes('venda') || userRole.includes('lojista') || userRole.includes('representante');
  const isReadOnly = isVendas || currentUser?.permissions?.canEditProduction === false;

  const handleStatusChange = (status: ExecutionStatus | 'retornado_aguardando') => {
    setSelectedStatus(status);
    if (status === 'retornado_aguardando') {
      setReturnToPendingDate(true);
    }
  };

  const handleSelectPresetReason = (reason: string) => {
    if (selectedReason === reason) {
      setSelectedReason('');
    } else {
      setSelectedReason(reason);
    }
  };

  const handleSave = () => {
    const nowStr = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const authorName = currentUser?.name || 'Gestor de Operações';

    // Calculate updated properties
    let finalStatus: ExecutionStatus = 'pendente';
    let finalProgress = order.progress;
    let finalColumn = order.column;
    let finalProdDate = order.productionDate;
    let finalPendingReposition = order.isPendingReposition || false;
    let actionType: 'status_update' | 'reschedule' | 'return_to_pending' = 'status_update';

    if (selectedStatus === 'concluido') {
      finalStatus = 'concluido';
      finalProgress = 100;
      finalPendingReposition = false;
    } else if (selectedStatus === 'parcial') {
      finalStatus = 'parcial';
      finalProgress = 50;
    } else if (selectedStatus === 'nao_produzido') {
      finalStatus = 'nao_produzido';
      finalProgress = order.progress === 100 ? 0 : order.progress;
    } else if (selectedStatus === 'retornado_aguardando') {
      finalStatus = 'nao_produzido';
      finalProgress = 0;
      finalColumn = 'nao_planejado';
      finalProdDate = '';
      finalPendingReposition = true;
      actionType = 'return_to_pending';
    }

    if (returnToPendingDate && selectedStatus !== 'concluido') {
      finalColumn = 'nao_planejado';
      finalProdDate = '';
      finalPendingReposition = true;
      actionType = 'return_to_pending';
    }

    const effectiveReason = selectedReason || (selectedStatus === 'concluido' ? '' : 'Sem motivo especificado');

    // Build history log entry with 5S scores
    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowStr,
      author: authorName,
      status: selectedStatus,
      reason: effectiveReason,
      note: customNote.trim() || undefined,
      previousDate: order.productionDate || 'Aguardando Data',
      actionType: actionType,
      cleanlinessScore,
      organizationScore,
      disciplineScore,
    };

    const existingHistory = order.statusHistory || [];
    const updatedHistory = [newLog, ...existingHistory];

    const updatedOrder: OrderItem = {
      ...order,
      executionStatus: finalStatus,
      progress: finalProgress,
      column: finalColumn,
      productionDate: finalProdDate,
      isPendingReposition: finalPendingReposition,
      delayReason: effectiveReason,
      pendingReason: effectiveReason,
      statusHistory: updatedHistory,
      cleanlinessScore,
      organizationScore,
      disciplineScore,
    };

    onUpdateOrder(updatedOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <span className="material-symbols-outlined text-2xl">assignment_late</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base text-white">OP #{order.orderId}</span>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-bold">
                  {order.store}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium truncate max-w-md">
                {order.itemDescription}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800">
          {/* Order Quick Summary Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Quantidade</span>
              <span className="font-bold text-slate-900 block truncate">{order.quantity || 1} {sanitizeUnit(order.unit)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Montador</span>
              <span className="font-bold text-slate-900 truncate block">
                {order.assignedOperatorName || order.assignedOperatorCode || 'Não atribuído'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Data Atual</span>
              <span className="font-bold text-slate-900">
                {order.productionDate ? order.productionDate : 'Aguardando Data'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Progresso Atual</span>
              <span className="font-bold text-slate-900">{order.progress}%</span>
            </div>
          </div>

          {/* Read Only Notice for Vendas */}
          {isReadOnly && (
            <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex items-center gap-3 font-medium shadow-2xs">
              <span className="material-symbols-outlined text-amber-600 text-xl shrink-0">lock</span>
              <div>
                <p className="font-bold text-amber-950">Apenas Leitura ({currentUser?.role || 'VENDAS'})</p>
                <p className="text-amber-800 text-[11px] mt-0.5">Seu perfil possui permissão de consulta e não pode alterar o status ou registrar relatos nesta OP.</p>
              </div>
            </div>
          )}

          {!isReadOnly && (
            <>
              {/* Manager Action Selection */}
              <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Selecione o Novo Status do Pedido / OP
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleStatusChange('concluido')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedStatus === 'concluido'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl p-1.5 rounded-xl ${
                    selectedStatus === 'concluido' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  check_circle
                </span>
                <div>
                  <div className="font-bold text-xs">Concluído (100%)</div>
                  <div className="text-[10px] text-slate-500">Esquadria montada e liberada</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('nao_produzido')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedStatus === 'nao_produzido'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl p-1.5 rounded-xl ${
                    selectedStatus === 'nao_produzido' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  warning
                </span>
                <div>
                  <div className="font-bold text-xs">Não Concluído / Com Problema</div>
                  <div className="text-[10px] text-slate-500">Manter na data com relato de motivo</div>
                </div>
              </button>
            </div>
          </div>

          {/* 5S Operational Evaluation Section */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">fact_check</span>
                <span>Avaliação de Limpeza, Organização e Disciplina</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Escala 1 a 5</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Limpeza */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1 text-slate-700">
                    <span className="material-symbols-outlined text-[15px] text-cyan-600">cleaning_services</span>
                    Limpeza
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-black text-[11px]">
                    {cleanlinessScore} / 5
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-between">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={`clean-${star}`}
                      type="button"
                      onClick={() => setCleanlinessScore(star)}
                      className={`flex-1 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        cleanlinessScore >= star
                          ? 'bg-amber-400 text-slate-900 shadow-2xs font-black'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Organização */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1 text-slate-700">
                    <span className="material-symbols-outlined text-[15px] text-indigo-600">inventory_2</span>
                    Organização
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-black text-[11px]">
                    {organizationScore} / 5
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-between">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={`org-${star}`}
                      type="button"
                      onClick={() => setOrganizationScore(star)}
                      className={`flex-1 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        organizationScore >= star
                          ? 'bg-amber-400 text-slate-900 shadow-2xs font-black'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Disciplina */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1 text-slate-700">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                    Disciplina
                  </span>
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-black text-[11px]">
                    {disciplineScore} / 5
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-between">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={`disc-${star}`}
                      type="button"
                      onClick={() => setDisciplineScore(star)}
                      className={`flex-1 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        disciplineScore >= star
                          ? 'bg-amber-400 text-slate-900 shadow-2xs font-black'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Reason Selection Section (For non-completed or reschedule) */}
          {selectedStatus !== 'concluido' && (
            <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-700">report_problem</span>
                <span>2. Motivo da Não Conclusão / Atraso</span>
              </label>

              <div className="flex flex-wrap gap-2">
                {COMMON_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => handleSelectPresetReason(reason)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-700 text-white shadow-sm'
                          : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>

              {/* Custom Detail Area */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observação Detalhada do Gestor:
                </label>
                <textarea
                  rows={2}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Escreva observações adicionais sobre o atraso, medidas ou solução necessária..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Checkbox for date removal */}
              <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chk-return-pending"
                  checked={returnToPendingDate}
                  onChange={(e) => setReturnToPendingDate(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="chk-return-pending" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Retornar esta OP para a lista de &quot;Aguardando Data&quot; (limpar data programada)
                </label>
              </div>
            </div>
          )}
            </>
          )}

          {/* History Timeline of previous motives & status changes */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-600">history</span>
              <span>Histórico de Relatos e Motivos Gravados ({order.statusHistory?.length || 0})</span>
            </h4>

            {!order.statusHistory || order.statusHistory.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                Nenhuma ocorrência ou alteração registrada anteriormente para este pedido.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {order.statusHistory.map((log, idx) => (
                  <div key={log.id ? `${log.id}-${idx}` : `log-${idx}`} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1 text-slate-700">
                        <span className="material-symbols-outlined text-[14px] text-blue-600">person</span>
                        {log.author}
                      </span>
                      <span>{log.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-200 text-slate-800">
                        {log.status === 'concluido'
                          ? 'Concluído'
                          : log.status === 'retornado_aguardando'
                          ? 'Retornado p/ Aguardando Data'
                          : 'Com Problema / Não Concluído'}
                      </span>
                      {log.previousDate && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          Data anterior: {log.previousDate}
                        </span>
                      )}
                    </div>

                    {log.reason && log.reason !== 'Sem motivo especificado' && (
                      <div className="font-bold text-amber-800 text-xs">
                        {log.reason}
                      </div>
                    )}

                    {(log.cleanlinessScore || log.organizationScore || log.disciplineScore) && (
                      <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-bold text-slate-600">
                        {log.cleanlinessScore && (
                          <span className="bg-cyan-50 text-cyan-800 px-1.5 py-0.5 rounded border border-cyan-200">
                            Limpeza: {log.cleanlinessScore}/5 ★
                          </span>
                        )}
                        {log.organizationScore && (
                          <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-200">
                            Organização: {log.organizationScore}/5 ★
                          </span>
                        )}
                        {log.disciplineScore && (
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                            Disciplina: {log.disciplineScore}/5 ★
                          </span>
                        )}
                      </div>
                    )}

                    {log.note && (
                      <p className="text-slate-600 text-[11px] bg-white p-2 rounded-lg border border-slate-200 italic">
                        &quot;{log.note}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          {isReadOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Fechar Visualização</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>Salvar Relato &amp; Atualizar Status</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
