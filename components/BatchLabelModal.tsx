'use client';

import React, { useState, useEffect, useRef } from 'react';
import { OrderItem } from '@/types/factory';
import { renderBarcodeSVG } from '@/lib/barcodeUtils';

interface BatchLabelModalProps {
  orders: OrderItem[];
  onClose: () => void;
  titleDate?: string;
  defaultCompanyHeader?: string;
  autoPrint?: boolean;
}

export type LabelPreset = '100x30' | '100x50' | '100x150';

export interface PrinterMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const DEFAULT_PRINTER = 'ZEBRA ZD220';
const DEFAULT_MARGINS: PrinterMargins = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};

export const BatchLabelModal: React.FC<BatchLabelModalProps> = ({
  orders,
  onClose,
  titleDate = 'Peças Concluídas',
  defaultCompanyHeader = '',
  autoPrint = false,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<LabelPreset>('100x30');
  const [companyHeader, setCompanyHeader] = useState(defaultCompanyHeader);
  const [printMode, setPrintMode] = useState<'by_quantity' | 'fixed'>('by_quantity');
  const [quantityMultiplier, setQuantityMultiplier] = useState<number>(1);
  const [fixedCopiesPerItem, setFixedCopiesPerItem] = useState<number>(1);
  const [isVolumeSequential, setIsVolumeSequential] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(
    orders.map((o) => o.id)
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);

  // Sync selectedOrderIds when orders prop changes
  useEffect(() => {
    setSelectedOrderIds(orders.map((o) => o.id));
  }, [orders]);

  // Printer & Custom Margins (Defaults: ZEBRA ZD220 with Left=0, Top=0, Right=0, Bottom=0 for auto-centering)
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pcp_selected_printer');
      if (saved && saved !== 'ZDESIGNER L3250') {
        return saved;
      }
      return DEFAULT_PRINTER;
    }
    return DEFAULT_PRINTER;
  });

  const [margins, setMargins] = useState<PrinterMargins>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pcp_printer_margins');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            left: Number(parsed.left ?? DEFAULT_MARGINS.left),
            top: Number(parsed.top ?? DEFAULT_MARGINS.top),
            right: Number(parsed.right ?? DEFAULT_MARGINS.right),
            bottom: Number(parsed.bottom ?? DEFAULT_MARGINS.bottom),
          };
        }
      } catch {
        // ignore JSON parse error
      }
    }
    return DEFAULT_MARGINS;
  });

  const handleUpdatePrinter = (printer: string) => {
    setSelectedPrinter(printer);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pcp_selected_printer', printer);
    }
  };

  const handleUpdateMargin = (key: keyof PrinterMargins, val: number) => {
    const updated = { ...margins, [key]: Math.max(0, val) };
    setMargins(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pcp_printer_margins', JSON.stringify(updated));
    }
  };

  const handleResetDefaultMargins = () => {
    setSelectedPrinter(DEFAULT_PRINTER);
    setMargins(DEFAULT_MARGINS);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pcp_selected_printer', DEFAULT_PRINTER);
      localStorage.setItem('pcp_printer_margins', JSON.stringify(DEFAULT_MARGINS));
    }
  };

  // Filter items based on selection checkbox in modal
  const itemsToPrint = orders.filter((o) => selectedOrderIds.includes(o.id));

  // Helper to calculate labels count for a specific item
  const getCopiesForOrder = (ord: OrderItem) => {
    if (printMode === 'by_quantity') {
      const qty = Number(ord.quantity) || 1;
      return Math.max(1, qty) * Math.max(1, quantityMultiplier);
    }
    return Math.max(1, fixedCopiesPerItem);
  };

  const totalLabelsToPrint = itemsToPrint.reduce(
    (acc, ord) => acc + getCopiesForOrder(ord),
    0
  );

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  // Build standalone printable HTML document for Zebra ZD220
  const generatePrintHtml = () => {
    let widthMm = '100mm';
    let heightMm = '30mm';

    if (selectedPreset === '100x50') {
      heightMm = '50mm';
    } else if (selectedPreset === '100x150') {
      heightMm = '150mm';
    }

    const printContent = document.getElementById('batch-zebra-print-area');
    const contentHtml = printContent ? printContent.innerHTML : '';
    const printerTitle = selectedPrinter || DEFAULT_PRINTER;
    const totalLabels = totalLabelsToPrint;
    const firstOp = itemsToPrint[0]?.orderId || '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${printerTitle} - ${firstOp ? `OP #${firstOp}` : 'Etiquetas'} (${totalLabels} etiquetas)</title>
    <style>
      @page {
        size: ${widthMm} ${heightMm} !important;
        margin: 0 !important;
      }
      @media print {
        html, body {
          width: ${widthMm} !important;
          height: ${heightMm} !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print-bar { display: none !important; }
        .zebra-page-item {
          page-break-after: always !important;
          page-break-inside: avoid !important;
          break-after: page !important;
          width: ${widthMm} !important;
          height: ${heightMm} !important;
          max-height: ${heightMm} !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }
      }
      *, ::before, ::after {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        background: #0f172a;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .zebra-page-item {
        box-sizing: border-box;
        margin: 12px auto;
        background: white;
        width: ${widthMm};
        height: ${heightMm};
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 4px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
      }
      svg {
        display: block !important;
        max-width: 100% !important;
        max-height: 100% !important;
      }
    </style>
  </head>
  <body>
    <div class="no-print-bar" style="text-align: center; font-family: sans-serif; background: #1e293b; padding: 14px 20px; border-bottom: 2px solid #3b82f6; position: sticky; top: 0; z-index: 100;">
      <div style="font-size: 14px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">
        🖨️ Impressora: <u>${printerTitle}</u> (Zebra ZD220) &bull; Formato: ${widthMm} x ${heightMm}
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
        Total: <strong>${totalLabels} ${totalLabels === 1 ? 'etiqueta pronta' : 'etiquetas prontas'}</strong> &bull; Margens automáticas centralizadas (0mm)
      </div>
      <button onclick="window.print()" style="background: #2563eb; hover: #1d4ed8; color: white; border: none; padding: 10px 24px; font-weight: 800; border-radius: 8px; cursor: pointer; font-size: 13px; box-shadow: 0 2px 6px rgba(37,99,235,0.4);">
        🖨️ CLIQUE PARA IMPRIMIR AGORA (Ctrl + P)
      </button>
    </div>
    <div style="padding: 16px 0;">
      ${contentHtml}
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() {
          try {
            window.print();
          } catch(e) {
            console.error(e);
          }
        }, 350);
      };
    </script>
  </body>
