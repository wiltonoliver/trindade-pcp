import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { OrderItem, Store, AssemblyOperator, UserProfile, AppNotification, MaterialRequest } from '@/types/factory';

/**
 * Escuta em tempo real a coleção de Pedidos no Firestore
 */
export const subscribeOrders = (onUpdate: (orders: OrderItem[]) => void) => {
  const ordersRef = collection(db, 'orders');
  return onSnapshot(
    ordersRef,
    (snapshot) => {
      const list: OrderItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as OrderItem);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Erro no ouvinte de Pedidos do Firestore:', err);
    }
  );
};

/**
 * Escuta em tempo real a coleção de Lojas no Firestore
 */
export const subscribeStores = (onUpdate: (stores: Store[]) => void) => {
  const storesRef = collection(db, 'stores');
  return onSnapshot(
    storesRef,
    (snapshot) => {
      const list: Store[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Store);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Erro no ouvinte de Lojas do Firestore:', err);
    }
  );
};

const MOCK_OP_IDS = ['op-101', 'op-102', 'op-103', 'op-104', 'op-1', 'op-2', 'op-3', 'op-4'];
const MOCK_OP_CODES = ['OP-101', 'OP-102', 'OP-103', 'OP-104'];
const MOCK_OP_NAMES = [
  'roberto souza',
  'marcos paulo',
  'lucas ferreira',
  'antonio carlos',
];

export const isMockOperator = (op: Partial<AssemblyOperator>): boolean => {
  if (!op) return true;
  const id = (op.id || '').toLowerCase().trim();
  const code = (op.code || '').toUpperCase().trim();
  const name = (op.name || '').toLowerCase().trim();
  if (MOCK_OP_IDS.includes(id)) return true;
  if (MOCK_OP_CODES.includes(code)) return true;
  return MOCK_OP_NAMES.some((m) => name.includes(m));
};

/**
 * Escuta em tempo real a coleção de Operadores/Usuários no Firestore
 */
export const subscribeOperators = (onUpdate: (operators: AssemblyOperator[]) => void) => {
  const opsRef = collection(db, 'operators');
  return onSnapshot(
    opsRef,
    (snapshot) => {
      const list: AssemblyOperator[] = [];
      snapshot.forEach((docSnap) => {
        const data = { ...docSnap.data(), id: docSnap.id } as AssemblyOperator;
        // Filter out old legacy mock operators if any remain in remote
        if (data && !isMockOperator(data)) {
          list.push(data);
        } else if (data && isMockOperator(data)) {
          // Permanently purge any residual mock operator from Firestore
          deleteDoc(doc(db, 'operators', docSnap.id)).catch(() => {});
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Erro no ouvinte de Operadores do Firestore:', err);
    }
  );
};

/**
 * Remove recursivamente todas as propriedades com valor `undefined`
 * para evitar erros do Firestore ("Unsupported field value: undefined").
 */
const sanitizeForFirestore = <T>(obj: T): T => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
};

/**
 * Salva ou atualiza um pedido no Firestore
 */
export const saveOrderToFirestore = async (order: OrderItem) => {
  if (!order.id) return;
  try {
    const docRef = doc(db, 'orders', order.id);
    const cleanOrder = sanitizeForFirestore(order);
    await setDoc(docRef, cleanOrder, { merge: true });
  } catch (error) {
    console.error('Erro ao salvar pedido no Firestore:', error);
  }
};

/**
 * Remove um pedido do Firestore
 */
export const deleteOrderFromFirestore = async (orderId: string) => {
  if (!orderId) return;
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    console.error('Erro ao remover pedido do Firestore:', error);
  }
};

/**
 * Salva ou atualiza uma loja no Firestore
 */
export const saveStoreToFirestore = async (store: Store) => {
  if (!store.id) return;
  try {
    const cleanStore = sanitizeForFirestore(store);
    await setDoc(doc(db, 'stores', store.id), cleanStore, { merge: true });
  } catch (error) {
    console.error('Erro ao salvar loja no Firestore:', error);
  }
};

/**
 * Remove uma loja do Firestore
 */
export const deleteStoreFromFirestore = async (storeId: string) => {
  if (!storeId) return;
  try {
    await deleteDoc(doc(db, 'stores', storeId));
  } catch (error) {
    console.error('Erro ao remover loja do Firestore:', error);
  }
};

/**
 * Salva ou atualiza um operador no Firestore
 */
export const saveOperatorToFirestore = async (operator: AssemblyOperator) => {
  if (!operator.id) return;
  try {
    const cleanOperator = sanitizeForFirestore(operator);
    await setDoc(doc(db, 'operators', operator.id), cleanOperator, { merge: true });
  } catch (error) {
    console.error('Erro ao salvar operador no Firestore:', error);
  }
};

/**
 * Remove um operador do Firestore
 */
export const deleteOperatorFromFirestore = async (operatorId: string) => {
  if (!operatorId) return;
  try {
    await deleteDoc(doc(db, 'operators', operatorId));
  } catch (error) {
    console.error('Erro ao remover operador do Firestore:', error);
  }
};

/**
 * Escuta em tempo real a coleção de Usuários no Firestore
 */
export const subscribeUsers = (onUpdate: (users: UserProfile[]) => void) => {
  const usersRef = collection(db, 'users');
  return onSnapshot(
    usersRef,
    (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as UserProfile);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Erro no ouvinte de Usuários do Firestore:', err);
    }
  );
};

