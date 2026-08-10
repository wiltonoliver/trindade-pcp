'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OrderItem, UserProfile, AssemblyOperator, Store } from '@/types/factory';
import { saveOrderToFirestore } from '@/lib/firestoreSync';
import jsQR from 'jsqr';

interface ExpeditionScreenProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  currentUser?: UserProfile | null;
  operators?: AssemblyOperator[];
  stores?: Store[];
}

export interface DispatchLogEntry {
  id: string;
  orderId: string;
  itemDescription: string;
  store: string;
  quantity: number;
  unit?: string;
  scannedCode: string;
  dispatchedAt: string;
  dispatchedBy: string;
  operatorName?: string;
}

export const ExpeditionScreen: React.FC<ExpeditionScreenProps> = ({
  orders,
  setOrders,
  currentUser,
  operators = [],
  stores = [],
}) => {
  // Input and Scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [autoDispatchOnScan, setAutoDispatchOnScan] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<OrderItem | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Local state for today's dispatch history
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogEntry[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trindade_expedition_logs');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse dispatch logs', e);
        }
      }
    }
    return [];
  });
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');

  // Video / Canvas refs for Camera Barcode Scanner
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scanAnimFrameRef = useRef<number | null>(null);
  const scanFrameRef = useRef<() => void>(() => {});

  // Web Audio Synth for Beep & Error sound effects
  const playSound = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        // High crisp beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Low error buzzer
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback error', e);
    }
  };

  const saveLogsToStorage = (newLogs: DispatchLogEntry[]) => {
    setDispatchLogs(newLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trindade_expedition_logs', JSON.stringify(newLogs));
    }
  };

  // Auto focus input field for physical barcode scanners
  useEffect(() => {
    if (!isCameraActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCameraActive]);

  // Search order helper by code
  const findOrderByCode = useCallback((codeRaw: string): OrderItem | null => {
    if (!codeRaw || !codeRaw.trim()) return null;
    const clean = codeRaw.trim().toUpperCase().replace(/#/g, '');

    // 1. Direct ID / OP Number match
    let matched = orders.find((o) => {
      const opNum = (o.orderId || o.id || '').replace(/#/g, '').trim().toUpperCase();
      return opNum === clean;
    });
    if (matched) return matched;

    // 2. Barcode text match (e.g., 31458RAGUEB or 31458-PORTA or BC3026-PORTA)
    matched = orders.find((o) => {
      const opNum = (o.orderId || o.id || '').replace(/#/g, '').trim().toUpperCase();
      const storeName = (o.store || '').trim().toUpperCase();
      const combined = `${opNum}${storeName}`;
      const barcode1 = `${opNum}-PORTA`;
      const barcode2 = `BC3026-PORTA`;

      return (
        clean === combined ||
        clean === barcode1 ||
        clean === barcode2 ||
        clean.startsWith(opNum) ||
        (clean.length >= 4 && combined.startsWith(clean))
      );
    });

    if (matched) return matched;

    // 3. Match item description or assigned operator
    matched = orders.find((o) => o.itemDescription.toUpperCase().includes(clean));

    return matched || null;
  }, [orders]);

  // Execute Dispatch / Checkout Action ("Dar Baixa na Saída")
  const executeDispatch = useCallback((orderToDispatch: OrderItem, scannedCode: string) => {
    const nowStr = new Date().toLocaleString('pt-BR');
    const userAuthor = currentUser?.name || 'Operador de Expedição';

    // Update order status
    const updatedOrder: OrderItem = {
      ...orderToDispatch,
      executionStatus: 'concluido',
      progress: 100,
      column: 'dia_15', // Marked in final completion stage
      statusHistory: [
        ...(orderToDispatch.statusHistory || []),
        {
          id: `log-exp-${Date.now()}`,
          timestamp: new Date().toISOString(),
          author: userAuthor,
          status: 'concluido',
          actionType: 'status_update',
          note: `🚚 BAIXA NA EXPEDIÇÃO REALIZADA VIA LEITOR (CÓD: ${scannedCode})`,
        },
      ],
    };

    // Update in React State & Firestore
    setOrders((prev) => prev.map((o) => (o.id === orderToDispatch.id ? updatedOrder : o)));
    saveOrderToFirestore(updatedOrder).catch((err) => console.error('Error saving dispatched order:', err));

    // Add entry to local dispatch logs
    const newLogEntry: DispatchLogEntry = {
      id: `disp-${Date.now()}`,
      orderId: orderToDispatch.orderId || orderToDispatch.id,
      itemDescription: orderToDispatch.itemDescription,
      store: orderToDispatch.store,
      quantity: orderToDispatch.quantity,
      unit: orderToDispatch.unit,
      scannedCode,
      dispatchedAt: nowStr,
      dispatchedBy: userAuthor,
      operatorName: orderToDispatch.assignedOperatorName,
    };

    saveLogsToStorage([newLogEntry, ...dispatchLogs]);

    // Haptic & Sound feedback
    playSound('success');
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    setFeedbackMessage({
      type: 'success',
      text: `✅ BAIXA EFETUADA COM SUCESSO! Pedido OP ${orderToDispatch.orderId} (${orderToDispatch.store}) liberado para expedição.`,
    });

    // Reset current search state after delay
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  }, [currentUser, dispatchLogs, setOrders]);

  // Process code input / scan
  const handleProcessCode = useCallback((codeRaw: string) => {
    if (!codeRaw || !codeRaw.trim()) return;
    const cleanCode = codeRaw.trim().toUpperCase();
    setScannedResult(cleanCode);

    const found = findOrderByCode(cleanCode);

    if (found) {
      setFoundOrder(found);
      if (autoDispatchOnScan) {
        executeDispatch(found, cleanCode);
      } else {
        playSound('success');
        setFeedbackMessage({
          type: 'info',
          text: `🔍 Pedido OP ${found.orderId} (${found.store}) localizado. Confirme a baixa de saída abaixo.`,
        });
      }
    } else {
      setFoundOrder(null);
      playSound('error');
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([300]);
      }
      setFeedbackMessage({
        type: 'error',
        text: `⚠️ CÓDIGO NÃO ENCONTRADO (${cleanCode}). Verifique a etiqueta ou busque manualmente.`,
      });
    }

    setBarcodeInput('');
    if (inputRef.current) inputRef.current.focus();
  }, [findOrderByCode, autoDispatchOnScan, executeDispatch]);

  // Form submit for physical barcode gun or keyboard typing
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessCode(barcodeInput);
  };

  // Revert Dispatch / Undo Checkout ("Estornar Baixa")
  const handleRevertDispatch = (logEntry: DispatchLogEntry) => {
    const targetOrder = orders.find((o) => (o.orderId || o.id) === logEntry.orderId);
    if (targetOrder) {
      const logId = `log-rev-${logEntry.id}`;
      const userName = currentUser?.name || 'Operador de Expedição';

      const revertedOrder: OrderItem = {
        ...targetOrder,
        executionStatus: 'pendente',
        progress: 50,
        statusHistory: [
          ...(targetOrder.statusHistory || []),
          {
            id: logId,
            timestamp: logEntry.dispatchedAt,
            author: userName,
            status: 'pendente',
            actionType: 'status_update',
            note: `↩️ BAIXA DE EXPEDIÇÃO ESTORNADA POR ${userName}`,
          },
        ],
      };
      setOrders((prev) => prev.map((o) => (o.id === targetOrder.id ? revertedOrder : o)));
      saveOrderToFirestore(revertedOrder).catch((e) => console.error(e));
    }

    const updatedLogs = dispatchLogs.filter((l) => l.id !== logEntry.id);
    saveLogsToStorage(updatedLogs);

    setFeedbackMessage({
      type: 'info',
      text: `↩️ Baixa de expedição da OP ${logEntry.orderId} foi estornada com sucesso.`,
    });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Camera Scanning Loop using canvas + jsQR
  const scanCameraFrame = useCallback(() => {
    if (!isCameraActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && code.data.trim()) {
        const detectedText = code.data.trim();
        handleProcessCode(detectedText);
        
        // Pause continuous scan briefly to avoid double-triggers
        setTimeout(() => {
          if (isCameraActive && scanFrameRef.current) {
            scanAnimFrameRef.current = requestAnimationFrame(scanFrameRef.current);
          }
        }, 1500);
        return;
      }
    }

    if (scanFrameRef.current) {
      scanAnimFrameRef.current = requestAnimationFrame(scanFrameRef.current);
    }
  }, [isCameraActive, handleProcessCode]);

  // Keep ref up to date with latest scanCameraFrame function
  useEffect(() => {
    scanFrameRef.current = scanCameraFrame;
  }, [scanCameraFrame]);

  // Start Camera Stream
  const startCameraStream = async (deviceId?: string) => {
    try {
      setIsCameraActive(true);
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Enumerate available video input camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videoIn);

      // Start processing frames
      scanAnimFrameRef.current = requestAnimationFrame(scanCameraFrame);
    } catch (err) {
      console.error('Camera access error:', err);
      setIsCameraActive(false);
      setFeedbackMessage({
        type: 'error',
        text: '❌ Erro ao acessar a câmera do celular. Certifique-se de conceder a permissão de vídeo no seu navegador.',
      });
    }
  };

  // Stop Camera Stream
  const stopCameraStream = () => {
    if (scanAnimFrameRef.current) {
      cancelAnimationFrame(scanAnimFrameRef.current);
      scanAnimFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (scanAnimFrameRef.current) cancelAnimationFrame(scanAnimFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Filtered history list
  const filteredDispatchLogs = dispatchLogs.filter((log) => {
    const matchesSearch =
      log.orderId.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      log.store.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      log.itemDescription.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      log.dispatchedBy.toLowerCase().includes(historySearchTerm.toLowerCase());

    const matchesStore = storeFilter === 'all' || log.store === storeFilter;

    return matchesSearch && matchesStore;
  });

  // Calculate expedition statistics
  const completedOrdersReady = orders.filter((o) => o.executionStatus === 'concluido' || o.progress === 100);
  const totalOrders = orders.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              <span>Expedição Industrial & Baixa de Saída</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Módulo de Expedição por Código de Barras</span>
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              Utilize a <strong>câmera do celular/tablet</strong> ou um <strong>leitor óptico USB/Bluetooth</strong> para bipar as etiquetas Zebra dos produtos montados e efetuar a baixa de saída automatizada no estoque da Trindade Esquadrias.
            </p>
          </div>

          {/* Quick Scanner Action Button */}
          <div className="flex flex-wrap items-center gap-3">
            {!isCameraActive ? (
              <button
                type="button"
                onClick={() => startCameraStream()}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer border border-emerald-400"
              >
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                <span>Usar Câmera do Celular</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCameraStream}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl text-xs transition-all flex items-center gap-2 shadow-xl shadow-rose-600/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">videocam_off</span>
                <span>Fechar Câmera</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Expedition Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Baixas Efetuadas Hoje</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{dispatchLogs.length}</p>
          </div>

          <div className="bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-500/30">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Prontos p/ Expedição</p>
            <p className="text-2xl font-black text-white mt-1">{completedOrdersReady.length}</p>
          </div>

          <div className="bg-blue-950/30 p-3.5 rounded-2xl border border-blue-500/30">
            <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Total de Pedidos PCP</p>
            <p className="text-2xl font-black text-blue-300 mt-1">{totalOrders}</p>
          </div>

          <div className="bg-purple-950/30 p-3.5 rounded-2xl border border-purple-500/30">
            <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Taxa de Saída</p>
            <p className="text-2xl font-black text-purple-300 mt-1">
              {totalOrders > 0 ? Math.round((completedOrdersReady.length / totalOrders) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Camera Feed or Physical Input Bar (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Mobile Camera Viewport */}
          {isCameraActive && (
            <div className="bg-slate-900 rounded-3xl p-4 border border-slate-800 shadow-2xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Câmera do Celular Ativa
                  </span>
                </div>

                {cameraDevices.length > 1 && (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      startCameraStream(e.target.value);
                    }}
                    className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-xl px-2 py-1 focus:outline-none"
                  >
                    {cameraDevices.map((dev, idx) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label || `Câmera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Video Stream Wrapper */}
              <div className="relative w-full aspect-4/3 bg-black rounded-2xl overflow-hidden border-2 border-emerald-500/50">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated Scanner Laser Overlay */}
                <div className="absolute inset-0 border-2 border-dashed border-emerald-400/40 m-8 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                    <span className="w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                  </div>
                  {/* Laser Beam Line */}
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_#10b981] animate-pulse" />
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                    <span className="w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                  </div>
                </div>

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
                  Aproxime o código de barras da etiqueta
                </div>
              </div>
            </div>
          )}

          {/* Manual Barcode Input Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">barcode_reader</span>
                <span>Leitor de Código de Barras</span>
              </h3>

              {/* Auto Dispatch Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-[11px] font-bold text-slate-600">Baixa Automática</span>
                <input
                  type="checkbox"
                  checked={autoDispatchOnScan}
                  onChange={(e) => setAutoDispatchOnScan(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
              </label>
            </div>

            <form onSubmit={handleInputSubmit} className="space-y-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[22px]">
                  qr_code_scanner
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Bipar etiqueta (ex: 31458RAGUEB ou BC3026)..."
                  className="w-full pl-11 pr-24 py-3.5 bg-slate-50 border-2 border-slate-300 focus:border-blue-600 rounded-2xl text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white transition-all shadow-inner"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Bipar / Buscar
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                💡 Leitores ópticos USB/Bluetooth disparam o código automaticamente ao ler a etiqueta.
              </p>
            </form>
          </div>

          {/* Status Feedback Toast Banner */}
          {feedbackMessage && (
            <div
              className={`p-4 rounded-2xl font-bold text-xs flex items-start gap-3 shadow-md animate-fade-in ${
                feedbackMessage.type === 'success'
                  ? 'bg-emerald-500 text-slate-950 border border-emerald-400'
                  : feedbackMessage.type === 'error'
                  ? 'bg-rose-600 text-white border border-rose-500'
                  : 'bg-blue-600 text-white border border-blue-500'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                {feedbackMessage.type === 'success' ? 'check_circle' : feedbackMessage.type === 'error' ? 'error' : 'info'}
              </span>
              <p className="leading-snug">{feedbackMessage.text}</p>
            </div>
          )}
        </div>

        {/* Right Column: Scanned Item Inspection Card (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-700 text-[22px]">inventory_2</span>
                  <h3 className="text-base font-black text-slate-900">
                    Inspeção do Item Bipado
                  </h3>
                </div>

                {foundOrder && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${
                      foundOrder.executionStatus === 'concluido'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {foundOrder.executionStatus === 'concluido' ? 'Concluído / Prontos' : 'Em Produção / Pendente'}
                  </span>
                )}
              </div>

              {foundOrder ? (
                <div className="mt-6 space-y-5">
                  {/* Order Main Identifier */}
                  <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg space-y-1 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        Ordem de Produção (OP)
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                        {scannedResult || foundOrder.orderId}
                      </span>
                    </div>

                    <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
                      OP #{foundOrder.orderId} - <span className="text-emerald-400 uppercase">{foundOrder.store}</span>
                    </div>

                    <p className="text-xs text-slate-300 font-medium pt-1">
                      {foundOrder.itemDescription}
                    </p>
                  </div>

                  {/* Order Specifications Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Quantidade / Unidade</p>
                      <p className="text-base font-black text-slate-900 mt-0.5">
                        {foundOrder.quantity} {foundOrder.unit || 'un'}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Montador Atribuído</p>
                      <p className="text-base font-black text-slate-900 mt-0.5 truncate">
                        {foundOrder.assignedOperatorName || 'Não Informado'}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Data de Produção</p>
                      <p className="text-base font-black text-slate-900 mt-0.5">
                        {foundOrder.productionDate || 'Não definida'}
                      </p>
                    </div>
                  </div>

                  {/* Manual Confirmation Dispatch Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => executeDispatch(foundOrder, scannedResult || foundOrder.orderId)}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400"
                    >
                      <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                      <span>EFETUAR BAIXA DE SAÍDA NA EXPEDIÇÃO NOW 🚚</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-12 mb-12 text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
                    <span className="material-symbols-outlined text-3xl">barcode_reader</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Aguardando Leitura da Etiqueta</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Aproxime o leitor de código de barras ou ative a câmera do celular para consultar e descarregar o item da expedição.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Usuário Responsável: <strong>{currentUser?.name || 'Operador'}</strong></span>
              <span>Módulo: <strong>Expedição & Logística</strong></span>
            </div>
          </div>
        </div>

      </div>

      {/* Dispatch History & Daily Report Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[22px]">history</span>
              <span>Histórico e Relatório de Baixas de Hoje</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro completo de todas as saídas efetuadas na expedição nesta sessão.
            </p>
          </div>

          {/* Search & Store Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Filtrar histórico..."
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Todas as Lojas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dispatch History Table */}
        {filteredDispatchLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <span className="material-symbols-outlined text-4xl text-slate-300">
              local_shipping
            </span>
            <p className="text-xs font-bold text-slate-600">Nenhuma baixa de expedição registrada ainda hoje.</p>
            <p className="text-[11px] text-slate-400">Biper uma etiqueta para registrar a primeira saída de produto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Data/Hora Baixa</th>
                  <th className="py-3 px-4">OP / Código</th>
                  <th className="py-3 px-4">Loja / Cliente</th>
                  <th className="py-3 px-4">Descrição do Item</th>
                  <th className="py-3 px-4">Qtd</th>
                  <th className="py-3 px-4">Montador</th>
                  <th className="py-3 px-4">Resp. Expedição</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {filteredDispatchLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {log.dispatchedAt}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-900 text-white font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                        OP #{log.orderId}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-blue-700">
                      {log.store}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-900">
                      {log.itemDescription}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {log.quantity} {log.unit || 'un'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.operatorName || '-'}
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">
                      {log.dispatchedBy}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRevertDispatch(log)}
                        title="Estornar Baixa"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold rounded-lg transition-colors border border-slate-200 text-[11px] cursor-pointer inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">undo</span>
                        <span>Estornar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
