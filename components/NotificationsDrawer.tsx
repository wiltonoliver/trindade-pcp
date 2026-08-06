'use client';

import React, { useState } from 'react';
import { AppNotification } from '@/types/factory';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: AppNotification[];
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
  onClearNotifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onDeleteNotification,
  onNavigateToOrder,
  onNotificationClick,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'urgency' | 'orders'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'urgency') {
      return n.type.includes('urgency');
    }
    if (filterType === 'orders') {
      return n.type === 'order_received' || n.type === 'production_date_set' || n.type === 'order_completed';
    }
    return true;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'order_received':
        return {
          icon: 'inventory_2',
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          iconColor: 'text-blue-600',
          label: 'Pedido Recebido',
        };
      case 'production_date_set':
        return {
          icon: 'event',
          bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
          iconColor: 'text-indigo-600',
          label: 'Data Programada',
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
          bg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
          iconColor: 'text-emerald-600',
          label: 'Urgência Aprovada',
        };
      case 'urgency_rejected':
        return {
          icon: 'cancel',
          bg: 'bg-rose-50 border-rose-200 text-rose-950',
          iconColor: 'text-rose-600',
          label: 'Urgência Recusada',
        };
      case 'order_completed':
        return {
          icon: 'check_circle',
          bg: 'bg-teal-50 border-teal-200 text-teal-900',
          iconColor: 'text-teal-600',
          label: 'Pedido Concluído',
        };
      case 'user_pending':
        return {
          icon: 'person_add',
          bg: 'bg-amber-50 border-amber-200 text-amber-900',
          iconColor: 'text-amber-600',
          label: 'Novo Acesso',
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
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
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

          {/* Quick Filters & Actions */}
          <div className="py-3 flex items-center justify-between gap-2 border-b border-slate-100 shrink-0 text-xs">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setFilterType('urgency')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'urgency' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm text-amber-500">bolt</span>
                <span>Urgências</span>
              </button>
              <button
                onClick={() => setFilterType('orders')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  filterType === 'orders' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Pedidos
              </button>
            </div>

            {unreadCount > 0 && onMarkAllAsRead && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
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
                <p className="text-xs font-bold text-slate-700">Nenhuma notificação encontrada</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Ações como entrada de novos pedidos, agendamento de data de produção e aprovação ou recusa de urgências aparecerão aqui automaticamente.
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
                            title="Remover notificação"
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
            <div className="pt-3 border-t border-slate-100 shrink-0">
              <button
                onClick={onClearNotifications}
                className="w-full py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">cleaning_services</span>
                <span>Limpar Notificações</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
