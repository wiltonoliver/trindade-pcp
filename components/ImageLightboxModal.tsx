'use client';

import React, { useState, useEffect } from 'react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  orderId?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  orderId,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setZoom(1);
        setRotation(0);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleClose = () => {
    setZoom(1);
    setRotation(0);
    onClose();
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
              <span className="material-symbols-outlined text-2xl">image</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {orderId && (
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-md text-xs font-bold font-mono">
                    {orderId}
                  </span>
                )}
                <h3 className="font-bold text-sm sm:text-base text-white truncate">
                  {title || 'Imagem do Pedido / Projeto'}
                </h3>
              </div>
              {subtitle && (
                <p className="text-xs text-slate-400 font-medium truncate max-w-xl">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={`pedido-${orderId || 'imagem'}.jpg`}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Abrir imagem em nova guia"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
              <span className="hidden sm:inline">Abrir</span>
            </a>

            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Viewport with Zoom and Rotation */}
        <div className="flex-1 min-h-[360px] sm:min-h-[480px] bg-slate-950 flex items-center justify-center overflow-auto p-4 relative select-none">
          <div
            className="transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title || 'Desenho ou foto do pedido'}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing"
              draggable={false}
            />
          </div>

          {/* Floating Controls Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-850/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-2xl text-white">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 hover:bg-slate-700 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
              title="Diminuir Zoom (-)"
            >
              <span className="material-symbols-outlined text-lg">zoom_out</span>
            </button>

            <span className="text-xs font-mono font-bold text-slate-300 min-w-[45px] text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="p-1.5 hover:bg-slate-700 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
              title="Aumentar Zoom (+)"
            >
              <span className="material-symbols-outlined text-lg">zoom_in</span>
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Girar Imagem 90°"
            >
              <span className="material-symbols-outlined text-lg">rotate_right</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-[11px] font-bold bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
              title="Redefinir Zoom e Rotação"
            >
              100%
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-blue-400">info</span>
            <span>Use os controles inferiores para dar zoom e rotacionar o desenho técnico/foto.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
