export type KanbanColumnId =
  | 'nao_planejado'
  | 'hoje'
  | 'amanha'
  | 'dia_3'
  | 'dia_4'
  | 'dia_5'
  | 'dia_6'
  | 'dia_7'
  | 'dia_8'
  | 'dia_9'
  | 'dia_10'
  | 'dia_11'
  | 'dia_12'
  | 'dia_13'
  | 'dia_14'
  | 'dia_15'
  | 'proximos_7_dias'
  | string;

export type PriorityLevel = 'ALTA PRIORIDADE' | 'NORMAL';

export type ExecutionStatus = 'pendente' | 'concluido' | 'parcial' | 'nao_produzido';

export interface AssemblyOperator {
  id: string;
  code: string;
  name: string;
  role: string;
  specialty: string;
  shift?: string;
  plant?: string;
  phone?: string;
  status: 'Ativo' | 'Inativo';
  createdAt?: string;
}

export interface UrgencyRequest {
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  requestReason: string;
  requestedAt: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  evaluatorNote?: string;
}

export interface OrderStatusHistoryLog {
  id: string;
  timestamp: string;
  author: string;
  status: ExecutionStatus | 'retornado_aguardando' | string;
  reason?: string;
  note?: string;
  previousDate?: string;
  actionType?: 'status_update' | 'reschedule' | 'return_to_pending';
  cleanlinessScore?: number; // 1 to 5
  organizationScore?: number; // 1 to 5
  disciplineScore?: number; // 1 to 5
}

export interface OrderItem {
  id: string;
  orderId: string;
  store: string;
  storeInitials: string;
  storeColorClass?: string;
  itemDescription: string;
  quantity: number;
  unit?: string;
  progress: number; // 0 - 100
  column: KanbanColumnId;
  productionDate?: string;
  deliveryDate?: string; // Data prevista de entrega
  priority?: PriorityLevel;
  executionStatus: ExecutionStatus;
  delayReason?: string;
  statusHistory?: OrderStatusHistoryLog[];
  isPendingReposition?: boolean; // For Re-planning screen
  pendingReason?: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  assignedOperatorCode?: string;
  cleanlinessScore?: number;
  organizationScore?: number;
  disciplineScore?: number;
  urgencyRequest?: UrgencyRequest;
}

export interface ProblemHistoryItem {
  id: string;
  date: string;
  store: string;
  itemOP: string;
  problem: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ActivityLog {
  id: string;
  title: string;
  store: string;
  itemsCount: string;
  timeAgo: string;
  status: 'SUCESSO' | 'ERRO' | 'PENDENTE';
}

export interface Store {
  id: string;
  name: string;
  code: string;
  city?: string;
  contactEmail?: string;
  phone?: string;
  status: 'Ativa' | 'Inativa';
}

export type ActiveTab = 'dashboard' | 'pending-date' | 'order-entry' | 'productivity' | 'completed' | 'statistics' | 'history' | 'stores' | 'users' | 'reports' | 'labels';

export type UserStatus = 'approved' | 'pending' | 'blocked';

export interface UserPermissions {
  canEditProduction: boolean;
  canCreateOrder: boolean;
  canManageStores: boolean;
  canManageUsers: boolean;
  canAccessOrderEntry?: boolean;
  canAccessPendingDate?: boolean;
  canAccessDashboard?: boolean;
  canAccessProductivity?: boolean;
  canAccessCompleted?: boolean;
  canAccessStatistics?: boolean;
  canAccessStores?: boolean;
  canAccessUsers?: boolean;
  canAccessHistory?: boolean;
  canAccessReports?: boolean;
  canAccessLabels?: boolean;
}

export interface UserProfile {
  id?: string;
  name: string;
  role: string;
  email?: string;
  plant?: string;
  status?: UserStatus;
  isAdmin?: boolean;
  permissions?: UserPermissions;
  createdAt?: string;
  password?: string;
}

export type NotificationType =
  | 'order_received'
  | 'production_date_set'
  | 'urgency_requested'
  | 'urgency_approved'
  | 'urgency_rejected'
  | 'order_completed'
  | 'user_pending'
  | 'system';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  type: NotificationType;
  read?: boolean;
  orderId?: string;
  storeName?: string;
  actor?: string;
}

