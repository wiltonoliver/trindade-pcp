'use client';

import React, { useState, useMemo, useRef } from 'react';
import { OrderItem, ExecutionStatus, OrderStatusHistoryLog, UserProfile, UrgencyRequest } from '@/types/factory';
import { sanitizeUnit } from '@/lib/utils';
import { saveOrderToFirestore } from '@/lib/firestoreSync';
import { compressImageFile } from '@/lib/imageUtils';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';
import {
  notifyUrgencyRequested,
  notifyUrgencyApproved,
  notifyUrgencyRejected,
  notifyOrderCompleted,
  notifyOrderNotCompletedPendingDate,
  notifyOrderClosedUncompleted,
} from '@/lib/notificationService';

interface OrderStatusModalProps {
  order: OrderItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateOrder: (updatedOrder: OrderItem) => void;
  onDeleteOrder?: (order: OrderItem) => void;
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
  onDeleteOrder,
  currentUser,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ExecutionStatus | 'retornado_aguardando'>(
    order?.executionStatus || (order?.progress === 100 ? 'concluido' : 'nao_produzido')
  );
  const [selectedReason, setSelectedReason] = useState<string>(order?.delayReason || order?.pendingReason || '');
  const [customNote, setCustomNote] = useState<string>('');
  const [notCompletedAction, setNotCompletedAction] = useState<'pending_date' | 'close_uncompleted'>(() => {
    if (order?.isClosedUncompleted) return 'close_uncompleted';
    return 'pending_date';
  });

  // 5S Operational Evaluation State (1 to 5)
  const [cleanlinessScore, setCleanlinessScore] = useState<number>(order?.cleanlinessScore || 5);
  const [organizationScore, setOrganizationScore] = useState<number>(order?.organizationScore || 5);
  const [disciplineScore, setDisciplineScore] = useState<number>(order?.disciplineScore || 5);

  // Editable item description & delivery date
  const [editableItemDescription, setEditableItemDescription] = useState<string>(order?.itemDescription || '');
  const [editableDeliveryDate, setEditableDeliveryDate] = useState<string>(order?.deliveryDate || '');
  const [modalImage, setModalImage] = useState<string | null>(order?.imageUrl || null);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Helper date generators for partial rescheduling
  const getTomorrowInputDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFutureInputDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Partial Production Local States
  const [partialCompletedQty, setPartialCompletedQty] = useState<number>(() => {
    const total = order?.quantity || 1;
    return total > 1 ? total - 1 : 1;
  });
  const [partialRemainingAction, setPartialRemainingAction] = useState<'reschedule' | 'pending_date' | 'close'>('reschedule');
  const [partialRescheduleDate, setPartialRescheduleDate] = useState<string>(() => getTomorrowInputDate());

  // Track current order ID to reset local state when order changes
  const [prevOrderId, setPrevOrderId] = useState<string | null>(null);

