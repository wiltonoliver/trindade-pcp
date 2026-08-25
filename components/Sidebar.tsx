'use client';

import React from 'react';
import { ActiveTab, UserProfile, UserPermissions } from '@/types/factory';
import { TrindadeLogo } from './TrindadeLogo';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount?: number;
  pendingDateCount?: number;
  pendingCheckoutsCount?: number;
  pendingRawMaterialsCount?: number;
  pendingUsersCount?: number;
  completedCount?: number;
  currentUser?: UserProfile | null;
  onOpenLogin?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount = 0,
  pendingDateCount = 0,
  pendingCheckoutsCount = 0,
  pendingRawMaterialsCount = 0,
  pendingUsersCount = 0,
  completedCount = 0,
  currentUser,
  onOpenLogin,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const userName = currentUser?.name || 'Wilton Oliver';
  const userRole = currentUser?.role || 'Gerente de Operações';
  const firstLetter = userName.trim().charAt(0).toUpperCase() || 'W';

  const navItems = [
    {
      id: 'order-entry' as ActiveTab,
      label: 'Entrada de Pedidos',
      icon: 'assignment',
      badge: null,
      permissionKey: 'canAccessOrderEntry' as keyof UserPermissions,
    },
    {
      id: 'pending-date' as ActiveTab,
      label: 'Aguardando Data',
      icon: 'pending_actions',
      badge: pendingDateCount > 0 ? pendingDateCount : null,
      permissionKey: 'canAccessPendingDate' as keyof UserPermissions,
    },
    {
      id: 'pending-checkouts' as ActiveTab,
      label: 'Baixas Pendentes',
      icon: 'history_toggle_off',
      badge: pendingCheckoutsCount > 0 ? pendingCheckoutsCount : null,
      badgeColor: 'amber',
      permissionKey: 'canAccessPendingCheckouts' as keyof UserPermissions,
    },
    {
      id: 'raw-materials' as ActiveTab,
      label: 'Matéria-Prima & Compras',
      icon: 'inventory_2',
      badge: pendingRawMaterialsCount > 0 ? pendingRawMaterialsCount : null,
      badgeColor: 'indigo',
      permissionKey: 'canAccessRawMaterials' as keyof UserPermissions,
    },
    {
      id: 'dashboard' as ActiveTab,
      label: 'Painel de Planejamento',
      icon: 'dashboard',
      badge: null,
      permissionKey: 'canAccessDashboard' as keyof UserPermissions,
    },
    {
      id: 'completed' as ActiveTab,
      label: 'Pedidos Concluídos',
      icon: 'verified',
      badge: completedCount > 0 ? completedCount : null,
      permissionKey: 'canAccessCompleted' as keyof UserPermissions,
    },
    {
      id: 'productivity' as ActiveTab,
      label: 'Produtividade Diária',
      icon: 'trending_up',
      badge: null,
      permissionKey: 'canAccessProductivity' as keyof UserPermissions,
    },
    {
      id: 'statistics' as ActiveTab,
      label: 'Estatísticas & Montadores',
      icon: 'analytics',
      badge: null,
      permissionKey: 'canAccessStatistics' as keyof UserPermissions,
    },
    {
      id: 'stores' as ActiveTab,
      label: 'Cadastro de Lojas',
      icon: 'store',
      badge: null,
      permissionKey: 'canAccessStores' as keyof UserPermissions,
    },
    {
      id: 'users' as ActiveTab,
      label: 'Gestão de Usuários',
      icon: 'manage_accounts',
      badge: pendingUsersCount > 0 ? pendingUsersCount : null,
      permissionKey: 'canAccessUsers' as keyof UserPermissions,
    },
    {
      id: 'labels' as ActiveTab,
      label: 'Etiquetas Zebra ZD220',
      icon: 'qr_code_2',
      badge: null,
      permissionKey: 'canAccessLabels' as keyof UserPermissions,
    },
    {
      id: 'expedition' as ActiveTab,
      label: 'Expedição & Baixa',
      icon: 'local_shipping',
      badge: null,
      permissionKey: 'canAccessExpedition' as keyof UserPermissions,
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Relatórios & Impressão',
      icon: 'print',
      badge: null,
      permissionKey: 'canAccessReports' as keyof UserPermissions,
    },
    {
      id: 'history' as ActiveTab,
      label: 'Re-planejamento e Histórico',
      icon: 'history',
      badge: pendingCount > 0 ? pendingCount : null,
      permissionKey: 'canAccessHistory' as keyof UserPermissions,
    },
  ];

  // Filter items based on user permissions
  const visibleNavItems = navItems.filter((item) => {
    if (!currentUser || !currentUser.permissions) return true;
    const isAllowed = currentUser.permissions[item.permissionKey];
    return isAllowed !== false; // Allowed unless explicitly set to false
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`bg-[#011627] text-slate-100 h-screen w-[260px] fixed left-0 top-0 flex flex-col py-6 z-50 shadow-2xl border-r border-[#0d2847]/80 select-none transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo & Mobile Close Button */}
        <div className="px-5 mb-6 flex items-center justify-between">
          <TrindadeLogo variant="dark-bg" />
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden text-blue-200/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Fechar menu"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-150 ease-in-out font-medium group text-left cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#011627] font-bold shadow-md shadow-black/25'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
              <div className="flex items-center gap-3">
                <span
                  className={`material-symbols-outlined text-[20px] transition-transform duration-150 ${
                    isActive ? 'scale-110 text-[#011627] font-bold' : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isActive
                    ? 'bg-[#011627]/10 text-[#011627] border-[#011627]/20'
                    : item.badgeColor === 'amber'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                    : 'bg-[#0b2038] text-slate-200 border-[#153459]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status & User Profile Footer */}
      <div className="p-4 border-t border-[#0d2847]/80 space-y-3">
        <div className="bg-[#081f36]/90 rounded-xl p-3 border border-[#153459]/60">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-xs shadow-emerald-400" />
            <span className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">
              Status do Sistema
            </span>
          </div>
          <p className="text-xs text-white font-medium">Sistemas operacionais</p>
        </div>

        {/* User Profile Box with large first letter avatar */}
        <div
          onClick={onOpenLogin}
          className="flex items-center justify-between p-2.5 rounded-xl bg-[#081f36]/90 hover:bg-[#0c2a47] transition-colors cursor-pointer border border-[#153459]/60 group shadow-xs"
          title="Clique para trocar de usuário / login"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-white text-[#011627] font-black text-lg flex items-center justify-center shrink-0 border border-white/40 shadow-sm">
              {firstLetter}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate transition-colors">
                {userName}
              </p>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold truncate">
                {userRole}
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-slate-400 group-hover:text-white text-[18px] transition-colors shrink-0">
            swap_horiz
          </span>
        </div>
      </div>
    </aside>
  </>
);
};

