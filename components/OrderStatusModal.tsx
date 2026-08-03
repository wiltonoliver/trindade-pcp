'use client';

import React, { useState, useMemo } from 'react';
import { OrderItem, ExecutionStatus, OrderStatusHistoryLog, UserProfile, UrgencyRequest } from '@/types/factory';
import { sanitizeUnit } from '@/lib/utils';
import { saveOrderToFirestore } from '@/lib/firestoreSync';

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

  // Urgency Request Local States
  const [urgencyReasonText, setUrgencyReasonText] = useState<string>('');
  const [showUrgencyForm, setShowUrgencyForm] = useState<boolean>(false);
  const [managerRejectionNote, setManagerRejectionNote] = useState<string>('');
  const [showRejectionInput, setShowRejectionInput] = useState<boolean>(false);

  // Deduplicate history logs to remove repeating identical entries
  const historyList = order?.statusHistory;
  const cleanStatusHistory = useMemo(() => {
    if (!historyList || historyList.length === 0) return [];

    const uniqueLogs: OrderStatusHistoryLog[] = [];
    const seenKeys = new Set<string>();

    for (const log of historyList) {
      const key = `${log.timestamp?.trim() || ''}-${log.author?.trim() || ''}-${log.status}-${log.reason?.trim() || ''}-${log.note?.trim() || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueLogs.push(log);
      }
    }
    return uniqueLogs;
  }, [historyList]);

  if (!isOpen || !order) return null;

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isVendas = userRole.includes('venda') || userRole.includes('lojista') || userRole.includes('representante');
  const isCompleted = order?.executionStatus === 'concluido' || order?.progress === 100;
  const isReadOnly = isVendas || currentUser?.permissions?.canEditProduction === false || isCompleted;

  const handleRequestUrgency = () => {
    if (!order || !urgencyReasonText.trim()) return;
    const nowStr = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const authorName = currentUser?.name || currentUser?.role || 'Vendedor/Lojista';

    const newUrgencyRequest: UrgencyRequest = {
      status: 'pending',
      requestedBy: authorName,
      requestReason: urgencyReasonText.trim(),
      requestedAt: nowStr,
    };

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowStr,
      author: authorName,
      status: order.executionStatus,
      reason: 'Solicitação de Urgência',
      note: `Justificativa do Vendedor: "${urgencyReasonText.trim()}"`,
      actionType: 'status_update',
    };

    const updatedOrder: OrderItem = {
      ...order,
      urgencyRequest: newUrgencyRequest,
      statusHistory: [newLog, ...(order.statusHistory || [])],
    };

    onUpdateOrder(updatedOrder);
    saveOrderToFirestore(updatedOrder);
    setShowUrgencyForm(false);
    setUrgencyReasonText('');
  };

  const handleApproveUrgency = () => {
    if (!order || !order.urgencyRequest) return;
    const nowStr = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const managerName = currentUser?.name || 'Gestão de Operações';

    const updatedUrgency: UrgencyRequest = {
      ...order.urgencyRequest,
      status: 'approved',
      evaluatedBy: managerName,
      evaluatedAt: nowStr,
      evaluatorNote: 'Urgência aceita e confirmada pela gestão.',
    };

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowStr,
      author: managerName,
      status: order.executionStatus,
      reason: 'Urgência Aprovada pela Gestão',
      note: `Solicitação de ${order.urgencyRequest.requestedBy} APROVADA. Pedido promovido para ALTA PRIORIDADE. (Justificativa: "${order.urgencyRequest.requestReason}")`,
      actionType: 'status_update',
    };

    const updatedOrder: OrderItem = {
      ...order,
      priority: 'ALTA PRIORIDADE',
      urgencyRequest: updatedUrgency,
      statusHistory: [newLog, ...(order.statusHistory || [])],
    };

    onUpdateOrder(updatedOrder);
    saveOrderToFirestore(updatedOrder);
  };

  const handleRejectUrgency = () => {
    if (!order || !order.urgencyRequest) return;
    const nowStr = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const managerName = currentUser?.name || 'Gestão de Operações';
    const rejectionReason = managerRejectionNote.trim() || 'Solicitação de urgência recusada pela gestão.';

    const updatedUrgency: UrgencyRequest = {
      ...order.urgencyRequest,
      status: 'rejected',
      evaluatedBy: managerName,
      evaluatedAt: nowStr,
      evaluatorNote: rejectionReason,
    };

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowStr,
      author: managerName,
      status: order.executionStatus,
      reason: 'Urgência Recusada pela Gestão',
      note: `Solicitação de ${order.urgencyRequest.requestedBy} RECUSADA. Motivo da recusa: "${rejectionReason}" (Justificativa original do vendedor: "${order.urgencyRequest.requestReason}")`,
      actionType: 'status_update',
    };

    const updatedOrder: OrderItem = {
      ...order,
      urgencyRequest: updatedUrgency,
      statusHistory: [newLog, ...(order.statusHistory || [])],
    };

    onUpdateOrder(updatedOrder);
    saveOrderToFirestore(updatedOrder);
    setShowRejectionInput(false);
    setManagerRejectionNote('');
  };

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

          {/* Urgency Request & Manager Evaluation Section */}
          {(order.urgencyRequest || (isVendas && !isCompleted)) && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 font-black text-xl">bolt</span>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-900">Solicitação de Urgência</span>
                </div>
                {order.urgencyRequest?.status === 'pending' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">schedule</span>
                    Pendente de Análise
                  </span>
                )}
                {order.urgencyRequest?.status === 'approved' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Aceita / Alta Prioridade
                  </span>
                )}
                {order.urgencyRequest?.status === 'rejected' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-slate-400">info</span>
                    Recusada
                  </span>
                )}
              </div>

              {order.urgencyRequest ? (
                <div className="space-y-2.5">
                  {order.urgencyRequest.status === 'pending' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-2">
                      <p className="font-bold flex items-center gap-1.5 text-amber-950">
                        <span className="material-symbols-outlined text-amber-600 text-base">person</span>
                        <span>Solicitado por {order.urgencyRequest.requestedBy}</span>
                        <span className="text-[10px] text-amber-700 font-normal">({order.urgencyRequest.requestedAt})</span>
                      </p>
                      <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 text-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Motivo da Urgência:</span>
                        <p className="text-xs text-slate-800 font-medium italic">&quot;{order.urgencyRequest.requestReason}&quot;</p>
                      </div>

                      {/* Manager Evaluation Panel */}
                      {!isReadOnly ? (
                        <div className="pt-2 border-t border-amber-200/80 space-y-2">
                          <span className="text-[11px] font-bold text-amber-950 block">Avaliação do Gestor:</span>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <button
                              type="button"
                              onClick={handleApproveUrgency}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-base">check_circle</span>
                              <span>Aceitar Urgência (Alta Prioridade)</span>
                            </button>

                            {!showRejectionInput ? (
                              <button
                                type="button"
                                onClick={() => setShowRejectionInput(true)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300"
                              >
                                <span className="material-symbols-outlined text-base text-slate-500">do_not_disturb_on</span>
                                <span>Recusar Urgência</span>
                              </button>
                            ) : (
                              <div className="w-full space-y-2 pt-1 bg-white p-3 rounded-xl border border-slate-200">
                                <label className="block text-xs font-medium text-slate-800">Motivo da Recusa (para o vendedor):</label>
                                <input
                                  type="text"
                                  value={managerRejectionNote}
                                  onChange={(e) => setManagerRejectionNote(e.target.value)}
                                  placeholder="Informe o motivo da recusa (ex: Fábrica em capacidade máxima)..."
                                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 font-medium text-slate-900"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowRejectionInput(false)}
                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleRejectUrgency}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs"
                                  >
                                    Confirmar Recusa
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-800 font-medium pt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>A solicitação foi enviada aos gestores e aguarda avaliação.</span>
                        </p>
                      )}
                    </div>
                  )}

                  {order.urgencyRequest.status === 'approved' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1.5">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                        <span>Solicitação de Urgência ACEITA pela Gestão!</span>
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Confirmado por <strong>{order.urgencyRequest.evaluatedBy}</strong> em {order.urgencyRequest.evaluatedAt}.
                      </p>
                      <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200/80 text-slate-800 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Motivo original do vendedor:</span>
                        <p className="text-xs text-slate-800 italic">&quot;{order.urgencyRequest.requestReason}&quot;</p>
                      </div>
                    </div>
                  )}

                  {order.urgencyRequest.status === 'rejected' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 space-y-2">
                      <p className="font-semibold flex items-center gap-1.5 text-slate-800">
                        <span className="material-symbols-outlined text-base text-slate-500">info</span>
                        <span>Solicitação de Urgência Recusada</span>
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Avaliado por <strong>{order.urgencyRequest.evaluatedBy}</strong> em {order.urgencyRequest.evaluatedAt}.
                      </p>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Motivo da Recusa (Gestor):</span>
                        <p className="text-xs text-slate-900 font-medium italic">&quot;{order.urgencyRequest.evaluatorNote}&quot;</p>
                      </div>

                      {isVendas && !isCompleted && !showUrgencyForm && (
                        <button
                          type="button"
                          onClick={() => setShowUrgencyForm(true)}
                          className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer pt-1 block"
                        >
                          + Solicitar Urgência Novamente (Nova Justificativa)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!showUrgencyForm && isVendas && !isCompleted && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 font-medium">Nenhuma solicitação de urgência registrada.</p>
                      <button
                        type="button"
                        onClick={() => setShowUrgencyForm(true)}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">bolt</span>
                        <span>Solicitar Urgência ao Gestor</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {showUrgencyForm && (
                <div className="bg-white border border-amber-300 p-3.5 rounded-xl space-y-2.5 animate-fadeIn">
                  <label className="block text-xs font-bold text-amber-950">
                    Justificativa da Urgência (será enviada para avaliação dos gestores):
                  </label>
                  <textarea
                    value={urgencyReasonText}
                    onChange={(e) => setUrgencyReasonText(e.target.value)}
                    rows={3}
                    placeholder="Descreva o motivo da urgência (ex: Cliente solicita entrega antecipada para inauguração da loja no dia X)..."
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white text-slate-900 font-medium"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUrgencyForm(false);
                        setUrgencyReasonText('');
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!urgencyReasonText.trim()}
                      onClick={handleRequestUrgency}
                      className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>Enviar aos Gestores</span>
                    </button>
                  </div>
                </div>
              )}
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
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/10 text-amber-950'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl p-1.5 rounded-xl ${
                    selectedStatus === 'nao_produzido' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
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
              <span>Histórico de Relatos e Motivos Gravados ({cleanStatusHistory.length})</span>
            </h4>

            {cleanStatusHistory.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                Nenhuma ocorrência ou alteração registrada anteriormente para este pedido.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {cleanStatusHistory.map((log, idx) => {
                  const statusLabel =
                    log.status === 'concluido'
                      ? 'Concluído'
                      : log.status === 'retornado_aguardando'
                      ? 'Retornado p/ Aguardando Data'
                      : log.status === 'nao_produzido'
                      ? 'Com Problema / Não Concluído'
                      : log.status === 'em_andamento'
                      ? 'Em Andamento'
                      : 'Não Iniciado';

                  const reasonText = (log.reason || '').trim();
                  const noteText = (log.note || '').trim();

                  // Avoid repeating reason if it matches default texts or status label or is duplicated in note
                  const isRedundantReason =
                    !reasonText ||
                    reasonText === 'Sem motivo especificado' ||
                    reasonText.toLowerCase() === statusLabel.toLowerCase() ||
                    reasonText.toLowerCase() === 'concluído' ||
                    reasonText.toLowerCase() === 'concluido' ||
                    reasonText === noteText;

                  return (
                    <div key={log.id ? `${log.id}-${idx}` : `log-${idx}`} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span className="flex items-center gap-1 text-slate-700">
                          <span className="material-symbols-outlined text-[14px] text-blue-600">person</span>
                          {log.author}
                        </span>
                        <span>{log.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {log.reason?.includes('Urgência') || log.reason?.includes('urgência') ? (
                          log.reason.includes('Recusada') ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] text-slate-400">info</span>
                              Urgência Recusada
                            </span>
                          ) : log.reason.includes('Aprovada') || log.reason.includes('Aceita') ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] text-emerald-600">verified</span>
                              Urgência Aprovada
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px] text-amber-600">bolt</span>
                              Solicitação de Urgência
                            </span>
                          )
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 border ${
                            log.status === 'concluido'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : log.status === 'nao_produzido'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            <span className="material-symbols-outlined text-[12px]">
                              {log.status === 'concluido' ? 'check_circle' : 'info'}
                            </span>
                            {statusLabel}
                          </span>
                        )}
                        {log.previousDate && log.previousDate !== 'Aguardando Data' && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            (Data anterior: {log.previousDate})
                          </span>
                        )}
                      </div>

                      {!isRedundantReason && !reasonText.includes('Urgência') && (
                        <div className="font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-md border border-amber-200/70 text-[11px]">
                          Motivo: {reasonText}
                        </div>
                      )}

                      {(log.cleanlinessScore || log.organizationScore || log.disciplineScore) && (
                        <div className="flex flex-wrap gap-2 pt-0.5 text-[10px] font-bold text-slate-600">
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

                      {noteText && (
                        <p className="text-slate-600 text-[11px] bg-white p-2 rounded-lg border border-slate-200 italic">
                          &quot;{noteText}&quot;
                        </p>
                      )}
                    </div>
                  );
                })}
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
