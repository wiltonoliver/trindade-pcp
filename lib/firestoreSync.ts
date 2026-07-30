import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { OrderItem, Store, AssemblyOperator } from '@/types/factory';

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
 * Salva ou atualiza um pedido no Firestore
 */
export const saveOrderToFirestore = async (order: OrderItem) => {
  if (!order.id) return;
  const docRef = doc(db, 'orders', order.id);
  await setDoc(docRef, order, { merge: true });
};

/**
 * Remove um pedido do Firestore
 */
export const deleteOrderFromFirestore = async (orderId: string) => {
  if (!orderId) return;
  await deleteDoc(doc(db, 'orders', orderId));
};

/**
 * Salva ou atualiza uma loja no Firestore
 */
export const saveStoreToFirestore = async (store: Store) => {
  if (!store.id) return;
  await setDoc(doc(db, 'stores', store.id), store, { merge: true });
};

/**
 * Remove uma loja do Firestore
 */
export const deleteStoreFromFirestore = async (storeId: string) => {
  if (!storeId) return;
  await deleteDoc(doc(db, 'stores', storeId));
};

/**
 * Salva ou atualiza um operador no Firestore
 */
export const saveOperatorToFirestore = async (operator: AssemblyOperator) => {
  if (!operator.id) return;
  await setDoc(doc(db, 'operators', operator.id), operator, { merge: true });
};
