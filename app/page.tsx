'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActiveTab, OrderItem, Store, UserProfile, AssemblyOperator, AppNotification, MaterialRequest } from '@/types/factory';
import { INITIAL_ORDERS, INITIAL_STORES, INITIAL_OPERATORS, INITIAL_MATERIAL_REQUESTS } from '@/lib/factory-store';
import { sanitizeUnit } from '@/lib/utils';
import { normalizeDateToDDMMYYYY, isOrderOverdueForCheckoff } from '@/lib/dateUtils';
import {
  getUserNotificationKey,
  isNotificationVisibleForUser,
  isNotificationReadForUser,
  notifyOrderReceived,
  notifyBatchOrdersReceived,
  notifyOrderReopened,
} from '@/lib/notificationService';

import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { PlanningDashboard } from '@/components/PlanningDashboard';
import { OrderEntry } from '@/components/OrderEntry';
import { RawMaterialRequests } from '@/components/RawMaterialRequests';
import { DailyProductivity } from '@/components/DailyProductivity';
import { StatisticsView } from '@/components/StatisticsView';
import { ReplanningHistory } from '@/components/ReplanningHistory';
import { StoreManagement } from '@/components/StoreManagement';
import { UserManagement } from '@/components/UserManagement';
import { ReportsPage } from '@/components/ReportsPage';
import { LabelGenerator } from '@/components/LabelGenerator';
import { ExpeditionScreen } from '@/components/ExpeditionScreen';
import { CompletedOrders } from '@/components/CompletedOrders';
import { PendingDateOrders } from '@/components/PendingDateOrders';
import { PendingCheckouts } from '@/components/PendingCheckouts';

import { ProfileSettingsModal } from '@/components/ProfileSettingsModal';
import { NotificationsDrawer } from '@/components/NotificationsDrawer';
import { LoginModal } from '@/components/LoginModal';
import { DevAccessModal } from '@/components/DevAccessModal';
import {
  subscribeOrders,
  subscribeStores,
  subscribeOperators,
  subscribeNotifications,
  subscribeMaterialRequests,
  saveOrderToFirestore,
  saveStoreToFirestore,
  saveOperatorToFirestore,
  saveNotificationToFirestore,
  saveMaterialRequestToFirestore,
  deleteMaterialRequestFromFirestore,
  deleteNotificationFromFirestore,
} from '@/lib/firestoreSync';

