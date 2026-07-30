'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types/factory';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetData?: () => void;
  currentUser?: UserProfile | null;
  onUpdateUser?: (user: UserProfile) => void;
  onSwitchUser?: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  onResetData,
  currentUser,
  onUpdateUser,
  onSwitchUser,
}) => {
  const [managerName, setManagerName] = useState(currentUser?.name || 'Wilton Oliver');
  const [role, setRole] = useState(currentUser?.role || 'Gerente de Operações');
  const [email, setEmail] = useState(currentUser?.email || 'wilton@factoryops.com');
  const [shift, setShift] = useState('Manhã (06:00 - 14:00)');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Sync internal state when modal opens or user prop updates
  const [prevUser, setPrevUser] = useState(currentUser);
  if (currentUser !== prevUser) {
    setPrevUser(currentUser);
    if (currentUser) {
      setManagerName(currentUser.name);
      setRole(currentUser.role);
      if (currentUser.email) setEmail(currentUser.email);
    }
  }

  if (!isOpen) return null;

  const firstLetter = managerName.trim().charAt(0).toUpperCase() || 'W';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      onUpdateUser({
        name: managerName.trim(),
        role: role.trim(),
        email: email.trim(),
        plant: currentUser?.plant || 'Planta A - Matriz',
      });
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 animate-scaleUp">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">manage_accounts</span>
            <span>Configurações de Perfil & Planta</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-4">
              {/* Large First Letter Avatar Badge */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 border-2 border-white">
                {firstLetter}
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">{managerName}</h4>
                <p className="text-xs text-slate-500">{role}</p>
                <span className="inline-block mt-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                  ● Ativo no Comando
                </span>
              </div>
            </div>

            {onSwitchUser && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchUser();
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                <span>Trocar</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cargo
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              E-mail Corporativo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Turno Padrão de Produção
            </label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Manhã (06:00 - 14:00)">Manhã (06:00 - 14:00)</option>
              <option value="Tarde (14:00 - 22:00)">Tarde (14:00 - 22:00)</option>
              <option value="Noite (22:00 - 06:00)">Noite (22:00 - 06:00)</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-900">Alertas de Gargalo e Paradas</p>
              <p className="text-[11px] text-slate-500">Receber avisos imediatos sobre quebras de máquinas</p>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl font-bold border border-emerald-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          {resetSuccess && (
            <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl font-bold border border-rose-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-rose-600">delete_sweep</span>
              <span>Todos os dados foram excluídos. O sistema está limpo para dados reais!</span>
            </div>
          )}

          <div className="pt-3 flex items-center justify-between border-t border-slate-100">
            {onResetData ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Tem certeza que deseja apagar todos os dados para trabalhar com dados reais?')) {
                    onResetData();
                    setResetSuccess(true);
                    setTimeout(() => setResetSuccess(false), 3000);
                  }
                }}
                className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Limpar todos os pedidos e lojas"
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                <span>Limpar Banco de Dados</span>
              </button>
            ) : <div />}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

