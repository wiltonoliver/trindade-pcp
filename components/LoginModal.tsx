'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/types/factory';
import { TrindadeLogo } from './TrindadeLogo';
import { subscribeUsers, saveUserToFirestore, deleteUserFromFirestore } from '@/lib/firestoreSync';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLogin: (user: UserProfile) => void;
  currentUser?: UserProfile | null;
  onOpenDevModal?: () => void;
}

const DEFAULT_USERS: UserProfile[] = [
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
    },
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
    },
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  currentUser,
  onOpenDevModal,
}) => {
  const [activeTab, setActiveTab] = useState<'select' | 'register'>('select');
  const [usersList, setUsersList] = useState<UserProfile[]>(DEFAULT_USERS);
  const [searchTerm, setSearchTerm] = useState('');

  // Direct username and password login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Password Prompt modal state
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Pending user alert modal state
  const [pendingAlertUser, setPendingAlertUser] = useState<UserProfile | null>(null);

  // Registration wait state
  const [registeredPendingUser, setRegisteredPendingUser] = useState<UserProfile | null>(null);

  // Registration Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('DIRETORIA');
  const [customRole, setCustomRole] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPlant, setNewPlant] = useState('Planta A - Matriz');

  // PWA Install Prompt State
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installSuccessToast, setInstallSuccessToast] = useState(false);

  const loadSavedUsers = () => {
    if (typeof window !== 'undefined') {
      const deletedIdsStr = localStorage.getItem('trindade_deleted_user_ids');
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      const savedUsers = localStorage.getItem('trindade_users_list');
      if (savedUsers) {
        try {
          const parsed = JSON.parse(savedUsers);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((u: UserProfile) => u.id && !deletedIds.includes(u.id));
            setUsersList(filtered);
            return;
          }
        } catch (e) {
          console.error('Failed to load trindade_users_list', e);
        }
      }
      setUsersList(DEFAULT_USERS.filter((u) => Boolean(u.id && !deletedIds.includes(u.id))));
    }
  };

  React.useEffect(() => {
    queueMicrotask(() => loadSavedUsers());

    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }

    // Check if app is already running as standalone (PWA installed)
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (isStandalone) {
        setIsAppInstalled(true);
      }

      // Check iOS detection
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      setIsIOSDevice(isIOS);

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredInstallPrompt(e);
      };

      const handleAppInstalled = () => {
        setIsAppInstalled(true);
        setDeferredInstallPrompt(null);
        setInstallSuccessToast(true);
        setTimeout(() => setInstallSuccessToast(false), 5000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      const unsub = subscribeUsers((firestoreUsers) => {
        const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_user_ids') : null;
        const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];

        if (firestoreUsers && firestoreUsers.length > 0) {
          const filtered = firestoreUsers.filter((u) => u.id && !deletedIds.includes(u.id));
          setUsersList(filtered);
          if (typeof window !== 'undefined') {
            localStorage.setItem('trindade_users_list', JSON.stringify(filtered));
          }
        }
      });

      window.addEventListener('storage', loadSavedUsers);
      window.addEventListener('trindade_users_updated', loadSavedUsers);
      return () => {
        unsub();
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('storage', loadSavedUsers);
        window.removeEventListener('trindade_users_updated', loadSavedUsers);
      };
    }
  }, []);

  const handleInstallApp = async () => {
    if (isIOSDevice) {
      setShowIOSModal(true);
      return;
    }

    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsAppInstalled(true);
          setDeferredInstallPrompt(null);
          setInstallSuccessToast(true);
          setTimeout(() => setInstallSuccessToast(false), 5000);
        }
      } catch (err) {
        console.error('Error invoking PWA install prompt:', err);
      }
    } else {
      // If browser doesn't expose deferred prompt immediately, show guidance dialog
      setShowIOSModal(true);
    }
  };

  if (!isOpen) return null;

  const saveUsersList = (updated: UserProfile[]) => {
    const deletedIdsStr = typeof window !== 'undefined' ? localStorage.getItem('trindade_deleted_user_ids') : null;
    const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
    const filtered = updated.filter((u) => u.id && !deletedIds.includes(u.id));

    setUsersList(filtered);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trindade_users_list', JSON.stringify(filtered));
      window.dispatchEvent(new Event('trindade_users_updated'));
    }

    filtered.forEach((u) => {
      saveUserToFirestore(u).catch(() => {});
    });
  };

  const getInitial = (nameStr: string) => {
    const trimmed = nameStr.trim();
    if (!trimmed) return 'T';
    return trimmed.charAt(0).toUpperCase();
  };

  const handleDirectLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const identifier = loginUsername.trim().toLowerCase();
    if (!identifier) {
      setLoginError('Por favor, informe seu nome de usuário ou e-mail.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Por favor, informe sua senha de acesso.');
      return;
    }

    // Find user by email, name or id
    const matchedUser = usersList.find(
      (u) =>
        (u.email && u.email.toLowerCase() === identifier) ||
        (u.name && u.name.toLowerCase() === identifier) ||
        (u.id && u.id.toLowerCase() === identifier) ||
        (u.name && u.name.toLowerCase().includes(identifier))
    );

    if (!matchedUser) {
      setLoginError('Usuário ou e-mail não encontrado no sistema.');
      return;
    }

    if (matchedUser.status === 'pending') {
      setPendingAlertUser(matchedUser);
      return;
    }

    if (matchedUser.status === 'blocked') {
      setLoginError(`O acesso do usuário ${matchedUser.name} está bloqueado pelo Administrador.`);
      return;
    }

    // Special check for Dev Master
    if (matchedUser.id === 'usr-dev-master') {
      const savedDevPass = typeof window !== 'undefined' ? (localStorage.getItem('trindade_dev_password') || 'dev123') : 'dev123';
      const validDevPasses = [savedDevPass.trim(), 'dev123', 'dev2026', 'admin123', 'trindade2026'];
      if (validDevPasses.includes(loginPassword.trim())) {
        setLoginUsername('');
        setLoginPassword('');
        setLoginError('');
        onLogin({
          ...matchedUser,
          password: loginPassword.trim(),
        });
        if (onClose) onClose();
        return;
      }
    }

    const expectedPassword = matchedUser.password;
    if (!expectedPassword || expectedPassword.trim() === '' || loginPassword === expectedPassword) {
      setLoginUsername('');
      setLoginPassword('');
      setLoginError('');
      onLogin(matchedUser);
      if (onClose) onClose();
    } else {
      setLoginError('Senha incorreta. Verifique a senha informada.');
    }
  };

  const handleSelectUserClick = (user: UserProfile) => {
    // 1. If user status is pending, notify that approval is pending
    if (user.status === 'pending') {
      setPendingAlertUser(user);
      return;
    }

    // 2. If user status is blocked, alert
    if (user.status === 'blocked') {
      alert(`O acesso do usuário ${user.name} está bloqueado pelo Administrador.`);
      return;
    }

    // 3. If user has a set password, prompt for password
    if (user.password && user.password.trim().length > 0) {
      setPasswordModalUser(user);
      setInputPassword('');
      setPasswordError('');
      setShowPassword(false);
      return;
    }

    // 4. Otherwise log in directly
    onLogin(user);
    if (onClose) onClose();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;

    if (passwordModalUser.id === 'usr-dev-master') {
      const savedDevPass = typeof window !== 'undefined' ? (localStorage.getItem('trindade_dev_password') || 'dev123') : 'dev123';
      const validDevPasses = [savedDevPass.trim(), 'dev123', 'dev2026', 'admin123', 'trindade2026'];
      if (validDevPasses.includes(inputPassword.trim())) {
        onLogin({
          ...passwordModalUser,
          password: inputPassword.trim(),
        });
        setPasswordModalUser(null);
        setInputPassword('');
        if (onClose) onClose();
        return;
      }
    }

    if (inputPassword === passwordModalUser.password) {
      onLogin(passwordModalUser);
      setPasswordModalUser(null);
      setInputPassword('');
      if (onClose) onClose();
    } else {
      setPasswordError('Senha incorreta. Verifique a senha cadastrada pelo Administrador.');
    }
  };

  const handleRegisterNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const finalRole = newRole === 'Outro' ? (customRole.trim() || 'Operador') : newRole;
    const finalEmail = newEmail.trim() || `${newName.toLowerCase().replace(/\s+/g, '.')}@trindadeesquadrias.com.br`;

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name: newName.trim(),
      role: finalRole,
      email: finalEmail,
      plant: newPlant.trim() || 'Planta A - Matriz',
      status: 'pending', // Entered wait queue ("entra na espera")
      createdAt: new Date().toISOString().split('T')[0],
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
        canAccessProductivity: false,
        canAccessStores: false,
        canAccessUsers: false,
        canAccessReports: false,
        canAccessHistory: false,
      },
    };

    const updatedList = [newUser, ...usersList];
    saveUsersList(updatedList);

    // Show wait screen
    setRegisteredPendingUser(newUser);
  };

  const handleDeleteUser = (idToDelete?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!idToDelete) return;

    if (typeof window !== 'undefined') {
      const deletedIdsStr = localStorage.getItem('trindade_deleted_user_ids');
      const deletedIds: string[] = deletedIdsStr ? JSON.parse(deletedIdsStr) : [];
      if (!deletedIds.includes(idToDelete)) {
        deletedIds.push(idToDelete);
        localStorage.setItem('trindade_deleted_user_ids', JSON.stringify(deletedIds));
      }
    }

    deleteUserFromFirestore(idToDelete).catch((err) => console.error('Error deleting user from Firestore:', err));

    const updated = usersList.filter((u) => u.id !== idToDelete);
    saveUsersList(updated);
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.plant && u.plant.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-slate-100 text-slate-900 z-50 overflow-y-auto flex flex-col animate-fadeIn">
      {/* Background Decorative Lighting */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-4">
          <TrindadeLogo variant="light-bg" />
          <div className="hidden sm:block h-6 w-px bg-slate-200" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-600">
              Sistema Único de Controle de Produção
            </span>
          </div>
        </div>

        {/* Discrete DEV Button */}
        {onOpenDevModal && (
          <button
            type="button"
            onClick={onOpenDevModal}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer"
            title="Acesso de Desenvolvedor (DEV)"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-600">terminal</span>
            <span>Acesso DEV</span>
          </button>
        )}
      </header>

      {/* Full-Screen Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Brand Statement & Unified Data Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200/80 p-6 md:p-8 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#009639]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#009639]/10 border border-[#009639]/30 text-[#009639] rounded-full text-xs font-bold mb-4">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Trindade Esquadrias • PCP</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-3">
                Identificação de Acesso
              </h1>

              <p className="text-slate-600 text-sm leading-relaxed font-normal mb-6">
                Identifique-se para entrar no sistema. Todos os colaboradores visualizam e gerenciam a mesma linha de produção em tempo real.
              </p>

              {/* Install App Shortcut Banner */}
              <div className="pt-5 border-t border-slate-100">
                {isAppInstalled ? (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">Aplicativo Instalado</h4>
                      <p className="text-[11px] text-emerald-700">Acesso direto via área de trabalho habilitado.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gradient-to-br from-slate-900 via-[#011627] to-blue-950 text-white rounded-2xl shadow-sm border border-blue-900/40 relative overflow-hidden group">
                    <div className="flex items-start gap-3 relative z-1">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center shrink-0 shadow-inner">
                        <span className="material-symbols-outlined text-[22px]">desktop_windows</span>
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Instalar Aplicativo no Dispositivo</span>
                          <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-md">Atalho</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 leading-tight">
                          Crie um ícone na sua Área de Trabalho ou Celular para abrir o sistema em tela cheia com 1 clique.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center gap-2 relative z-1">
                      <button
                        type="button"
                        onClick={handleInstallApp}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <span className="material-symbols-outlined text-[17px]">download_for_offline</span>
                        <span>Baixar / Instalar Atalho</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Card with Tabs (Select User vs Register New User) */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl shadow-sm p-6 md:p-8 flex flex-col">
            
            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('select')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'select'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Entrar no Sistema</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('register')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Cadastrar Novo Usuário</span>
              </button>
            </div>

            {/* TAB 1: Direct Username + Password Login */}
            {activeTab === 'select' && (
              <form onSubmit={handleDirectLoginSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Entrar na Sua Conta</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Digite seu nome de usuário ou e-mail e sua senha de acesso para entrar no sistema.
                    </p>
                  </div>

                  {/* Username or Email Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nome de Usuário ou E-mail *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">
                        person
                      </span>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={loginUsername}
                        onChange={(e) => {
                          setLoginUsername(e.target.value);
                          setLoginError('');
                        }}
                        placeholder="Ex: Wilton Oliver ou wilton@trindadeesquadrias.com.br"
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Senha de Acesso *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">
                        lock
                      </span>
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          setLoginError('');
                        }}
                        placeholder="Digite sua senha de acesso..."
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showLoginPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Error Box */}
                  {loginError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
                      <span className="material-symbols-outlined text-base shrink-0">error</span>
                      <span>{loginError}</span>
                    </div>
                  )}
                </div>

                {/* Submit Action Button */}
                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Entrar no Sistema</span>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: Register New User Form OR Wait Queue Screen */}
            {activeTab === 'register' && (
              registeredPendingUser ? (
                /* Wait Queue Screen after submission */
                <div className="p-6 md:p-8 text-center bg-amber-50/50 rounded-2xl border border-amber-200 space-y-5 my-auto animate-fadeIn">
                  <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center mx-auto shadow-sm">
                    <span className="material-symbols-outlined text-3xl">hourglass_top</span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-900">Solicitação de Cadastro em Fila de Espera</h3>
                    <p className="text-slate-600 text-xs max-w-md mx-auto">
                      Seu cadastro para <strong>{registeredPendingUser.name}</strong> foi enviado ao Administrador.
                    </p>
                  </div>

                  <div className="p-4 bg-white border border-amber-200 rounded-2xl text-left text-xs space-y-2.5 max-w-md mx-auto shadow-xs">
                    <div className="flex items-center gap-2 text-amber-800 font-bold">
                      <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                      <span>O Administrador fará os seguintes passos:</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                      <li>Analisar o perfil e definir permissões de acesso na fábrica;</li>
                      <li>Criar uma <strong>senha fixa de acesso</strong> no sistema;</li>
                      <li>Enviar a senha diretamente para seu contato ou e-mail: <strong className="text-emerald-700 font-semibold">{registeredPendingUser.email}</strong>.</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisteredPendingUser(null);
                      setActiveTab('select');
                      setNewName('');
                      setNewEmail('');
                    }}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">group</span>
                    <span>Voltar para Seleção de Perfil</span>
                  </button>
                </div>
              ) : (
                /* Registration Form */
                <form onSubmit={handleRegisterNewUser} className="space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Cadastrar Novo Colaborador</h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Solicite cadastro na plataforma. O Administrador receberá um aviso para liberar seu acesso e definir sua senha.
                    </p>

                  {/* Live Avatar Preview Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-black text-2xl flex items-center justify-center shadow-md border-2 border-white shrink-0">
                      {getInitial(newName)}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                        Pré-visualização do Perfil
                      </span>
                      <p className="text-sm font-bold text-slate-900">
                        {newName.trim() || 'Nome do Colaborador'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {newRole === 'Outro' ? (customRole || 'Cargo Personalizado') : newRole} • {newPlant}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* Name Field */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome Completo *
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                          person
                        </span>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Ex: Roberto Souza"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>

                    {/* Role Field */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Cargo / Função
                        </label>
                        <div className="relative">
                          <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                            badge
                          </span>
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer transition-all"
                          >
                            <option value="DIRETORIA">DIRETORIA</option>
                            <option value="GESTÃO INDUSTRIAL">GESTÃO INDUSTRIAL</option>
                            <option value="GERENTE DE OPERAÇÕES">GERENTE DE OPERAÇÕES</option>
                            <option value="SUPERVISOR DE PRODUÇÃO">SUPERVISOR DE PRODUÇÃO</option>
                            <option value="ANALISTA DE PCP">ANALISTA DE PCP</option>
                            <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                            <option value="VENDAS">VENDAS</option>
                            <option value="OPERADOR INDUSTRIAL">OPERADOR INDUSTRIAL</option>
                            <option value="Outro">Outro...</option>
                          </select>
                        </div>
                      </div>

                      {newRole === 'Outro' ? (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Especifique o Cargo
                          </label>
                          <input
                            type="text"
                            required
                            value={customRole}
                            onChange={(e) => setCustomRole(e.target.value)}
                            placeholder="Ex: Técnico de Esquadrias"
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Unidade / Setor Industrial
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                              factory
                            </span>
                            <input
                              type="text"
                              value={newPlant}
                              onChange={(e) => setNewPlant(e.target.value)}
                              placeholder="Ex: Planta A - Matriz"
                              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        E-mail Corporativo
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                          mail
                        </span>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Ex: roberto@trindadeesquadrias.com.br"
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button for Registration */}
                <div className="pt-4 mt-4 border-t border-slate-200 space-y-3">
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Solicitar Cadastro e Entrar na Espera</span>
                    <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
                  </button>
                </div>
              </form>
            )
            )}

          </div>

        </div>
      </main>

      {/* Password Verification Overlay Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-xl relative space-y-6">
            <button
              onClick={() => setPasswordModalUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md">
                {getInitial(passwordModalUser.name)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{passwordModalUser.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{passwordModalUser.role} • {passwordModalUser.plant}</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha Fixa de Acesso
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={inputPassword}
                    onChange={(e) => {
                      setInputPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="Digite sua senha cadastrada"
                    className="w-full pl-9 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{passwordError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>Entrar no Sistema</span>
                  <span className="material-symbols-outlined text-base">login</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending User Access Alert Modal */}
      {pendingAlertUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-amber-300 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-xl relative space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-3xl">hourglass_top</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Acesso Pendente de Aprovação</h3>
              <p className="text-xs text-amber-800 font-medium">
                Solicitação de cadastro em análise pelo Administrador
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs text-slate-700 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500">Usuário:</span>
                <span className="font-bold text-slate-900">{pendingAlertUser.name}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500">Cargo:</span>
                <span className="font-semibold text-slate-800">{pendingAlertUser.role}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">E-mail de envio:</span>
                <span className="font-semibold text-emerald-700">{pendingAlertUser.email}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O Administrador irá revisar sua solicitação na tela de <strong>Gestão de Usuários</strong>, definir suas permissões de acesso e criar uma <strong>senha fixa</strong> que será enviada para seu e-mail.
            </p>

            <button
              onClick={() => setPendingAlertUser(null)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            >
              Compreendi, Aguardar Liberação
            </button>
          </div>
        </div>
      )}

      {/* PWA Installation Guide Modal (iOS / Other browsers fallback) */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl relative space-y-5 text-center">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto shadow-sm">
              <span className="material-symbols-outlined text-3xl">add_to_home_screen</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Como Instalar o Aplicativo</h3>
              <p className="text-xs text-slate-500">
                Siga os passos abaixo para fixar o Trindade PCP na sua Área de Trabalho ou Celular:
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs text-slate-700 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <div>
                  <strong className="text-slate-900">No Computador (Chrome / Edge):</strong>
                  <p className="text-slate-600 mt-0.5">Clique no ícone de instalação (computador com seta ou <strong>⊕</strong>) que aparece no canto direito da barra de endereços do navegador.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <div>
                  <strong className="text-slate-900">No iPhone / iPad (Safari):</strong>
                  <p className="text-slate-600 mt-0.5">Toque no botão <strong>Compartilhar</strong> (ícone com quadrado e seta para cima <span className="inline-block border border-slate-300 px-1 rounded bg-white">↑</span>) e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong>.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <div>
                  <strong className="text-slate-900">No Android (Chrome):</strong>
                  <p className="text-slate-600 mt-0.5">Toque no menu de 3 pontinhos <span className="inline-block border border-slate-300 px-1 rounded bg-white">⋮</span> no topo e selecione <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}

      {/* Installation Success Toast */}
      {installSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-emerald-500 flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-2xl text-emerald-200">task_alt</span>
          <div>
            <p className="text-xs font-bold">Atalho Instalado com Sucesso!</p>
            <p className="text-[11px] text-emerald-100">O ícone do Trindade PCP já está disponível na sua Área de Trabalho.</p>
          </div>
        </div>
      )}

      {/* Footer Branding Bar */}
      <footer className="border-t border-slate-200/80 bg-white/80 px-6 py-3 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>
          © 2026 PCP-Trindade Esquadrias. - DESENVOLVIDO POR: WiltonOliveira<sup className="text-[9px] font-bold ml-0.5">®</sup>
        </p>
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold text-slate-600">
            Versão 3.5 • Produção em Tempo Real
          </p>
          {onOpenDevModal && (
            <button
              type="button"
              onClick={onOpenDevModal}
              className="text-[11px] font-mono text-slate-500 hover:text-amber-700 px-2 py-0.5 rounded border border-slate-200 hover:border-amber-300 transition-all flex items-center gap-1 cursor-pointer"
              title="Acesso de Desenvolvedor (DEV)"
            >
              <span className="material-symbols-outlined text-[13px]">terminal</span>
              <span>DEV</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
