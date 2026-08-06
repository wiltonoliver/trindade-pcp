import { AppNotification, NotificationType } from '@/types/factory';
import { saveNotificationToFirestore, deleteNotificationFromFirestore } from './firestoreSync';

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
export const notifyOrderReceived = (orderId: string, storeName: string, description?: string) => {
  return emitNotification({
    title: `📦 Pedido Recebido (OP #${orderId})`,
    message: `O pedido OP #${orderId} da loja ${storeName}${description ? ` (${description})` : ''} foi recebido e aguarda agendamento.`,
    type: 'order_received',
    orderId,
    storeName,
  });
};

/**
 * Notificação de Data de Produção Programada/Definida
 */
export const notifyProductionDateSet = (orderId: string, storeName: string, productionDate: string, actor?: string) => {
  return emitNotification({
    title: `📅 Data de Produção Definida (OP #${orderId})`,
    message: `A OP #${orderId} (${storeName}) teve sua data de produção agendada para ${productionDate}${actor ? ` por ${actor}` : ''}.`,
    type: 'production_date_set',
    orderId,
    storeName,
    actor,
  });
};

/**
 * Notificação de Solicitação de Urgência (Enviada pelo Vendas)
 */
export const notifyUrgencyRequested = (orderId: string, storeName: string, requestedBy: string, reason: string) => {
  return emitNotification({
    title: `🚨 Solicitação de Urgência (OP #${orderId})`,
    message: `${requestedBy} (Vendas) solicitou urgência para a OP #${orderId} (${storeName}). Motivo: "${reason}".`,
    type: 'urgency_requested',
    orderId,
    storeName,
    actor: requestedBy,
  });
};

/**
 * Notificação de Urgência Aprovada / Aceita (PCP/Gestão)
 */
export const notifyUrgencyApproved = (orderId: string, storeName: string, evaluatedBy: string, reason?: string) => {
  return emitNotification({
    title: `✅ Urgência APROVADA (OP #${orderId})`,
    message: `A solicitação de urgência para a OP #${orderId} (${storeName}) foi ACEITA por ${evaluatedBy}. O pedido foi promovido para ALTA PRIORIDADE!`,
    type: 'urgency_approved',
    orderId,
    storeName,
    actor: evaluatedBy,
  });
};

/**
 * Notificação de Urgência Rejeitada / Recusada (PCP/Gestão)
 */
export const notifyUrgencyRejected = (orderId: string, storeName: string, evaluatedBy: string, rejectionNote: string) => {
  return emitNotification({
    title: `❌ Urgência RECUSADA (OP #${orderId})`,
    message: `A solicitação de urgência para a OP #${orderId} (${storeName}) foi RECUSADA por ${evaluatedBy}. Motivo da recusa: "${rejectionNote}".`,
    type: 'urgency_rejected',
    orderId,
    storeName,
    actor: evaluatedBy,
  });
};

/**
 * Notificação de Pedido Concluído
 */
export const notifyOrderCompleted = (orderId: string, storeName: string, actor?: string) => {
  return emitNotification({
    title: `🎉 Pedido Concluído (OP #${orderId})`,
    message: `A OP #${orderId} (${storeName}) foi finalizada 100% na fábrica${actor ? ` por ${actor}` : ''}.`,
    type: 'order_completed',
    orderId,
    storeName,
    actor,
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
