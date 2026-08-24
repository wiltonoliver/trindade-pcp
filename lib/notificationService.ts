import { AppNotification, NotificationType, UserProfile } from '@/types/factory';
import { saveNotificationToFirestore, deleteNotificationFromFirestore } from './firestoreSync';

/**
 * Obtém a chave identificadora única do usuário para controle independente de notificações
 */
export const getUserNotificationKey = (user?: UserProfile | null): string => {
  if (!user) return 'default_user';
  if (user.id && user.id.trim()) return user.id.trim().toLowerCase();
  if (user.email && user.email.trim()) return user.email.trim().toLowerCase();
  if (user.name && user.name.trim()) return user.name.trim().toLowerCase().replace(/\s+/g, '_');
  return 'default_user';
};

/**
 * Verifica se uma notificação é visível para um determinado usuário (ou seja, se o usuário não a limpou/removeu)
 */
export const isNotificationVisibleForUser = (
  notif: AppNotification,
  userKey: string,
  localClearedIds?: Set<string>
): boolean => {
  if (localClearedIds && localClearedIds.has(notif.id)) {
    return false;
  }
  if (notif.clearedBy && Array.isArray(notif.clearedBy) && notif.clearedBy.includes(userKey)) {
    return false;
  }
  return true;
};

/**
 * Verifica se a notificação já foi lida por esse usuário específico
 */
export const isNotificationReadForUser = (
  notif: AppNotification,
  userKey: string,
  localReadIds?: Set<string>
): boolean => {
  if (localReadIds && localReadIds.has(notif.id)) {
    return true;
  }
  if (notif.readBy && Array.isArray(notif.readBy) && notif.readBy.includes(userKey)) {
    return true;
  }
  return false;
};

/**
 * Cria e dispara uma nova notificação do sistema (salvando no Firestore e localStorage)
 */
export const emitNotification = async (params: {
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  storeName?: string;
  actor?: string;
}): Promise<AppNotification> => {
  const now = new Date();
  const time =
    now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' às ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const notif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: params.title,
    message: params.message,
    type: params.type,
    time,
    timestamp: Date.now(),
    read: false,
    readBy: [],
    clearedBy: [],
    orderId: params.orderId,
    storeName: params.storeName,
    actor: params.actor,
  };

  // Dispatch event for UI
  if (typeof window !== 'undefined') {
    try {
      const existingStr = localStorage.getItem('trindade_notifications');
      const existing: AppNotification[] = existingStr ? JSON.parse(existingStr) : [];
      // Prevent exact duplicate notifications in short succession
      const isDuplicate = existing.some(
        (n) => n.title === notif.title && n.message === notif.message && Date.now() - n.timestamp < 3000
      );
      if (!isDuplicate) {
        const updated = [notif, ...existing].slice(0, 100);
        localStorage.setItem('trindade_notifications', JSON.stringify(updated));
        window.dispatchEvent(new Event('trindade_notifications_updated'));
      }
    } catch (e) {
      console.error('Error saving local notification:', e);
    }
  }

  // Save to Firestore
  try {
    await saveNotificationToFirestore(notif);
  } catch (e) {
    console.error('Error saving notification to Firestore:', e);
  }

  return notif;
};

/**
 * Notificação de Pedido Recebido no sistema
 */
