'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types/factory';

interface DevAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGrantDevAccess: (devUser: UserProfile) => void;
}

export const DEV_USER_PROFILE: UserProfile = {
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
    canAccessPendingDate: true,
    canAccessDashboard: true,
    canAccessCompleted: true,
    canAccessProductivity: true,
    canAccessStatistics: true,
    canAccessStores: true,
    canAccessUsers: true,
    canAccessReports: true,
    canAccessHistory: true,
  },
  createdAt: '2026-01-01',
};

export const DevAccessModal: React.FC<DevAccessModalProps> = ({
  isOpen,
  onClose,
  onGrantDevAccess,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [storedDevPassword, setStoredDevPassword] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedPass = localStorage.getItem('trindade_dev_password');
      if (savedPass && savedPass.trim()) {
        return savedPass.trim();
      }
    }
    return 'dev123';
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newDevPassword, setNewDevPassword] = useState('');

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedPass = localStorage.getItem('trindade_dev_password');
      if (savedPass && savedPass.trim()) {
        queueMicrotask(() => setStoredDevPassword(savedPass.trim()));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const entered = passwordInput.trim();
    const validPasswords = [storedDevPassword, 'dev123', 'dev2026', 'admin123', 'trindade2026'];

    if (validPasswords.includes(entered)) {
      setSuccessMsg('Autenticação de Desenvolvedor confirmada! Acessando...');
      setTimeout(() => {
        onGrantDevAccess({
          ...DEV_USER_PROFILE,
          password: entered || storedDevPassword,
        });
        setSuccessMsg(null);
        setPasswordInput('');
        onClose();
      }, 500);
    } else {
      setErrorMsg('SENHA INVÁLIDA');
    }
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevPassword.trim()) return;

    const pass = newDevPassword.trim();
    setStoredDevPassword(pass);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trindade_dev_password', pass);
    }
    setIsChangingPassword(false);
    setNewDevPassword('');
    setSuccessMsg('Nova senha master do Desenvolvedor salva com sucesso!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-left space-y-5 text-white relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-400 to-blue-500" />

        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">terminal</span>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide text-white">
                Acesso de Desenvolvedor (DEV)
              </h3>
              <p className="text-[11px] text-slate-400">
                Digite a senha para liberar acesso completo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-base text-rose-400">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {!isChangingPassword ? (
          /* Primary Login Form */
          <form onSubmit={handleAuthenticate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Senha do DEV *</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Digite a senha de acesso..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end text-xs">
              <button
                type="button"
                onClick={() => setIsChangingPassword(true)}
                className="text-slate-400 hover:text-slate-200 font-medium underline cursor-pointer text-[11px]"
              >
                Alterar Senha
              </button>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>Acessar</span>
              </button>
            </div>
          </form>
        ) : (
          /* Change Dev Password Subform */
          <form onSubmit={handleSaveNewPassword} className="space-y-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">lock_reset</span>
              <span>Cadastrar Nova Senha Personalizada de Desenvolvedor</span>
            </h4>
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Nova Senha Master DEV:</label>
              <input
                type="text"
                required
                value={newDevPassword}
                onChange={(e) => setNewDevPassword(e.target.value)}
                placeholder="Ex: dev2026 / mestre123"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsChangingPassword(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-md"
              >
                Salvar Nova Senha
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
