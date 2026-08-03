import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { OrderItem, Store, AssemblyOperator, UserProfile } from '@/types/factory';

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
        list.push(docSnap.data() as AssemblyOperator);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
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