/**
 * Salva ou atualiza um usuário no Firestore
 */
export const saveUserToFirestore = async (user: UserProfile) => {
  if (!user.id) return;
  try {
    const cleanUser = sanitizeForFirestore(user);
    const docRef = doc(db, 'users', user.id);
    await setDoc(docRef, cleanUser, { merge: true });
  } catch (error) {
    console.error('Erro ao salvar usuário no Firestore:', error);
  }
};

/**
 * Remove um usuário do Firestore
 */
export const deleteUserFromFirestore = async (userId: string) => {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    console.error('Erro ao remover usuário do Firestore:', error);
  }
};

/**
 * Escuta em tempo real a coleção de Notificações no Firestore
 */
export const subscribeNotifications = (onUpdate: (notifications: AppNotification[]) => void) => {
  const notifsRef = collection(db, 'notifications');
  return onSnapshot(
    notifsRef,
    (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as AppNotification);
      });
      // Sort newest first
      list.sort((a, b) => b.timestamp - a.timestamp);
      onUpdate(list);
    },
    (err) => {
      console.error('Erro no ouvinte de Notificações do Firestore:', err);
    }
  );
};

/**
 * Salva uma notificação no Firestore
 */
export const saveNotificationToFirestore = async (notification: AppNotification) => {
  if (!notification.id) return;
  try {
    const clean = sanitizeForFirestore(notification);
    const docRef = doc(db, 'notifications', notification.id);
    await setDoc(docRef, clean, { merge: true });
  } catch (error) {
    console.error('Erro ao salvar notificação no Firestore:', error);
  }
};

/**
 * Remove uma notificação do Firestore
 */
export const deleteNotificationFromFirestore = async (notificationId: string) => {
  if (!notificationId) return;
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Erro ao remover notificação do Firestore:', error);
  }
};

/**
 * Escuta em tempo real a coleção de Solicitações de Matéria-Prima no Firestore
 */
export const subscribeMaterialRequests = (onUpdate: (requests: MaterialRequest[]) => void) => {
  const reqsRef = collection(db, 'material_requests');
  return onSnapshot(
    reqsRef,
    (snapshot) => {
      const list: MaterialRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as MaterialRequest);
      });
      // Ordenar mais recentes primeiro
      list.sort((a, b) => (b.requestedTimestamp || 0) - (a.requestedTimestamp || 0));
      onUpdate(list);
    },
    (err) => {
      console.error('Erro no ouvinte de Solicitações de Matéria-Prima do Firestore:', err);
    }
  );
};

/**
 * Salva ou atualiza uma solicitação de matéria-prima no Firestore
 */
export const saveMaterialRequestToFirestore = async (request: MaterialRequest) => {
  if (!request.id) return;
  try {
    const clean = sanitizeForFirestore(request);
    const docRef = doc(db, 'material_requests', request.id);
    await setDoc(docRef, clean, { merge: true });
  } catch (error) {
    console.error('Erro ao salvar solicitação de matéria-prima no Firestore:', error);
  }
};

/**
 * Remove uma solicitação de matéria-prima do Firestore
 */
export const deleteMaterialRequestFromFirestore = async (requestId: string) => {
  if (!requestId) return;
  try {
    await deleteDoc(doc(db, 'material_requests', requestId));
  } catch (error) {
    console.error('Erro ao remover solicitação de matéria-prima do Firestore:', error);
  }
};