export const notifyOrderReceived = (orderId: string, storeName: string, description?: string, actor?: string) => {
  return emitNotification({
    title: `📦 Pedido Recebido (OP #${orderId.replace(/^#/, '')})`,
    message: `O pedido OP #${orderId.replace(/^#/, '')} da loja ${storeName}${description ? ` (${description})` : ''} foi registrado no sistema${actor ? ` por ${actor}` : ''}.`,
    type: 'order_received',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Lote de Pedidos Recebidos
 */
export const notifyBatchOrdersReceived = (count: number, storeName?: string, actor?: string) => {
  return emitNotification({
    title: `📦 ${count} Novos Pedidos Recebidos`,
    message: `${count} novos pedidos ${storeName ? `da loja ${storeName} ` : ''}foram cadastrados no sistema${actor ? ` por ${actor}` : ''} e aguardam programação.`,
    type: 'order_received',
    storeName,
    actor,
  });
};

/**
 * Notificação de Data de Produção Programada/Definida (1ª vez / saindo de aguardando data)
 */
export const notifyProductionScheduled = (orderId: string, storeName: string, productionDate: string, actor?: string) => {
  return emitNotification({
    title: `📅 Produção Agendada (OP #${orderId.replace(/^#/, '')})`,
    message: `A OP #${orderId.replace(/^#/, '')} (${storeName}) foi agendada para produção em ${productionDate}${actor ? ` por ${actor}` : ''}.`,
    type: 'production_date_set',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

// Backward-compatible alias
export const notifyProductionDateSet = notifyProductionScheduled;

/**
 * Notificação de Produção Reagendada (Mudança de Data de Produção)
 */
export const notifyProductionRescheduled = (
  orderId: string,
  storeName: string,
  newDate: string,
  previousDate?: string,
  reason?: string,
  actor?: string
) => {
  const fromText = previousDate && previousDate !== 'Aguardando Data' ? ` de ${previousDate}` : '';
  const reasonText = reason ? `. Motivo: "${reason}"` : '';
  return emitNotification({
    title: `🔄 Produção Reagendada (OP #${orderId.replace(/^#/, '')})`,
    message: `A OP #${orderId.replace(/^#/, '')} (${storeName}) foi reagendada${fromText} para o dia ${newDate}${actor ? ` por ${actor}` : ''}${reasonText}.`,
    type: 'production_rescheduled',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Pedido Concluído (100% Baixa de Produção)
 */
export const notifyOrderCompleted = (orderId: string, storeName: string, actor?: string) => {
  return emitNotification({
    title: `🎉 Produção Concluída (OP #${orderId.replace(/^#/, '')})`,
    message: `A OP #${orderId.replace(/^#/, '')} (${storeName}) foi 100% concluída na fábrica${actor ? ` por ${actor}` : ''}.`,
    type: 'order_completed',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Baixa Coletiva / Em Lote
 */
export const notifyBatchOrdersCompleted = (count: number, actor?: string) => {
  return emitNotification({
    title: `🎉 Baixa Coletiva Concluída (${count} OPs)`,
    message: `${count} ordens de produção receberam baixa de conclusão${actor ? ` por ${actor}` : ''}.`,
    type: 'order_completed',
    actor,
  });
};

/**
 * Notificação de Não Concluído - Aguardando Nova Data
 */
export const notifyOrderNotCompletedPendingDate = (
  orderId: string,
  storeName: string,
  reason?: string,
  actor?: string
) => {
  const reasonText = reason ? `. Motivo informado: "${reason}"` : '';
  return emitNotification({
    title: `⏳ Não Concluído - Aguardando Nova Data (OP #${orderId.replace(/^#/, '')})`,
    message: `A OP #${orderId.replace(/^#/, '')} (${storeName}) não foi concluída e retornou para a fila de Aguardando Data${actor ? ` por ${actor}` : ''}${reasonText}.`,
    type: 'order_not_completed_pending',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Não Concluído - Excluído / Descartado
 */
export const notifyOrderNotCompletedDeleted = (
  orderId: string,
  storeName: string,
  reason?: string,
  actor?: string
) => {
  const reasonText = reason ? `. Motivo do descarte: "${reason}"` : '';
  return emitNotification({
    title: `🚫 Não Concluído / Excluído (OP #${orderId.replace(/^#/, '')})`,
    message: `A OP #${orderId.replace(/^#/, '')} (${storeName}) não foi concluída e foi excluída do fluxo de fabricação${actor ? ` por ${actor}` : ''}${reasonText}.`,
    type: 'order_not_completed_deleted',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Pedido Excluído do Sistema
 */
export const notifyOrderDeleted = (
  orderId: string,
  storeName: string,
  actor?: string,
  reason?: string
) => {
  const reasonText = reason ? `. Motivo: "${reason}"` : '';
  return emitNotification({
    title: `🗑️ Pedido Excluído (OP #${orderId.replace(/^#/, '')})`,
    message: `O pedido OP #${orderId.replace(/^#/, '')} (${storeName}) foi excluído do sistema${actor ? ` por ${actor}` : ''}${reasonText}.`,
    type: 'order_deleted',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Pedido Reaberto para Produção / Refazer
 */
export const notifyOrderReopened = (
  orderId: string,
  storeName: string,
  actor?: string,
  reason?: string
) => {
  const reasonText = reason ? `. Motivo: "${reason}"` : '';
  return emitNotification({
    title: `🔁 Pedido Reaberto para Refazer (OP #${orderId.replace(/^#/, '')})`,
    message: `A OP #${orderId.replace(/^#/, '')} (${storeName}) foi reaberta para nova produção na fábrica${actor ? ` por ${actor}` : ''}${reasonText}.`,
    type: 'order_reopened',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor,
  });
};

/**
 * Notificação de Solicitação de Urgência (Enviada pelo Vendas)
 */
export const notifyUrgencyRequested = (orderId: string, storeName: string, requestedBy: string, reason: string) => {
  return emitNotification({
    title: `🚨 Solicitação de Urgência (OP #${orderId.replace(/^#/, '')})`,
    message: `${requestedBy} (Vendas) solicitou urgência para a OP #${orderId.replace(/^#/, '')} (${storeName}). Motivo: "${reason}".`,
    type: 'urgency_requested',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor: requestedBy,
  });
};

/**
 * Notificação de Urgência Aprovada / Aceita (PCP/Gestão)
 */
export const notifyUrgencyApproved = (orderId: string, storeName: string, evaluatedBy: string, reason?: string) => {
  return emitNotification({
    title: `✅ Urgência APROVADA (OP #${orderId.replace(/^#/, '')})`,
    message: `A solicitação de urgência para a OP #${orderId.replace(/^#/, '')} (${storeName}) foi ACEITA por ${evaluatedBy}. O pedido foi promovido para ALTA PRIORIDADE!`,
    type: 'urgency_approved',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor: evaluatedBy,
  });
};

/**
 * Notificação de Urgência Rejeitada / Recusada (PCP/Gestão)
 */
export const notifyUrgencyRejected = (orderId: string, storeName: string, evaluatedBy: string, rejectionNote: string) => {
  return emitNotification({
    title: `❌ Urgência RECUSADA (OP #${orderId.replace(/^#/, '')})`,
    message: `A solicitação de urgência para a OP #${orderId.replace(/^#/, '')} (${storeName}) foi RECUSADA por ${evaluatedBy}. Motivo da recusa: "${rejectionNote}".`,
    type: 'urgency_rejected',
    orderId: orderId.replace(/^#/, ''),
    storeName,
    actor: evaluatedBy,
  });
};

/**
 * Notificação de Solicitação de Novo Usuário
 */
export const notifyUserPending = (userName: string, userEmail?: string) => {
  return emitNotification({
    title: `👤 Novo Cadastro Pendente`,
    message: `O colaborador ${userName}${userEmail ? ` (${userEmail})` : ''} cadastrou-se no sistema e aguarda aprovação de acesso.`,
    type: 'user_pending',
    actor: userName,
  });
};

/**
 * Notificação de Nova Solicitação de Matéria-Prima
 */
export const notifyMaterialRequested = (
  code: string,
  materialName: string,
  quantity: number,
  unit: string,
  requestedBy: string,
  sector?: string,
  priority?: string
) => {
  const isUrgent = priority?.includes('ALTA');
  return emitNotification({
    title: `${isUrgent ? '🚨' : '📦'} Solicitação de Matéria-Prima (${code})`,
    message: `${requestedBy} solicitou ${quantity} ${unit} de "${materialName}"${sector ? ` para o setor ${sector}` : ''}.${isUrgent ? ' (URGENTE)' : ''}`,
    type: 'material_requested',
    actor: requestedBy,
  });
};

/**
 * Notificação de Compra Realizada / Prazo Informado
 */
export const notifyMaterialPurchased = (
  code: string,
  materialName: string,
  expectedDeliveryDate: string,
  purchasedBy: string,
  supplier?: string
) => {
  return emitNotification({
    title: `🛒 Compra Realizada (${code})`,
    message: `A compra de "${materialName}" foi confirmada por ${purchasedBy}${supplier ? ` (${supplier})` : ''}. Previsão de entrega: ${expectedDeliveryDate}.`,
    type: 'material_purchased',
    actor: purchasedBy,
  });
};

/**
 * Notificação de Matéria-Prima Recebida pela Expedição
 */
export const notifyMaterialReceived = (
  code: string,
  materialName: string,
  receivedQuantity: number,
  unit: string,
  receivedBy: string
) => {
  return emitNotification({
    title: `✅ Material Recebido na Fábrica (${code})`,
    message: `A Expedição/Recebimento (${receivedBy}) deu baixa no recebimento de ${receivedQuantity} ${unit} de "${materialName}". Material disponível para produção!`,
    type: 'material_received',
    actor: receivedBy,
  });
};
