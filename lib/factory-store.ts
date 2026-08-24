import { OrderItem, ProblemHistoryItem, ActivityLog, Store, AssemblyOperator, MaterialRequest } from '@/types/factory';

export const INITIAL_ORDERS: OrderItem[] = [];

export const INITIAL_PENDING_REPOSITIONS: OrderItem[] = [];

export const INITIAL_PROBLEM_HISTORY: ProblemHistoryItem[] = [];

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

export const INITIAL_STORES: Store[] = [];

export const INITIAL_MATERIAL_REQUESTS: MaterialRequest[] = [];

export const INITIAL_OPERATORS: AssemblyOperator[] = [
  {
    id: 'op-101',
    code: 'OP-101',
    name: 'Roberto Souza',
    role: 'Montador Especialista',
    specialty: 'Esquadrias de Alumínio & Linha Gold',
    shift: '1º Turno (07:00 - 17:00)',
    plant: 'Planta A - Matriz',
    phone: '(15) 99123-4567',
    status: 'Ativo',
    createdAt: '2026-01-15',
  },
  {
    id: 'op-102',
    code: 'OP-102',
    name: 'Marcos Paulo',
    role: 'Montador de Esquadrias',
    specialty: 'Portas de Giro e Integradas',
    shift: '1º Turno (07:00 - 17:00)',
    plant: 'Planta A - Matriz',
    phone: '(15) 99876-5432',
    status: 'Ativo',
    createdAt: '2026-02-01',
  },
  {
    id: 'op-103',
    code: 'OP-103',
    name: 'Lucas Ferreira',
    role: 'Operador de Corte e Montagem',
    specialty: 'Janelas Integradas & Fachadas',
    shift: '2º Turno (17:00 - 02:00)',
    plant: 'Setor de Alumínio & Corte',
    phone: '(15) 99345-6789',
    status: 'Ativo',
    createdAt: '2026-03-10',
  },
  {
    id: 'op-104',
    code: 'OP-104',
    name: 'Antonio Carlos',
    role: 'Montador de Vidros & Esquadrias',
    specialty: 'Vidro Temperado e Sacadas',
    shift: '1º Turno (07:00 - 17:00)',
    plant: 'Setor de Vidros & Montagem',
    phone: '(15) 99765-4321',
    status: 'Ativo',
    createdAt: '2026-04-05',
  },
];

