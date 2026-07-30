'use client';

import React, { useState } from 'react';
import { Store } from '@/types/factory';

interface StoreManagementProps {
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  onSelectStoreForOrder?: (storeName: string) => void;
}

export const StoreManagement: React.FC<StoreManagementProps> = ({
  stores,
  setStores,
  onSelectStoreForOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'Ativa' | 'Inativa'>('todos');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'Ativa' | 'Inativa'>('Ativa');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingStore(null);
    setName('');
    setCode(`ST-${Math.floor(10 + Math.random() * 90)}`);
    setCity('');
    setContactEmail('');
    setPhone('');
    setStatus('Ativa');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (store: Store) => {
    setEditingStore(store);
    setName(store.name);
    setCode(store.code);
    setCity(store.city || '');
    setContactEmail(store.contactEmail || '');
    setPhone(store.phone || '');
    setStatus(store.status);
    setIsModalOpen(true);
  };

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor, informe o nome da loja.');
      return;
    }

    if (editingStore) {
      // Edit existing
      setStores((prev) =>
        prev.map((st) =>
          st.id === editingStore.id
            ? {
                ...st,
                name: name.trim(),
                code: code.trim() || st.code,
                city: city.trim(),
                contactEmail: contactEmail.trim(),
                phone: phone.trim(),
                status,
              }
            : st
        )
      );
      showToast(`Loja "${name.trim()}" atualizada com sucesso!`);
    } else {
      // Create new
      const newStore: Store = {
        id: `st-${Date.now()}`,
        name: name.trim(),
        code: code.trim() || `ST-${Math.floor(100 + Math.random() * 900)}`,
        city: city.trim() || 'São Paulo - SP',
        contactEmail: contactEmail.trim() || 'contato@loja.com.br',
        phone: phone.trim() || '(11) 99999-0000',
        status,
      };

      setStores((prev) => [newStore, ...prev]);
      showToast(`Loja "${newStore.name}" cadastrada com sucesso!`);
    }

    setIsModalOpen(false);
  };

  const handleDeleteStore = (store: Store) => {
    setStoreToDelete(store);
  };

  const confirmDeleteStore = () => {
    if (!storeToDelete) return;
    const name = storeToDelete.name;
    setStores((prev) => prev.filter((s) => s.id !== storeToDelete.id));
    setStoreToDelete(null);
    showToast(`Loja "${name}" excluída com sucesso!`);
  };

  const handleToggleStatus = (id: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'Ativa' ? 'Inativa' : 'Ativa' }
          : s
      )
    );
  };

  const filteredStores = stores.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'todos' || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCount = stores.filter((s) => s.status === 'Ativa').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-3 text-sm font-semibold border border-slate-700 animate-slideLeft">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Cadastro de Lojas & Unidades
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie as lojas da rede. As lojas ativas serão carregadas automaticamente nos formulários e seletores de entrada de pedidos.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">add_business</span>
          <span>Cadastrar Nova Loja</span>
        </button>
      </div>

      {/* Filter and Table Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4">
        {/* Search & Status Filter Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por nome, código ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-semibold mr-1">Status:</span>
            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'todos'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todas ({stores.length})
            </button>
            <button
              onClick={() => setStatusFilter('Ativa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'Ativa'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Ativas ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('Inativa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'Inativa'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Inativas ({stores.length - activeCount})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold text-[11px] uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">Código</th>
                <th className="px-6 py-4">Nome da Loja</th>
                <th className="px-6 py-4">Cidade / UF</th>
                <th className="px-6 py-4">Contato / E-mail</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[40px] text-slate-300 block mb-2">
                      storefront
                    </span>
                    <p className="font-semibold text-slate-700">Nenhuma loja encontrada</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Tente alterar os filtros de busca ou cadastre uma nova loja.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStores.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-600 text-xs">
                      {st.code}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {st.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium text-xs">
                      {st.city || '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium text-xs">
                      <div>{st.contactEmail || '—'}</div>
                      <div className="text-[11px] text-slate-400">{st.phone || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        onClick={() => handleToggleStatus(st.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-transform active:scale-95 border ${
                          st.status === 'Ativa'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Clique para alterar status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            st.status === 'Ativa' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        <span>{st.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onSelectStoreForOrder && (
                          <button
                            onClick={() => onSelectStoreForOrder(st.name)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-lg transition-colors cursor-pointer mr-2"
                            title="Lançar pedido para esta loja"
                          >
                            + Pedido
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditModal(st)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Editar Loja"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStore(st)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Loja"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Store Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">store</span>
                <span>{editingStore ? 'Editar Loja' : 'Cadastrar Nova Loja'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome da Loja <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Loja E - Shopping Center"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: LE-05"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Ativa' | 'Inativa')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Inativa">Inativa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cidade / Estado
                </label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo - SP"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    placeholder="pedidos@loja.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 99999-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  {editingStore ? 'Salvar Alterações' : 'Cadastrar Loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {storeToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 animate-scaleUp text-center space-y-4">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[32px]">delete_forever</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Excluir Loja?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Tem certeza que deseja excluir a loja <strong className="text-slate-900">{storeToDelete.name}</strong> ({storeToDelete.code})? Esta ação não poderá ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStoreToDelete(null)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer w-full"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteStore}
                className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-xs cursor-pointer w-full flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
