'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, UserPermissions, UserStatus, AssemblyOperator } from '@/types/factory';
import { INITIAL_OPERATORS } from '@/lib/factory-store';
import { TrindadeLogo } from './TrindadeLogo';
import { subscribeUsers, saveUserToFirestore, deleteUserFromFirestore, deleteOperatorFromFirestore, saveOperatorToFirestore } from '@/lib/firestoreSync';

interface UserManagementProps {
  currentUser?: UserProfile | null;
  onOpenLoginModal?: () => void;
  operators?: AssemblyOperator[];
  setOperators?: React.Dispatch<React.SetStateAction<AssemblyOperator[]>>;
}

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-dev-master',
    name: 'Desenvolvedor do Sistema',
    role: 'Desenvolvedor / SuperAdmin (DEV)',
    email: 'dev@trindadeesquadrias.com.br',
    plant: 'Acesso Global - Matriz & Filiais',
    status: 'approved',
    isAdmin: true,
    password: 'dev123',
    permissions: {
      canEditProduction: true,
      canCreateOrder: true,
      canManageStores: true,
      canManageUsers: true,
      canAccessOrderEntry: true,
      canAccessRawMaterials: true,
      canAccessPendingDate: true,
      canAccessPendingCheckouts: true,
      canAccessDashboard: true,
      canAccessCompleted: true,
      canAccessProductivity: true,
      canAccessStatistics: true,
      canAccessStores: true,
      canAccessUsers: true,
      canAccessLabels: true,
      canAccessReports: true,
      canAccessHistory: true,
    },
    createdAt: '2026-01-01',
  },
  {
    id: 'usr-1',
    name: 'Wilton Oliver',
    role: 'Gerente de Operações',
    email: 'wilton@trindadeesquadrias.com.br',
    plant: 'Planta A - Matriz',
    status: 'approved',
    isAdmin: true,
    password: 'admin123',
    permissions: {
      canEditProduction: true,
      canCreateOrder: true,
      canManageStores: true,
      canManageUsers: true,
      canAccessOrderEntry: true,
      canAccessRawMaterials: true,
      canAccessPendingDate: true,
      canAccessPendingCheckouts: true,
      canAccessDashboard: true,
      canAccessCompleted: true,
      canAccessProductivity: true,
      canAccessStatistics: true,
      canAccessStores: true,
      canAccessUsers: true,
      canAccessLabels: true,
      canAccessReports: true,
      canAccessHistory: true,
    },
    createdAt: '2026-01-10',
  },
  {
    id: 'usr-2',
    name: 'Julio D.',
    role: 'Analista Sênior de PCP',
    email: 'julio@trindadeesquadrias.com.br',
    plant: 'Planta A - Matriz',
    status: 'approved',
    isAdmin: false,
    password: 'julio123',
    permissions: {
      canEditProduction: true,
      canCreateOrder: true,
      canManageStores: true,
      canManageUsers: false,
      canAccessOrderEntry: true,
      canAccessRawMaterials: true,
      canAccessPendingDate: true,
      canAccessPendingCheckouts: true,
      canAccessDashboard: true,
      canAccessCompleted: true,
      canAccessProductivity: true,
      canAccessStatistics: true,
      canAccessStores: true,
      canAccessUsers: false,
      canAccessLabels: true,
      canAccessReports: true,
      canAccessHistory: true,
    },
    createdAt: '2026-02-15',
  },
  {
    id: 'usr-3',
    name: 'Carlos Eduardo',
    role: 'Supervisor de Produção',
    email: 'carlos@trindadeesquadrias.com.br',
    plant: 'Setor de Alumínio & Corte',
    status: 'approved',
    isAdmin: false,
    password: 'carlos123',
    permissions: {
      canEditProduction: true,
      canCreateOrder: false,
      canManageStores: false,
      canManageUsers: false,
      canAccessOrderEntry: false,
      canAccessPendingDate: true,
      canAccessPendingCheckouts: true,
      canAccessRawMaterials: true,
      canAccessDashboard: true,
      canAccessCompleted: true,
      canAccessProductivity: true,
      canAccessStatistics: true,
      canAccessStores: false,
      canAccessUsers: false,
      canAccessLabels: true,
      canAccessReports: true,
      canAccessHistory: true,
    },
    createdAt: '2026-03-01',
  },
  {
    id: 'usr-4',
    name: 'Fernando Costa',
    role: 'Lojista / Representante Comercial',
    email: 'fernando@lojaaluminiocosta.com.br',
    plant: 'Loja Parceira - Sorocaba',
    status: 'approved',
    isAdmin: false,
    password: 'fernando123',
    permissions: {
      canEditProduction: false,
      canCreateOrder: false,
      canManageStores: false,
      canManageUsers: false,
      canAccessOrderEntry: false,
      canAccessPendingDate: false,
      canAccessPendingCheckouts: false,
      canAccessRawMaterials: false,
      canAccessDashboard: true,
      canAccessCompleted: true,
      canAccessProductivity: true,
      canAccessStatistics: false,
      canAccessStores: false,
      canAccessUsers: false,
      canAccessReports: false,
      canAccessHistory: false,
    },
    createdAt: '2026-06-12',
  },
  {
    id: 'usr-5',
    name: 'Amanda Silva',
    role: 'Coordenadora de Qualidade',
    email: 'amanda@trindadeesquadrias.com.br',
    plant: 'Setor de Vidros & Montagem',
    status: 'pending',
    isAdmin: false,
    password: 'amanda123',
    permissions: {
      canEditProduction: false,
      canCreateOrder: false,
      canManageStores: false,
      canManageUsers: false,
      canAccessOrderEntry: false,
      canAccessPendingDate: true,
      canAccessPendingCheckouts: true,
      canAccessRawMaterials: true,
      canAccessDashboard: true,
      canAccessCompleted: true,
      canAccessProductivity: true,
      canAccessStatistics: true,
      canAccessStores: false,
      canAccessUsers: false,
      canAccessReports: true,
      canAccessHistory: false,
    },
    createdAt: '2026-07-20',
  },
];

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  operators = [],
  setOperators,
}) => {
  const [activeSectionTab, setActiveSectionTab] = useState<'users' | 'operators'>('users');

  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);

  const loadUsersFromStorage = () => {
    if (typeof window !== 'undefined') {
      const deletedIdsStr = localStorage.getItem('trindade_deleted_user_ids');
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      const saved = localStorage.getItem('trindade_users_list');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((u: UserProfile) => u.id && !deletedIds.includes(u.id));
            setUsers(
              filtered.map((u: UserProfile) => ({
                ...u,
                status: u.status || 'approved',
                permissions: u.permissions || {
                  canEditProduction: true,
                  canCreateOrder: true,
                  canManageStores: true,
                  canManageUsers: u.isAdmin || false,
                },
              }))
            );
            return;
          }
        } catch (e) {
          console.error('Failed to parse users from localStorage', e);
        }
      }
      setUsers(INITIAL_USERS.filter((u) => Boolean(u.id && !deletedIds.includes(u.id))));
    }
  };

  useEffect(() => {
    queueMicrotask(() => loadUsersFromStorage());

    const unsub = subscribeUsers((firestoreUsers) => {
      const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_user_ids') : null;
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];

      if (firestoreUsers && firestoreUsers.length > 0) {
        const filtered = firestoreUsers.filter((u) => u.id && !deletedIds.includes(u.id));
        setUsers(filtered);
        if (typeof window !== 'undefined') {
          localStorage.setItem('trindade_users_list', JSON.stringify(filtered));
        }
      }
    });

    window.addEventListener('storage', loadUsersFromStorage);
    window.addEventListener('trindade_users_updated', loadUsersFromStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', loadUsersFromStorage);
      window.removeEventListener('trindade_users_updated', loadUsersFromStorage);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'blocked'>('all');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  // Approval & Password Assignment Modal State
  const [approveModalUser, setApproveModalUser] = useState<UserProfile | null>(null);
  const [approvePassword, setApprovePassword] = useState('');
  const [approvePermissions, setApprovePermissions] = useState<UserPermissions>({
    canEditProduction: true,
    canCreateOrder: true,
    canManageStores: false,
    canManageUsers: false,
    canAccessOrderEntry: true,
    canAccessPendingDate: true,
    canAccessPendingCheckouts: true,
    canAccessRawMaterials: true,
    canAccessDashboard: true,
    canAccessCompleted: true,
    canAccessProductivity: true,
    canAccessStatistics: true,
    canAccessStores: true,
    canAccessUsers: false,
    canAccessReports: true,
    canAccessHistory: true,
  });

  // Email Dispatch Modal State
  const [emailDispatchUser, setEmailDispatchUser] = useState<UserProfile | null>(null);
  const [emailSentToast, setEmailSentToast] = useState<string | null>(null);

  // New User Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('DIRETORIA');
  const [newEmail, setNewEmail] = useState('');
  const [newPlant, setNewPlant] = useState('Planta A - Matriz');
  const [newStatus, setNewStatus] = useState<UserStatus>('approved');
  const [newPermissions, setNewPermissions] = useState<UserPermissions>({
    canEditProduction: true,
    canCreateOrder: true,
    canManageStores: true,
    canManageUsers: true,
    canAccessOrderEntry: true,
    canAccessPendingDate: true,
    canAccessPendingCheckouts: true,
    canAccessRawMaterials: true,
    canAccessDashboard: true,
    canAccessCompleted: true,
    canAccessProductivity: true,
    canAccessStatistics: true,
    canAccessStores: true,
    canAccessUsers: true,
    canAccessReports: true,
    canAccessHistory: true,
  });

  // Operator Management state / handlers
  const [operatorSearch, setOperatorSearch] = useState('');
  const [operatorSpecialtyFilter, setOperatorSpecialtyFilter] = useState<string>('all');
  const [operatorStatusFilter, setOperatorStatusFilter] = useState<'all' | 'Ativo' | 'Inativo'>('all');
  const [isOperatorModalOpen, setIsOperatorModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<AssemblyOperator | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<AssemblyOperator | null>(null);

  // Form fields for Operator Modal
  const [opCode, setOpCode] = useState('');
  const [opName, setOpName] = useState('');
  const [opRole, setOpRole] = useState('Montador Especialista de Esquadrias');
  const [opSpecialty, setOpSpecialty] = useState('Esquadrias de Alumínio & Linha Gold');
  const [opShift, setOpShift] = useState('1º Turno (07:00 - 17:00)');
  const [opPlant, setOpPlant] = useState('Planta A - Matriz');
  const [opPhone, setOpPhone] = useState('');
  const [opStatus, setOpStatus] = useState<'Ativo' | 'Inativo'>('Ativo');

  const openNewOperatorModal = () => {
    setEditingOperator(null);
    setOpCode(`OP-${100 + operators.length + 1}`);
    setOpName('');
    setOpRole('Montador Especialista de Esquadrias');
    setOpSpecialty('Esquadrias de Alumínio & Linha Gold');
    setOpShift('1º Turno (07:00 - 17:00)');
    setOpPlant('Planta A - Matriz');
    setOpPhone('');
    setOpStatus('Ativo');
    setIsOperatorModalOpen(true);
  };

  const openEditOperatorModal = (op: AssemblyOperator) => {
    setEditingOperator(op);
    setOpCode(op.code);
    setOpName(op.name);
    setOpRole(op.role);
    setOpSpecialty(op.specialty);
    setOpShift(op.shift || '1º Turno (07:00 - 17:00)');
    setOpPlant(op.plant || 'Planta A - Matriz');
    setOpPhone(op.phone || '');
    setOpStatus(op.status);
    setIsOperatorModalOpen(true);
  };

  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName.trim()) return;

    if (editingOperator) {
      const updatedOp: AssemblyOperator = {
        ...editingOperator,
        code: opCode,
        name: opName.trim(),
        role: opRole,
        specialty: opSpecialty,
        shift: opShift,
        plant: opPlant,
        phone: opPhone,
        status: opStatus,
      };
      const updated = operators.map((op) =>
        op.id === editingOperator.id ? updatedOp : op
      );
      if (setOperators) setOperators(updated);
      saveOperatorToFirestore(updatedOp).catch((err) => console.error('Erro ao salvar operador no Firestore:', err));
    } else {
      const newOp: AssemblyOperator = {
        id: `op-${Date.now()}`,
        code: opCode || `OP-${100 + operators.length + 1}`,
        name: opName.trim(),
        role: opRole,
        specialty: opSpecialty,
        shift: opShift,
        plant: opPlant,
        phone: opPhone,
        status: opStatus,
        createdAt: new Date().toISOString().split('T')[0],
      };
      if (setOperators) setOperators([...operators, newOp]);
      saveOperatorToFirestore(newOp).catch((err) => console.error('Erro ao salvar novo operador no Firestore:', err));
    }
    setIsOperatorModalOpen(false);
  };

  const handleToggleOperatorStatus = (opId: string) => {
    const target = operators.find((op) => op.id === opId);
    if (!target) return;
    const updatedOp: AssemblyOperator = {
      ...target,
      status: target.status === 'Ativo' ? ('Inativo' as const) : ('Ativo' as const),
    };
    const updated = operators.map((op) => (op.id === opId ? updatedOp : op));
    if (setOperators) setOperators(updated);
    saveOperatorToFirestore(updatedOp).catch((err) => console.error('Erro ao alternar status do operador:', err));
  };

  const handleDeleteOperator = (opId: string) => {
    if (typeof window !== 'undefined') {
      const deletedIdsStr = localStorage.getItem('trindade_deleted_operator_ids');
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      if (!deletedIds.includes(opId)) {
        deletedIds.push(opId);
        localStorage.setItem('trindade_deleted_operator_ids', JSON.stringify(deletedIds));
      }
    }
    deleteOperatorFromFirestore(opId).catch((err) => console.error('Erro ao excluir operador do Firestore:', err));
    const updated = operators.filter((op) => op.id !== opId);
    if (setOperators) setOperators(updated);
    setOperatorToDelete(null);
  };

  // Save to localStorage when users list updates
  const updateUsersList = (newUsers: UserProfile[]) => {
    const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_user_ids') : null;
    const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
    const filtered = newUsers.filter((u) => u.id && !deletedIds.includes(u.id));

    setUsers(filtered);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trindade_users_list', JSON.stringify(filtered));
      window.dispatchEvent(new Event('trindade_users_updated'));
    }

    filtered.forEach((u) => {
      saveUserToFirestore(u).catch(() => {});
    });
  };

  const openApproveModal = (user: UserProfile) => {
    setApproveModalUser(user);
    // Use user password or generate default
    const existingPwd = user.password && user.password.trim() ? user.password : `${user.name.split(' ')[0].toLowerCase()}2026`;
    setApprovePassword(existingPwd);
    setApprovePermissions(
      user.permissions || {
        canEditProduction: true,
        canCreateOrder: true,
        canManageStores: false,
        canManageUsers: false,
        canAccessOrderEntry: true,
        canAccessPendingDate: true,
        canAccessPendingCheckouts: true,
        canAccessRawMaterials: true,
        canAccessDashboard: true,
        canAccessProductivity: true,
        canAccessStores: true,
        canAccessUsers: false,
        canAccessReports: true,
        canAccessHistory: true,
      }
    );
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pass = 'trindade-';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApprovePassword(pass);
  };

  const handleSaveApprovalAndSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveModalUser) return;

    const updatedUser: UserProfile = {
      ...approveModalUser,
      status: 'approved',
      password: approvePassword.trim() || 'trindade2026',
      permissions: approvePermissions,
    };

    const updated = users.map((u) => (u.id === approveModalUser.id ? updatedUser : u));
    updateUsersList(updated);

    // Close approve modal and open email dispatch modal
    setApproveModalUser(null);
    setEmailDispatchUser(updatedUser);
  };

  const handleSimulateSendEmail = (user: UserProfile) => {
    setEmailSentToast(`E-mail com a senha enviado com sucesso para ${user.email}!`);
    setTimeout(() => {
      setEmailSentToast(null);
      setEmailDispatchUser(null);
    }, 3000);
  };

  const getEmailContent = (user: UserProfile) => {
    const subject = encodeURIComponent('Sua Senha de Acesso ao Sistema - Trindade Esquadrias');
    const bodyText = `Olá ${user.name},\n\nSeu cadastro no Sistema de Gestão Industrial & PCP da Trindade Esquadrias foi APROVADO pelo Administrador.\n\nSua senha de acesso fixa:\n🔑 Senha: ${user.password}\n\nPara acessar:\n1. Acesse a plataforma;\n2. Selecione seu perfil na tela inicial;\n3. Digite sua senha acima.\n\nAtenciosamente,\nGestão Industrial - Trindade Esquadrias`;
    return { subject, bodyText, fullText: bodyText };
  };

  const handleOpenMailto = (user: UserProfile) => {
    const { subject, bodyText } = getEmailContent(user);
    const mailtoUrl = `mailto:${user.email}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleCopyPasswordInfo = (user: UserProfile) => {
    const { fullText } = getEmailContent(user);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      setEmailSentToast('Instruções e senha copiadas para a área de transferência!');
      setTimeout(() => setEmailSentToast(null), 3000);
    }
  };

  const handleStatusChange = (userId: string, status: UserStatus) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, status };
      }
      return u;
    });
    updateUsersList(updated);
  };

  const handleTogglePermission = (userId: string, permKey: keyof UserPermissions) => {
    const updated = users.map((u) => {
      if (u.id === userId) {
        const currentPerms = u.permissions || {
          canEditProduction: true,
          canCreateOrder: true,
          canManageStores: true,
          canManageUsers: false,
        };
        return {
          ...u,
          permissions: {
            ...currentPerms,
            [permKey]: !currentPerms[permKey],
          },
        };
      }
      return u;
    });
    updateUsersList(updated);
  };

  const handleApproveAllPending = () => {
    const updated = users.map((u) => {
      if (u.status === 'pending') {
        return {
          ...u,
          status: 'approved' as UserStatus,
          permissions: u.permissions || {
            canEditProduction: true,
            canCreateOrder: true,
            canManageStores: false,
            canManageUsers: false,
          },
        };
      }
      return u;
    });
    updateUsersList(updated);
  };

  const handleDeleteUser = () => {
    if (!userToDelete || !userToDelete.id) return;
    const deletedId = userToDelete.id;

    if (typeof window !== 'undefined') {
      const deletedIdsStr = localStorage.getItem('trindade_deleted_user_ids');
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      if (!deletedIds.includes(deletedId)) {
        deletedIds.push(deletedId);
        localStorage.setItem('trindade_deleted_user_ids', JSON.stringify(deletedIds));
      }
    }

    deleteUserFromFirestore(deletedId).catch((err) => console.error('Error deleting user from Firestore:', err));

    const updated = users.filter((u) => u.id !== deletedId);
    updateUsersList(updated);
    setUserToDelete(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name: newName.trim(),
      role: newRole,
      email: newEmail.trim() || `${newName.toLowerCase().replace(/\s+/g, '.')}@trindadeesquadrias.com.br`,
      plant: newPlant,
      status: newStatus,
      isAdmin: newPermissions.canManageUsers,
      permissions: newPermissions,
      createdAt: new Date().toISOString().split('T')[0],
    };

    updateUsersList([newUser, ...users]);
    setIsAddModalOpen(false);
    
    // Reset form
    setNewName('');
    setNewRole('DIRETORIA');
    setNewEmail('');
    setNewPlant('Planta A - Matriz');
    setNewStatus('approved');
    setNewPermissions({
      canEditProduction: true,
      canCreateOrder: true,
      canManageStores: true,
      canManageUsers: true,
      canAccessOrderEntry: true,
      canAccessPendingDate: true,
      canAccessPendingCheckouts: true,
      canAccessRawMaterials: true,
      canAccessDashboard: true,
      canAccessProductivity: true,
      canAccessStatistics: true,
      canAccessStores: true,
      canAccessUsers: true,
      canAccessReports: true,
      canAccessHistory: true,
    });
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.plant && u.plant.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtered Operators
  const filteredOperators = operators.filter((op) => {
    const matchesSearch =
      op.name.toLowerCase().includes(operatorSearch.toLowerCase()) ||
      op.code.toLowerCase().includes(operatorSearch.toLowerCase()) ||
      op.specialty.toLowerCase().includes(operatorSearch.toLowerCase()) ||
      op.role.toLowerCase().includes(operatorSearch.toLowerCase());

    const matchesSpecialty =
      operatorSpecialtyFilter === 'all' || op.specialty.toLowerCase().includes(operatorSpecialtyFilter.toLowerCase());

    const matchesStatus = operatorStatusFilter === 'all' || op.status === operatorStatusFilter;

    return matchesSearch && matchesSpecialty && matchesStatus;
  });

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const approvedCount = users.filter((u) => u.status === 'approved' || !u.status).length;
  const blockedCount = users.filter((u) => u.status === 'blocked').length;

  const getInitial = (nameStr: string) => {
    return nameStr.trim().charAt(0).toUpperCase() || 'U';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-20">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-full text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">
                {activeSectionTab === 'users' ? 'admin_panel_settings' : 'engineering'}
              </span>
              <span>
                {activeSectionTab === 'users' ? 'Administração & Controle de Acesso' : 'Gestão de Montadores & Operadores'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              {activeSectionTab === 'users'
                ? 'Validação & Permissões de Usuários'
                : 'Funcionários Aptos para Montagem de Peças'}
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              {activeSectionTab === 'users'
                ? 'Todos os colaboradores acessam a mesma base unificada de produção da Trindade Esquadrias. Gerencie quem pode alterar a produção, inserir novos pedidos ou cadastrar lojas.'
                : 'Cadastre e gerencie a equipe de operadores e montadores aptos para montagem de esquadrias de alumínio, portas integradas, vidros e fachadas na fábrica.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {activeSectionTab === 'users' ? (
              <>
                {pendingCount > 0 && (
                  <button
                    onClick={handleApproveAllPending}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Aprovar Todos ({pendingCount})</span>
                  </button>
                )}

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  <span>Cadastrar Novo Usuário</span>
                </button>
              </>
            ) : (
              <button
                onClick={openNewOperatorModal}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Cadastrar Novo Montador</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics Bar */}
        {activeSectionTab === 'users' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Colaboradores</p>
              <p className="text-2xl font-black text-white mt-1">{users.length}</p>
            </div>

            <div className="bg-amber-950/30 p-3.5 rounded-2xl border border-amber-500/30">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Aguardando Validação</span>
              </p>
              <p className="text-2xl font-black text-amber-300 mt-1">{pendingCount}</p>
            </div>

            <div className="bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-500/30">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Acessos Aprovados</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">{approvedCount}</p>
            </div>

            <div className="bg-rose-950/30 p-3.5 rounded-2xl border border-rose-500/30">
              <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Acessos Bloqueados</p>
              <p className="text-2xl font-black text-rose-300 mt-1">{blockedCount}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Montadores</p>
              <p className="text-2xl font-black text-white mt-1">{operators.length}</p>
            </div>

            <div className="bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-500/30">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Montadores Ativos</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">
                {operators.filter((op) => op.status === 'Ativo').length}
              </p>
            </div>

            <div className="bg-blue-950/30 p-3.5 rounded-2xl border border-blue-500/30">
              <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Turnos Ativos</p>
              <p className="text-2xl font-black text-blue-300 mt-1">2 Turnos</p>
            </div>

            <div className="bg-purple-950/30 p-3.5 rounded-2xl border border-purple-500/30">
              <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Especialidades</p>
              <p className="text-2xl font-black text-purple-300 mt-1">5 Áreas</p>
            </div>
          </div>
        )}
      </div>

      {/* Section Navigation Tabs: Platform Users vs Assembly Operators */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveSectionTab('users')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSectionTab === 'users'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
          <span>Usuários & Permissões da Plataforma ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSectionTab('operators')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSectionTab === 'operators'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">engineering</span>
          <span>Funcionários Aptos p/ Montagem ({operators.length})</span>
        </button>
      </div>

      {activeSectionTab === 'users' && (
        <div className="space-y-6">
          {/* Toolbar: Search & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, e-mail, cargo ou setor..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos ({users.length})
              </button>
              
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-amber-600 hover:text-amber-700'
                }`}
              >
                <span>Pendentes</span>
                {pendingCount > 0 && (
                  <span className="bg-amber-950/20 px-1.5 py-0.2 rounded-full text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-800'
                }`}
              >
                Aprovados
              </button>

              <button
                onClick={() => setStatusFilter('blocked')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'blocked'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 hover:text-rose-700'
                }`}
              >
                Bloqueados
              </button>
            </div>
          </div>

      {/* Users List Cards */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
              group_off
            </span>
            <h3 className="text-sm font-bold text-slate-700">Nenhum usuário encontrado</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tente redefinir a busca ou mudar o filtro de status.
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const initial = getInitial(user.name);
            const isSelf = currentUser?.email === user.email || currentUser?.name === user.name;
            const perms = user.permissions || {
              canEditProduction: true,
              canCreateOrder: true,
              canManageStores: true,
              canManageUsers: user.isAdmin || false,
            };

            return (
              <div
                key={user.id || user.name}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  
                  {/* User Profile Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md shrink-0">
                      {initial}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900">{user.name}</h3>
                        
                        {isSelf && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                            Você (Conectado)
                          </span>
                        )}

                        {user.isAdmin && (
                          <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">security</span>
                            <span>Administrador</span>
                          </span>
                        )}

                        {/* Status Chip */}
                        {user.status === 'pending' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 animate-pulse">
                            <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
                            <span>Aguardando Validação</span>
                          </span>
                        )}

                        {(user.status === 'approved' || !user.status) && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            <span>Acesso Aprovado</span>
                          </span>
                        )}

                        {user.status === 'blocked' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">block</span>
                            <span>Acesso Bloqueado</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-600">{user.role}</p>
                      
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 flex-wrap">
                        {user.email && (
                          <span className="flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">mail</span>
                            <span>{user.email}</span>
                          </span>
                        )}
                        {user.plant && (
                          <span className="flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-[14px] text-slate-400">factory</span>
                            <span>{user.plant}</span>
                          </span>
                        )}
                        {user.password && (
                          <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            <span className="material-symbols-outlined text-[14px] text-amber-600">key</span>
                            <span>Senha: {user.password}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Toggle & Approval Actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 shrink-0">
                    {user.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => openApproveModal(user)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer animate-bounce"
                      >
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                        <span>Aprovar & Definir Senha</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openApproveModal(user)}
                        title="Gerenciar senha e permissões"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
                      >
                        <span className="material-symbols-outlined text-[16px] text-amber-600">key</span>
                        <span>Senha & E-mail</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStatusChange(user.id || user.name, 'approved')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        user.status === 'approved' || !user.status
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Aprovado</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(user.id || user.name, 'blocked')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        user.status === 'blocked'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      <span>Bloquear</span>
                    </button>

                    {/* Delete User Button */}
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete(user)}
                        title="Excluir Usuário"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors ml-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Granular Permissions Section */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-4">
                  
                  {/* Section A: Page Navigation Accesses */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-blue-600">tab</span>
                        <span>Acesso às Páginas do Sistema (Menu Lateral):</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Define quais telas ficam visíveis
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      
                      {/* Page: Entrada de Pedidos */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessOrderEntry')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessOrderEntry !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">assignment</span>
                          <span className="text-xs font-bold truncate">Entrada de Pedidos</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessOrderEntry !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessOrderEntry !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Matéria-Prima & Compras */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessRawMaterials')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessRawMaterials !== false
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                          <span className="text-xs font-bold truncate">Matéria-Prima & Compras</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessRawMaterials !== false ? 'bg-amber-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessRawMaterials !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Aguardando Data */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessPendingDate')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessPendingDate !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">pending_actions</span>
                          <span className="text-xs font-bold truncate">Aguardando Data</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessPendingDate !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessPendingDate !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Baixas Pendentes */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessPendingCheckouts')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessPendingCheckouts !== false
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">history_toggle_off</span>
                          <span className="text-xs font-bold truncate">Baixas Pendentes</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessPendingCheckouts !== false ? 'bg-amber-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessPendingCheckouts !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Painel de Planejamento */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessDashboard')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessDashboard !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">dashboard</span>
                          <span className="text-xs font-bold truncate">Painel de Planejamento</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessDashboard !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessDashboard !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Pedidos Concluídos */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessCompleted')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessCompleted !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">verified</span>
                          <span className="text-xs font-bold truncate">Pedidos Concluídos</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessCompleted !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessCompleted !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Produtividade Diária */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessProductivity')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessProductivity !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">trending_up</span>
                          <span className="text-xs font-bold truncate">Produtividade Diária</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessProductivity !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessProductivity !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Estatísticas & Montadores */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessStatistics')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessStatistics !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">analytics</span>
                          <span className="text-xs font-bold truncate">Estatísticas & Montadores</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessStatistics !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessStatistics !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Cadastro de Lojas */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessStores')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessStores !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">store</span>
                          <span className="text-xs font-bold truncate">Cadastro de Lojas</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessStores !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessStores !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Gestão de Usuários */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessUsers')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessUsers !== false
                            ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                          <span className="text-xs font-bold truncate">Gestão de Usuários</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessUsers !== false ? 'bg-purple-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessUsers !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Etiquetas Zebra ZD220 */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessLabels')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessLabels !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                          <span className="text-xs font-bold truncate">Etiquetas Zebra ZD220</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessLabels !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessLabels !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Expedição & Baixa */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessExpedition')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessExpedition !== false
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                          <span className="text-xs font-bold truncate">Expedição & Baixa</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessExpedition !== false ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessExpedition !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Relatórios & Impressão */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessReports')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessReports !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">print</span>
                          <span className="text-xs font-bold truncate">Relatórios & Impressão</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessReports !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessReports !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Page: Replanejamento & Histórico */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canAccessHistory')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canAccessHistory !== false
                            ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">history</span>
                          <span className="text-xs font-bold truncate">Re-planejamento & Histórico</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canAccessHistory !== false ? 'bg-blue-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canAccessHistory !== false ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Section B: Operational Functional Permissions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">admin_panel_settings</span>
                        <span>Ações e Alterações no Sistema:</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      
                      {/* Action 1: Alterar Produção */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canEditProduction')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canEditProduction
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">engineering</span>
                          <span className="text-xs font-bold truncate">Alterar Produção</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canEditProduction ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canEditProduction ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action 2: Inserir Pedidos */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canCreateOrder')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canCreateOrder
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">note_add</span>
                          <span className="text-xs font-bold truncate">Inserir Novas OPs</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canCreateOrder ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canCreateOrder ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action 3: Gerenciar Lojas */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canManageStores')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canManageStores
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">store</span>
                          <span className="text-xs font-bold truncate">Cadastrar Lojas</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canManageStores ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canManageStores ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action 4: Administrar Usuários */}
                      <div
                        onClick={() => user.id && handleTogglePermission(user.id, 'canManageUsers')}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                          perms.canManageUsers
                            ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                            : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                          <span className="text-xs font-bold truncate">Admin de Usuários</span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors relative shrink-0 p-0.5 ${
                            perms.canManageUsers ? 'bg-purple-600' : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${
                              perms.canManageUsers ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  )}

      {/* Operators Section */}
      {activeSectionTab === 'operators' && (
        <div className="space-y-6">
          {/* Operator Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={operatorSearch}
                onChange={(e) => setOperatorSearch(e.target.value)}
                placeholder="Buscar por nome, código (OP-101) ou especialidade..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>

            {/* Filters and Add button */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={operatorSpecialtyFilter}
                onChange={(e) => setOperatorSpecialtyFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Todas Especialidades</option>
                <option value="Alumínio">Linha Alumínio & Gold</option>
                <option value="Integradas">Portas Integradas</option>
                <option value="Vidro">Vidro & Sacadas</option>
                <option value="Fachada">Fachada Structural Glazing</option>
              </select>

              <select
                value={operatorStatusFilter}
                onChange={(e) => setOperatorStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="Ativo">Ativos ({operators.filter((op) => op.status === 'Ativo').length})</option>
                <option value="Inativo">Inativos ({operators.filter((op) => op.status === 'Inativo').length})</option>
              </select>

              <button
                type="button"
                onClick={openNewOperatorModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer ml-auto"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>+ Cadastrar Novo Montador</span>
              </button>
            </div>
          </div>

          {/* Operators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOperators.length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
                <span className="material-symbols-outlined text-[48px] text-slate-300">engineering</span>
                <h3 className="font-bold text-slate-700 text-sm">Nenhum montador encontrado</h3>
                <p className="text-xs text-slate-400">Tente ajustar a busca ou filtros, ou cadastre um novo funcionário.</p>
              </div>
            ) : (
              filteredOperators.map((op) => (
                <div
                  key={op.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                          {op.code}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 leading-tight">{op.name}</h3>
                          <p className="text-xs text-slate-500 font-medium">{op.role}</p>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                          op.status === 'Ativo'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {op.status}
                      </span>
                    </div>

                    {/* Specialty pill */}
                    <div className="bg-blue-50/80 border border-blue-100 p-2.5 rounded-xl space-y-1">
                      <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider block">
                        Especialidade Principal
                      </span>
                      <p className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-blue-600">verified</span>
                        <span>{op.specialty}</span>
                      </p>
                    </div>

                    {/* Details: Turno, Planta, Contato */}
                    <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Turno:</span>
                        <span className="font-semibold text-slate-800">{op.shift || '1º Turno'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Unidade:</span>
                        <span className="font-semibold text-slate-800">{op.plant || 'Matriz'}</span>
                      </div>
                      {op.phone && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Contato:</span>
                          <span className="font-semibold text-slate-800">{op.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOperatorStatus(op.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        op.status === 'Ativo'
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {op.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditOperatorModal(op)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                        title="Editar cadastro"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOperatorToDelete(op)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Excluir montador"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Operator */}
      {isOperatorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 animate-scaleUp space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">engineering</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {editingOperator ? 'Editar Cadastro do Montador' : 'Cadastrar Novo Montador de Esquadria'}
                  </h3>
                  <p className="text-xs text-slate-500">Insira as informações do operador apto para montagem de peças</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOperatorModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveOperator} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código de Registro</label>
                  <input
                    type="text"
                    required
                    value={opCode}
                    onChange={(e) => setOpCode(e.target.value)}
                    placeholder="Ex: OP-105"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={opStatus}
                    onChange={(e) => setOpStatus(e.target.value as 'Ativo' | 'Inativo')}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 font-bold"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo do Montador</label>
                <input
                  type="text"
                  required
                  value={opName}
                  onChange={(e) => setOpName(e.target.value)}
                  placeholder="Ex: Roberto Carlos Silva"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cargo / Função</label>
                  <input
                    type="text"
                    required
                    value={opRole}
                    onChange={(e) => setOpRole(e.target.value)}
                    placeholder="Ex: Montador Especialista"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={opPhone}
                    onChange={(e) => setOpPhone(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Especialidade Principal</label>
                <select
                  value={opSpecialty}
                  onChange={(e) => setOpSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                >
                  <option value="Esquadrias de Alumínio & Linha Gold">Esquadrias de Alumínio & Linha Gold</option>
                  <option value="Portas Integradas & Automação">Portas Integradas & Automação</option>
                  <option value="Vidro Temperado & Sacadas">Vidro Temperado & Sacadas</option>
                  <option value="Fachada Structural Glazing / Pele de Vidro">Fachada Structural Glazing / Pele de Vidro</option>
                  <option value="Corte, Usinagem & Pré-Montagem">Corte, Usinagem & Pré-Montagem</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Turno de Trabalho</label>
                  <select
                    value={opShift}
                    onChange={(e) => setOpShift(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1º Turno (07:00 - 17:00)">1º Turno (07:00 - 17:00)</option>
                    <option value="2º Turno (17:00 - 02:00)">2º Turno (17:00 - 02:00)</option>
                    <option value="Horário Comercial (08:00 - 18:00)">Horário Comercial (08:00 - 18:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Setor / Planta</label>
                  <select
                    value={opPlant}
                    onChange={(e) => setOpPlant(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Planta A - Matriz">Planta A - Matriz</option>
                    <option value="Setor de Alumínio & Corte">Setor de Alumínio & Corte</option>
                    <option value="Setor de Vidros & Linha Integrada">Setor de Vidros & Linha Integrada</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOperatorModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  {editingOperator ? 'Salvar Alterações' : 'Cadastrar Montador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Operator Confirmation Modal */}
      {operatorToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-scaleUp text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Excluir Montador?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Tem certeza que deseja remover o funcionário <strong className="text-slate-900">{operatorToDelete.name}</strong> ({operatorToDelete.code}) do cadastro de montadores?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOperatorToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer w-full"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteOperator(operatorToDelete.id)}
                className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs cursor-pointer w-full flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
              <span className="material-symbols-outlined text-3xl">person_remove</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Excluir Usuário?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tem certeza que deseja remover <strong>{userToDelete.name}</strong> ({userToDelete.role}) do sistema?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New User */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 text-left space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">person_add</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Novo Colaborador</h3>
                  <p className="text-xs text-slate-400">Cadastrar usuário e definir suas permissões</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Marcus Vinicius"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cargo / Função</label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const role = e.target.value;
                      setNewRole(role);
                      if (role === 'DIRETORIA' || role === 'EXPEDIÇÃO' || role === 'GERENTE DE OPERAÇÕES') {
                        setNewPermissions({
                          canEditProduction: true,
                          canCreateOrder: true,
                          canManageStores: true,
                          canManageUsers: true,
                          canAccessOrderEntry: true,
                          canAccessPendingDate: true,
                          canAccessPendingCheckouts: true,
                          canAccessRawMaterials: true,
                          canAccessDashboard: true,
                          canAccessCompleted: true,
                          canAccessProductivity: true,
                          canAccessStatistics: true,
                          canAccessStores: true,
                          canAccessUsers: true,
                          canAccessLabels: true,
                          canAccessReports: true,
                          canAccessHistory: true,
                        });
                      } else if (role === 'VENDAS' || role === 'Lojista / Representante Comercial') {
                        setNewPermissions({
                          canEditProduction: false,
                          canCreateOrder: true,
                          canManageStores: false,
                          canManageUsers: false,
                          canAccessOrderEntry: true,
                          canAccessPendingDate: false,
                          canAccessPendingCheckouts: false,
                          canAccessRawMaterials: false,
                          canAccessDashboard: true,
                          canAccessCompleted: true,
                          canAccessProductivity: true,
                          canAccessStatistics: false,
                          canAccessStores: false,
                          canAccessUsers: false,
                          canAccessLabels: false,
                          canAccessReports: false,
                          canAccessHistory: false,
                        });
                      } else if (role === 'OPERADOR INDUSTRIAL' || role === 'SUPERVISOR DE PRODUÇÃO' || role === 'ANALISTA DE PCP') {
                        setNewPermissions({
                          canEditProduction: true,
                          canCreateOrder: true,
                          canManageStores: false,
                          canManageUsers: false,
                          canAccessOrderEntry: true,
                          canAccessPendingDate: true,
                          canAccessPendingCheckouts: true,
                          canAccessRawMaterials: true,
                          canAccessDashboard: true,
                          canAccessCompleted: true,
                          canAccessProductivity: true,
                          canAccessStatistics: true,
                          canAccessStores: false,
                          canAccessUsers: false,
                          canAccessLabels: true,
                          canAccessReports: true,
                          canAccessHistory: true,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="DIRETORIA">DIRETORIA</option>
                    <option value="EXPEDIÇÃO">EXPEDIÇÃO</option>
                    <option value="GERENTE DE OPERAÇÕES">GERENTE DE OPERAÇÕES</option>
                    <option value="SUPERVISOR DE PRODUÇÃO">SUPERVISOR DE PRODUÇÃO</option>
                    <option value="ANALISTA DE PCP">ANALISTA DE PCP</option>
                    <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                    <option value="VENDAS">VENDAS</option>
                    <option value="OPERADOR INDUSTRIAL">OPERADOR INDUSTRIAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status de Acesso</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="approved">Aprovado Diretamente</option>
                    <option value="pending">Aguardando Validação</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Corporativo</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Ex: marcus@trindadeesquadrias.com.br"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Initial Permissions Selection */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2">Páginas Acessíveis:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessOrderEntry !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessOrderEntry: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Entrada Pedidos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessPendingDate !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessPendingDate: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Aguardando Data</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessPendingCheckouts !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessPendingCheckouts: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Baixas Pendentes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-indigo-700 font-semibold">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessRawMaterials !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessRawMaterials: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Matéria-Prima & Compras</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessDashboard !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessDashboard: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Planejamento</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessCompleted !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessCompleted: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pedidos Concluídos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessProductivity !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessProductivity: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Produtividade</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessStatistics !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessStatistics: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Estatísticas & Montadores</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessStores !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessStores: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Lojas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessReports !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessReports: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Relatórios & Impressão</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessLabels !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessLabels: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Etiquetas Zebra ZD220</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessHistory !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessHistory: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Re-planejamento</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-purple-800 font-bold">
                    <input
                      type="checkbox"
                      checked={newPermissions.canAccessUsers !== false}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canAccessUsers: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Gestão Usuários</span>
                  </label>
                </div>

                <label className="block text-xs font-bold text-slate-700 mb-2">Ações Operacionais:</label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.canEditProduction}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canEditProduction: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pode alterar produção (status, progresso e OPs)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.canCreateOrder}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canCreateOrder: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pode cadastrar novos pedidos na fábrica</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.canManageStores}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canManageStores: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pode cadastrar e gerenciar lojas parceiras</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPermissions.canManageUsers}
                      onChange={(e) => setNewPermissions({ ...newPermissions, canManageUsers: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Possui privilégios de Administrador de Usuários</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Aprovar & Definir Senha Fixa */}
      {approveModalUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 text-left space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">verified_user</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Aprovar & Definir Permissões</h3>
                  <p className="text-xs text-slate-500">
                    Defina as permissões e crie uma senha fixa de acesso para <strong className="text-slate-900">{approveModalUser.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApproveModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveApprovalAndSetPassword} className="space-y-4">
              {/* Profile summary banner */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">{approveModalUser.name}</p>
                  <p className="text-slate-500">{approveModalUser.role} • {approveModalUser.plant || 'Planta A'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block">E-mail de Envio:</span>
                  <span className="font-bold text-emerald-700">{approveModalUser.email}</span>
                </div>
              </div>

              {/* Password Assignment Box */}
              <div className="space-y-1.5 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-600 text-base">key</span>
                    <span>Criar Senha Fixa do Usuário *</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-[11px] text-amber-800 hover:text-amber-900 font-bold underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">casino</span>
                    <span>Gerar Senha Aleatória</span>
                  </button>
                </label>
                <p className="text-[11px] text-slate-600">
                  A senha será armazenada diretamente no código/estado do sistema.
                </p>
                <input
                  type="text"
                  required
                  value={approvePassword}
                  onChange={(e) => setApprovePassword(e.target.value)}
                  placeholder="Ex: wilton2026 ou 123456"
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Permissões de Acesso */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">Permissões de Telas e Ações:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessOrderEntry !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessOrderEntry: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Entrada Pedidos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessPendingDate !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessPendingDate: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Aguardando Data</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessPendingCheckouts !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessPendingCheckouts: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Baixas Pendentes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-indigo-700 font-semibold">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessRawMaterials !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessRawMaterials: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Matéria-Prima & Compras</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessDashboard !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessDashboard: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Planejamento</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessCompleted !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessCompleted: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Pedidos Concluídos</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessProductivity !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessProductivity: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Produtividade</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessStatistics !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessStatistics: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Estatísticas & Montadores</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessStores !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessStores: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Lojas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessReports !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessReports: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Relatórios & Impressão</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessLabels !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessLabels: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Etiquetas Zebra ZD220</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canAccessHistory !== false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canAccessHistory: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Re-planejamento</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-800">
                    <input
                      type="checkbox"
                      checked={approvePermissions.canManageUsers || false}
                      onChange={(e) => setApprovePermissions({ ...approvePermissions, canManageUsers: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Administrador</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setApproveModalUser(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Salvar e Aprovar Acesso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Resumo de Acesso Criado (Para o Adm enviar por fora) */}
      {emailDispatchUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 text-left space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Acesso Aprovado com Sucesso</h3>
                  <p className="text-xs text-slate-500">
                    O usuário <strong className="text-slate-900">{emailDispatchUser.name}</strong> foi liberado no sistema
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEmailDispatchUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Warning Banner */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <span className="material-symbols-outlined text-base">info</span>
                <span>Envio Independente da Senha:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-950">
                A plataforma salvou a senha no sistema. Copie os dados abaixo e envie a senha para o colaborador de maneira independente (e-mail corporativo, WhatsApp ou mensagem externa).
              </p>
            </div>

            {/* Password Credentials Box */}
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-xs font-sans space-y-3 text-slate-200 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                <span className="text-slate-400">Usuário:</span>
                <span className="font-bold text-white">{emailDispatchUser.name}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                <span className="text-slate-400">E-mail Cadastrado:</span>
                <span className="font-bold text-emerald-400">{emailDispatchUser.email}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-center my-2">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Senha Fixa Definida:</span>
                <span className="text-emerald-400 text-xl font-mono font-bold select-all">{emailDispatchUser.password}</span>
              </div>
            </div>

            {/* Toast notification if copied */}
            {emailSentToast && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
                <span>{emailSentToast}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleCopyPasswordInfo(emailDispatchUser)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                <span>Copiar Mensagem e Senha para Área de Transferência</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenMailto(emailDispatchUser)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  <span>Abrir E-mail Externo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmailDispatchUser(null)}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                  <span>Concluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
