'use client';

import React, { useState, useEffect } from 'react';
import { OrderItem, ActivityLog, Store } from '@/types/factory';
import { INITIAL_ACTIVITY_LOGS, INITIAL_STORES } from '@/lib/factory-store';
import { sanitizeUnit } from '@/lib/utils';

interface OrderEntryProps {
  onAddOrdersToPlanning: (newOrders: OrderItem[]) => void;
  onNavigateToDashboard: () => void;
  stores?: Store[];
  onNavigateToStores?: () => void;
  defaultSelectedStore?: string;
}

interface ExtractedOrder {
  orderId: string;
  store: string;
  itemDescription: string;
  quantity: number;
  unit?: string;
  priority?: string;
  productionDate?: string;
  notes?: string;
}

export const OrderEntry: React.FC<OrderEntryProps> = ({
  onAddOrdersToPlanning,
  onNavigateToDashboard,
  stores = INITIAL_STORES,
  onNavigateToStores,
  defaultSelectedStore,
}) => {
  const availableStores = stores && stores.length > 0 ? stores : INITIAL_STORES;
  const activeStores = availableStores.filter((s) => s.status === 'Ativa');
  const storesToDisplay = activeStores.length > 0 ? activeStores : availableStores;

  const [selectedStore, setSelectedStore] = useState<string>(() => {
    if (defaultSelectedStore) return defaultSelectedStore;
    return storesToDisplay[0]?.name || 'Loja A - Matriz';
  });

  useEffect(() => {
    if (defaultSelectedStore) {
      const timer = setTimeout(() => {
        setSelectedStore(defaultSelectedStore);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [defaultSelectedStore]);
  const [referenceDate, setReferenceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [emailText, setEmailText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted items list
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(INITIAL_ACTIVITY_LOGS);

  const handleProcessEmail = async () => {
    if (!emailText.trim()) {
      setErrorMessage('Por favor, cole o texto do e-mail ou lista de pedidos antes de processar.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/extract-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailText,
          storeName: selectedStore,
          referenceDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar e-mail.');
      }

      setExtractedOrders(data.orders || []);
      setAiSummary(data.summary || 'Extração de itens concluída com sucesso!');

      // Add a success log
      const newLog: ActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: `Extração ${selectedStore}`,
        store: selectedStore,
        itemsCount: `${data.orders?.length || 0} itens`,
        timeAgo: 'Agora',
        status: 'SUCESSO',
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocorreu um erro no servidor durante a extração.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveExtractedOrder = (indexToRemove: number) => {
    setExtractedOrders((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleConfirmAndAddToDashboard = () => {
    if (extractedOrders.length === 0) return;

    const newItems: OrderItem[] = extractedOrders.map((ext, idx) => {
      const itemStore = ext.store || selectedStore;
      const descHasQty = ext.itemDescription.toLowerCase().startsWith(`${ext.quantity}x`) ||
                         ext.itemDescription.toLowerCase().startsWith(`${ext.quantity} `);
      const formattedDesc = descHasQty ? ext.itemDescription : `${ext.quantity}x ${ext.itemDescription}`;

      return {
        id: `ext-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        orderId: ext.orderId ? (ext.orderId.startsWith('#') ? ext.orderId : `#${ext.orderId}`) : `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        store: itemStore,
        storeInitials: itemStore
          .split(' ')
          .map((w) => w[0])
          .join('')
          .substring(0, 2)
          .toUpperCase(),
        storeColorClass: 'bg-[#2563eb] text-white',
        itemDescription: formattedDesc,
        quantity: ext.quantity,
        unit: sanitizeUnit(ext.unit),
        progress: 0,
        column: 'nao_planejado',
        productionDate: ext.productionDate || referenceDate,
        priority: ext.priority?.includes('ALTA') ? 'ALTA PRIORIDADE' : 'NORMAL',
        executionStatus: 'pendente',
      };
    });

    onAddOrdersToPlanning(newItems);
    setEmailText('');
    setExtractedOrders([]);
    setAiSummary(null);
    onNavigateToDashboard();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Page Title Header */}
      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Entrada de Pedidos
        </h2>
        <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">
          O sistema extrai automaticamente os dados dos e-mails e gera listas de produção prontas para o planejamento.
        </p>
      </section>

      {/* Main Grid: Form + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Form Column (7 cols) */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            {/* Email Text Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-xs text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">alternate_email</span>
                  <span>Cole aqui o conteúdo do pedido</span>
                </label>
              </div>

              <textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder=""
                rows={10}
                className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 font-medium resize-none text-slate-900"
              />

              <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Estrutura recomendada: [OP] [LOJA] - [QUANTIDADE] [DESCRIÇÃO]. Ex: 5376 GRANSUZANO - 1 BL3052 VENEZ.6F</span>
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Process Button */}
            <button
              onClick={handleProcessEmail}
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-bold text-sm py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  <span>Extraindo Pedidos do E-mail...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  <span>Processar e Gerar Lista de Pedidos</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Extraction Preview Column (5 cols) */}
        <section className="lg:col-span-5 flex flex-col h-full">
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">fact_check</span>
                  <span>Preview da Extração</span>
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    extractedOrders.length > 0
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {extractedOrders.length > 0
                    ? `${extractedOrders.length} Extraídos`
                    : 'Aguardando'}
                </span>
              </div>

              {/* Display Extracted Items if available */}
              {extractedOrders.length > 0 ? (
                <div className="space-y-4">
                  {aiSummary && (
                    <div className="p-3.5 bg-blue-50 border border-blue-100 text-blue-900 rounded-xl text-xs font-medium mb-3">
                      💡 {aiSummary}
                    </div>
                  )}

                  <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {extractedOrders.map((ord, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 hover:border-blue-500 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-blue-600">
                              {ord.orderId || `#ORD-${idx + 1}`}
                            </span>
                            {ord.priority?.includes('ALTA') && (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">
                                ALTA PRIORIDADE
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveExtractedOrder(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover item da lista"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                        <p className="font-semibold text-sm text-slate-900">
                          {ord.quantity}x {ord.itemDescription}
                        </p>
                        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                          <span>Loja: {ord.store || selectedStore}</span>
                          <span>Data: {ord.productionDate || referenceDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleConfirmAndAddToDashboard}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">playlist_add</span>
                    <span>Adicionar ao Planejamento ({extractedOrders.length} itens)</span>
                  </button>
                </div>
              ) : (
                /* Empty State Illustration */
                <div className="flex-1 flex flex-col items-center justify-center text-center py-10 space-y-6">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <div className="absolute inset-0 bg-slate-100/80 rounded-full" />
                    <span className="material-symbols-outlined text-[64px] text-slate-300 relative z-10">
                      memory
                    </span>
                  </div>

                  <div className="space-y-1.5 max-w-[280px]">
                    <h4 className="font-bold text-sm text-slate-900">
                      Nenhum dado processado
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Os itens extraídos do seu e-mail aparecerão aqui para revisão antes de serem salvos no sistema.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Guide Footer */}
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
              <h5 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Dicas Rápidas
              </h5>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <p>Copie o corpo do e-mail incluindo quantidades e nomes de produtos.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <p>Certifique-se de que a loja correta está selecionada no seletor.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Recent Activity Log Bento Grid */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xl text-slate-900">Atividades Recentes</h3>
          <button
            onClick={onNavigateToDashboard}
            className="text-blue-600 font-semibold text-sm flex items-center gap-1 hover:underline cursor-pointer"
          >
            <span>Ver histórico no planejamento</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activityLogs.map((log, idx) => (
            <div
              key={log.id ? `${log.id}-${idx}` : `log-${idx}`}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  log.status === 'SUCESSO'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {log.status === 'SUCESSO' ? 'receipt_long' : 'warning'}
                </span>
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900">{log.title}</p>
                <p className="text-xs text-slate-500">
                  {log.store} • {log.itemsCount}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[11px] text-slate-400 font-medium">{log.timeAgo}</p>
                <span
                  className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase mt-1 ${
                    log.status === 'SUCESSO'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