  if (order && order.id !== prevOrderId) {
    const total = order.quantity || 1;
    setPrevOrderId(order.id);
    setSelectedStatus(order.executionStatus || (order.progress === 100 ? 'concluido' : 'nao_produzido'));
    setSelectedReason(order.delayReason || order.pendingReason || '');
    setCustomNote('');
    setNotCompletedAction(order.isClosedUncompleted ? 'close_uncompleted' : 'pending_date');
    setCleanlinessScore(order.cleanlinessScore || 5);
    setOrganizationScore(order.organizationScore || 5);
    setDisciplineScore(order.disciplineScore || 5);
    setEditableItemDescription(order.itemDescription || '');
    setEditableDeliveryDate(order.deliveryDate || '');
    setModalImage(order.imageUrl || null);
    setPartialCompletedQty(total > 1 ? total - 1 : 1);
    setPartialRemainingAction('reschedule');
    setPartialRescheduleDate(getTomorrowInputDate());
  }

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsProcessingImage(true);
        const compressed = await compressImageFile(file);
        setModalImage(compressed);
      } catch (err) {
        console.error('Erro ao processar imagem no modal:', err);
      } finally {
        setIsProcessingImage(false);
      }
    }
    if (e.target) e.target.value = '';
  };

  // Convert DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD for <input type="date">
  const formatToInputDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  // Convert YYYY-MM-DD or DD/MM/YYYY to DD/MM/YYYY for saving/displaying
  const formatToDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return dateStr;
  };

  const hasFieldsChanged = useMemo(() => {
    if (!order) return false;
    const descChanged = (editableItemDescription || '').trim() !== (order.itemDescription || '').trim();
    const dateChanged = (editableDeliveryDate || '').trim() !== (order.deliveryDate || '').trim();
    const imageChanged = (modalImage || null) !== (order.imageUrl || null);
    return descChanged || dateChanged || imageChanged;
  }, [order, editableItemDescription, editableDeliveryDate, modalImage]);

  // Urgency Request Local States
  const [urgencyReasonText, setUrgencyReasonText] = useState<string>('');
  const [showUrgencyForm, setShowUrgencyForm] = useState<boolean>(false);
  const [managerRejectionNote, setManagerRejectionNote] = useState<string>('');
  const [showRejectionInput, setShowRejectionInput] = useState<boolean>(false);

  // Formatted & Categorized History Actions
  const historyList = order?.statusHistory;

  const cleanStatusHistory = useMemo(() => {
    if (!order) return [];

    interface FormattedAction {
      id: string;
      type: 'pedido_recebido' | 'producao_agendada' | 'producao_concluida' | 'producao_parcial' | 'producao_nao_concluida' | 'producao_reagendada' | 'urgencia' | 'geral';
      title: string;
      badgeLabel: string;
      badgeColorClass: string;
      icon: string;
      iconBgClass: string;
      author: string;
      timestamp: string;
      timestampEpoch: number;
      scheduledDate?: string;
      previousDate?: string;
      reason?: string;
      note?: string;
      cleanlinessScore?: number;
      organizationScore?: number;
      disciplineScore?: number;
    }

    const parseEpoch = (str?: string, fallback = 0): number => {
      if (!str) return fallback;
      const s = str.trim();
      if (s.includes('T') || s.match(/^\d{4}-\d{2}-\d{2}/)) {
        const t = new Date(s).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      const brMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:.*?(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (brMatch) {
        const day = parseInt(brMatch[1], 10);
        const month = parseInt(brMatch[2], 10) - 1;
        const year = parseInt(brMatch[3], 10);
        const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 12;
        const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
        const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, min, sec);
        if (!isNaN(d.getTime())) return d.getTime();
      }
      return fallback;
    };

    const formatDisplayTime = (str?: string): string => {
      if (!str) return '';
      const s = str.trim();
      if (s.includes('T') || s.match(/^\d{4}-\d{2}-\d{2}/)) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) {
          return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }
      return s;
    };

    // Calculate baseline creation time
    let baseCreationEpoch = 0;
    if (order.id) {
      const matchNum = order.id.match(/\d{10,13}/);
      if (matchNum) {
        baseCreationEpoch = parseInt(matchNum[0], 10);
      }
    }
    if (!baseCreationEpoch || isNaN(baseCreationEpoch) || baseCreationEpoch < 1600000000000) {
      baseCreationEpoch = Date.now() - 86400000;
    }

    const actions: FormattedAction[] = [];
    const seenKeys = new Set<string>();
    const rawList = historyList || [];

    for (let idx = 0; idx < rawList.length; idx++) {
      const log = rawList[idx];
      const rawTime = log.timestamp || '';
      const displayTime = formatDisplayTime(rawTime) || 'Data não registrada';
      const logEpoch = parseEpoch(rawTime, baseCreationEpoch + (idx + 1) * 60000);
      const author = (log.author || 'Usuário').trim();
      const reason = (log.reason || '').trim();
      const note = (log.note || '').trim();
      const status = log.status;
      const actionType = log.actionType;

      const dedupeKey = `${displayTime}-${author}-${status}-${reason}-${note}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      // 1. Pedido recebido
      const isReceived =
        reason.toLowerCase().includes('pedido recebido') ||
        note.toLowerCase().includes('pedido recebido') ||
        reason.toLowerCase() === 'entrada de pedido';

      if (isReceived) {
        actions.push({
          id: log.id || `rec-${idx}`,
          type: 'pedido_recebido',
          title: 'Pedido Recebido',
          badgeLabel: 'Pedido Recebido',
          badgeColorClass: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: 'inventory_2',
          iconBgClass: 'bg-blue-100 text-blue-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          note: note || `Pedido recebido e cadastrado no sistema para a loja ${order.store}. Quantidade: ${order.quantity || 1} ${sanitizeUnit(order.unit)}.`,
        });
        continue;
      }

      // 2. Status: Produção Concluída
      const isCompletedLog =
        status === 'concluido' ||
        reason.toLowerCase().includes('concluíd') ||
        reason.toLowerCase().includes('concluid') ||
        note.toLowerCase().includes('baixa efetuada') ||
        note.toLowerCase().includes('baixa concluída');

      if (isCompletedLog && status !== 'parcial' && !reason.toLowerCase().includes('parcial') && !note.toLowerCase().includes('parcial')) {
        actions.push({
          id: log.id || `comp-${idx}`,
          type: 'producao_concluida',
          title: 'Status da Produção: Concluído',
          badgeLabel: 'Produção Concluída',
          badgeColorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: 'check_circle',
          iconBgClass: 'bg-emerald-100 text-emerald-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          cleanlinessScore: log.cleanlinessScore,
          organizationScore: log.organizationScore,
          disciplineScore: log.disciplineScore,
          note: note && !note.toLowerCase().includes('baixa efetuada') && !note.toLowerCase().includes('concluid') ? note : undefined,
        });
        continue;
      }

      // 2.1 Status: Produção Parcial
      const isPartialLog =
        status === 'parcial' ||
        reason.toLowerCase().includes('parcial') ||
        note.toLowerCase().includes('parcial') ||
        note.toLowerCase().includes('conclusão parcial');

      if (isPartialLog) {
        actions.push({
          id: log.id || `part-${idx}`,
          type: 'producao_parcial',
          title: 'Status da Produção: Parcial',
          badgeLabel: 'Produção Parcial',
          badgeColorClass: 'bg-sky-50 text-sky-800 border-sky-200',
          icon: 'pie_chart',
          iconBgClass: 'bg-sky-100 text-sky-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          reason: reason && !reason.toLowerCase().includes('parcial') ? reason : undefined,
          cleanlinessScore: log.cleanlinessScore,
          organizationScore: log.organizationScore,
          disciplineScore: log.disciplineScore,
          note: note || undefined,
        });
        continue;
      }

      // 2.2 Status: Baixa como Não Concluído (Produção Encerrada)
      const isClosedUncompletedLog =
        status === 'encerrado_nao_produzido' ||
        actionType === 'close_uncompleted' ||
        note.toLowerCase().includes('baixa efetuada como não concluído') ||
        note.toLowerCase().includes('encerrado como não concluído') ||
        note.toLowerCase().includes('não precisa mais fazer') ||
        note.toLowerCase().includes('não concluído (encerrado');

      if (isClosedUncompletedLog) {
        actions.push({
          id: log.id || `close-${idx}`,
          type: 'producao_nao_concluida',
          title: 'Produção Encerrada (Baixa como Não Concluído)',
          badgeLabel: 'Baixa: Encerrado (Não Concluído)',
          badgeColorClass: 'bg-rose-50 text-rose-800 border-rose-300',
          icon: 'cancel',
          iconBgClass: 'bg-rose-100 text-rose-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          reason: reason || 'Produção cancelada/encerrada pela gestão',
          cleanlinessScore: log.cleanlinessScore,
          organizationScore: log.organizationScore,
          disciplineScore: log.disciplineScore,
          note: note || 'Produção encerrada em definitivo (não precisa mais fazer). Pedido arquivado nos finalizados.',
        });
        continue;
      }

      // 3. Status: Retornado para Aguardando Data
      const isReturnPending =
        actionType === 'return_to_pending' ||
        status === 'retornado_aguardando' ||
        reason.toLowerCase().includes('aguardando data') ||
        note.toLowerCase().includes('aguardando data');

      if (isReturnPending) {
        const notCompReason = reason && !reason.toLowerCase().includes('aguardando data') && !reason.toLowerCase().includes('retornado') ? reason : '';
        actions.push({
          id: log.id || `ret-${idx}`,
          type: 'producao_reagendada',
          title: 'Status da Produção: Retornado para Aguardando Data',
          badgeLabel: 'Retornado p/ Aguardando Data',
          badgeColorClass: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: 'pending_actions',
          iconBgClass: 'bg-amber-100 text-amber-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          previousDate: log.previousDate && log.previousDate !== 'Aguardando Data' ? log.previousDate : undefined,
          reason: notCompReason || undefined,
          note: note || undefined,
        });
        continue;
      }

      // 4. Status: Produção Agendada ou Reagendada
      const isReschedule =
        actionType === 'reschedule' ||
        reason.toLowerCase().includes('agendad') ||
        note.toLowerCase().includes('agendad') ||
        note.toLowerCase().includes('reagendad');

      if (isReschedule) {
        let targetDate = '';
        const matchNoteDate = note.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (matchNoteDate) {
          targetDate = matchNoteDate[1];
        } else if (order.productionDate && order.productionDate !== 'Aguardando Data') {
          targetDate = order.productionDate;
        }

        const isReagendamento = (log.previousDate && log.previousDate !== 'Aguardando Data') || note.toLowerCase().includes('reagendad');

        if (isReagendamento) {
          actions.push({
            id: log.id || `resched-${idx}`,
            type: 'producao_reagendada',
            title: targetDate ? `Status da Produção: Reagendado para ${targetDate}` : 'Status da Produção: Reagendado',
            badgeLabel: 'Produção Reagendada',
            badgeColorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
            icon: 'event_repeat',
            iconBgClass: 'bg-indigo-100 text-indigo-700',
            author,
            timestamp: displayTime,
            timestampEpoch: logEpoch,
            scheduledDate: targetDate || undefined,
            previousDate: log.previousDate && log.previousDate !== 'Aguardando Data' ? log.previousDate : undefined,
            reason: reason && !reason.toLowerCase().includes('agendad') ? reason : undefined,
            note: note || undefined,
          });
        } else {
          actions.push({
            id: log.id || `sched-${idx}`,
            type: 'producao_agendada',
            title: targetDate ? `Produção Agendada para dia ${targetDate}` : `Produção Agendada`,
            badgeLabel: 'Produção Agendada',
            badgeColorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
            icon: 'event_available',
            iconBgClass: 'bg-indigo-100 text-indigo-700',
            author,
            timestamp: displayTime,
            timestampEpoch: logEpoch,
            scheduledDate: targetDate || undefined,
            note: note && !note.toLowerCase().includes('agendado para') ? note : undefined,
          });
        }
        continue;
      }

      // 5. Status: Produção Não Concluída (com Motivo da não conclusão)
      const isNotCompleted =
        status === 'nao_produzido' ||
        (reason && !reason.includes('Urgência') && !reason.includes('Cadastro') && !reason.includes('Imagem'));

      if (isNotCompleted) {
        const notCompletedReason = reason || order.delayReason || order.pendingReason || 'Sem motivo informado';
        actions.push({
          id: log.id || `notcomp-${idx}`,
          type: 'producao_nao_concluida',
          title: 'Status da Produção: Não Concluído',
          badgeLabel: 'Não Concluído',
          badgeColorClass: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: 'warning',
          iconBgClass: 'bg-rose-100 text-rose-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          reason: notCompletedReason,
          cleanlinessScore: log.cleanlinessScore,
          organizationScore: log.organizationScore,
          disciplineScore: log.disciplineScore,
          note: note && note !== notCompletedReason ? note : undefined,
        });
        continue;
      }

      // 6. Urgência
      if (reason.includes('Urgência') || reason.includes('urgência')) {
        const isRecusada = reason.includes('Recusada');
        const isAprovada = reason.includes('Aprovada') || reason.includes('Aceita');
        actions.push({
          id: log.id || `urg-${idx}`,
          type: 'urgencia',
          title: isRecusada ? 'Urgência Recusada pela Gestão' : isAprovada ? 'Urgência Aprovada pela Gestão' : 'Solicitação de Urgência',
          badgeLabel: isRecusada ? 'Urgência Recusada' : isAprovada ? 'Urgência Aprovada' : 'Solicitação de Urgência',
          badgeColorClass: isRecusada ? 'bg-slate-100 text-slate-700 border-slate-200' : isAprovada ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200',
          icon: isRecusada ? 'info' : isAprovada ? 'verified' : 'bolt',
          iconBgClass: isRecusada ? 'bg-slate-200 text-slate-700' : isAprovada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
          author,
          timestamp: displayTime,
          timestampEpoch: logEpoch,
          note: note || undefined,
        });
        continue;
      }

      // 7. Geral / Alteração de cadastro
      actions.push({
        id: log.id || `gen-${idx}`,
        type: 'geral',
        title: reason || 'Atualização de Cadastro',
        badgeLabel: 'Atualização',
        badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: 'edit_note',
        iconBgClass: 'bg-slate-200 text-slate-700',
        author,
        timestamp: displayTime,
        timestampEpoch: logEpoch,
        reason: reason || undefined,
        note: note || undefined,
      });
    }

    // Synthesize guaranteed "Pedido Recebido" if not present in logs
    const hasReceived = actions.some((a) => a.type === 'pedido_recebido');
    if (!hasReceived) {
      const creationDate = new Date(baseCreationEpoch);
      const formattedReceivedDate = `${creationDate.toLocaleDateString('pt-BR')} às ${creationDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      actions.push({
        id: `auto-received-${order.id}`,
        type: 'pedido_recebido',
        title: 'Pedido Recebido',
        badgeLabel: 'Pedido Recebido',
        badgeColorClass: 'bg-blue-50 text-blue-800 border-blue-200',
        icon: 'inventory_2',
        iconBgClass: 'bg-blue-100 text-blue-700',
        author: 'Setor de Entrada / PCP',
        timestamp: formattedReceivedDate,
        timestampEpoch: baseCreationEpoch,
        note: `Pedido recebido e cadastrado no sistema para a loja ${order.store}. Quantidade: ${order.quantity || 1} ${sanitizeUnit(order.unit)}.`,
      });
    }

    // Synthesize "Produção Agendada" if scheduled date exists and not logged
    const hasScheduling = actions.some((a) => a.type === 'producao_agendada' || a.type === 'producao_reagendada');
    if (!hasScheduling && order.productionDate && order.productionDate !== 'Aguardando Data') {
      const scheduleEpoch = baseCreationEpoch + 600000;
      const scheduleDate = new Date(scheduleEpoch);
      const formattedSchedDate = `${scheduleDate.toLocaleDateString('pt-BR')} às ${scheduleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      actions.push({
        id: `auto-scheduled-${order.id}`,
        type: 'producao_agendada',
        title: `Produção Agendada para dia ${order.productionDate}`,
        badgeLabel: 'Produção Agendada',
        badgeColorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        icon: 'event_available',
        iconBgClass: 'bg-indigo-100 text-indigo-700',
        author: 'Planejamento / PCP',
        timestamp: formattedSchedDate,
        timestampEpoch: scheduleEpoch,
        scheduledDate: order.productionDate,
        note: `Programado para a esteira de montagem em ${order.productionDate}.`,
      });
    }

    // Synthesize "Produção Concluída" if status is completed and not logged
    const hasCompleted = actions.some((a) => a.type === 'producao_concluida');
    if (!hasCompleted && (order.executionStatus === 'concluido' || order.progress === 100)) {
      const completedEpoch = Date.now();
      const compDate = new Date(completedEpoch);
      const formattedCompDate = `${compDate.toLocaleDateString('pt-BR')} às ${compDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      actions.push({
        id: `auto-completed-${order.id}`,
        type: 'producao_concluida',
        title: 'Status da Produção: Concluído',
        badgeLabel: 'Produção Concluída',
        badgeColorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: 'check_circle',
        iconBgClass: 'bg-emerald-100 text-emerald-700',
        author: 'Gestão de Produção',
        timestamp: formattedCompDate,
        timestampEpoch: completedEpoch,
        cleanlinessScore: order.cleanlinessScore,
        organizationScore: order.organizationScore,
        disciplineScore: order.disciplineScore,
      });
    }

    // Synthesize "Produção Não Concluída" if status is not produced and has reason and not logged
    const hasNotCompleted = actions.some((a) => a.type === 'producao_nao_concluida');
    if (!hasNotCompleted && order.executionStatus === 'nao_produzido' && (order.delayReason || order.pendingReason)) {
      const notCompEpoch = Date.now() - 3600000;
      const notCompDate = new Date(notCompEpoch);
      const formattedNotCompDate = `${notCompDate.toLocaleDateString('pt-BR')} às ${notCompDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      actions.push({
        id: `auto-notcomp-${order.id}`,
        type: 'producao_nao_concluida',
        title: 'Status da Produção: Não Concluído',
        badgeLabel: 'Não Concluído',
        badgeColorClass: 'bg-rose-50 text-rose-800 border-rose-200',
        icon: 'warning',
        iconBgClass: 'bg-rose-100 text-rose-700',
        author: 'Gestão de Produção',
        timestamp: formattedNotCompDate,
        timestampEpoch: notCompEpoch,
        reason: order.delayReason || order.pendingReason || 'Sem motivo informado',
        cleanlinessScore: order.cleanlinessScore,
        organizationScore: order.organizationScore,
        disciplineScore: order.disciplineScore,
      });
    }

    // Sort descending by timestamp: Most recent action is at index 0 (top of the list)
    actions.sort((a, b) => b.timestampEpoch - a.timestampEpoch);

    return actions;
  }, [order, historyList]);

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
    notifyUrgencyRequested(order.orderId, order.store, authorName, urgencyReasonText.trim());
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
    notifyUrgencyApproved(order.orderId, order.store, managerName);
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
    notifyUrgencyRejected(order.orderId, order.store, managerName, rejectionReason);
    setShowRejectionInput(false);
    setManagerRejectionNote('');
  };

  const handleStatusChange = (status: ExecutionStatus | 'retornado_aguardando') => {
    if (status === 'retornado_aguardando') {
      setSelectedStatus('nao_produzido');
      setNotCompletedAction('pending_date');
    } else {
      setSelectedStatus(status);
    }
  };

  const handleSelectPresetReason = (reason: string) => {
    if (selectedReason === reason) {
      setSelectedReason('');
    } else {
      setSelectedReason(reason);
    }
  };

  const handleSaveFieldsOnly = () => {
    if (!order) return;
    const nowStr = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const authorName = currentUser?.name || currentUser?.role || 'Usuário';

    const fieldChangeNotes: string[] = [];
    if ((editableItemDescription || '').trim() !== (order.itemDescription || '').trim()) {
      fieldChangeNotes.push(`Descrição da peça alterada para "${editableItemDescription.trim()}"`);
    }
    if ((editableDeliveryDate || '').trim() !== (order.deliveryDate || '').trim()) {
      fieldChangeNotes.push(`Data de entrega alterada para "${editableDeliveryDate.trim() || 'Sem data'}"`);
    }
    if ((modalImage || null) !== (order.imageUrl || null)) {
      fieldChangeNotes.push(modalImage ? 'Imagem/Desenho técnico anexado ou atualizado' : 'Imagem/Desenho técnico removido');
    }

    const newLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowStr,
      author: authorName,
      status: order.executionStatus,
      reason: 'Atualização de Cadastro / Peça / Imagem',
      note: fieldChangeNotes.join('; '),
      actionType: 'status_update',
    };

    const updatedOrder: OrderItem = {
      ...order,
      itemDescription: editableItemDescription.trim() || order.itemDescription,
      deliveryDate: editableDeliveryDate.trim(),
      imageUrl: modalImage || undefined,
      images: modalImage ? [modalImage] : undefined,
      statusHistory: fieldChangeNotes.length > 0 ? [newLog, ...(order.statusHistory || [])] : order.statusHistory,
    };

    onUpdateOrder(updatedOrder);
    saveOrderToFirestore(updatedOrder);
    onClose();
  };

  const handleSave = () => {
    const nowStr = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const authorName = currentUser?.name || currentUser?.role || 'Gestor de Operações';
    const totalQty = order.quantity || 1;
    const effectiveReason = selectedReason || (selectedStatus === 'concluido' ? '' : 'Sem motivo especificado');

    // Notes for field changes if updated
    const fieldChangeNotes: string[] = [];
    if ((editableItemDescription || '').trim() !== (order.itemDescription || '').trim()) {
      fieldChangeNotes.push(`Descrição da peça alterada para "${editableItemDescription.trim()}"`);
    }
    if ((editableDeliveryDate || '').trim() !== (order.deliveryDate || '').trim()) {
      fieldChangeNotes.push(`Data de entrega alterada para "${editableDeliveryDate.trim() || 'Sem data'}"`);
    }
    if ((modalImage || null) !== (order.imageUrl || null)) {
      fieldChangeNotes.push(modalImage ? 'Imagem/Desenho técnico anexado ou atualizado' : 'Imagem/Desenho técnico removido');
    }

    let combinedNote = customNote.trim();
    if (fieldChangeNotes.length > 0) {
      combinedNote = combinedNote
        ? `${combinedNote} | ${fieldChangeNotes.join('; ')}`
        : fieldChangeNotes.join('; ');
    }

    // 1. Status Concluído Total (100%)
    if (selectedStatus === 'concluido') {
      const newLog: OrderStatusHistoryLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: nowStr,
        author: authorName,
        status: 'concluido',
        reason: 'Concluído',
        note: combinedNote || `Baixa de produção 100% efetuada (${totalQty} ${sanitizeUnit(order.unit)}).`,
        previousDate: order.productionDate || 'Aguardando Data',
        actionType: 'status_update',
        cleanlinessScore,
        organizationScore,
        disciplineScore,
      };

      const updatedOrder: OrderItem = {
        ...order,
        itemDescription: editableItemDescription.trim() || order.itemDescription,
        deliveryDate: editableDeliveryDate.trim(),
        imageUrl: modalImage || undefined,
        images: modalImage ? [modalImage] : undefined,
        executionStatus: 'concluido',
        progress: 100,
        delayReason: '',
        pendingReason: '',
        statusHistory: [newLog, ...(order.statusHistory || [])],
        cleanlinessScore,
        organizationScore,
        disciplineScore,
      };

      onUpdateOrder(updatedOrder);
      saveOrderToFirestore(updatedOrder);
      notifyOrderCompleted(order.orderId, order.store, authorName);
      onClose();
      return;
    }

    // 2. Status Produção Parcial
    if (selectedStatus === 'parcial') {
      const completedQty = Math.max(1, Math.min(totalQty, partialCompletedQty));
      const remainingQty = Math.max(0, totalQty - completedQty);
      const targetReschedDate = formatToDisplayDate(partialRescheduleDate) || order.productionDate || 'Aguardando Data';

      let destinationNote = '';
      if (remainingQty === 0 || partialRemainingAction === 'close') {
        destinationNote = `Baixa de produção parcial: ${completedQty} de ${totalQty} ${sanitizeUnit(order.unit)} concluídas. Pedido encerrado sem saldo pendente.`;
      } else if (partialRemainingAction === 'reschedule') {
        destinationNote = `Baixa de produção parcial: ${completedQty} de ${totalQty} ${sanitizeUnit(order.unit)} concluídas e liberadas. O saldo restante de ${remainingQty} ${sanitizeUnit(order.unit)} foi reagendado para ${targetReschedDate}.`;
      } else if (partialRemainingAction === 'pending_date') {
        destinationNote = `Baixa de produção parcial: ${completedQty} de ${totalQty} ${sanitizeUnit(order.unit)} concluídas e liberadas. O saldo restante de ${remainingQty} ${sanitizeUnit(order.unit)} foi retornado para a fila de "Aguardando Data".`;
      }

      const logNote = combinedNote ? `${destinationNote} | Motivo/Obs: ${combinedNote}` : destinationNote;

      const mainLog: OrderStatusHistoryLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: nowStr,
        author: authorName,
        status: 'parcial',
        reason: effectiveReason,
        note: logNote,
        previousDate: order.productionDate || 'Aguardando Data',
        actionType: partialRemainingAction === 'reschedule' ? 'reschedule' : partialRemainingAction === 'pending_date' ? 'return_to_pending' : 'status_update',
        cleanlinessScore,
        organizationScore,
        disciplineScore,
      };

      // The original order represents the completed quantity and is marked as finished
      const updatedOrder: OrderItem = {
        ...order,
        itemDescription: editableItemDescription.trim() || order.itemDescription,
        deliveryDate: editableDeliveryDate.trim(),
        imageUrl: modalImage || undefined,
        images: modalImage ? [modalImage] : undefined,
        quantity: completedQty,
        executionStatus: 'concluido',
        progress: 100,
        delayReason: '',
        pendingReason: '',
        statusHistory: [mainLog, ...(order.statusHistory || [])],
        cleanlinessScore,
        organizationScore,
        disciplineScore,
      };

      onUpdateOrder(updatedOrder);
      saveOrderToFirestore(updatedOrder);

      // If remaining quantity exists and not closed, generate the split order for remaining pieces
      if (remainingQty > 0 && partialRemainingAction !== 'close') {
        const splitSuffix = Math.floor(100 + Math.random() * 900);
        const splitOrderId = order.orderId.includes('-R') ? `${order.orderId}.${splitSuffix}` : `${order.orderId}-R`;
        const isResched = partialRemainingAction === 'reschedule';

        const remainingLog: OrderStatusHistoryLog = {
          id: `log-${Date.now()}-split`,
          timestamp: nowStr,
          author: authorName,
          status: isResched ? 'pendente' : 'retornado_aguardando',
          reason: isResched ? `Produção Agendada para dia ${targetReschedDate}` : effectiveReason,
          note: isResched
            ? `Saldo restante de ${remainingQty} ${sanitizeUnit(order.unit)} desmembrado da OP #${order.orderId} (onde ${completedQty} foram concluídas). Reagendado para ${targetReschedDate}. Motivo da pendência: ${effectiveReason}`
            : `Saldo restante de ${remainingQty} ${sanitizeUnit(order.unit)} desmembrado da OP #${order.orderId} retornado para a fila de Aguardando Data. Motivo: ${effectiveReason}`,
          actionType: isResched ? 'reschedule' : 'return_to_pending',
          previousDate: order.productionDate || 'Aguardando Data',
        };

        const remainingOrder: OrderItem = {
          ...order,
          id: `split-${order.id}-${Date.now()}`,
          orderId: splitOrderId,
          itemDescription: `${editableItemDescription.trim() || order.itemDescription} (Saldo ${remainingQty} un)`,
          quantity: remainingQty,
          column: isResched ? 'proximos_7_dias' : 'nao_planejado',
          productionDate: isResched ? targetReschedDate : '',
          executionStatus: isResched ? 'pendente' : 'nao_produzido',
          progress: 0,
          isPendingReposition: !isResched,
          delayReason: effectiveReason,
          pendingReason: effectiveReason,
          statusHistory: [
            remainingLog,
            {
              id: `log-${Date.now()}-orig-rec`,
              timestamp: nowStr,
              author: authorName,
              status: 'pendente',
              reason: 'Pedido Recebido',
              note: `Saldo gerado a partir da OP #${order.orderId} para a loja ${order.store}. Quantidade: ${remainingQty} ${sanitizeUnit(order.unit)}.`,
              actionType: 'status_update',
            }
          ],
        };

        saveOrderToFirestore(remainingOrder);

        if (isResched) {
          notifyUrgencyApproved(splitOrderId, order.store, authorName);
        } else {
          notifyOrderNotCompletedPendingDate(splitOrderId, order.store, effectiveReason, authorName);
        }
      }

      onClose();
      return;
    }

    // 3. Status Não Concluído / Retornado para Aguardando Data / Baixa (Encerrado)
    if (notCompletedAction === 'close_uncompleted') {
      const closeLog: OrderStatusHistoryLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: nowStr,
        author: authorName,
        status: 'encerrado_nao_produzido',
        reason: effectiveReason,
        note: combinedNote || `NÃO CONCLUÍDO (Encerrado pelo gestor: não precisa mais fazer). Motivo: ${effectiveReason}`,
        previousDate: order.productionDate || 'Aguardando Data',
        actionType: 'close_uncompleted',
        cleanlinessScore,
        organizationScore,
        disciplineScore,
      };

      const updatedOrder: OrderItem = {
        ...order,
        itemDescription: editableItemDescription.trim() || order.itemDescription,
        deliveryDate: editableDeliveryDate.trim(),
        imageUrl: modalImage || undefined,
        images: modalImage ? [modalImage] : undefined,
        executionStatus: 'nao_produzido',
        progress: 0,
        column: 'nao_planejado',
        productionDate: '',
        isPendingReposition: false,
        isClosedUncompleted: true,
        closedAt: nowStr,
        closedBy: authorName,
        delayReason: effectiveReason,
        pendingReason: effectiveReason,
        statusHistory: [closeLog, ...(order.statusHistory || [])],
        cleanlinessScore,
        organizationScore,
        disciplineScore,
      };

      onUpdateOrder(updatedOrder);
      saveOrderToFirestore(updatedOrder);
      notifyOrderClosedUncompleted(order.orderId, order.store, effectiveReason, authorName);
      onClose();
      return;
    }

    // Caso padrão de Não Concluído: Retornado para a fila de Aguardando Data
    const returnLog: OrderStatusHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowStr,
      author: authorName,
      status: 'retornado_aguardando',
      reason: effectiveReason,
      note: combinedNote || `Retornado para Aguardando Data. Motivo: ${effectiveReason}`,
      previousDate: order.productionDate || 'Aguardando Data',
      actionType: 'return_to_pending',
      cleanlinessScore,
      organizationScore,
      disciplineScore,
    };

    const updatedOrder: OrderItem = {
      ...order,
      itemDescription: editableItemDescription.trim() || order.itemDescription,
      deliveryDate: editableDeliveryDate.trim(),
      imageUrl: modalImage || undefined,
      images: modalImage ? [modalImage] : undefined,
      executionStatus: 'nao_produzido',
      progress: 0,
      column: 'nao_planejado',
      productionDate: '',
      isPendingReposition: true,
      isClosedUncompleted: false,
      closedAt: undefined,
      closedBy: undefined,
      delayReason: effectiveReason,
      pendingReason: effectiveReason,
      statusHistory: [returnLog, ...(order.statusHistory || [])],
      cleanlinessScore,
      organizationScore,
      disciplineScore,
    };

    onUpdateOrder(updatedOrder);
    saveOrderToFirestore(updatedOrder);
    notifyOrderNotCompletedPendingDate(order.orderId, order.store, effectiveReason, authorName);
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-base text-white">OP #{order.orderId}</span>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px] font-bold">
                  {order.store}
                </span>
                {order.isClosedUncompleted && (
                  <span className="px-2 py-0.5 bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">cancel</span>
                    Encerrado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium truncate max-w-md">
                {editableItemDescription || order.itemDescription}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
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
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Data Produção</span>
              <span className="font-bold text-slate-900 truncate block">
                {order.productionDate ? order.productionDate : 'Aguardando Data'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Prev. Entrega</span>
              <span className="font-bold text-amber-900 truncate block">
                {editableDeliveryDate || order.deliveryDate || 'Sem data'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Progresso</span>
              {order.isClosedUncompleted ? (
                <span className="font-bold text-rose-600 block truncate">Encerrado</span>
              ) : (
                <span className="font-bold text-slate-900">{order.progress || 0}%</span>
              )}
            </div>
          </div>

          {/* Editable Fields Section: Item Description & Delivery Date */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-blue-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-blue-600 text-base">edit_note</span>
                <span>Editar Peça &amp; Data de Previsão de Entrega</span>
              </span>
              {hasFieldsChanged && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold border border-amber-300 animate-pulse flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">edit_square</span>
                  Alterações não salvas
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Item Description (Peça) */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-blue-600">inventory_2</span>
                  <span>Descrição da Peça (Esquadria)</span>
                </label>
                <input
                  type="text"
                  value={editableItemDescription}
                  onChange={(e) => setEditableItemDescription(e.target.value)}
                  placeholder="Descrição ou especificação da esquadria..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                />
              </div>

              {/* Delivery Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">event</span>
                  <span>Data Prevista de Entrega</span>
                </label>
                <input
                  type="date"
                  value={formatToInputDate(editableDeliveryDate)}
                  onChange={(e) => setEditableDeliveryDate(formatToDisplayDate(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            {/* Attached Image / Technical Drawing Area */}
            <div className="pt-3 border-t border-slate-200/80">
              <input
                type="file"
                ref={modalFileInputRef}
                onChange={handleImageFileSelect}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">add_photo_alternate</span>
                  <span>Imagem / Desenho Técnico da Peça</span>
                </label>

                {modalImage && (
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">zoom_in</span>
                    <span>Ampliar Imagem</span>
                  </button>
                )}
              </div>

              {modalImage ? (
                <div className="p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                  <div
                    onClick={() => setIsLightboxOpen(true)}
                    className="flex items-center gap-3 cursor-pointer group min-w-0"
                  >
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-blue-300 shadow-2xs shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={modalImage}
                        alt="Anexo do pedido"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="material-symbols-outlined text-white text-base">zoom_in</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase">
                        Anexo Visual
                      </span>
                      <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                        Clique para visualizar em tela cheia
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Foto / Desenho técnico registrado
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Substituir Imagem"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalImage(null)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover Imagem"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-white border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  {isProcessingImage ? (
                    <>
                      <span className="material-symbols-outlined text-base animate-spin text-blue-600">sync</span>
                      <span>Processando imagem...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base text-blue-600">add_photo_alternate</span>
                      <span>Anexar Imagem ou Desenho Técnico desta OP</span>
                    </>
                  )}
                </button>
              )}
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Concluído Total */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange('concluido')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      selectedStatus === 'concluido'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg p-1.5 rounded-xl shrink-0 ${
                        selectedStatus === 'concluido' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      check_circle
                    </span>
                    <div>
                      <div className="font-bold text-xs">Concluído Total</div>
                      <div className="text-[10px] text-slate-500">100% das peças prontas</div>
                    </div>
                  </button>

                  {/* Produção Parcial */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange('parcial')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      selectedStatus === 'parcial'
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 text-sky-950 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg p-1.5 rounded-xl shrink-0 ${
                        selectedStatus === 'parcial' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      pie_chart
                    </span>
                    <div>
                      <div className="font-bold text-xs">Produção Parcial</div>
                      <div className="text-[10px] text-slate-500">Parte feita + destino da sobra</div>
                    </div>
                  </button>

                  {/* Não Concluído */}
                  <button
                    type="button"
                    onClick={() => handleStatusChange('nao_produzido')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                      selectedStatus === 'nao_produzido'
                        ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg p-1.5 rounded-xl shrink-0 ${
                        selectedStatus === 'nao_produzido' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      warning
                    </span>
                    <div>
                      <div className="font-bold text-xs">Não Concluído</div>
                      <div className="text-[10px] text-slate-500">Ocorrência / Relatar motivo</div>
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

              {/* SPECIFIC CONFIGURATION FOR PARTIAL PRODUCTION */}
              {selectedStatus === 'parcial' && (
                <div className="space-y-4 bg-sky-50/70 p-4.5 rounded-2xl border border-sky-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-sky-700">incomplete_circle</span>
                      <span>2. Detalhamento da Produção Parcial</span>
                    </label>
                    <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-200">
                      Total do Pedido: {order.quantity || 1} {sanitizeUnit(order.unit)}
                    </span>
                  </div>

                  {/* Quantity selector */}
                  <div className="bg-white p-4 rounded-xl border border-sky-200/90 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Quantas peças foram concluídas e liberadas?
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Ajuste o número de peças finalizadas nesta etapa
                        </span>
                      </div>

                      {/* Interactive Counter */}
                      <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          disabled={partialCompletedQty <= 1}
                          onClick={() => setPartialCompletedQty((prev) => Math.max(1, prev - 1))}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-black text-base hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-all"
                        >
                          -
                        </button>

                        <div className="px-3 min-w-[64px] text-center">
                          <input
                            type="number"
                            min={1}
                            max={order.quantity || 1}
                            value={partialCompletedQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                setPartialCompletedQty(Math.max(1, Math.min(order.quantity || 1, val)));
                              }
                            }}
                            className="w-12 text-center font-black text-base text-sky-950 focus:outline-none bg-transparent"
                          />
                          <span className="text-[10px] block font-bold text-slate-500 -mt-1">
                            {sanitizeUnit(order.unit)}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={partialCompletedQty >= (order.quantity || 1)}
                          onClick={() => setPartialCompletedQty((prev) => Math.min(order.quantity || 1, prev + 1))}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 font-black text-base hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Summary split badges */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
                        <div>
                          <div className="text-[10px] font-bold text-emerald-700 uppercase">Peças Prontas</div>
                          <div className="text-xs font-black text-emerald-950">
                            {partialCompletedQty} {sanitizeUnit(order.unit)} (Liberadas)
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-600 text-base">pending</span>
                        <div>
                          <div className="text-[10px] font-bold text-amber-700 uppercase">Saldo Restante</div>
                          <div className="text-xs font-black text-amber-950">
                            {Math.max(0, (order.quantity || 1) - partialCompletedQty)} {sanitizeUnit(order.unit)} (Pendente)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Destination of remaining quantity */}
                  {Math.max(0, (order.quantity || 1) - partialCompletedQty) > 0 && (
                    <div className="space-y-2.5">
                      <label className="block text-xs font-bold text-sky-950">
                        O que fazer com as {Math.max(0, (order.quantity || 1) - partialCompletedQty)} peças restantes?
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Option 1: Reagendar Produção */}
                        <button
                          type="button"
                          onClick={() => setPartialRemainingAction('reschedule')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                            partialRemainingAction === 'reschedule'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-800 border-sky-200 hover:bg-sky-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span className="material-symbols-outlined text-[16px]">event_repeat</span>
                            <span>Reagendar</span>
                          </div>
                          <p className={`text-[10px] leading-snug ${partialRemainingAction === 'reschedule' ? 'text-blue-100' : 'text-slate-500'}`}>
                            Agendar nova data para produzir o restante
                          </p>
                        </button>

                        {/* Option 2: Voltar para Fila de Espera */}
                        <button
                          type="button"
                          onClick={() => setPartialRemainingAction('pending_date')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                            partialRemainingAction === 'pending_date'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-800 border-sky-200 hover:bg-sky-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                            <span>Fila de Espera</span>
                          </div>
                          <p className={`text-[10px] leading-snug ${partialRemainingAction === 'pending_date' ? 'text-blue-100' : 'text-slate-500'}`}>
                            Voltar saldo para &quot;Aguardando Data&quot;
                          </p>
                        </button>

                        {/* Option 3: Encerrar */}
                        <button
                          type="button"
                          onClick={() => setPartialRemainingAction('close')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                            partialRemainingAction === 'close'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-800 border-sky-200 hover:bg-sky-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <span className="material-symbols-outlined text-[16px]">check_box</span>
                            <span>Encerrar Pedido</span>
                          </div>
                          <p className={`text-[10px] leading-snug ${partialRemainingAction === 'close' ? 'text-blue-100' : 'text-slate-500'}`}>
                            Finalizar sem produzir o saldo restante
                          </p>
                        </button>
                      </div>

                      {/* If reschedule selected, show date picker with quick presets */}
                      {partialRemainingAction === 'reschedule' && (
                        <div className="p-3 bg-white rounded-xl border border-sky-200 space-y-2 animate-fadeIn">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-blue-600">calendar_today</span>
                              Data para produção do saldo restante ({Math.max(0, (order.quantity || 1) - partialCompletedQty)} un):
                            </label>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              (dd/mm/aaaa)
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="date"
                              value={formatToInputDate(partialRescheduleDate)}
                              onChange={(e) => setPartialRescheduleDate(e.target.value)}
                              className="p-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
                            />

                            {/* Quick buttons */}
                            <button
                              type="button"
                              onClick={() => setPartialRescheduleDate(getTomorrowInputDate())}
                              className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-all"
                            >
                              Amanhã
                            </button>
                            <button
                              type="button"
                              onClick={() => setPartialRescheduleDate(getFutureInputDate(2))}
                              className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-all"
                            >
                              +2 dias
                            </button>
                            <button
                              type="button"
                              onClick={() => setPartialRescheduleDate(getFutureInputDate(7))}
                              className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-all"
                            >
                              +7 dias
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Motivo da Parcialidade */}
                  <div className="space-y-2 pt-1 border-t border-sky-200">
                    <label className="block text-xs font-bold text-sky-950">
                      Motivo de Não Ter Concluído Todas as Peças:
                    </label>

                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_REASONS.map((reason) => {
                        const isSelected = selectedReason === reason;
                        return (
                          <button
                            key={`part-reason-${reason}`}
                            type="button"
                            onClick={() => handleSelectPresetReason(reason)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-sky-800 text-white shadow-xs'
                                : 'bg-white border border-sky-300 text-sky-900 hover:bg-sky-100'
                            }`}
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>

                    <textarea
                      rows={2}
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      placeholder="Observações complementares sobre o motivo das peças faltantes..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* SPECIFIC CONFIGURATION FOR NON-COMPLETED / RETORNADO */}
              {selectedStatus === 'nao_produzido' && (
                <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">report_problem</span>
                    <span>2. Motivo da Não Conclusão / Ocorrência</span>
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

                  {/* Action Selection for Non-Completed */}
                  <div className="pt-3 border-t border-amber-200/80 space-y-2.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Destino / Ação para esta OP:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Opção 1: Retornar para Aguardando Data */}
                      <button
                        type="button"
                        onClick={() => setNotCompletedAction('pending_date')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          notCompletedAction === 'pending_date'
                            ? 'bg-amber-100/80 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 shadow-xs font-medium'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            notCompletedAction === 'pending_date'
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">pending_actions</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900">
                            Retornar p/ Aguardando Data
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            Limpa a data programada e envia para a fila de espera para ser replanejada.
                          </div>
                        </div>
                      </button>

                      {/* Opção 2: Dar baixa como não concluído (Encerrar) */}
                      <button
                        type="button"
                        onClick={() => setNotCompletedAction('close_uncompleted')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                          notCompletedAction === 'close_uncompleted'
                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-950 shadow-xs font-medium'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            notCompletedAction === 'close_uncompleted'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">cancel</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-rose-900 flex items-center gap-1">
                            <span>Dar Baixa como Não Concluído</span>
                            <span className="px-1.5 py-0.2 bg-rose-200 text-rose-800 rounded text-[9px] font-black uppercase">
                              Encerrar
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            Dá baixa definitiva. A produção é encerrada (não precisa mais fazer) e arquivada em Pedidos Finalizados.
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Informative banner when close_uncompleted is selected */}
                    {notCompletedAction === 'close_uncompleted' && (
                      <div className="p-3 bg-rose-100/70 border border-rose-200 rounded-xl text-xs text-rose-950 flex items-start gap-2 animate-fadeIn">
                        <span className="material-symbols-outlined text-base text-rose-600 shrink-0 mt-0.5">info</span>
                        <div>
                          <p className="font-bold text-rose-950">Atenção: A OP será encerrada</p>
                          <p className="text-[11px] text-rose-900 mt-0.5">
                            Esta OP não constará mais nas listas de produção ativa nem gerará pendências de baixa. Ficará arquivada na aba &quot;Pedidos Finalizados&quot; como <strong>Encerrada</strong> com o motivo registrado para consulta e auditoria.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* History Timeline of previous motives & status changes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-blue-600">history</span>
                <span>Histórico de Relatos e Ações Gravadas ({cleanStatusHistory.length})</span>
              </h4>
              <span className="text-[10px] font-semibold text-slate-500">
                Mais recente no topo
              </span>
            </div>

            {cleanStatusHistory.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                Nenhuma ocorrência ou alteração registrada anteriormente para este pedido.
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cleanStatusHistory.map((log, idx) => {
                  const isTopMost = idx === 0;

                  return (
                    <div
                      key={log.id ? `${log.id}-${idx}` : `action-${idx}`}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                        isTopMost
                          ? 'bg-blue-50/40 border-blue-200 shadow-sm'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Top Header Row: Action Badge + Most Recent Tag + Date/Time */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${log.badgeColorClass}`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {log.icon}
                            </span>
                            {log.badgeLabel}
                          </span>

                          {isTopMost && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-600 text-white flex items-center gap-0.5 uppercase tracking-wide">
                              <span className="material-symbols-outlined text-[10px]">check</span>
                              Mais Recente
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">schedule</span>
                          {log.timestamp}
                        </span>
                      </div>

                      {/* Title & Author */}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-bold text-slate-900">{log.title}</span>
                        <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1 shrink-0">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">person</span>
                          Lançado por: <strong className="text-slate-800 font-semibold">{log.author}</strong>
                        </span>
                      </div>

                      {/* Motivo da Não Conclusão (Destacado para Não Concluído) */}
                      {log.type === 'producao_nao_concluida' && log.reason && (
                        <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200 text-rose-900 space-y-1">
                          <div className="font-bold text-[11px] flex items-center gap-1 text-rose-800">
                            <span className="material-symbols-outlined text-[14px]">report_problem</span>
                            Motivo da Não Conclusão:
                          </div>
                          <p className="font-semibold text-xs text-rose-950 pl-5">
                            {log.reason}
                          </p>
                        </div>
                      )}

                      {/* Detalhes de Produção Parcial */}
                      {log.type === 'producao_parcial' && (
                        <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200 text-sky-950 space-y-1">
                          {log.reason && log.reason !== 'Sem motivo especificado' && (
                            <div className="text-[11px] font-semibold text-sky-900 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-sky-700">report_problem</span>
                              <span>Motivo da Parcialidade: <strong>{log.reason}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Detalhes de Reagendamento / Aguardando Data */}
                      {log.type === 'producao_reagendada' && (
                        <div className="p-2 bg-amber-50/80 rounded-lg border border-amber-200/80 text-amber-900 text-[11px] space-y-1">
                          {log.scheduledDate && (
                            <div className="font-semibold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px] text-amber-700">event</span>
                              <span>Nova Data de Produção: <strong>{log.scheduledDate}</strong></span>
                            </div>
                          )}
                          {log.previousDate && (
                            <div className="text-amber-800 text-[10px]">
                              Data anterior: <strong>{log.previousDate}</strong>
                            </div>
                          )}
                          {log.reason && log.reason !== 'Sem motivo informado' && (
                            <div className="text-[11px] font-medium text-amber-900 pt-0.5">
                              Motivo: <strong>{log.reason}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5S Evaluations if applicable */}
                      {(log.cleanlinessScore || log.organizationScore || log.disciplineScore) && (
                        <div className="flex flex-wrap gap-2 pt-0.5 text-[10px] font-bold text-slate-600">
                          {log.cleanlinessScore && (
                            <span className="bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded border border-cyan-200 flex items-center gap-1">
                              <span>Limpeza:</span>
                              <span className="text-cyan-900 font-extrabold">{log.cleanlinessScore}/5 ★</span>
                            </span>
                          )}
                          {log.organizationScore && (
                            <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                              <span>Organização:</span>
                              <span className="text-indigo-900 font-extrabold">{log.organizationScore}/5 ★</span>
                            </span>
                          )}
                          {log.disciplineScore && (
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <span>Disciplina:</span>
                              <span className="text-emerald-900 font-extrabold">{log.disciplineScore}/5 ★</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Observações e relatos */}
                      {log.note && (
                        <p className="text-slate-700 text-[11px] bg-white p-2 rounded-lg border border-slate-200 italic leading-relaxed">
                          &quot;{log.note}&quot;
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
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {!isReadOnly && onDeleteOrder && order && (
              <button
                type="button"
                onClick={() => {
                  onDeleteOrder(order);
                  onClose();
                }}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5"
                title="Excluir este pedido definitivamente"
              >
                <span className="material-symbols-outlined text-[16px] text-rose-600">delete</span>
                <span>Excluir Pedido</span>
              </button>
            )}
            {hasFieldsChanged && (
              <span className="text-amber-800 font-bold text-[11px] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
                Existem edições de dados não salvas
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            {isReadOnly ? (
              <>
                {hasFieldsChanged && (
                  <button
                    type="button"
                    onClick={handleSaveFieldsOnly}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Salvar Alterações</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Fechar Visualização</span>
                </button>
              </>
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
                  className={`px-6 py-2.5 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                    selectedStatus === 'nao_produzido' && notCompletedAction === 'close_uncompleted'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedStatus === 'nao_produzido' && notCompletedAction === 'close_uncompleted' ? 'cancel' : 'save'}
                  </span>
                  <span>
                    {selectedStatus === 'nao_produzido' && notCompletedAction === 'close_uncompleted'
                      ? 'Dar Baixa & Encerrar OP'
                      : 'Salvar & Atualizar Pedido'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        imageUrl={modalImage}
        title={`OP #${order.orderId} - ${editableItemDescription || order.itemDescription}`}
        subtitle={`Loja: ${order.store} • Entrega: ${editableDeliveryDate || order.deliveryDate || 'Sem data'}`}
        orderId={order.orderId}
      />
    </div>
  );
};
