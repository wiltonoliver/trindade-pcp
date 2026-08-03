'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/types/factory';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  unreadCount?: number;
  pendingUsersCount?: number;
  onNavigateToUsers?: () => void;
  currentUser?: UserProfile | null;
  onOpenLogin?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  onOpenSettings,
  onOpenNotifications,
  unreadCount = 0,
  pendingUsersCount = 0,
  onNavigateToUsers,
  currentUser,
  onOpenLogin,
  onToggleMobileMenu,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const userName = currentUser?.name || 'Wilton Oliver';
  const userRole = currentUser?.role || 'Gerente de Operações';
  const firstLetter = userName.trim().charAt(0).toUpperCase() || 'W';

  return (
    <header className="min-h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-10 sticky top-0 z-30 ml-0 lg:ml-[260px] transition-all gap-2 sm:gap-4 py-2 sm:py-0">
      {/* Left: Mobile Hamburger & Search Bar */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Abrir menu de navegação"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
        )}

        <div className="relative w-full max-w-xs sm:max-w-md">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Pesquisar..."
            className={`w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-7 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${
              isSearchFocused ? 'shadow-xs' : ''
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Pending Users Notification Badge Banner */}
        {pendingUsersCount > 0 && onNavigateToUsers && (
          <button
            onClick={onNavigateToUsers}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 text-amber-800 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0"
            title="Acessar Gestão de Usuários para aprovação e criação de senha"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-600">person_add</span>
            <span>{pendingUsersCount} {pendingUsersCount === 1 ? 'Solicitação' : 'Solicitações'}</span>
          </button>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            title="Notificações"
            className="p-2 sm:p-2.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors relative cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Calendar Button */}
          <button
            title="Calendário de Produção"
            onClick={() => alert('Calendário industrial: Turno Ativo')}
            className="hidden sm:block p-2.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          </button>
        </div>

        {/* Profile Settings & User Avatar Trigger */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 cursor-pointer group hover:opacity-90 transition-all text-right"
          title="Clique para editar perfil ou trocar usuário"
        >
          <div className="hidden md:block">
            <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {userName}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">{userRole}</p>
          </div>
          
          {/* Avatar circle */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-base sm:text-xl flex items-center justify-center border-2 border-white shadow-xs shrink-0 select-none group-hover:scale-105 transition-transform">
            {firstLetter}
          </div>
        </button>
      </div>
    </header>
  );
};

