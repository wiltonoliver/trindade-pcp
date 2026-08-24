'use client';

import React, { useState } from 'react';
import { AppNotification, UserProfile } from '@/types/factory';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: AppNotification[];
  currentUser?: UserProfile | null;
  onClearNotifications?: () => void;
  onMarkAllAsRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
  onNotificationClick?: (notification: AppNotification) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications = [],
  currentUser,
  onClearNotifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onDeleteNotification,
  onNavigateToOrder,
  onNotificationClick,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'urgency' | 'orders' | 'status'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const userName = currentUser?.name || 'Meu Perfil';

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'urgency') {
      return n.type.includes('urgency');
    }
    if (filterType === 'orders') {
      return (
        n.type === 'order_received' ||
        n.type === 'production_date_set' ||
        n.type === 'production_rescheduled' ||
        n.type === 'order_completed' ||
        n.type === 'order_reopened'
      );
    }
    if (filterType === 'status') {
      return (
        n.type === 'order_not_completed_pending' ||
        n.type === 'order_not_completed_deleted' ||
        n.type === 'order_deleted'
      );
    }
    return true;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'order_received':
        return {
          icon: 'inventory_2',
          bg: 'bg-blue-50/80 border-blue-200 text-blue-900',
          iconColor: 'text-blue-600',
          label: 'Novo Pedido',
        };
      case 'production_date_set':
        return {
          icon: 'event',
          bg: 'bg-indigo-50/80 border-indigo-200 text-indigo-900',
          iconColor: 'text-indigo-600',
          label: 'Produção Agendada',
        };
      case 'production_rescheduled':
        return {
          icon: 'update',
          bg: 'bg-sky-50/80 border-sky-200 text-sky-900',
          iconColor: 'text-sky-600',
          label: 'Produção Reagendada',
        };
      case 'order_completed':
        return {
          icon: 'check_circle',
          bg: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
          iconColor: 'text-emerald-600',
          label: 'Produção Concluída',
        };
      case 'order_not_completed_pending':
        return {
          icon: 'schedule',
          bg: 'bg-amber-50/80 border-amber-200 text-amber-900',
          iconColor: 'text-amber-600',
          label: 'Aguardando Nova Data',
        };
      case 'order_not_completed_deleted':
        return {
          icon: 'remove_shopping_cart',
          bg: 'bg-rose-50/80 border-rose-200 text-rose-900',
          iconColor: 'text-rose-600',
          label: 'Não Concluído / Excluído',
        };
      case 'order_deleted':
        return {
          icon: 'delete_forever',
          bg: 'bg-slate-100 border-slate-300 text-slate-900',
          iconColor: 'text-slate-600',
          label: 'Pedido Excluído',
        };
      case 'order_reopened':
        return {
          icon: 'replay',
          bg: 'bg-cyan-50/80 border-cyan-200 text-cyan-900',
          iconColor: 'text-cyan-600',
          label: 'Reaberto para Produção',
        };
      case 'urgency_requested':
        return {
          icon: 'bolt',
          bg: 'bg-amber-50 border-amber-300 text-amber-950',
          iconColor: 'text-amber-600',
          label: 'Solicitação de Urgência',
        };
      case 'urgency_approved':
        return {
          icon: 'verified',
          bg: 'bg-teal-50 border-teal-300 text-teal-950',
          iconColor: 'text-teal-600',
          label: 'Urgência Aprovada',
        };
      case 'urgency_rejected':
        return {
          icon: 'cancel',
          bg: 'bg-rose-50 border-rose-200 text-rose-950',
          iconColor: 'text-rose-600',
          label: 'Urgência Recusada',
        };
      case 'user_pending':
        return {
          icon: 'person_add',
          bg: 'bg-purple-50 border-purple-200 text-purple-900',
          iconColor: 'text-purple-600',
          label: 'Novo Acesso',
        };
      case 'material_requested':
        return {
          icon: 'inventory_2',
          bg: 'bg-amber-50/90 border-amber-200 text-amber-950',
          iconColor: 'text-amber-600',
          label: 'Matéria-Prima Solicitada',
        };
      case 'material_purchased':
        return {
          icon: 'shopping_bag',
          bg: 'bg-blue-50/90 border-blue-200 text-blue-950',
          iconColor: 'text-blue-600',
          label: 'Compra Informada (Aguardando)',
        };
      case 'material_received':
        return {
          icon: 'mark_email_read',
          bg: 'bg-emerald-50/90 border-emerald-200 text-emerald-950',
          iconColor: 'text-emerald-600',
          label: 'Material Recebido na Fábrica',
        };
      default:
        return {
          icon: 'notifications',
          bg: 'bg-slate-50 border-slate-200 text-slate-800',
          iconColor: 'text-slate-600',
          label: 'Notificação',
        };
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end animate-fadeIn">
      <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 border-l border-slate-200 flex flex-col justify-between animate-slideLeft">
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center relative">
                <span className="material-symbols-outlined text-xl">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full ring-2 ring-white animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <span>Central de Notificações</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-full">
                      {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Alertas em tempo real sobre pedidos e urgências
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
              title="Fechar"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* User Independence Banner */}
          <div className="py-2 px-3 my-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-sm text-blue-600 shrink-0">person</span>
              <span className="text-[11px] font-bold text-slate-700 truncate">
                Perfil: <span className="text-blue-700">{userName}</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium shrink-0 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              Visualização individual
            </span>
          </div>

          {/* Quick Filters & Actions */}
          <div className="py-2 flex items-center justify-between gap-2 border-b border-slate-100 shrink-0 text-xs">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-[280px]">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setFilterType('urgency')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap text-[11px] ${
                  filterType === 'urgency' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-xs text-amber-500">bolt</span>
                <span>Urgências</span>
              </button>
              <button
                onClick={() => setFilterType('orders')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  filterType === 'orders' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Pedidos
              </button>
              <button
                onClick={() => setFilterType('status')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap text-[11px] ${
                  filterType === 'status' ? 'bg-white text-rose-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Status / Baixas
              </button>
            </div>

            {unreadCount > 0 && onMarkAllAsRead && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
                title="Marcar todas como lidas apenas no meu perfil"
              >
                Marcar lidas
              </button>
            )}
          </div>

          {/* Notifications Scroll Area */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 min-h-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 my-8 space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-300 block mx-auto">
                  notifications_paused
                </span>
                <p className="text-xs font-bold text-slate-700">Nenhuma notificação na sua lista</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Ações como entrada de novos pedidos, agendamento de data de produção e aprovação ou recusa de urgências aparecerão aqui em tempo real.
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const badge = getTypeBadge(n.type);
                const isUnread = !n.read;

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (onMarkAsRead && isUnread) onMarkAsRead(n.id);
                      if (onNotificationClick) {
                        onNotificationClick(n);
                      } else if (n.orderId && onNavigateToOrder) {
                        onNavigateToOrder(n.orderId);
                        onClose();
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${badge.bg} ${
                      isUnread ? 'ring-2 ring-blue-500/20 shadow-xs font-medium' : 'opacity-90'
                    }`}
                  >
                    {isUnread && (
                      <span className="absolute top-3.5 right-3.5 w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    )}

                    <div className="flex items-start justify-between gap-2 mb-1.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`material-symbols-outlined text-lg ${badge.iconColor}`}>
                          {badge.icon}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{n.title}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{n.time}</span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-normal">{n.message}</p>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">label</span>
                        {badge.label}
                      </span>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onDeleteNotification && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(n.id);
                            }}
                            className="p-1 hover:bg-slate-200/80 rounded text-slate-400 hover:text-red-600 transition-colors"
                            title="Remover apenas da minha lista"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                        {n.orderId && (
                          <span className="font-bold text-blue-600 hover:underline flex items-center gap-0.5">
                            Ver OP
                            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="pt-3 border-t border-slate-100 shrink-0 space-y-1.5">
              <button
                onClick={onClearNotifications}
                className="w-full py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="Limpar notificações apenas para o seu usuário (outros usuários continuarão vendo)"
              >
                <span className="material-symbols-outlined text-sm">cleaning_services</span>
                <span>Limpar Minhas Notificações</span>
              </button>
              <p className="text-[10px] text-center text-slate-400 font-medium">
                Esta ação limpa a lista somente para o seu perfil. Os demais usuários continuam com as notificações normais.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