export default function FactoryOpsApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const [loginModalKey, setLoginModalKey] = useState<number>(() => Date.now());
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedStoreForOrder, setSelectedStoreForOrder] = useState<string | undefined>(undefined);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<string | null>(null);

  // User Profile state with default fallback
  const [currentUser, setCurrentUser] = useState<UserProfile | null>({
    name: 'Wilton Oliver',
    role: 'Gerente de Operações',
    email: 'wiltonoliver@gmail.com',
    plant: 'Planta A - Matriz',
  });

  // Initialize orders state safely for SSR hydration match
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS);
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [operators, setOperators] = useState<AssemblyOperator[]>(INITIAL_OPERATORS);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>(INITIAL_MATERIAL_REQUESTS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage after client hydration
  useEffect(() => {
    const timer = setTimeout(() => {
      // Load user profile
      const savedUser = localStorage.getItem('factoryops_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Error parsing user from localStorage', e);
        }
      }

      // Check if user previously saved legacy demo data (with ord-1, st-1, etc)
      const savedOrders = localStorage.getItem('factoryops_orders');
      const savedStores = localStorage.getItem('factoryops_stores');
      const savedOperators = localStorage.getItem('factoryops_operators');
      const savedMaterials = localStorage.getItem('factoryops_material_requests');
      const deletedOrderIdsStr = localStorage.getItem('trindade_deleted_order_ids');
      const deletedOrderIds: string[] = deletedOrderIdsStr ? JSON.parse(deletedOrderIdsStr) : [];
      const deletedStoreIdsStr = localStorage.getItem('trindade_deleted_store_ids');
      const deletedStoreIds: string[] = deletedStoreIdsStr ? JSON.parse(deletedStoreIdsStr) : [];
      const deletedOpIdsStr = localStorage.getItem('trindade_deleted_operator_ids');
      const deletedOpIds: string[] = deletedOpIdsStr ? JSON.parse(deletedOpIdsStr) : [];

      if (savedOrders) {
        try {
          const parsed = JSON.parse(savedOrders);
          const hasLegacyMock = Array.isArray(parsed) && parsed.some((o: OrderItem) => o.id?.startsWith('ord-'));
          if (hasLegacyMock) {
            localStorage.removeItem('factoryops_orders');
            setOrders([]);
          } else if (Array.isArray(parsed)) {
            const seenIds = new Set<string>();
            const sanitizedOrders = parsed
              .filter((o: OrderItem) => o.id && !deletedOrderIds.includes(o.id))
              .map((o: OrderItem, index: number) => {
                let uniqueId = o.id || `item-${Date.now()}-${index}`;
                if (seenIds.has(uniqueId)) {
                  uniqueId = `${uniqueId}-dup-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
                }
                seenIds.add(uniqueId);
                return { ...o, id: uniqueId, unit: sanitizeUnit(o.unit) };
              });
            setOrders(sanitizedOrders);
          }
        } catch (e) {
          console.error('Error parsing saved orders from localStorage', e);
          setOrders([]);
        }
      }

      if (savedStores) {
        try {
          const parsedStores = JSON.parse(savedStores);
          const hasLegacyStores = Array.isArray(parsedStores) && parsedStores.some((s: Store) => s.id?.startsWith('st-'));
          if (hasLegacyStores) {
            localStorage.removeItem('factoryops_stores');
            setStores([]);
          } else if (Array.isArray(parsedStores)) {
            const filteredStores = parsedStores.filter((s: Store) => s.id && !deletedStoreIds.includes(s.id));
            setStores(filteredStores);
          }
        } catch (e) {
          console.error('Error parsing saved stores from localStorage', e);
          setStores([]);
        }
      }

      if (savedOperators) {
        try {
          const parsedOps = JSON.parse(savedOperators);
          if (Array.isArray(parsedOps)) {
            const filteredOps = parsedOps.filter((op: AssemblyOperator) => op.id && !deletedOpIds.includes(op.id));
            setOperators(filteredOps);
          }
        } catch (e) {
          console.error('Error parsing saved operators from localStorage', e);
        }
      } else if (deletedOpIds.length > 0) {
        setOperators(INITIAL_OPERATORS.filter((op) => !deletedOpIds.includes(op.id)));
      }

      if (savedMaterials) {
        try {
          const parsedMaterials = JSON.parse(savedMaterials);
          if (Array.isArray(parsedMaterials)) {
            setMaterialRequests(parsedMaterials);
          }
        } catch (e) {
          console.error('Error parsing saved material requests from localStorage', e);
        }
      }

      setIsLoaded(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Save state on change after initial mount load
  useEffect(() => {
    if (isLoaded && currentUser) {
      localStorage.setItem('factoryops_user', JSON.stringify(currentUser));
    }
  }, [currentUser, isLoaded]);

  // Function to completely reset all data to clean real-data state
  const handleResetAllData = () => {
    localStorage.removeItem('factoryops_orders');
    localStorage.removeItem('factoryops_stores');
    localStorage.removeItem('factoryops_operators');
    localStorage.removeItem('factoryops_pending');
    localStorage.removeItem('factoryops_problems');
    localStorage.removeItem('trindade_deleted_order_ids');
    localStorage.removeItem('trindade_deleted_store_ids');
    localStorage.removeItem('trindade_deleted_user_ids');
    localStorage.removeItem('trindade_deleted_operator_ids');
    setOrders([]);
    setStores([]);
    setOperators(INITIAL_OPERATORS);
  };

  // Subscribe to real-time Firestore updates
  useEffect(() => {
    if (!isLoaded) return;

    const unsubOrders = subscribeOrders((remoteOrders) => {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_order_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      if (remoteOrders) {
        const filtered = remoteOrders
          .filter((o) => o.id && !deletedIds.includes(o.id))
          .map((o) => ({
            ...o,
            unit: sanitizeUnit(o.unit),
            productionDate: normalizeDateToDDMMYYYY(o.productionDate),
          }));
        setOrders(filtered);
        if (typeof window !== 'undefined') {
          localStorage.setItem('factoryops_orders', JSON.stringify(filtered));
        }
      }
    });

    const unsubStores = subscribeStores((remoteStores) => {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_store_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      if (remoteStores) {
        const filtered = remoteStores.filter((s) => s.id && !deletedIds.includes(s.id));
        setStores(filtered);
        if (typeof window !== 'undefined') {
          localStorage.setItem('factoryops_stores', JSON.stringify(filtered));
        }
      }
    });

    const unsubOperators = subscribeOperators((remoteOps) => {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_operator_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      if (remoteOps) {
        const filtered = remoteOps.filter((op) => op.id && !deletedIds.includes(op.id));
        setOperators(filtered);
        if (typeof window !== 'undefined') {
          localStorage.setItem('factoryops_operators', JSON.stringify(filtered));
        }
      }
    });

    const unsubNotifications = subscribeNotifications((remoteNotifs) => {
      if (remoteNotifs) {
        setNotifications(remoteNotifs);
      }
    });

    const unsubMaterials = subscribeMaterialRequests((remoteMaterials) => {
      if (remoteMaterials && remoteMaterials.length > 0) {
        setMaterialRequests(remoteMaterials);
        if (typeof window !== 'undefined') {
          localStorage.setItem('factoryops_material_requests', JSON.stringify(remoteMaterials));
        }
      }
    });

    return () => {
      unsubOrders();
      unsubStores();
      unsubOperators();
      unsubNotifications();
      unsubMaterials();
    };
  }, [isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('factoryops_material_requests', JSON.stringify(materialRequests));
    }
  }, [materialRequests, isLoaded]);

  const handleSaveMaterialRequest = (req: MaterialRequest) => {
    setMaterialRequests((prev) => {
      const idx = prev.findIndex((m) => m.id === req.id);
      let updated: MaterialRequest[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = req;
      } else {
        updated = [req, ...prev];
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('factoryops_material_requests', JSON.stringify(updated));
      }
      return updated;
    });
    saveMaterialRequestToFirestore(req).catch((e) => console.error('Error saving material request:', e));
  };

  const handleDeleteMaterialRequest = (id: string) => {
    setMaterialRequests((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('factoryops_material_requests', JSON.stringify(updated));
      }
      return updated;
    });
    deleteMaterialRequestFromFirestore(id).catch((e) => console.error('Error deleting material request:', e));
  };

  useEffect(() => {
    if (isLoaded) {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_order_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      const filtered = orders.filter((o) => o.id && !deletedIds.includes(o.id));
      localStorage.setItem('factoryops_orders', JSON.stringify(filtered));
    }
  }, [orders, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_store_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      const filtered = stores.filter((s) => s.id && !deletedIds.includes(s.id));
      localStorage.setItem('factoryops_stores', JSON.stringify(filtered));
      filtered.forEach((st) => {
        saveStoreToFirestore(st).catch((e) => console.error('Firestore store error:', e));
      });
    }
  }, [stores, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_operator_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      const filtered = operators.filter((op) => op.id && !deletedIds.includes(op.id));
      localStorage.setItem('factoryops_operators', JSON.stringify(filtered));
      filtered.forEach((op) => {
        saveOperatorToFirestore(op).catch((e) => console.error('Firestore operator error:', e));
      });
    }
  }, [operators, isLoaded]);

  // Handler to add orders extracted from OrderEntry
  const handleAddOrdersToPlanning = (newOrders: OrderItem[]) => {
    if (newOrders.length === 0) return;

    setOrders((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      const sanitizedNew = newOrders.map((o, idx) => {
        let uniqueId = o.id || `ext-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
        if (existingIds.has(uniqueId)) {
          uniqueId = `${uniqueId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
        existingIds.add(uniqueId);
        const newOrd: OrderItem = {
          ...o,
          id: uniqueId,
          column: 'nao_planejado',
          productionDate: 'Aguardando Data',
          executionStatus: 'pendente',
        };
        saveOrderToFirestore(newOrd).catch((e) => console.error('Error saving new order to Firestore:', e));
        return newOrd;
      });
      return [...sanitizedNew, ...prev];
    });

    // Emit notification(s) for added orders
    if (newOrders.length === 1) {
      notifyOrderReceived(
        newOrders[0].orderId,
        newOrders[0].store,
        newOrders[0].itemDescription,
        currentUser?.name
      );
    } else if (newOrders.length > 1) {
      notifyBatchOrdersReceived(
        newOrders.length,
        newOrders[0]?.store,
        currentUser?.name
      );
    }
  };

  // Handler to reintroduce single item from ReplanningHistory (remanejando o item existente, sem duplicar)
  const handleReintroduceItemToPlanning = (item: OrderItem) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === item.id) {
          const updated = {
            ...o,
            column: 'nao_planejado' as const,
            executionStatus: 'pendente' as const,
            isPendingReposition: false,
            productionDate: 'Aguardando Data',
            pendingReason: '',
            delayReason: '',
          };
          saveOrderToFirestore(updated).catch(() => {});
          return updated;
        }
        return o;
      })
    );
    notifyOrderReopened(item.orderId, item.store, currentUser?.name, 'Reintroduzido para fila de programação');
  };

  // Handler to reintroduce all items from ReplanningHistory
  const handleReintroduceAllToPlanning = (items: OrderItem[]) => {
    const itemIds = new Set(items.map((i) => i.id));
    setOrders((prev) =>
      prev.map((o) => {
        if (itemIds.has(o.id)) {
          const updated = {
            ...o,
            column: 'nao_planejado' as const,
            executionStatus: 'pendente' as const,
            isPendingReposition: false,
            productionDate: 'Aguardando Data',
            pendingReason: '',
            delayReason: '',
          };
          saveOrderToFirestore(updated).catch(() => {});
          return updated;
        }
        return o;
      })
    );
    if (items.length > 0) {
      notifyBatchOrdersReceived(items.length, undefined, currentUser?.name);
    }
  };

  const handleLoginUser = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    setIsLoginOpen(false);
    localStorage.setItem('factoryops_user', JSON.stringify(user));
  };

  // Permission verification helper for tabs
  const isTabAllowed = useCallback((tab: ActiveTab): boolean => {
    if (!currentUser || !currentUser.permissions) return true; // Default allowed if unspecified
    const p = currentUser.permissions;

    switch (tab) {
      case 'order-entry':
        return p.canAccessOrderEntry !== false;
      case 'raw-materials':
        return p.canAccessRawMaterials !== false;
      case 'pending-date':
        return p.canAccessPendingDate !== false;
      case 'pending-checkouts':
        return p.canAccessPendingCheckouts !== false;
      case 'dashboard':
        return p.canAccessDashboard !== false;
      case 'productivity':
        return p.canAccessProductivity !== false;
      case 'statistics':
        return p.canAccessStatistics !== false;
      case 'completed':
        return p.canAccessCompleted !== false;
      case 'stores':
        return p.canAccessStores !== false;
      case 'users':
        return p.canAccessUsers !== false;
      case 'reports':
        return p.canAccessReports !== false;
      case 'labels':
        return p.canAccessLabels !== false;
      case 'expedition':
        return p.canAccessExpedition !== false;
      case 'history':
        return p.canAccessHistory !== false;
      default:
        return true;
    }
  }, [currentUser]);

  // Redirect user to an allowed tab if current activeTab becomes unauthorized
  useEffect(() => {
    if (currentUser && !isTabAllowed(activeTab)) {
      const timer = setTimeout(() => {
        if (isTabAllowed('dashboard')) {
          setActiveTab('dashboard');
        } else if (isTabAllowed('productivity')) {
          setActiveTab('productivity');
        } else {
          const firstAllowed: ActiveTab[] = ['dashboard', 'productivity', 'order-entry', 'pending-date', 'completed', 'statistics', 'stores', 'reports', 'history', 'users'];
          const fallback = firstAllowed.find((t) => isTabAllowed(t)) || 'dashboard';
          setActiveTab(fallback);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentUser, activeTab, isTabAllowed]);

  // State for pending user access requests
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);

  const checkPendingUsers = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trindade_users_list');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const count = parsed.filter((u: UserProfile) => u.status === 'pending').length;
            setPendingUsersCount(count);
            return;
          }
        } catch (e) {
          console.error('Error checking pending users', e);
        }
      }
    }
    setPendingUsersCount(0);
  };

  useEffect(() => {
    queueMicrotask(() => checkPendingUsers());
    window.addEventListener('storage', checkPendingUsers);
    window.addEventListener('trindade_users_updated', checkPendingUsers);
    return () => {
      window.removeEventListener('storage', checkPendingUsers);
      window.removeEventListener('trindade_users_updated', checkPendingUsers);
    };
  }, []);

  const handleGrantDevAccess = (devUser: UserProfile) => {
    setCurrentUser(devUser);
    setActiveTab('dashboard');
    setIsLoginOpen(false);
    setIsDevModalOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('factoryops_user', JSON.stringify(devUser));
      window.dispatchEvent(new Event('trindade_users_updated'));
    }
  };

  const completedCount = orders.filter((o) => o.executionStatus === 'concluido' || o.progress === 100).length;
  const pendingDateCount = orders.filter(
    (o) =>
      o.executionStatus !== 'concluido' &&
      o.progress !== 100 &&
      (o.column === 'nao_planejado' || !o.productionDate || o.productionDate.toLowerCase().includes('aguardando'))
  ).length;
  const pendingCheckoutsCount = orders.filter((o) =>
    isOrderOverdueForCheckoff(o.productionDate, o.executionStatus, o.progress)
  ).length;
  const pendingRawMaterialsCount = materialRequests.filter((m) => m.status === 'pendente').length;

  // User-specific notification identification and preferences
  const userNotifKey = useMemo(() => getUserNotificationKey(currentUser), [currentUser]);
  const [localClearedNotifIds, setLocalClearedNotifIds] = useState<string[]>([]);
  const [localReadNotifIds, setLocalReadNotifIds] = useState<string[]>([]);

  // Load user-specific cleared and read notifications preferences on mount and user switch
  useEffect(() => {
    queueMicrotask(() => {
      if (typeof window !== 'undefined' && userNotifKey) {
        try {
          const clearedStr = localStorage.getItem(`trindade_notif_cleared_${userNotifKey}`);
          setLocalClearedNotifIds(clearedStr ? JSON.parse(clearedStr) : []);
          const readStr = localStorage.getItem(`trindade_notif_read_${userNotifKey}`);
          setLocalReadNotifIds(readStr ? JSON.parse(readStr) : []);
        } catch (e) {
          console.error('Error parsing user notifications storage:', e);
        }
      }
    });
  }, [userNotifKey]);

  // Compute user-independent notifications list (only includes notifications not cleared by this user)
  const userNotifications = useMemo(() => {
    const clearedSet = new Set(localClearedNotifIds);
    const readSet = new Set(localReadNotifIds);

    return notifications
      .filter((n) => isNotificationVisibleForUser(n, userNotifKey, clearedSet))
      .map((n) => ({
        ...n,
        read: isNotificationReadForUser(n, userNotifKey, readSet),
      }));
  }, [notifications, userNotifKey, localClearedNotifIds, localReadNotifIds]);

  const unreadNotificationsCount = userNotifications.filter((n) => !n.read).length;

  const handleMarkNotificationAsRead = (id: string) => {
    setLocalReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`trindade_notif_read_${userNotifKey}`, JSON.stringify(updated));
      }
      return updated;
    });

    const target = notifications.find((n) => n.id === id);
    if (target) {
      const existingReadBy = Array.isArray(target.readBy) ? target.readBy : [];
      if (!existingReadBy.includes(userNotifKey)) {
        const updated: AppNotification = {
          ...target,
          readBy: [...existingReadBy, userNotifKey],
        };
        saveNotificationToFirestore(updated).catch(() => {});
      }
    }
  };

  const handleMarkAllNotificationsAsRead = () => {
    const visibleIds = userNotifications.map((n) => n.id);
    setLocalReadNotifIds((prev) => {
      const combined = Array.from(new Set([...prev, ...visibleIds]));
      if (typeof window !== 'undefined') {
        localStorage.setItem(`trindade_notif_read_${userNotifKey}`, JSON.stringify(combined));
      }
      return combined;
    });

    userNotifications.forEach((n) => {
      const existingReadBy = Array.isArray(n.readBy) ? n.readBy : [];
      if (!existingReadBy.includes(userNotifKey)) {
        const updated: AppNotification = {
          ...n,
          readBy: [...existingReadBy, userNotifKey],
        };
        saveNotificationToFirestore(updated).catch(() => {});
      }
    });
  };

  // Limpa as notificações SOMENTE para o usuário logado (sem deletar do Firestore para os outros)
  const handleClearAllNotifications = () => {
    const visibleIds = userNotifications.map((n) => n.id);
    setLocalClearedNotifIds((prev) => {
      const combined = Array.from(new Set([...prev, ...visibleIds]));
      if (typeof window !== 'undefined') {
        localStorage.setItem(`trindade_notif_cleared_${userNotifKey}`, JSON.stringify(combined));
      }
      return combined;
    });

    userNotifications.forEach((n) => {
      const existingClearedBy = Array.isArray(n.clearedBy) ? n.clearedBy : [];
      if (!existingClearedBy.includes(userNotifKey)) {
        const updated: AppNotification = {
          ...n,
          clearedBy: [...existingClearedBy, userNotifKey],
        };
        saveNotificationToFirestore(updated).catch(() => {});
      }
    });
  };

  // Remove uma notificação específica SOMENTE da visualização deste usuário
  const handleDeleteNotification = (id: string) => {
    setLocalClearedNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`trindade_notif_cleared_${userNotifKey}`, JSON.stringify(updated));
      }
      return updated;
    });

    const target = notifications.find((n) => n.id === id);
    if (target) {
      const existingClearedBy = Array.isArray(target.clearedBy) ? target.clearedBy : [];
      if (!existingClearedBy.includes(userNotifKey)) {
        const updated: AppNotification = {
          ...target,
          clearedBy: [...existingClearedBy, userNotifKey],
        };
        saveNotificationToFirestore(updated).catch(() => {});
      }
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    handleMarkNotificationAsRead(n.id);
    if (
      n.type === 'urgency_requested' ||
      n.type === 'urgency_approved' ||
      n.type === 'urgency_rejected' ||
      n.type === 'order_received' ||
      n.type === 'order_not_completed_pending'
    ) {
      if (isTabAllowed('pending-date')) {
        setActiveTab('pending-date');
      } else {
        setActiveTab('dashboard');
      }
    } else if (n.type === 'production_date_set' || n.type === 'production_rescheduled' || n.type === 'order_reopened') {
      if (isTabAllowed('dashboard')) {
        setActiveTab('dashboard');
      }
    } else if (n.type === 'order_completed') {
      if (isTabAllowed('completed')) {
        setActiveTab('completed');
      } else if (isTabAllowed('dashboard')) {
        setActiveTab('dashboard');
      }
    } else if (n.type === 'order_not_completed_deleted' || n.type === 'order_deleted') {
      if (isTabAllowed('pending-checkouts')) {
        setActiveTab('pending-checkouts');
      } else if (isTabAllowed('dashboard')) {
        setActiveTab('dashboard');
      }
    } else if (n.type === 'material_requested' || n.type === 'material_purchased' || n.type === 'material_received') {
      if (isTabAllowed('raw-materials')) {
        setActiveTab('raw-materials');
      } else if (isTabAllowed('dashboard')) {
        setActiveTab('dashboard');
      }
    }
    setIsNotificationsOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Persistent Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={0}
        pendingDateCount={pendingDateCount}
        pendingCheckoutsCount={pendingCheckoutsCount}
        pendingUsersCount={pendingUsersCount}
        pendingRawMaterialsCount={pendingRawMaterialsCount}
        completedCount={completedCount}
        currentUser={currentUser}
        onOpenLogin={() => {
          setLoginModalKey(Date.now());
          setIsLoginOpen(true);
        }}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Top Sticky Header */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadCount={unreadNotificationsCount}
        pendingUsersCount={pendingUsersCount}
        onNavigateToUsers={() => setActiveTab('users')}
        currentUser={currentUser}
        onOpenLogin={() => {
          setLoginModalKey(Date.now());
          setIsLoginOpen(true);
        }}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Main View Body */}
      <main className="ml-0 lg:ml-[260px] flex-1 bg-slate-50 min-h-[calc(100vh-64px)] transition-all">
        {activeTab === 'pending-date' && isTabAllowed('pending-date') && (
          <PendingDateOrders
            orders={orders}
            setOrders={setOrders}
            stores={stores}
            operators={operators}
            searchQuery={searchQuery}
            currentUser={currentUser}
            onNavigateToOrderEntry={() => {
              if (isTabAllowed('order-entry')) {
                setActiveTab('order-entry');
              }
            }}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'pending-checkouts' && isTabAllowed('pending-checkouts') && (
          <PendingCheckouts
            orders={orders}
            setOrders={setOrders}
            stores={stores}
            operators={operators}
            searchQuery={searchQuery}
            currentUser={currentUser}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dashboard' && isTabAllowed('dashboard') && (
          <PlanningDashboard
            orders={orders}
            setOrders={setOrders}
            operators={operators}
            searchQuery={searchQuery}
            currentUser={currentUser}
            onOpenDevModal={() => setIsDevModalOpen(true)}
            onNavigateToOrderEntry={() => {
              if (isTabAllowed('order-entry')) {
                setActiveTab('order-entry');
              }
            }}
            onNavigateToPendingCheckouts={() => {
              if (isTabAllowed('pending-checkouts')) {
                setActiveTab('pending-checkouts');
              }
            }}
          />
        )}

        {activeTab === 'order-entry' && isTabAllowed('order-entry') && (
          <OrderEntry
            onAddOrdersToPlanning={handleAddOrdersToPlanning}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            onNavigateToPendingDate={() => setActiveTab('pending-date')}
            stores={stores}
            onNavigateToStores={() => setActiveTab('stores')}
            defaultSelectedStore={selectedStoreForOrder}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'raw-materials' && isTabAllowed('raw-materials') && (
          <RawMaterialRequests
            requests={materialRequests}
            currentUser={currentUser}
            onSaveRequest={handleSaveMaterialRequest}
            onDeleteRequest={handleDeleteMaterialRequest}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'productivity' && isTabAllowed('productivity') && (
          <DailyProductivity
            orders={orders}
            setOrders={setOrders}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'completed' && isTabAllowed('completed') && (
          <CompletedOrders
            orders={orders}
            setOrders={setOrders}
            searchQuery={searchQuery}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'statistics' && isTabAllowed('statistics') && (
          <StatisticsView
            orders={orders}
            setOrders={setOrders}
            operators={operators}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'stores' && isTabAllowed('stores') && (
          <StoreManagement
            stores={stores}
            setStores={setStores}
            onSelectStoreForOrder={(storeName) => {
              setSelectedStoreForOrder(storeName);
              if (isTabAllowed('order-entry')) {
                setActiveTab('order-entry');
              }
            }}
          />
        )}

        {activeTab === 'users' && isTabAllowed('users') && (
          <UserManagement
            currentUser={currentUser}
            onOpenLoginModal={() => setIsLoginOpen(true)}
            operators={operators}
            setOperators={setOperators}
          />
        )}

        {activeTab === 'labels' && isTabAllowed('labels') && (
          <LabelGenerator
            orders={orders}
            operators={operators}
            stores={stores}
            preselectedOrderId={selectedOrderForLabel}
            onClearPreselectedOrder={() => setSelectedOrderForLabel(null)}
          />
        )}

        {activeTab === 'expedition' && isTabAllowed('expedition') && (
          <ExpeditionScreen
            orders={orders}
            setOrders={setOrders}
            currentUser={currentUser}
            operators={operators}
            stores={stores}
          />
        )}

        {activeTab === 'reports' && isTabAllowed('reports') && (
          <ReportsPage
            orders={orders}
            setOrders={setOrders}
            stores={stores}
            operators={operators}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'history' && isTabAllowed('history') && (
          <ReplanningHistory
            orders={orders}
            setOrders={setOrders}
            onReintroduceItemToPlanning={handleReintroduceItemToPlanning}
            onReintroduceAllToPlanning={handleReintroduceAllToPlanning}
            searchQuery={searchQuery}
          />
        )}

        {/* Fallback Access Denied Notice if active tab is disallowed */}
        {!isTabAllowed(activeTab) && (
          <div className="p-12 flex flex-col items-center justify-center min-h-[70vh] text-center">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-lg shadow-rose-600/10">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Acesso Restrito ao Perfil</h2>
            <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
              O seu perfil de usuário (<strong>{currentUser?.role || 'Colaborador'}</strong>) não possui permissão para visualizar esta página. Entre em contato com um administrador de operações para solicitar liberação de acesso.
            </p>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Ir para o Painel Principal</span>
            </button>
          </div>
        )}
      </main>

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onResetData={handleResetAllData}
        currentUser={currentUser}
        onUpdateUser={(updated) => setCurrentUser(updated)}
        onSwitchUser={() => {
          setLoginModalKey(Date.now());
          setIsLoginOpen(true);
        }}
      />

      {/* Login / User Identification Modal */}
      <LoginModal
        key={loginModalKey}
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLoginUser}
        currentUser={currentUser}
        onOpenDevModal={() => setIsDevModalOpen(true)}
      />

      {/* Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={userNotifications}
        currentUser={currentUser}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearNotifications={handleClearAllNotifications}
        onDeleteNotification={handleDeleteNotification}
        onNotificationClick={handleNotificationClick}
      />

      {/* Developer Special Access Modal */}
      <DevAccessModal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
        onGrantDevAccess={handleGrantDevAccess}
      />
    </div>
  );
}