</html>`;
  };

  // Open standalone print page in new tab
  const handleOpenInNewTab = () => {
    try {
      const html = generatePrintHtml();
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.open();
        newWin.document.write(html);
        newWin.document.close();
        newWin.focus();
        setPrintStatusMessage('Página de etiquetas aberta em nova aba com diálogo de impressão pronto!');
      } else {
        // If popup was blocked, fallback to blob URL click
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 2000);
        setPrintStatusMessage('Página aberta em nova aba! Confirme a impressão na janela.');
      }
    } catch (err) {
      console.error('Failed to open print tab:', err);
      setPrintStatusMessage('Erro ao abrir nova aba. Verifique se popups estão autorizados.');
    }
  };

  // Helper to trigger Zebra batch printing with exact margins
  const handlePrintBatch = () => {
    if (itemsToPrint.length === 0) return;

    setIsPrinting(true);
    setPrintStatusMessage(`Disparando impressão para a impressora ${selectedPrinter}...`);

    let widthMm = '100mm';
    let heightMm = '30mm';
    if (selectedPreset === '100x50') {
      heightMm = '50mm';
    } else if (selectedPreset === '100x150') {
      heightMm = '150mm';
    }

    const printContent = document.getElementById('batch-zebra-print-area');
    const contentHtml = printContent ? printContent.innerHTML : '';

    // Strategy 1: Direct in-window print with injected page size style and dedicated print portal
    const executeInWindowPrint = () => {
      try {
        let printPortal = document.getElementById('zebra-inwindow-print-portal');
        if (!printPortal) {
          printPortal = document.createElement('div');
          printPortal.id = 'zebra-inwindow-print-portal';
          document.body.appendChild(printPortal);
        }
        printPortal.innerHTML = contentHtml;

        let styleTag = document.getElementById('zebra-inwindow-print-style') as HTMLStyleElement;
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'zebra-inwindow-print-style';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = `
          @media print {
            @page {
              size: ${widthMm} ${heightMm} !important;
              margin: 0 !important;
            }
            body > *:not(#zebra-inwindow-print-portal) {
              display: none !important;
            }
            #zebra-inwindow-print-portal {
              display: block !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: ${widthMm} !important;
              background: #ffffff !important;
              z-index: 99999999 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .zebra-page-item {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              width: ${widthMm} !important;
              height: ${heightMm} !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              margin: 0 auto !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
            }
          }
        `;

        const cleanup = () => {
          if (printPortal && printPortal.parentNode) {
            printPortal.parentNode.removeChild(printPortal);
          }
          if (styleTag && styleTag.parentNode) {
            styleTag.parentNode.removeChild(styleTag);
          }
          setIsPrinting(false);
        };

        window.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 4000);

        window.print();
        return true;
      } catch (err) {
        console.warn('In-window print failed:', err);
        setIsPrinting(false);
        return false;
      }
    };

    // Execute direct window.print
    executeInWindowPrint();

    // In iframe environments (like Google AI Studio preview), window.print() is often blocked by browser sandbox.
    // Also trigger standalone tab so user has a guaranteed working print dialog without hindrance.
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isInIframe) {
      setTimeout(() => {
        handleOpenInNewTab();
      }, 250);
    }
  };

  // Automatically trigger printing if autoPrint was requested on open
  const autoPrintedRef = useRef(false);
  useEffect(() => {
    if (autoPrint && !autoPrintedRef.current && itemsToPrint.length > 0) {
      autoPrintedRef.current = true;
      const timer = setTimeout(() => {
        handlePrintBatch();
      }, 350);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, itemsToPrint]);

  // Render a single 100x30mm label item for batch
  const renderSingleLabel = (ord: OrderItem, copyIndex: number, totalCopies: number) => {
    const volText = isVolumeSequential ? `VOL ${copyIndex + 1}/${totalCopies}` : '';
    const headerTitle = companyHeader || (ord.store ? `CLI: ${ord.store}` : '');
    const showClientInBody = Boolean(companyHeader && ord.store);
    const opNumber = String(ord.orderId || ord.id || '');
    const cleanOp = opNumber.replace(/[^a-zA-Z0-9]/g, '');
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const lotCode = `LOT-${todayStr}-${cleanOp.slice(-4)}`;

    if (selectedPreset === '100x30') {
      const formatPtBrDate = (dateStr?: string) => {
        if (!dateStr) return new Date().toLocaleDateString('pt-BR');
        const cleanStr = dateStr.trim();
        if (cleanStr.includes('-')) {
          const parts = cleanStr.split('-');
          if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
          }
        }
        return cleanStr;
      };

      const formattedDate = formatPtBrDate(ord.productionDate);
      const cleanOpNum = (opNumber || '').replace(/#/g, '').trim();
      const cleanStore = (ord.store || '').trim().toUpperCase();
      const combinedOpStore = (cleanOpNum || cleanStore) ? `${cleanOpNum}${cleanStore}` : 'BC3026';
      const operatorDisplayName = (ord.assignedOperatorName || '').trim().toUpperCase();
      const barcodeText = [cleanOpNum, cleanStore, ord.itemDescription].filter(Boolean).join(' - ') || (opNumber ? `${opNumber}-PORTA` : 'BC3026-PORTA');

      return (
        <div 
          className="w-[100mm] h-[30mm] bg-white border border-black p-2 flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none relative"
          style={{ 
            width: '100mm', 
            height: '30mm', 
            minWidth: '100mm', 
            minHeight: '30mm', 
            boxSizing: 'border-box', 
            border: '1.5px solid black', 
            padding: '6px 10px 6px 10px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            backgroundColor: '#ffffff', 
            color: '#000000',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          {/* Header Row: OP: [OPERATOR] ... [DATE] */}
          <div 
            className="flex items-center justify-between border-b border-black pb-1 shrink-0"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              borderBottom: '2px solid black', 
              paddingBottom: '3px', 
              flexShrink: 0 
            }}
          >
            <div className="text-[13px] font-black uppercase tracking-wide" style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              OP: <span className="font-extrabold">{operatorDisplayName}</span>
            </div>
            <div className="text-[13px] font-black uppercase tracking-wide" style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {formattedDate}
            </div>
          </div>

          {/* Body Row: Left Barcode + Right Big Item Code & Description */}
          <div 
            className="flex items-center gap-3 my-auto flex-1 min-h-0 overflow-hidden pt-1" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              flex: '1 1 0%', 
              minHeight: 0, 
              overflow: 'hidden',
              paddingTop: '2px'
            }}
          >
            {/* Left Column: Barcode with text beneath */}
            <div 
              className="w-[42mm] flex flex-col items-center justify-center shrink-0" 
              style={{ width: '42mm', minWidth: '42mm', maxWidth: '42mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              {renderBarcodeSVG(barcodeText, { 
                height: 48, 
                className: 'h-[14mm] w-[40mm]', 
                svgStyle: { height: '14mm', width: '40mm', maxHeight: '100%', maxWidth: '100%' },
                textClass: 'text-[9.5px] font-mono tracking-tight font-black text-black mt-0.5 leading-none uppercase' 
              })}
            </div>

            {/* Right Column: Prominent Code & Multi-line Item Description */}
            <div 
              className="flex-1 min-w-0 flex flex-col justify-center h-full pl-1" 
              style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}
            >
              {/* Product Main Code (OP+Store joined, e.g., 31458RAGUEB or BC3026) */}
              <div 
                className="text-[22px] font-black leading-none text-black uppercase tracking-tight" 
                style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1.0, color: '#000000', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '2px' }}
              >
                {combinedOpStore}
              </div>
              
              {/* Detailed Item Specification with auto line breaks */}
              <div 
                className="text-black font-black uppercase break-words whitespace-normal leading-tight" 
                style={{ 
                  fontSize: (ord.itemDescription || '').length > 60 ? '8.5px' : (ord.itemDescription || '').length > 35 ? '9.5px' : '11px', 
                  fontWeight: 900, 
                  lineHeight: 1.08, 
                  color: '#000000', 
                  textTransform: 'uppercase', 
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                  letterSpacing: '0.01em'
                }}
              >
                {ord.itemDescription || 'VITRO 4F S/B 100X120 S/G MODULAR BRANCO'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (selectedPreset === '100x50') {
      return (
        <div 
          className="w-[100mm] h-[50mm] bg-white border-2 border-black p-2 flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none"
          style={{ width: '100mm', height: '50mm', minWidth: '100mm', minHeight: '50mm', boxSizing: 'border-box', border: '2px solid black', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}
        >
          <div className="flex items-center justify-between border-b-2 border-black pb-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '4px' }}>
            {headerTitle ? (
              <span className="text-[13px] font-black uppercase" style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase' }}>{headerTitle}</span>
            ) : null}
            <span className={`text-[13px] font-black bg-black text-white px-2.5 py-0.5 rounded-xs ${headerTitle ? '' : 'ml-auto'}`} style={{ fontSize: '13px', fontWeight: 900, backgroundColor: 'black', color: 'white', padding: '2px 8px', textTransform: 'uppercase' }}>
              OP #{opNumber}
            </span>
          </div>

          <div className="space-y-1 my-1" style={{ marginTop: '4px', marginBottom: '4px' }}>
            {showClientInBody && (
              <div className="text-[12px] font-bold break-words" style={{ fontSize: '12px', fontWeight: 700 }}>
                CLIENTE/LOJA: <strong className="text-[14px] font-black uppercase" style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>{ord.store}</strong>
              </div>
            )}
            <div className="text-[18px] font-black uppercase leading-tight break-words whitespace-normal font-sans" style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.15 }}>
              {ord.itemDescription}
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px] font-bold bg-gray-100 p-1 border-2 border-black" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#f3f4f6', padding: '4px', border: '2px solid black' }}>
              <div>QTD: <strong className="text-[13px]" style={{ fontSize: '13px', fontWeight: 900 }}>{ord.quantity} {ord.unit || 'UN'}</strong></div>
              <div>MONT: <strong className="uppercase" style={{ textTransform: 'uppercase', fontWeight: 900 }}>{ord.assignedOperatorName || 'N/A'}</strong></div>
              <div>DATA: <strong style={{ fontWeight: 900 }}>{ord.productionDate || 'N/A'}</strong></div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t-2 border-black pt-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid black', paddingTop: '4px' }}>
            <div className="text-[10px] font-bold" style={{ fontSize: '10px', fontWeight: 700 }}>
              <span>{lotCode ? `LOTE: ${lotCode}` : ''}</span>
              {volText && <span className="ml-2 bg-black text-white px-1 font-black" style={{ marginLeft: '8px', backgroundColor: 'black', color: 'white', padding: '0 4px', fontWeight: 900 }}>{volText}</span>}
            </div>
            <div className="w-[32mm]" style={{ width: '32mm', minWidth: '32mm', maxWidth: '32mm' }}>
              {renderBarcodeSVG([opNumber, ord.store, ord.itemDescription].filter(Boolean).join(' - '), { 
                height: 35, 
                className: 'h-8 w-[30mm]', 
                svgStyle: { height: '10mm', width: '30mm', maxHeight: '100%', maxWidth: '100%' },
                textClass: 'text-[8.5px] font-mono font-black' 
              })}
            </div>
          </div>
        </div>
      );
    }

    // 100x150mm
    return (
      <div 
        className="w-[100mm] h-[150mm] bg-white border-4 border-black p-3.5 flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none"
        style={{ width: '100mm', height: '150mm', minWidth: '100mm', minHeight: '150mm', boxSizing: 'border-box', border: '4px solid black', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', color: '#000000' }}
      >
        <div className="border-b-4 border-black pb-2 text-center" style={{ borderBottom: '4px solid black', paddingBottom: '8px', textAlign: 'center' }}>
          {headerTitle ? (
            <div className="text-[14px] font-black uppercase mb-1" style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>{headerTitle}</div>
          ) : null}
          <div className="text-[22px] font-black bg-black text-white py-1.5 uppercase" style={{ fontSize: '22px', fontWeight: 900, backgroundColor: 'black', color: 'white', padding: '6px 0', textTransform: 'uppercase' }}>
            ORDEM DE PRODUÇÃO: OP #{opNumber}
          </div>
        </div>

        <div className="my-2 space-y-3" style={{ marginTop: '8px', marginBottom: '8px' }}>
          {showClientInBody && (
            <div className="border-2 border-black p-2 bg-gray-50" style={{ border: '2px solid black', padding: '8px', backgroundColor: '#f9fafb' }}>
              <span className="text-[11px] font-bold uppercase block" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>CLIENTE / DESTINO:</span>
              <span className="text-[18px] font-black uppercase" style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase' }}>{ord.store}</span>
            </div>
          )}

          <div className="border-2 border-black p-2 min-h-[45mm]" style={{ border: '2px solid black', padding: '8px', minHeight: '45mm' }}>
            <span className="text-[11px] font-bold uppercase block" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>ESPECIFICAÇÃO DO PRODUTO:</span>
            <span className="text-[25px] font-black uppercase leading-tight" style={{ fontSize: '25px', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.15 }}>{ord.itemDescription}</span>
          </div>

          <div className="grid grid-cols-2 gap-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            <div className="border-2 border-black p-2 bg-gray-100 text-center" style={{ border: '2px solid black', padding: '8px', backgroundColor: '#f3f4f6', textAlign: 'center' }}>
              <span className="text-[10px] font-bold uppercase block" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>QUANTIDADE:</span>
              <span className="text-[26px] font-black" style={{ fontSize: '26px', fontWeight: 900 }}>{ord.quantity} {ord.unit || 'UN'}</span>
            </div>
            <div className="border-2 border-black p-2 text-center" style={{ border: '2px solid black', padding: '8px', textAlign: 'center' }}>
              <span className="text-[10px] font-bold uppercase block" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>OPERADOR:</span>
              <span className="text-[16px] font-black uppercase" style={{ fontSize: '16px', fontWeight: 900, textTransform: 'uppercase' }}>{ord.assignedOperatorName || 'FABRICA'}</span>
            </div>
          </div>
        </div>

        <div className="border-t-4 border-black pt-2 flex flex-col items-center" style={{ borderTop: '4px solid black', paddingTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {renderBarcodeSVG([opNumber, ord.store, ord.itemDescription].filter(Boolean).join(' - '), { 
            height: 60, 
            className: 'h-16 w-[70mm]', 
            svgStyle: { height: '16mm', width: '70mm', maxHeight: '100%', maxWidth: '100%' },
            textClass: 'text-[11px] font-mono font-black' 
          })}
          <div className="flex justify-between w-full mt-2 text-[10px] font-black" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px', fontSize: '10px', fontWeight: 900 }}>
            <span>{lotCode}</span>
            <span> TRINDADE PCP - FABRICAÇÃO</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn overflow-hidden">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-scaleUp overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">qr_code_2</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Impressão de Etiquetas Zebra em Lote</span>
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {itemsToPrint.length} peças
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {titleDate} — Gerador de lote em formato térmico direto Zebra ZD220
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Configurations Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Formato da Etiqueta:
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value as LabelPreset)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="100x30">100mm x 30mm (10x3 cm) - Zebra Padrão</option>
                <option value="100x50">100mm x 50mm (10x5 cm) - Médio</option>
                <option value="100x150">100mm x 150mm (10x15 cm) - Volume Grande</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modo de Impressão:
              </label>
              <select
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value as 'by_quantity' | 'fixed')}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-blue-900 border-blue-200 focus:ring-2 focus:ring-blue-500"
              >
                <option value="by_quantity">1 Etiqueta por Peça/Unidade (QTD)</option>
                <option value="fixed">Quantidade Fixa por Item</option>
              </select>
            </div>

            {printMode === 'by_quantity' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Multiplicador por Peça:
                </label>
                <select
                  value={quantityMultiplier}
                  onChange={(e) => setQuantityMultiplier(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value={1}>1x (Ex: 3 peças = 3 etiquetas)</option>
                  <option value={2}>2x (Ex: 3 peças = 6 etiquetas)</option>
                  <option value={3}>3x (Ex: 3 peças = 9 etiquetas)</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cópias por Item:
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={fixedCopiesPerItem}
                  onChange={(e) => setFixedCopiesPerItem(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cabeçalho (Opcional):
              </label>
              <input
                type="text"
                value={companyHeader}
                onChange={(e) => setCompanyHeader(e.target.value)}
                placeholder="Ex: TRINDADE PCP"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVolumeSequential}
                  onChange={(e) => setIsVolumeSequential(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>Numerar Volumes em Sequência por Peça (Ex: VOL 1/3, VOL 2/3, VOL 3/3)</span>
              </label>
            </div>
          </div>

          {/* Printer & Custom Margins Setup (ZDESIGNER L3250) */}
          <div className="bg-blue-50/70 border border-blue-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-700 text-lg">print</span>
                <span className="text-xs font-black text-blue-950 uppercase tracking-wide">
                  Configuração da Impressora & Margens Personalizadas
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md uppercase">
                  Padrão Ativo
                </span>
              </div>

              <button
                type="button"
                onClick={handleResetDefaultMargins}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100/70 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer w-fit"
                title="Restaurar padrão ZDESIGNER L3250 (Esq:0, Sup:4, Dir:0, Inf:4)"
              >
                <span className="material-symbols-outlined text-[13px]">refresh</span>
                <span>Restaurar Padrão (E:0, S:4, D:0, I:4)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              {/* Printer selection */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Impressora Selecionada:
                </label>
                <div className="relative">
                  <select
                    value={selectedPrinter}
                    onChange={(e) => handleUpdatePrinter(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  >
                    <option value="ZDESIGNER L3250">ZDESIGNER L3250 (Padrão de Fábrica)</option>
                    <option value="ZEBRA ZD220">ZEBRA ZD220</option>
                    <option value="EPSON L3250">EPSON L3250</option>
                    <option value="GENÉRICA / TÉRMICA">GENÉRICA / TÉRMICA DIRETA</option>
                  </select>
                </div>
              </div>

              {/* Margins: Esquerda */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Esquerda (mm):
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={margins.left}
                  onChange={(e) => handleUpdateMargin('left', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              {/* Margins: Superior */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Superior (mm):
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={margins.top}
                  onChange={(e) => handleUpdateMargin('top', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              {/* Margins: Direita */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Direita (mm):
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={margins.right}
                  onChange={(e) => handleUpdateMargin('right', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              {/* Margins: Inferior */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Inferior (mm):
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={margins.bottom}
                  onChange={(e) => handleUpdateMargin('bottom', Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-blue-900 font-medium bg-blue-100/60 px-3 py-1.5 rounded-lg">
              <span className="material-symbols-outlined text-[15px] text-blue-700">info</span>
              <span>
                As margens configuradas (<strong>Sup: {margins.top}mm, Inf: {margins.bottom}mm, Esq: {margins.left}mm, Dir: {margins.right}mm</strong>) e o perfil <strong>{selectedPrinter}</strong> são aplicados diretamente nas regras @page de impressão.
              </span>
            </div>
          </div>

          {/* Selected Items List & Toggle All */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Selecione as Peças para o Lote ({itemsToPrint.length} itens → {totalLabelsToPrint} etiquetas):
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {selectedOrderIds.length === orders.length ? 'Desmarcar Todas' : 'Marcar Todas'}
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
              {orders.map((ord) => {
                const isSelected = selectedOrderIds.includes(ord.id);
                const itemCopies = getCopiesForOrder(ord);
                return (
                  <label
                    key={ord.id}
                    className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(ord.id)}
                        className="w-4 h-4 text-blue-600 rounded-xs border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-black text-slate-900">
                          OP #{ord.orderId || ord.id} — <span className="text-blue-700">{ord.store}</span>
                        </p>
                        <p className="text-[11px] font-medium text-slate-600 line-clamp-1">
                          {ord.itemDescription}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        QTD: {ord.quantity} {ord.unit || 'UN'}
                      </span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {itemCopies} {itemCopies === 1 ? 'etiqueta' : 'etiquetas'}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Live Label Gallery Preview */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Pré-visualização Térmica das Etiquetas em Lote ({totalLabelsToPrint} etiquetas a gerar):
            </h3>

            <div className="bg-slate-900 p-4 rounded-2xl overflow-x-auto max-h-56 border border-slate-800">
              <div className="flex flex-wrap gap-4 justify-center items-center">
                {itemsToPrint.map((ord) => {
                  const itemCopies = getCopiesForOrder(ord);
                  return (
                    <div key={ord.id} className="flex flex-col items-center gap-1">
                      <div className="shadow-lg rounded-xs overflow-hidden bg-white shrink-0">
                        {renderSingleLabel(ord, 0, itemCopies)}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {itemCopies > 1 ? `${itemCopies} etiquetas (VOL 1/${itemCopies} ... ${itemCopies}/${itemCopies})` : '1 etiqueta'}
                      </span>
                    </div>
                  );
                })}
                {itemsToPrint.length === 0 && (
                  <div className="text-slate-400 text-xs py-8 text-center">
                    Nenhuma peça selecionada para impressão.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Printable Hidden Batch Render Area */}
        <div className="hidden">
          <div id="batch-zebra-print-area">
            {itemsToPrint.map((ord) => {
              const itemCopies = getCopiesForOrder(ord);
              const copies = Array.from({ length: itemCopies });
              return copies.map((_, copyIndex) => (
                <div key={`${ord.id}-${copyIndex}`} className="zebra-page-item">
                  {renderSingleLabel(ord, copyIndex, itemCopies)}
                </div>
              ));
            })}
          </div>
        </div>

        {/* Status Message if active */}
        {printStatusMessage && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[18px] text-blue-600">print</span>
            <span>{printStatusMessage}</span>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">
              Margens: 0mm (Centralizado ZD220)
            </span>
          </div>

          <button
            type="button"
            disabled={itemsToPrint.length === 0 || isPrinting}
            onClick={handlePrintBatch}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-75 text-white font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 active:scale-[0.98]"
          >
            {isPrinting ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                <span>Enviando para {selectedPrinter}...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">print</span>
                <span>
                  Imprimir na {selectedPrinter} ({totalLabelsToPrint} {totalLabelsToPrint === 1 ? 'Etiqueta' : 'Etiquetas'})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
