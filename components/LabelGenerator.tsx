'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OrderItem, AssemblyOperator, Store } from '@/types/factory';
import { BatchLabelModal } from './BatchLabelModal';
import { renderBarcodeSVG } from '@/lib/barcodeUtils';

interface LabelGeneratorProps {
  orders: OrderItem[];
  operators?: AssemblyOperator[];
  stores?: Store[];
  preselectedOrderId?: string | null;
  onClearPreselectedOrder?: () => void;
}

export type LabelPreset = '100x30' | '100x50' | '50x30' | '100x150';

export const LabelGenerator: React.FC<LabelGeneratorProps> = ({
  orders,
  operators = [],
  stores = [],
  preselectedOrderId = null,
  onClearPreselectedOrder,
}) => {
  // Config States
  const [selectedPreset, setSelectedPreset] = useState<LabelPreset>('100x30');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  
  // Label Fields State
  const [companyHeader, setCompanyHeader] = useState('');
  const [opNumber, setOpNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [unit, setUnit] = useState('UN');
  const [productionDate, setProductionDate] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [priorityText, setPriorityText] = useState('NORMAL');
  const [lotCode, setLotCode] = useState('');
  const [observations, setObservations] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');
  
  // Printing & Copies Settings
  const [copiesCount, setCopiesCount] = useState<number>(1);
  const [isVolumeSequential, setIsVolumeSequential] = useState(false);
  const [barcodeType, setBarcodeType] = useState<'code128' | 'qr' | 'both'>('code128');
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Helper to populate fields from OrderItem
  const populateFromOrder = useCallback((ord: OrderItem) => {
    setOpNumber(ord.orderId || ord.id);
    setClientName(ord.store || 'Loja Principal');
    setItemDesc(ord.itemDescription || '');
    setQuantity(ord.quantity || 1);
    setCopiesCount(ord.quantity || 1);
    setIsVolumeSequential((ord.quantity || 1) > 1);
    setUnit(ord.unit || 'UN');
    setProductionDate(ord.productionDate || new Date().toLocaleDateString('pt-BR'));
    setOperatorName(ord.assignedOperatorName || '');
    setPriorityText(ord.priority || 'NORMAL');
    
    // Generate clean lot code: LOT-[DATE]-[OP]
    const cleanOp = (ord.orderId || ord.id).replace(/[^a-zA-Z0-9]/g, '');
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    setLotCode(`LOT-${todayStr}-${cleanOp.slice(-4)}`);
    setBarcodeValue(ord.orderId || ord.id);
    setObservations(ord.pendingReason ? `Obs: ${ord.pendingReason}` : '');
  }, []);

  // Sync when preselectedOrderId changes
  useEffect(() => {
    if (!preselectedOrderId) return;
    const timer = setTimeout(() => {
      setSelectedOrderId(preselectedOrderId);
      const found = orders.find((o) => o.id === preselectedOrderId);
      if (found) {
        populateFromOrder(found);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [preselectedOrderId, orders, populateFromOrder]);

  // Handle Order Selection from Dropdown
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      if (onClearPreselectedOrder) onClearPreselectedOrder();
      return;
    }
    const found = orders.find((o) => o.id === orderId);
    if (found) {
      populateFromOrder(found);
    }
  };

  // Helper to trigger Zebra Direct Print with iframe/popup fallback
  const handlePrint = () => {
    try {
      const printContent = document.getElementById('zebra-print-area');
      if (!printContent) {
        window.print();
        return;
      }

      const pageSize = selectedPreset === '100x30' ? '100mm 30mm' : selectedPreset === '100x50' ? '100mm 50mm' : '100mm 150mm';
      const widthMm = '100mm';
      const heightMm = selectedPreset === '100x30' ? '30mm' : selectedPreset === '100x50' ? '50mm' : '150mm';

      const htmlDocument = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impressão Térmica Zebra ZD220</title>
            <meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page {
                size: ${pageSize};
                margin: 0;
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .zebra-label-item {
                  page-break-after: always !important;
                  break-after: page !important;
                  page-break-inside: avoid !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: ${widthMm} !important;
                  height: ${heightMm} !important;
                }
                .no-print-element {
                  display: none !important;
                }
              }
              body {
                margin: 0;
                padding: 10px;
                background: #f8fafc;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              }
              .zebra-label-item {
                box-sizing: border-box;
                margin: 0 auto 10px auto;
                background: white;
                width: ${widthMm};
                height: ${heightMm};
                display: flex;
                align-items: center;
                justify-content: center;
              }
            </style>
          </head>
          <body>
            <div class="no-print-element" style="text-align: center; margin-bottom: 12px; font-family: sans-serif;">
              <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer;">
                🖨️ CONFIRMAR IMPRESSÃO ZEBRA (${copiesCount} ${copiesCount === 1 ? 'etiqueta' : 'etiquetas'})
              </button>
            </div>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      // Strategy 1: Try window.open first (opens clean popup window outside iframe)
      const printWin = window.open('', '_blank', 'width=850,height=650');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlDocument);
        printWin.document.close();
        return;
      }

      // Strategy 2: If window.open is blocked by pop-up blocker in iframe, use hidden iframe
      let iframe = document.getElementById('zebra-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'zebra-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlDocument);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 500);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print trigger fallback:', err);
      window.print();
    }
  };

  // Generate array of label items to render for printing (based on copiesCount and volume sequential)
  const renderLabelContent = (copyIndex: number) => {
    const volText = isVolumeSequential ? `VOL ${copyIndex + 1}/${copiesCount}` : '';
    const headerTitle = companyHeader || (clientName ? `CLI: ${clientName}` : '');
    const showClientInBody = Boolean(companyHeader && clientName);

    if (selectedPreset === '100x30') {
      // 100mm x 30mm (Zebra Standard 10x3 cm) - High legibility layout with strict overflow prevention
      return (
        <div 
          className="w-[100mm] h-[30mm] bg-white border-2 border-black p-1 flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none"
          style={{ width: '100mm', height: '30mm', minWidth: '100mm', minHeight: '30mm', boxSizing: 'border-box', border: '2px solid black', padding: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}
        >
          {/* Header row */}
          <div 
            className="h-[6mm] flex items-center justify-between border-b-2 border-black pb-0.5 shrink-0"
            style={{ height: '6mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '2px', flexShrink: 0 }}
          >
            {headerTitle ? (
              <span className="text-[12px] font-black uppercase tracking-tight truncate max-w-[68%] leading-none" style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '68%' }}>
                {headerTitle}
              </span>
            ) : null}
            <div className={`flex items-center gap-1 shrink-0 ${headerTitle ? '' : 'w-full justify-end'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {volText && (
                <span className="text-[9px] font-black border border-black px-1 bg-black text-white rounded-xs leading-none" style={{ fontSize: '9px', fontWeight: 900, border: '1px solid black', padding: '1px 4px', backgroundColor: 'black', color: 'white' }}>
                  {volText}
                </span>
              )}
              <span className="text-[11px] font-black bg-black text-white px-1.5 py-0.5 rounded-xs uppercase leading-none" style={{ fontSize: '11px', fontWeight: 900, backgroundColor: 'black', color: 'white', padding: '2px 6px', textTransform: 'uppercase' }}>
                {opNumber || 'OP-0000'}
              </span>
            </div>
          </div>

          {/* Main info row */}
          <div className="flex items-center gap-1 my-0.5 flex-1 min-h-0 overflow-hidden" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', marginBottom: '2px', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
            <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 pr-1" style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', paddingRight: '4px' }}>
              {showClientInBody && (
                <div className="text-[10px] font-bold text-black leading-tight truncate" style={{ fontSize: '10px', fontWeight: 700, color: 'black', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong className="text-black uppercase">CLI:</strong> <span className="font-black text-[11px] uppercase" style={{ fontWeight: 900, fontSize: '11px' }}>{clientName}</span>
                </div>
              )}
              <div className="text-[13.5px] font-black leading-[1.1] text-black uppercase break-words line-clamp-2 font-sans overflow-hidden" style={{ fontSize: '13.5px', fontWeight: 900, lineHeight: 1.1, color: 'black', textTransform: 'uppercase', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {itemDesc || 'PRODUTO / ITEM NÃO ESPECIFICADO'}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[9.5px] font-black text-black leading-tight" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '9.5px', fontWeight: 900, color: 'black' }}>
                <span>QTD: <strong style={{ fontSize: '11px', fontWeight: 900 }}>{quantity} {unit}</strong></span>
                {operatorName && <span>| OP: <strong>{operatorName}</strong></span>}
                {productionDate && <span>| {productionDate}</span>}
              </div>
            </div>

            {/* Barcode column - Exactly 25mm to 28mm width */}
            <div className="w-[28mm] flex flex-col items-center justify-center shrink-0 border-l-2 border-black pl-1 h-full my-auto" style={{ width: '28mm', minWidth: '28mm', maxWidth: '28mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderLeft: '2px solid black', paddingLeft: '4px', height: '100%' }}>
              {renderBarcodeSVG(barcodeValue || opNumber || 'TRINDADE', { 
                height: 38, 
                className: 'h-[10mm] w-[25mm]', 
                svgStyle: { height: '10mm', width: '25mm', maxHeight: '100%', maxWidth: '100%' },
                textClass: 'text-[8.5px] font-mono tracking-tight font-black text-black mt-0.5 leading-none' 
              })}
            </div>
          </div>

          {/* Footer row */}
          <div className="h-[4.5mm] flex items-center justify-between border-t-2 border-black pt-0.5 text-[8.5px] font-black leading-none shrink-0" style={{ height: '4.5mm', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid black', fontSize: '8.5px', fontWeight: 900, flexShrink: 0, paddingTop: '2px' }}>
            <span className="uppercase truncate max-w-[70%]" style={{ textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
              {lotCode ? `LOTE: ${lotCode}` : ''} {observations ? `| ${observations}` : ''}
            </span>
            <span className="font-mono text-[8.5px] font-black shrink-0 ml-1" style={{ fontFamily: 'monospace', fontSize: '8.5px', fontWeight: 900, flexShrink: 0, marginLeft: '4px' }}>TRINDADE PCP</span>
          </div>
        </div>
      );
    }

    if (selectedPreset === '100x50') {
      // 100mm x 50mm - Large legible typography
      return (
        <div 
          className="w-[100mm] h-[50mm] bg-white border-2 border-black p-2 flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none"
          style={{ width: '100mm', height: '50mm', minWidth: '100mm', minHeight: '50mm', boxSizing: 'border-box', border: '2px solid black', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}
        >
          <div className="flex items-center justify-between border-b-2 border-black pb-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '4px' }}>
            {companyHeader ? (
              <span className="text-[12px] font-black uppercase" style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}>{companyHeader}</span>
            ) : null}
            <span className={`text-[13px] font-black bg-black text-white px-2.5 py-0.5 rounded-xs ${companyHeader ? '' : 'ml-auto'}`} style={{ fontSize: '13px', fontWeight: 900, backgroundColor: 'black', color: 'white', padding: '2px 8px', textTransform: 'uppercase' }}>
              OP: {opNumber || '0000'}
            </span>
          </div>

          <div className="space-y-1 my-1" style={{ marginTop: '4px', marginBottom: '4px' }}>
            <div className="text-[12px] font-bold break-words" style={{ fontSize: '12px', fontWeight: 700 }}>
              CLIENTE/LOJA: <strong className="text-[14px] font-black uppercase" style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>{clientName || 'N/A'}</strong>
            </div>
            <div className="text-[18px] font-black uppercase leading-tight break-words whitespace-normal font-sans" style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.15 }}>
              {itemDesc || 'PRODUTO'}
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px] font-bold bg-gray-100 p-1 border-2 border-black" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#f3f4f6', padding: '4px', border: '2px solid black' }}>
              <div>QTD: <strong className="text-[13px] font-black" style={{ fontSize: '13px', fontWeight: 900 }}>{quantity} {unit}</strong></div>
              <div>DATA: <strong className="font-black" style={{ fontWeight: 900 }}>{productionDate}</strong></div>
              <div>PRIORIDADE: <strong className="font-black" style={{ fontWeight: 900 }}>{priorityText}</strong></div>
            </div>
          </div>

          {observations && (
            <div className="text-[11px] font-bold border-t border-dashed border-black pt-0.5" style={{ fontSize: '11px', fontWeight: 700, borderTop: '1px dashed black', paddingTop: '2px' }}>
              OBS: {observations}
            </div>
          )}

          <div className="flex items-center justify-between border-t-2 border-black pt-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid black', paddingTop: '4px' }}>
            <div className="text-[11px] font-mono font-bold" style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700 }}>
              <div>LOTE: <strong>{lotCode || 'N/A'}</strong></div>
              <div>OP: <strong>{operatorName || 'PCP'}</strong></div>
            </div>
            <div style={{ width: '32mm', minWidth: '32mm' }}>
              {renderBarcodeSVG(barcodeValue || opNumber || 'ZEBRA', { 
                height: 48, 
                className: 'h-11 w-full max-w-[240px]', 
                svgStyle: { height: '11mm', width: '30mm', maxHeight: '100%', maxWidth: '100%' },
                textClass: 'text-[11px] font-mono font-black' 
              })}
            </div>
          </div>
        </div>
      );
    }

    if (selectedPreset === '100x150') {
      // 100mm x 150mm (Caixas / Volume grandes)
      return (
        <div 
          className="w-[100mm] h-[150mm] bg-white border-4 border-black p-3.5 flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none"
          style={{ width: '100mm', height: '150mm', minWidth: '100mm', minHeight: '150mm', boxSizing: 'border-box', border: '4px solid black', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}
        >
          <div className="border-b-4 border-black pb-2 text-center" style={{ borderBottom: '4px solid black', paddingBottom: '8px', textAlign: 'center' }}>
            {companyHeader ? (
              <div className="text-[14px] font-black uppercase mb-1" style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>{companyHeader}</div>
            ) : null}
            <div className="text-[22px] font-black bg-black text-white py-1.5 uppercase" style={{ fontSize: '22px', fontWeight: 900, backgroundColor: 'black', color: 'white', padding: '6px 0', textTransform: 'uppercase' }}>
              ORDEM DE PRODUÇÃO: {opNumber || 'OP-0000'}
            </div>
          </div>

          <div className="space-y-3 my-2 text-left" style={{ marginTop: '8px', marginBottom: '8px' }}>
            <div className="border-b-2 border-black pb-1" style={{ borderBottom: '2px solid black', paddingBottom: '4px' }}>
              <span className="text-[11px] font-extrabold uppercase text-gray-700" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#374151' }}>CLIENTE / DESTINATÁRIO</span>
              <div className="text-[18px] font-black uppercase" style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>{clientName || 'N/A'}</div>
            </div>

            <div className="border-b-2 border-black pb-1" style={{ borderBottom: '2px solid black', paddingBottom: '4px' }}>
              <span className="text-[11px] font-extrabold uppercase text-gray-700" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#374151' }}>DESCRIÇÃO DO ITEM</span>
              <div className="text-[25px] font-black uppercase leading-snug" style={{ fontSize: '25px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.15 }}>{itemDesc || 'N/A'}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-2.5 border-2 border-black" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', backgroundColor: '#f3f4f6', padding: '10px', border: '2px solid black' }}>
              <div>
                <span className="text-[10px] font-extrabold text-gray-700 uppercase" style={{ fontSize: '10px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>QUANTIDADE TOTAL</span>
                <div className="text-[22px] font-black" style={{ fontSize: '22px', fontWeight: 900 }}>{quantity} {unit}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-700 uppercase" style={{ fontSize: '10px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>DATA FABRICAÇÃO</span>
                <div className="text-[16px] font-black" style={{ fontSize: '16px', fontWeight: 900 }}>{productionDate}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
              <div>
                <span className="text-[10px] font-extrabold text-gray-700 uppercase" style={{ fontSize: '10px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>RESPONSÁVEL / OP</span>
                <div className="text-[14px] font-black" style={{ fontSize: '14px', fontWeight: 900 }}>{operatorName || 'N/A'}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-700 uppercase" style={{ fontSize: '10px', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>VOLUME</span>
                <div className="text-[16px] font-black" style={{ fontSize: '16px', fontWeight: 900 }}>{volText || `VOL 1/1`}</div>
              </div>
            </div>

            {observations && (
              <div className="border-2 border-black p-2 text-[12px] font-bold" style={{ border: '2px solid black', padding: '8px', fontSize: '12px', fontWeight: 700 }}>
                <strong>OBSERVAÇÕES:</strong> {observations}
              </div>
            )}
          </div>

          <div className="border-t-4 border-black pt-3 flex flex-col items-center" style={{ borderTop: '4px solid black', paddingTop: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {renderBarcodeSVG(barcodeValue || opNumber || 'ZEBRA100', { 
              height: 60, 
              className: 'h-16 w-full max-w-[280px]', 
              svgStyle: { height: '16mm', width: '70mm', maxHeight: '100%', maxWidth: '100%' },
              textClass: 'text-[13px] font-mono font-black mt-1' 
            })}
            <span className="text-[10px] font-mono mt-1 font-black" style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 900, marginTop: '4px' }}>SISTEMA TRINDADE PCP - IMPRESSÃO ZEBRA ZD220</span>
          </div>
        </div>
      );
    }

    // Default Fallback
    return null;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Dynamic Thermal Print Engine CSS Injection */}
      <style jsx global>{`
        @media print {
          /* Hide all UI shell elements during print */
          body * {
            visibility: hidden;
          }
          #zebra-print-area, #zebra-print-area * {
            visibility: visible;
          }
          #zebra-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }

          /* Exact Zebra Thermal Page Size */
          @page {
            size: ${selectedPreset === '100x30' ? '100mm 30mm' : selectedPreset === '100x50' ? '100mm 50mm' : '100mm 150mm'};
            margin: 0;
          }

          .zebra-label-item {
            page-break-after: always;
            break-after: page;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[28px]">qr_code_2</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Gerador de Etiquetas Zebra ZD220
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                Térmica Direta
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Geração de etiquetas de produção com código de barras Code128 em lote para impressoras térmicas Zebra.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm text-xs transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            <span>Imprimir Peças Concluídas em Lote</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm text-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Imprimir {copiesCount} {copiesCount === 1 ? 'Etiqueta' : 'Etiquetas'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls & Right Visual Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Left Form Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Preset & PCP Order Selector Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">tune</span>
              <span>1. Configuração da Impressora & Dados do PCP</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Preset Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tamanho / Formato da Etiqueta:
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value as LabelPreset)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="100x30">100mm x 30mm (10x3 cm) - Zebra Padrão</option>
                  <option value="100x50">100mm x 50mm (10x5 cm) - Médio com Obs</option>
                  <option value="100x150">100mm x 150mm (10x15 cm) - Caixa / Volume</option>
                </select>
              </div>

              {/* Import from PCP Order */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Carregar de um Pedido / OP do PCP:
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => handleSelectOrder(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Seleção Manual / Personalizada --</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      OP: {ord.orderId || ord.id} - {ord.store} ({ord.itemDescription.substring(0, 25)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Label Fields Customization Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">edit_note</span>
              <span>2. Campos da Etiqueta</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cabeçalho (Opcional):</label>
                <input
                  type="text"
                  value={companyHeader}
                  onChange={(e) => setCompanyHeader(e.target.value)}
                  placeholder="Deixe em branco para ocultar"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Número da OP / Pedido:</label>
                <input
                  type="text"
                  value={opNumber}
                  onChange={(e) => {
                    setOpNumber(e.target.value);
                    if (!barcodeValue) setBarcodeValue(e.target.value);
                  }}
                  placeholder="Ex: OP-1045"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cliente / Loja:</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Loja Central - São Paulo"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descrição do Produto / Item:</label>
                <input
                  type="text"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Ex: Balcão Promocional MDF 18mm Branco"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quantidade & Unidade:</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-2/3 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  />
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-1/3 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Operador Responsável:</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Ex: Carlos Silva"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Código do Lote:</label>
                <input
                  type="text"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                  placeholder="Ex: LOT-2608-1045"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valor do Código de Barras:</label>
                <input
                  type="text"
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  placeholder="Ex: OP-1045"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações Adicionais:</label>
                <input
                  type="text"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: Embalagem reforçada / Cor Azul"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Batch Print Options */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">layers</span>
              <span>3. Opções de Impressão em Lote</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Cópias (Etiquetas em Sequência):
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={copiesCount}
                  onChange={(e) => setCopiesCount(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="volSeq"
                  checked={isVolumeSequential}
                  onChange={(e) => setIsVolumeSequential(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="volSeq" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Numerar Volumes Sequencialmente (VOL 1/N, VOL 2/N)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Panel (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md sticky top-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">visibility</span>
                <span className="font-bold text-sm tracking-wide">Pré-visualização Térmica</span>
              </div>
              
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewZoom(100)}
                  className={`px-2 py-0.5 rounded font-bold ${previewZoom === 100 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(130)}
                  className={`px-2 py-0.5 rounded font-bold ${previewZoom === 130 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  130%
                </button>
              </div>
            </div>

            {/* Label Canvas Container */}
            <div className="bg-slate-800 p-6 rounded-xl flex items-center justify-center min-h-[220px] overflow-x-auto border border-slate-700">
              <div
                style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'center center' }}
                className="transition-transform duration-200 shadow-xl"
              >
                {renderLabelContent(0)}
              </div>
            </div>

            {/* Print Specs Summary */}
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Modelo Impressora:</span>
                <strong className="text-white">Zebra ZD220 (ou compatível)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dimensão Física:</span>
                <strong className="text-emerald-400">{selectedPreset === '100x30' ? '100mm x 30mm (10x3 cm)' : selectedPreset === '100x50' ? '100mm x 50mm' : '100mm x 150mm'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total a Imprimir:</span>
                <strong className="text-white">{copiesCount} {copiesCount === 1 ? 'etiqueta' : 'etiquetas físicas'}</strong>
              </div>
            </div>

            {/* Action Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">print</span>
              <span>ENVIAR PARA IMPRESSORA ZEBRA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Print Container specifically targeted by @media print */}
      <div id="zebra-print-area" className="hidden print:block">
        {Array.from({ length: copiesCount }).map((_, copyIndex) => (
          <div key={copyIndex} className="zebra-label-item">
            {renderLabelContent(copyIndex)}
          </div>
        ))}
      </div>

      {/* Batch Label Generator Modal */}
      {isBatchModalOpen && (
        <BatchLabelModal
          orders={orders.filter((o) => o.executionStatus === 'concluido' || o.progress === 100)}
          titleDate="Lote Geral de Concluídos"
          defaultCompanyHeader={companyHeader}
          onClose={() => setIsBatchModalOpen(false)}
        />
      )}
    </div>
  );
};
