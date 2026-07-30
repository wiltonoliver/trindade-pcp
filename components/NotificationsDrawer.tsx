'use client';

import React from 'react';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [notifications, setNotifications] = React.useState<
    Array<{ id: string; title: string; message: string; time: string; type: string }>
  >([]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 border-l border-slate-200 flex flex-col justify-between animate-slideLeft">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600">notifications</span>
              <h3 className="font-bold text-lg text-slate-900">Central de Notificações</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 my-8">
                <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">
                  notifications_paused
                </span>
                <p className="text-sm font-semibold text-slate-700">Nenhuma notificação recente</p>
                <p className="text-xs text-slate-400 mt-1">
                  Alertas sobre pedidos e gargalos de produção aparecerão aqui.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 hover:border-blue-500 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{n.title}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-600">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={() => setNotifications([])}
            className="w-full py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Limpar Notificações
          </button>
        </div>
      </div>
    </div>
  );
};
