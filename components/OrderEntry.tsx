'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OrderItem, ActivityLog, Store, UserProfile, OrderStatusHistoryLog } from '@/types/factory';
import { INITIAL_ACTIVITY_LOGS, INITIAL_STORES } from '@/lib/factory-store';
import { sanitizeUnit } from '@/lib/utils';
import { notifyOrderReceived } from '@/lib/notificationService';
import { compressImageFile, formatFileSize } from '@/lib/imageUtils';
import { ImageLightboxModal } from '@/components/ImageLightboxModal';

interface OrderEntryProps {
  onAddOrdersToPlanning: (newOrders: OrderItem[]) => void;
  onNavigateToDashboard: () => void;
  onNavigateToPendingDate?: () => void;
  stores?: Store[];
  onNavigateToStores?: () => void;
  defaultSelectedStore?: string;
  currentUser?: UserProfile | null;
}

interface ExtractedOrder {
  orderId: string;
  store: string;
  itemDescription: string;
  quantity: number;
  unit?: string;
  priority?: string;
  productionDate?: string;
  deliveryDate?: string;
  notes?: string;
  imageUrl?: string;
}

export const OrderEntry: React.FC<OrderEntryProps> = ({
  onAddOrdersToPlanning,
  onNavigateToDashboard,
  onNavigateToPendingDate,
  stores = INITIAL_STORES,
  onNavigateToStores,
  defaultSelectedStore,
  currentUser,
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

  // Data prevista de entrega (default +7 dias)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  const [emailText, setEmailText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted items list
  const [extractedOrders, setExtractedOrders] = useState<ExtractedOrder[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(INITIAL_ACTIVITY_LOGS);

  // Image attachment states
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const [attachedImageSize, setAttachedImageSize] = useState<number | null>(null);
  const [applyImageToAll, setApplyImageToAll] = useState<boolean>(true);
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [lightboxData, setLightboxData] = useState<{ url: string; title: string; orderId?: string; subtitle?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const individualFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedExtractedIndexForImage, setSelectedExtractedIndexForImage] = useState<number | null>(null);

  // Handle image compression and setting
  const handleProcessImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    try {
      setIsProcessingImage(true);
      setErrorMessage(null);
      const compressedDataUrl = await compressImageFile(file);
      setAttachedImage(compressedDataUrl);
      setAttachedImageName(file.name || 'foto-pedido.jpg');
      setAttachedImageSize(file.size);

      // If there are already extracted orders and applyImageToAll is true, apply to them
      if (applyImageToAll && extractedOrders.length > 0) {
        setExtractedOrders((prev) =>
          prev.map((ord) => ({ ...ord, imageUrl: ord.imageUrl || compressedDataUrl }))
        );
      }
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      setErrorMessage('Não foi possível processar a imagem. Tente uma imagem diferente.');
    } finally {
      setIsProcessingImage(false);
    }
  }, [applyImageToAll, extractedOrders.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImageFile(file);
    }
    // reset input
    if (e.target) e.target.value = '';
  };

  const handleIndividualImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedExtractedIndexForImage !== null) {
      try {
        setIsProcessingImage(true);
        const compressedDataUrl = await compressImageFile(file);
        setExtractedOrders((prev) =>
          prev.map((ord, idx) =>
            idx === selectedExtractedIndexForImage ? { ...ord, imageUrl: compressedDataUrl } : ord
          )
        );
      } catch (err) {
        console.error('Erro ao anexar imagem individual:', err);
      } finally {
        setIsProcessingImage(false);
        setSelectedExtractedIndexForImage(null);
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveAttachedImage = () => {
    setAttachedImage(null);
    setAttachedImageName(null);
    setAttachedImageSize(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveIndividualImage = (index: number) => {
    setExtractedOrders((prev) =>
      prev.map((ord, idx) => (idx === index ? { ...ord, imageUrl: undefined } : ord))
    );
  };

  // Support pasting image from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleProcessImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleProcessImageFile]);

  const parseOrdersLocally = (
    rawText: string,
    defaultStore: string,
    defaultDelivery: string
  ): ExtractedOrder[] => {
    const orders: ExtractedOrder[] = [];
    const normalizedText = rawText
      .replace(/[\u2010-\u2015\u2212\u2013\u2014\u2010\u2011]/g, '-')
      .replace(/\u00A0/g, ' ');

    const lines = normalizedText.split(/\r?\n/);
    const isHighPriorityAll = /urgente|alta prioridade|hoje|imediato/i.test(normalizedText);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Pattern 1: 1234 ITAIM-1 PTA PALHETA 80 BL OR 34581 RAGUEB - 1 PTA...
      const p1 = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s+([A-Za-z0-9À-ÿ\.\s_]+?)\s*[-:\–\—\|]\s*(\d+)\s*x?\s+(.+)$/i);
      if (p1) {
        const opNum = p1[1].trim();
        const storeName = p1[2].trim();
        const qty = parseInt(p1[3], 10);
        const desc = p1[4].trim();

        orders.push({
          orderId: `#${opNum}`,
          store: storeName || defaultStore || 'Matriz',
          itemDescription: desc,
          quantity: qty > 0 ? qty : 1,
          unit: 'un',
          priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
          productionDate: 'Aguardando Data',
          deliveryDate: defaultDelivery || '',
          notes: 'Extraído no formato padrão (OP Loja - Qtd Descrição)',
        });
        continue;
      }

      // Pattern 2: OP - QTY DESC (store omitted) e.g. 1234 - 1 PORTA...
      const p2 = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s*[-:\–\—\|]\s*(\d+)\s*x?\s+(.+)$/i);
      if (p2) {
        const opNum = p2[1].trim();
        const qty = parseInt(p2[2], 10);
        const desc = p2[3].trim();

        orders.push({
          orderId: `#${opNum}`,
          store: defaultStore || 'Matriz',
          itemDescription: desc,
          quantity: qty > 0 ? qty : 1,
          unit: 'un',
          priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
          productionDate: 'Aguardando Data',
          deliveryDate: defaultDelivery || '',
          notes: 'Extraído no formato (OP - Qtd Descrição)',
        });
        continue;
      }

      // Pattern 3: Line starting with OP number + store/text (e.g. "1234 ITAIM 1 PTA...")
      const p3 = trimmed.match(/^(?:#|OP\s*#?|PEDIDO\s*#?)?\s*(\d{2,8})\s+(.+)$/i);
      if (p3) {
        const opNum = p3[1].trim();
        let rest = p3[2].trim();

        let storeName = defaultStore || 'Matriz';
        const storePrefixMatch = rest.match(/^([A-Za-z0-9À-ÿ\._]+)\s*[-:\–\—\|]?\s*(.+)$/);
        if (storePrefixMatch && storePrefixMatch[1].length >= 2 && !/^\d+$/.test(storePrefixMatch[1])) {
          const potentialStore = storePrefixMatch[1];
          if (!/^(porta|janela|bl3052|pt|pta|pva|pvc|esquadria|box|vidro|aluminio|portao|venez)/i.test(potentialStore)) {
            storeName = potentialStore;
            rest = storePrefixMatch[2];
          }
        }

        let qty = 1;
        const qtyMatch = rest.match(/^(\d+)\s*x?\s+(.+)$/i);
        let desc = rest;
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1], 10);
          desc = qtyMatch[2].trim();
        }

        orders.push({
          orderId: `#${opNum}`,
          store: storeName,
          itemDescription: desc,
          quantity: qty > 0 ? qty : 1,
          unit: 'un',
          priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
          productionDate: 'Aguardando Data',
          deliveryDate: defaultDelivery || '',
          notes: 'Extraído por linha com OP',
        });
        continue;
      }

      // Pattern 4: Qty x Description
      const p4 = trimmed.match(/^(\d+)\s*x?\s+(.+)$/i);
      if (p4 && p4[2].length >= 3 && !/^(pedido|loja|ref|data|atenciosamente|olá|assunto|favor|gostaríamos)/i.test(p4[2])) {
        orders.push({
          orderId: `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          store: defaultStore || 'Matriz',
          itemDescription: p4[2].trim(),
          quantity: parseInt(p4[1], 10),
          unit: 'un',
          priority: isHighPriorityAll || /urgente|alta/i.test(trimmed) ? 'ALTA PRIORIDADE' : 'NORMAL',
          productionDate: 'Aguardando Data',
          deliveryDate: defaultDelivery || '',
          notes: 'Extraído por quantidade x item',
        });
        continue;
      }

      // Fallback single line
      if (trimmed.length > 3) {
        orders.push({
          orderId: `#ORD-${Math.floor(1000 + Math.random() * 9000)}`,
          store: defaultStore || 'Matriz',
          itemDescription: trimmed,
          quantity: 1,
          unit: 'un',
          priority: isHighPriorityAll ? 'ALTA PRIORIDADE' : 'NORMAL',
          productionDate: 'Aguardando Data',
          deliveryDate: defaultDelivery || '',
          notes: 'Extraído do texto',
        });
      }
    }

    return orders;
  };

  const handleProcessEmail = async () => {
    if (!emailText.trim()) {
      setErrorMessage('Por favor, cole o texto do e-mail ou lista de pedidos antes de processar.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    const formattedDefaultDelivery = expectedDeliveryDate
      ? expectedDeliveryDate.split('-').reverse().join('/')
      : '';

    try {
      let ordersWithDelivery: ExtractedOrder[] = [];
      let summaryText = 'Extração de itens concluída com sucesso!';

      try {
        const res = await fetch('/api/extract-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emailText,
            storeName: selectedStore,
            referenceDate,
            deliveryDate: formattedDefaultDelivery,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data && data.orders && data.orders.length > 0) {
            ordersWithDelivery = (data.orders || []).map((o: any) => ({
              ...o,
              deliveryDate: o.deliveryDate || formattedDefaultDelivery,
            }));
            summaryText = data.summary || summaryText;
          }
        }
      } catch (networkOrApiErr) {
        console.warn('API error during extraction, fallback to local parsing:', networkOrApiErr);
      }

      // If API returned no orders or was unreachable, run local parser
      if (ordersWithDelivery.length === 0) {
        const localOrders = parseOrdersLocally(emailText, selectedStore, formattedDefaultDelivery);
        if (localOrders.length > 0) {
          ordersWithDelivery = localOrders;
          summaryText = `Foram identificados ${localOrders.length} item(ns) de produção no texto informado.`;
        } else {
          throw new Error('Não foi possível identificar pedidos no texto informado. Verifique o formato e tente novamente.');
        }
      }

      // Attach image if user selected an image with applyImageToAll
      const ordersWithImage = ordersWithDelivery.map((o) => ({
        ...o,
        imageUrl: o.imageUrl || (applyImageToAll && attachedImage ? attachedImage : undefined),
      }));

      setExtractedOrders(ordersWithImage);
      setAiSummary(summaryText);

      // Add a success log
      const newLog: ActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: `Extração ${selectedStore}`,
        store: selectedStore,
        itemsCount: `${ordersWithDelivery.length} itens`,
        timeAgo: 'Agora',
        status: 'SUCESSO',
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Ocorreu um erro durante o processamento do texto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveExtractedOrder = (indexToRemove: number) => {
    setExtractedOrders((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateExtractedDeliveryDate = (index: number, newDate: string) => {
    setExtractedOrders((prev) =>
      prev.map((ord, idx) => (idx === index ? { ...ord, deliveryDate: newDate } : ord))
    );
  };

  const handleConfirmAndAddToDashboard = () => {
    if (extractedOrders.length === 0) return;

    const formattedDefaultDelivery = expectedDeliveryDate
      ? expectedDeliveryDate.split('-').reverse().join('/')
      : '';

    const newItems: OrderItem[] = extractedOrders.map((ext, idx) => {
      const itemStore = ext.store || selectedStore;
      const descHasQty = ext.itemDescription.toLowerCase().startsWith(`${ext.quantity}x`) ||
                         ext.itemDescription.toLowerCase().startsWith(`${ext.quantity} `);
      const formattedDesc = descHasQty ? ext.itemDescription : `${ext.quantity}x ${ext.itemDescription}`;

      const finalDeliveryDate = ext.deliveryDate
        ? (ext.deliveryDate.includes('-') ? ext.deliveryDate.split('-').reverse().join('/') : ext.deliveryDate)
        : formattedDefaultDelivery;

      const itemImg = ext.imageUrl || (applyImageToAll && attachedImage ? attachedImage : undefined);
      const nowStr = new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const authorName = currentUser?.name || 'Entrada de Pedidos';

      const initialLog: OrderStatusHistoryLog = {
        id: `log-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: nowStr,
        author: authorName,
        status: 'pendente',
        reason: 'Pedido Recebido',
        note: `Pedido recebido e lançado no sistema para a loja ${itemStore}. Quantidade: ${ext.quantity} ${sanitizeUnit(ext.unit)}.`,
        actionType: 'status_update',
      };

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
        productionDate: 'Aguardando Data',
        deliveryDate: finalDeliveryDate,
        priority: ext.priority?.includes('ALTA') ? 'ALTA PRIORIDADE' : 'NORMAL',
        executionStatus: 'pendente',
        imageUrl: itemImg,
        images: itemImg ? [itemImg] : undefined,
        statusHistory: [initialLog],
      };
    });

    onAddOrdersToPlanning(newItems);

    // Trigger automatic notifications for new orders received
    newItems.forEach((item) => {
      notifyOrderReceived(item.orderId, item.store, item.itemDescription);
    });

    setEmailText('');
    setExtractedOrders([]);
    setAiSummary(null);

    if (onNavigateToPendingDate) {
      onNavigateToPendingDate();
    } else {
      onNavigateToDashboard();
    }
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
            {/* Expected Delivery Date Field */}
            <div className="space-y-1.5">
              <label className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-amber-600">event</span>
                <span>Data Prevista de Entrega</span>
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
              />
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={individualFileInputRef}
              onChange={handleIndividualImageChange}
              accept="image/*"
              className="hidden"
            />

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
                rows={8}
                className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 font-medium resize-none text-slate-900"
              />

              <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
                <span className="material-symbols-outlined text-[16px]">info</span>
                <span>Estrutura recomendada: [OP] [LOJA] - [QUANTIDADE] [DESCRIÇÃO]. Ex: 5376 GRANSUZANO - 1 BL3052 VENEZ.6F</span>
              </p>

              {/* Discreet Image Attachment positioned directly below the textarea */}
              <div className="pt-1">
                {!attachedImage ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleProcessImageFile(file);
                    }}
                    className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                      isDraggingImage
                        ? 'border-blue-500 bg-blue-50/80 scale-[0.99]'
                        : 'border-slate-200/80 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-lg border border-slate-200 hover:border-blue-300 shadow-2xs transition-colors cursor-pointer"
                        title="Clique para anexar foto da peça ou desenho técnico (ou cole com Ctrl+V)"
                      >
                        {isProcessingImage ? (
                          <span className="material-symbols-outlined text-[18px] text-blue-600 animate-spin">sync</span>
                        ) : (
                          <span className="material-symbols-outlined text-[18px] text-blue-600">photo_camera</span>
                        )}
                        <span>{isProcessingImage ? 'Processando imagem...' : 'Anexar Foto / Desenho'}</span>
                      </button>
                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        (Opcional • JPG, PNG ou Ctrl+V)
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-400 font-medium">
                      Vincula imagem às OPs extraídas
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        onClick={() =>
                          setLightboxData({
                            url: attachedImage,
                            title: attachedImageName || 'Imagem Anexada',
                            orderId: 'Anexo do Pedido',
                          })
                        }
                        className="relative w-10 h-10 rounded-lg overflow-hidden border border-blue-300 shadow-2xs group shrink-0 cursor-pointer"
                        title="Clique para ampliar a imagem"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attachedImage}
                          alt="Thumbnail do pedido"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="material-symbols-outlined text-white text-[14px]">zoom_in</span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {attachedImageName || 'foto-pedido.jpg'}
                          </span>
                          {attachedImageSize && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              ({formatFileSize(attachedImageSize)})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxData({
                                url: attachedImage,
                                title: attachedImageName || 'Imagem Anexada',
                                orderId: 'Anexo do Pedido',
                              })
                            }
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">visibility</span>
                            <span>Ampliar</span>
                          </button>

                          <label className="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={applyImageToAll}
                              onChange={(e) => setApplyImageToAll(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span>Vincular a todas as OPs</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer"
                        title="Trocar Foto"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveAttachedImage}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover Foto"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                  {/* Summary metrics banner */}
                  <div className="p-3.5 bg-blue-50/80 border border-blue-100 text-blue-900 rounded-xl text-xs mb-3 space-y-2.5">
                    {aiSummary && (
                      <div className="text-[11px] font-medium text-blue-800 border-b border-blue-100 pb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-blue-600">auto_awesome</span>
                        <span>{aiSummary}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/90 p-2 rounded-lg border border-blue-100/80 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Itens
                        </span>
                        <span className="font-extrabold text-sm text-blue-900">
                          {extractedOrders.length}
                        </span>
                      </div>

                      <div className="bg-white/90 p-2 rounded-lg border border-blue-100/80 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Peças
                        </span>
                        <span className="font-extrabold text-sm text-emerald-700">
                          {extractedOrders.reduce((acc, curr) => acc + (Number(curr.quantity) || 1), 0)}
                        </span>
                      </div>

                      <div className="bg-white/90 p-2 rounded-lg border border-blue-100/80 shadow-2xs">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          OPs Únicas
                        </span>
                        <span className="font-extrabold text-sm text-indigo-900">
                          {
                            new Set(
                              extractedOrders
                                .map((o) => (o.orderId ? o.orderId.trim().toUpperCase() : ''))
                                .filter(Boolean)
                            ).size
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                    {extractedOrders.map((ord, idx) => {
                      const itemImg = ord.imageUrl || (applyImageToAll && attachedImage ? attachedImage : undefined);

                      return (
                        <div
                          key={idx}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 hover:border-blue-500 transition-all"
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
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExtractedIndexForImage(idx);
                                  individualFileInputRef.current?.click();
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title={itemImg ? 'Trocar imagem desta OP' : 'Adicionar imagem a esta OP'}
                              >
                                <span className="material-symbols-outlined text-[17px]">
                                  {itemImg ? 'edit_square' : 'add_photo_alternate'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtractedOrder(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remover item da lista"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            {itemImg && (
                              <div
                                onClick={() =>
                                  setLightboxData({
                                    url: itemImg,
                                    title: `${ord.orderId || 'OP'} - ${ord.itemDescription}`,
                                    subtitle: `Loja: ${ord.store || selectedStore}`,
                                    orderId: ord.orderId,
                                  })
                                }
                                className="relative w-12 h-12 rounded-lg overflow-hidden border border-blue-200 shadow-2xs group shrink-0 cursor-pointer"
                                title="Clique para ampliar foto/desenho"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={itemImg}
                                  alt="Miniatura"
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <span className="material-symbols-outlined text-white text-xs">zoom_in</span>
                                </div>
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-slate-900 leading-snug">
                                {ord.quantity}x {ord.itemDescription}
                              </p>
                              {itemImg && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                                    <span className="material-symbols-outlined text-[12px]">image</span>
                                    Imagem Anexada
                                  </span>
                                  {ord.imageUrl && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIndividualImage(idx)}
                                      className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                                    >
                                      Remover foto
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium pt-1.5 border-t border-slate-100 gap-2">
                            <span>Loja: <strong className="text-slate-700">{ord.store || selectedStore}</strong></span>
                            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">local_shipping</span>
                              <span>Entrega: {ord.deliveryDate || expectedDeliveryDate.split('-').reverse().join('/')}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleConfirmAndAddToDashboard}
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                    <span>Salvar em Aguardando Data ({extractedOrders.length} itens)</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-400 mt-2 font-medium">
                    Os pedidos serão enviados para a fila de <strong>Aguardando Data</strong> para o gerente programar o dia de produção.
                  </p>
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
                  <p>As lojas e números de OP são identificados automaticamente em cada linha.</p>
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

      {/* Lightbox Image Modal */}
      <ImageLightboxModal
        isOpen={!!lightboxData}
        onClose={() => setLightboxData(null)}
        imageUrl={lightboxData?.url || null}
        title={lightboxData?.title}
        subtitle={lightboxData?.subtitle}
        orderId={lightboxData?.orderId}
      />
    </div>
  );
};
