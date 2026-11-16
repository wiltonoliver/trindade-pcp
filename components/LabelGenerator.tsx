'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Layers,
  RefreshCw,
  Trash2,
  User,
  Calendar,
  FileText,
  Code2,
  Database,
  Barcode,
  Printer,
  Copy,
  Check,
  Download,
  Plus,
  Search,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';
import { OrderItem, AssemblyOperator, Store } from '@/types/factory';
import { BatchLabelModal } from './BatchLabelModal';
import { renderBarcodeSVG } from '@/lib/barcodeUtils';
import { matchesMultiTermSearch } from '@/lib/utils';

interface LabelGeneratorProps {
  orders: OrderItem[];
  operators?: AssemblyOperator[];
  stores?: Store[];
  preselectedOrderId?: string | null;
  onClearPreselectedOrder?: () => void;
}

export type LabelPreset = '100x30' | '100x220';
export type ItemFontSize = 'PEQ' | 'MÉD' | 'GRD';
type RightPanelTab = 'labels' | 'zpl' | 'database';

interface ParsedLabelItem {
  id: string;
  rawLine: string;
  code: string;
  description: string;
  quantity: number;
}

interface PhysicalLabelInstance {
  key: string;
  item: ParsedLabelItem;
  copyIndex: number;
  totalCopies: number;
}

const getTodayFormatted = (): string => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const dmyToIso = (dmy: string): string => {
  const match = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
};

const isoToDmy = (iso: string): string => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const sanitizeZplText = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\^~]/g, ' ')
    .toUpperCase()
    .trim();
};

export const LabelGenerator: React.FC<LabelGeneratorProps> = ({
  orders,
  operators = [],
  preselectedOrderId = null,
  onClearPreselectedOrder,
}) => {
  const DEFAULT_PRINTER = 'ZEBRA ZD220';

  // Left Control Panel States (matching reference UI)
  const [operatorName, setOperatorName] = useState<string>('OPERADOR 01');
  const [labelDate, setLabelDate] = useState<string>(() => getTodayFormatted());
  const [itemsText, setItemsText] = useState<string>('');

  // Label Configuration States
  const [showOperator, setShowOperator] = useState<boolean>(true);
  const [showDate, setShowDate] = useState<boolean>(true);
  const [showBarcode, setShowBarcode] = useState<boolean>(true);
  const [itemFontSize, setItemFontSize] = useState<ItemFontSize>('MÉD');
  const [paperFormat, setPaperFormat] = useState<LabelPreset>('100x30');

  // Right Panel States
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>('labels');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);
  const [zplCopied, setZplCopied] = useState<boolean>(false);

  // Database Tab States
  const [dbSearch, setDbSearch] = useState<string>('');
  const [dbStatusFilter, setDbStatusFilter] = useState<'all' | 'completed' | 'active' | 'pending'>('all');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  const datePickerRef = useRef<HTMLInputElement>(null);

  // Format an OrderItem into a batch line: "CODE - DESCRIPTION (QTY)"
  const formatOrderToLine = useCallback((ord: OrderItem): string => {
    const op = (ord.orderId || ord.id || '').replace(/#/g, '').trim().toUpperCase();
    const store = (ord.store || '').trim().toUpperCase();
    const codePart = [op, store].filter(Boolean).join('');
    const descPart = (ord.itemDescription || 'PEÇA').trim().toUpperCase();
    const qty = Math.max(1, Number(ord.quantity) || 1);
    const prefix = codePart ? `${codePart} - ` : '';
    return `${prefix}${descPart} (${qty})`;
  }, []);

  // Sync if preselectedOrderId is provided when navigating to Labels tab
  useEffect(() => {
    if (!preselectedOrderId) return;
    const found = orders.find((o) => o.id === preselectedOrderId);
    if (found) {
      const line = formatOrderToLine(found);
      const timer = setTimeout(() => {
        if (found.assignedOperatorName) {
          setOperatorName(found.assignedOperatorName.toUpperCase());
        }
        if (found.productionDate && !found.productionDate.toLowerCase().includes('aguardando')) {
          setLabelDate(found.productionDate);
        }
        setItemsText((prev) => {
          const trimmed = prev.trim();
          if (!trimmed) return line;
          if (trimmed.split('\n').some((l) => l.trim() === line)) return prev;
          return `${trimmed}\n${line}`;
        });
        setActiveRightTab('labels');
        if (onClearPreselectedOrder) onClearPreselectedOrder();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [preselectedOrderId, orders, formatOrderToLine, onClearPreselectedOrder]);

  // Parse lines from textarea into structured items
  const parsedItems = useMemo<ParsedLabelItem[]>(() => {
    if (!itemsText.trim()) return [];
    const lines = itemsText.split('\n');
    const result: ParsedLabelItem[] = [];

    lines.forEach((rawLine, idx) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;

      let working = trimmed;
      let qty = 1;

      // Extract trailing "(N)" quantity if present
      const qtyMatch = working.match(/\((\d+)\)\s*$/);
      if (qtyMatch) {
        qty = Math.min(500, Math.max(1, parseInt(qtyMatch[1], 10) || 1));
        working = working.slice(0, qtyMatch.index).trim();
      }

      if (!working) return;

      // Split on first "-" into 1st line (code/title) and 2nd line (description)
      const sepIndex = working.indexOf('-');
      let code = '';
      let description = working;

      if (sepIndex > 0) {
        code = working.slice(0, sepIndex).trim();
        description = working.slice(sepIndex + 1).trim();
      }

      result.push({
        id: `lbl-item-${idx}`,
        rawLine: trimmed,
        code: code.toUpperCase(),
        description: description.toUpperCase(),
        quantity: qty,
      });
    });

    return result;
  }, [itemsText]);

  // Expand items into physical 100x30mm label instances
  const physicalLabels = useMemo<PhysicalLabelInstance[]>(() => {
    const list: PhysicalLabelInstance[] = [];
    parsedItems.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        list.push({
          key: `${item.id}-copy-${i}`,
          item,
          copyIndex: i,
          totalCopies: item.quantity,
        });
      }
    });
    return list;
  }, [parsedItems]);

  // Chunk parsed items for Agrupado (100x220mm) thermal sheets (up to 7 items per 220mm sheet)
  const groupedSheets = useMemo<ParsedLabelItem[][]>(() => {
    if (parsedItems.length === 0) return [];
    const CHUNK_SIZE = 7;
    const sheets: ParsedLabelItem[][] = [];
    for (let i = 0; i < parsedItems.length; i += CHUNK_SIZE) {
      sheets.push(parsedItems.slice(i, i + CHUNK_SIZE));
    }
    return sheets;
  }, [parsedItems]);

  const totalLabelsCount = physicalLabels.length;
  const displayLabelsBadgeCount = paperFormat === '100x30' ? totalLabelsCount : groupedSheets.length;

  // Quick Actions: Example & Clear
  const handleInsertExample = () => {
    setItemsText(
      [
        'R306909PRIMA - PORTA PALHETA 210X80 LADO ESQUERDO BRANCO (2)',
        '31458RAGUEB - VITRO 4F S/B 100X120 S/G MODULAR BRANCO (1)',
        '31502CENTRAL - LAMBRIL DUPLO 210X90 PRETO FOSCO (3)',
      ].join('\n')
    );
  };

  const handleClearAll = () => {
    setItemsText('');
  };

  // ZPL II Code Generation for Zebra ZD220 (203 DPI: 8 dots/mm)
  const generatedZplCode = useMemo<string>(() => {
    if (parsedItems.length === 0) return '';

    const opClean = sanitizeZplText(operatorName || 'OPERADOR 01');
    const dateClean = sanitizeZplText(labelDate || getTodayFormatted());

    if (paperFormat === '100x30') {
      // 100mm = 800 dots, 30mm = 240 dots
      return parsedItems
        .map((item) => {
          const codeClean = sanitizeZplText(item.code);
          const descClean = sanitizeZplText(item.description);
          const barcodeData = codeClean || descClean.slice(0, 24) || 'ZEBRA';

          const descFont =
            itemFontSize === 'PEQ'
              ? '^A0N,20,20'
              : itemFontSize === 'GRD'
              ? '^A0N,30,28'
              : '^A0N,25,24';

          const lines: string[] = [
            '^XA',
            '^CI28',
            '^PW800',
            '^LL240',
            '^LH0,0',
          ];

          if (showOperator || showDate) {
            if (showOperator) {
              lines.push(`^FO24,16^A0N,24,24^FDOP: ${opClean}^FS`);
            }
            if (showDate) {
              lines.push(`^FO620,16^A0N,24,24^FD${dateClean}^FS`);
            }
            lines.push('^FO20,46^GB760,3,3^FS');
          }

          const contentTopY = showOperator || showDate ? 62 : 24;

          if (showBarcode) {
            lines.push(`^FO24,${contentTopY + 6}^BY2,2.5,95^BCN,95,Y,N,N^FD${barcodeData}^FS`);
          }

          const textStartX = showBarcode ? 345 : 24;
          const textBlockWidth = showBarcode ? 430 : 750;

          if (codeClean) {
            lines.push(`^FO${textStartX},${contentTopY}^A0N,54,50^FD${codeClean}^FS`);
            if (descClean) {
              lines.push(
                `^FO${textStartX},${contentTopY + 60}${descFont}^FB${textBlockWidth},3,4,L,0^FD${descClean}^FS`
              );
            }
          } else {
            lines.push(
              `^FO${textStartX},${contentTopY + 8}${descFont}^FB${textBlockWidth},4,4,L,0^FD${descClean}^FS`
            );
          }

          lines.push(`^PQ${item.quantity},0,1,Y`);
          lines.push('^XZ');
          return lines.join('\n');
        })
        .join('\n\n');
    } else {
      // Agrupado 100mm x 220mm (800 dots x 1760 dots)
      return groupedSheets
        .map((sheetItems, sheetIdx) => {
          const lines: string[] = [
            '^XA',
            '^CI28',
            '^PW800',
            '^LL1760',
            '^LH0,0',
            `^FO24,24^A0N,34,34^FDLOTE AGRUPADO (${sheetIdx + 1}/${groupedSheets.length})^FS`,
          ];

          if (showOperator) {
            lines.push(`^FO24,68^A0N,24,24^FDOPERADOR: ${opClean}^FS`);
          }
          if (showDate) {
            lines.push(`^FO580,68^A0N,24,24^FDDATA: ${dateClean}^FS`);
          }
          lines.push('^FO20,104^GB760,4,4^FS');

          let currY = 128;
          sheetItems.forEach((item) => {
            const codeClean = sanitizeZplText(item.code);
            const descClean = sanitizeZplText(item.description);
            const barcodeData = codeClean || descClean.slice(0, 20);

            if (showBarcode) {
              lines.push(`^FO24,${currY + 12}^BY2,2,70^BCN,70,Y,N,N^FD${barcodeData}^FS`);
            }
            const tx = showBarcode ? 310 : 24;
            const tw = showBarcode ? 465 : 750;
            lines.push(
              `^FO${tx},${currY}^A0N,40,38^FD${codeClean ? `${codeClean}  ` : ''}[QTD: ${item.quantity}]^FS`
            );
            lines.push(`^FO${tx},${currY + 46}^A0N,24,22^FB${tw},2,4,L,0^FD${descClean}^FS`);
            lines.push(`^FO20,${currY + 185}^GB760,2,2^FS`);
            currY += 205;
          });

          lines.push('^PQ1,0,1,Y');
          lines.push('^XZ');
          return lines.join('\n');
        })
        .join('\n\n');
    }
  }, [parsedItems, groupedSheets, operatorName, labelDate, paperFormat, showOperator, showDate, showBarcode, itemFontSize]);

  const handleCopyZpl = async () => {
    if (!generatedZplCode) return;
    try {
      await navigator.clipboard.writeText(generatedZplCode);
      setZplCopied(true);
      setTimeout(() => setZplCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleDownloadZpl = () => {
    if (!generatedZplCode) return;
    const blob = new Blob([generatedZplCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiquetas-zebra-zd220-${Date.now()}.zpl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Database Tab filtering
  const filteredDbOrders = useMemo(() => {
    return orders.filter((ord) => {
      const isCompleted = ord.executionStatus === 'concluido' || ord.progress === 100;
      const isPendingDate =
        !isCompleted &&
        !ord.isClosedUncompleted &&
        (ord.column === 'nao_planejado' || !ord.productionDate || ord.productionDate.toLowerCase().includes('aguardando'));

      if (dbStatusFilter === 'completed' && !isCompleted) return false;
      if (dbStatusFilter === 'pending' && !isPendingDate) return false;
      if (dbStatusFilter === 'active' && (isCompleted || isPendingDate || ord.isClosedUncompleted)) return false;

      if (dbSearch.trim()) {
        return matchesMultiTermSearch(
          [ord.orderId, ord.store, ord.itemDescription, ord.assignedOperatorName, ord.assignedOperatorCode],
          dbSearch
        );
      }
      return true;
    });
  }, [orders, dbSearch, dbStatusFilter]);

  const handleAddOrderLine = (ord: OrderItem) => {
    const line = formatOrderToLine(ord);
    setItemsText((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
    if (ord.assignedOperatorName && operatorName === 'OPERADOR 01') {
      setOperatorName(ord.assignedOperatorName.toUpperCase());
    }
  };

  const handleAddAllFilteredOrders = () => {
    if (filteredDbOrders.length === 0) return;
    const lines = filteredDbOrders.slice(0, 50).map(formatOrderToLine);
    setItemsText((prev) => {
      const existing = prev.trim();
      return existing ? `${existing}\n${lines.join('\n')}` : lines.join('\n');
    });
    setActiveRightTab('labels');
  };

  // Standalone HTML generator for iframe fallback new-tab printing
  const generatePrintHtml = () => {
    const widthMm = '100mm';
    const heightMm = paperFormat === '100x30' ? '30mm' : '220mm';
    const printContent = document.getElementById('zebra-print-source');
    const contentHtml = printContent ? printContent.innerHTML : '';

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${DEFAULT_PRINTER} - Impressão de Etiquetas (${displayLabelsBadgeCount})</title>
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
        .no-print-element {
          display: none !important;
        }
        .zebra-label-print-page {
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
      *, ::before, ::after {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 12px;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
      }
      .zebra-label-print-page {
        box-sizing: border-box;
        margin: 0 auto 12px auto;
        background: white;
        width: ${widthMm};
        height: ${heightMm};
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <div class="no-print-element" style="text-align: center; margin-bottom: 14px; font-family: sans-serif; background: #eff6ff; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #bfdbfe; max-width: 620px; margin-left: auto; margin-right: auto;">
      <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">
        Impressora Padrão: <u>${DEFAULT_PRINTER}</u>
      </div>
      <div style="font-size: 11px; color: #1e40af; margin-bottom: 8px;">
        Formato: <strong>${widthMm} x ${heightMm}</strong> | Margens zeradas e centralização automática
      </div>
      <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 9px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 13px;">
        CONFIRMAR IMPRESSÃO (${displayLabelsBadgeCount})
      </button>
    </div>
    ${contentHtml}
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 300);
      };
    </script>
  </body>
</html>`;
  };

  const handleOpenInNewTab = () => {
    try {
      const html = generatePrintHtml();
      const newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.open();
        newWin.document.write(html);
        newWin.document.close();
        newWin.focus();
      } else {
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
      }
    } catch (err) {
      console.error('Failed to open print tab:', err);
    }
  };

  // Dedicated Direct Print Logic for Zebra ZD220 using window.print() + @media print
  const handlePrint = () => {
    if (totalLabelsCount === 0) return;

    try {
      setIsPrinting(true);
      setPrintStatusMessage(`Enviando para ${DEFAULT_PRINTER}...`);

      const widthMm = '100mm';
      const heightMm = paperFormat === '100x30' ? '30mm' : '220mm';

      let printPortal = document.getElementById('zebra-direct-print-portal');
      if (!printPortal) {
        printPortal = document.createElement('div');
        printPortal.id = 'zebra-direct-print-portal';
        document.body.appendChild(printPortal);
      }

      const sourceContent = document.getElementById('zebra-print-source');
      if (sourceContent) {
        printPortal.innerHTML = sourceContent.innerHTML;
      }

      let styleTag = document.getElementById('zebra-direct-print-style') as HTMLStyleElement;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'zebra-direct-print-style';
        document.head.appendChild(styleTag);
      }

      styleTag.textContent = `
        @media print {
          @page {
            size: ${widthMm} ${heightMm} !important;
            margin: 0 !important;
          }
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#zebra-direct-print-portal) {
            display: none !important;
          }
          .no-print, header, aside, nav, footer, button {
            display: none !important;
          }
          #zebra-direct-print-portal {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            z-index: 99999999 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .zebra-label-print-page {
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
        setPrintStatusMessage(null);
      };

      window.addEventListener('afterprint', cleanup, { once: true });
      setTimeout(cleanup, 4000);

      window.print();

      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isInIframe) {
        setTimeout(() => {
          handleOpenInNewTab();
        }, 250);
      }
    } catch (err) {
      console.error('Direct print failed, fallback:', err);
      setIsPrinting(false);
      handleOpenInNewTab();
    }
  };

  // Compute description font size in px based on PEQ / MÉD / GRD and character length
  const getDescriptionFontPx = (descLength: number): string => {
    if (itemFontSize === 'PEQ') {
      return descLength > 55 ? '7.5px' : '8.5px';
    }
    if (itemFontSize === 'GRD') {
      return descLength > 55 ? '10.5px' : descLength > 35 ? '11.5px' : '13px';
    }
    // MÉD (default)
    return descLength > 55 ? '9px' : descLength > 35 ? '10px' : '11px';
  };

  // Render a single 100x30mm label
  const renderStandardLabel = (instance: PhysicalLabelInstance) => {
    const { item, copyIndex, totalCopies } = instance;
    const barcodeText = item.code || item.description.slice(0, 22) || 'ZEBRA';
    const hasHeader = showOperator || showDate;

    return (
      <div
        className="w-[100mm] h-[30mm] bg-white border border-black flex flex-col justify-between text-black font-sans box-border overflow-hidden select-none relative"
        style={{
          width: '100mm',
          height: '30mm',
          minWidth: '100mm',
          minHeight: '30mm',
          boxSizing: 'border-box',
          border: '1.5px solid #000000',
          padding: '5px 10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {hasHeader && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1.5px solid #000000',
              paddingBottom: '2px',
              flexShrink: 0,
              minHeight: '15px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {showOperator ? `OP: ${(operatorName || 'OPERADOR 01').toUpperCase()}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 900 }}>
              {totalCopies > 1 && (
                <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                  VOL {copyIndex + 1}/{totalCopies}
                </span>
              )}
              {showDate && <span>{labelDate}</span>}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: '1 1 0%',
            minHeight: 0,
            overflow: 'hidden',
            paddingTop: hasHeader ? '2px' : '0px',
          }}
        >
          {showBarcode && (
            <div
              style={{
                width: '38mm',
                minWidth: '38mm',
                maxWidth: '38mm',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {renderBarcodeSVG(barcodeText, {
                height: 44,
                className: 'h-[13mm] w-[36mm]',
                svgStyle: { height: '13mm', width: '36mm', maxHeight: '100%', maxWidth: '100%' },
                textClass: 'text-[9px] font-mono tracking-tight font-black text-black mt-0.5 leading-none uppercase',
              })}
            </div>
          )}

          <div
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            {item.code && (
              <div
                style={{
                  fontSize:
                    item.code.length <= 10
                      ? itemFontSize === 'PEQ'
                        ? '22px'
                        : itemFontSize === 'GRD'
                        ? '28px'
                        : '26px'
                      : item.code.length <= 15
                      ? itemFontSize === 'PEQ'
                        ? '19px'
                        : itemFontSize === 'GRD'
                        ? '24px'
                        : '22px'
                      : itemFontSize === 'PEQ'
                      ? '16px'
                      : itemFontSize === 'GRD'
                      ? '20px'
                      : '18px',
                  fontWeight: 900,
                  lineHeight: 0.98,
                  color: '#000000',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.03em',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.code}
              </div>
            )}

            {item.description && (
              <div
                style={{
                  fontSize: getDescriptionFontPx(item.description.length),
                  fontWeight: 700,
                  lineHeight: 1.12,
                  color: '#000000',
                  textTransform: 'uppercase',
                  wordBreak: 'break-word',
                  whiteSpace: 'normal',
                  letterSpacing: '0.01em',
                }}
              >
                {item.description}
              </div>
            )}

            {!hasHeader && totalCopies > 1 && (
              <div style={{ fontSize: '9px', fontWeight: 900, fontFamily: 'monospace', marginTop: '2px' }}>
                VOL {copyIndex + 1}/{totalCopies}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render an Agrupado (100x220mm) sheet
  const renderGroupedSheet = (sheetItems: ParsedLabelItem[], sheetIdx: number, totalSheets: number) => {
    return (
      <div
        className="w-[100mm] h-[220mm] bg-white border border-black flex flex-col text-black font-sans box-border overflow-hidden select-none"
        style={{
          width: '100mm',
          height: '220mm',
          minWidth: '100mm',
          minHeight: '220mm',
          boxSizing: 'border-box',
          border: '2px solid #000000',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2.5px solid #000000',
            paddingBottom: '5px',
            marginBottom: '6px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase' }}>
              LOTE DE PRODUÇÃO ({sheetIdx + 1}/{totalSheets})
            </div>
            {showOperator && (
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginTop: '1px' }}>
                OP: {(operatorName || 'OPERADOR 01').toUpperCase()}
              </div>
            )}
          </div>
          {showDate && (
            <div style={{ fontSize: '12px', fontWeight: 900 }}>
              {labelDate}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 0%', overflow: 'hidden' }}>
          {sheetItems.map((item) => {
            const barcodeText = item.code || item.description.slice(0, 20) || 'ZEBRA';
            return (
              <div
                key={item.id}
                style={{
                  borderBottom: '1px dashed #000000',
                  paddingBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {showBarcode && (
                  <div style={{ width: '32mm', minWidth: '32mm', flexShrink: 0 }}>
                    {renderBarcodeSVG(barcodeText, {
                      height: 36,
                      className: 'h-[10mm] w-[30mm]',
                      svgStyle: { height: '10mm', width: '30mm' },
                      textClass: 'text-[8px] font-mono font-black text-black mt-0.5 leading-none uppercase',
                    })}
                  </div>
                )}
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                      {item.code || 'ITEM'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 900,
                        backgroundColor: '#000000',
                        color: '#ffffff',
                        padding: '1px 5px',
                      }}
                    >
                      QTD: {item.quantity}
                    </span>
                  </div>
                  {item.description && (
                    <div
                      style={{
                        fontSize: getDescriptionFontPx(item.description.length),
                        fontWeight: 700,
                        lineHeight: 1.15,
                        textTransform: 'uppercase',
                        marginTop: '2px',
                      }}
                    >
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            borderTop: '2px solid #000000',
            paddingTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            fontWeight: 900,
            fontFamily: 'monospace',
          }}
        >
          <span>ZEBRA ZD220 (100x220MM)</span>
          <span>ITENS NA FOLHA: {sheetItems.length}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1440px] mx-auto animate-fadeIn">
      {/* Dedicated Zebra ZD220 Thermal Print Style (Ignores UI elements, auto-centers labels) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${paperFormat === '100x30' ? '100mm 30mm' : '100mm 220mm'} !important;
                margin: 0 !important;
              }
              html, body {
                width: 100% !important;
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body > *:not(#zebra-direct-print-portal) {
                display: none !important;
              }
              .no-print, header, aside, nav, footer, button {
                display: none !important;
              }
              #zebra-direct-print-portal {
                display: block !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                z-index: 99999999 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .zebra-label-print-page {
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                width: 100mm !important;
                height: ${paperFormat === '100x30' ? '30mm' : '220mm'} !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: 0 auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
              }
            }
          `,
        }}
      />

      {/* Main 2-Column Workspace (Exact Match to Reference Design) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start no-print">
        {/* LEFT COLUMN: PAINEL DE CONTROLE */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-5">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                PAINEL DE CONTROLE
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInsertExample}
                className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-indigo-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Preencher com exemplo de lote"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Exemplo</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 text-rose-600 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Limpar lista de peças"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            </div>
          </div>

          {/* Row 1: OPERADOR & DATA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>OPERADOR</span>
              </label>
              <input
                type="text"
                list="zebra-operators-datalist"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="OPERADOR 01"
                className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all"
              />
              {operators.length > 0 && (
                <datalist id="zebra-operators-datalist">
                  {operators.map((op) => (
                    <option key={op.id} value={op.name.toUpperCase()} />
                  ))}
                </datalist>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>DATA</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={labelDate}
                  onChange={(e) => setLabelDate(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => datePickerRef.current?.showPicker?.()}
                  className="absolute right-2.5 text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                  title="Selecionar data no calendário"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={datePickerRef}
                  type="date"
                  value={dmyToIso(labelDate)}
                  onChange={(e) => {
                    const formatted = isoToDmy(e.target.value);
                    if (formatted) setLabelDate(formatted);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          {/* Row 2: LISTA DE PEÇAS (LOTE) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  LISTA DE PEÇAS (LOTE)
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
                  displayLabelsBadgeCount > 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200/80'
                }`}
              >
                {displayLabelsBadgeCount} {displayLabelsBadgeCount === 1 ? 'Etiqueta' : 'Etiquetas'}
              </span>
            </div>

            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              INSIRA UM PRODUTO POR LINHA. EX: R306909PRIMA - PORTA PALHETA 210X80 LADO ESQUERDO BRANCO (2). Onde o número em parênteses refere-se a quantidade de etiquetas.
            </p>

            <textarea
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder="INSIRA UM PRODUTO POR LINHA, EX: R306909PRIMA - PORTA PALHETA 210X80 LADO ESQUERDO BRANCO (2)"
              className="w-full min-h-[210px] p-3.5 bg-white border border-slate-200 rounded-xl font-mono text-xs text-slate-800 placeholder:text-slate-400/90 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y uppercase"
            />
          </div>

          {/* Row 3: CONFIGURAÇÕES DA ETIQUETA */}
          <div className="border-t border-slate-100 pt-4 space-y-3.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              CONFIGURAÇÕES DA ETIQUETA
            </h3>

            {/* 3 Toggle Checkboxes */}
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showOperator}
                  onChange={(e) => setShowOperator(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-semibold text-slate-700 truncate">Ver Operador</span>
              </label>

              <label className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => setShowDate(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-semibold text-slate-700 truncate">Ver Data</span>
              </label>

              <label className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={showBarcode}
                  onChange={(e) => setShowBarcode(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-semibold text-slate-700 truncate">Ver Cód. Barras</span>
              </label>
            </div>

            {/* Tamanho da Letra do Item */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">Tamanho da Letra do Item:</span>
              <div className="inline-flex bg-slate-100/90 border border-slate-200/80 rounded-lg p-0.5">
                {(['PEQ', 'MÉD', 'GRD'] as ItemFontSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setItemFontSize(sz)}
                    className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                      itemFontSize === sz
                        ? 'bg-white text-slate-900 font-extrabold shadow-2xs border border-slate-200/60'
                        : 'text-slate-500 font-semibold hover:text-slate-800'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Formato do Papel / Etiqueta */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                <span>Formato do Papel / Etiqueta:</span>
              </div>
              <div className="grid grid-cols-2 gap-1 bg-slate-100/90 border border-slate-200/80 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setPaperFormat('100x30')}
                  className={`py-2 px-3 rounded-lg text-xs transition-all cursor-pointer ${
                    paperFormat === '100x30'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-500 font-semibold hover:text-slate-700'
                  }`}
                >
                  Padrão (100x30mm)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperFormat('100x220')}
                  className={`py-2 px-3 rounded-lg text-xs transition-all cursor-pointer ${
                    paperFormat === '100x220'
                      ? 'bg-white text-slate-900 font-bold shadow-xs'
                      : 'text-slate-500 font-semibold hover:text-slate-700'
                  }`}
                >
                  Agrupado (100x220mm)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TABS & WORKSPACE CANVAS */}
        <div className="lg:col-span-7 flex flex-col">
          {/* Top Navigation Tabs + Direct Print Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveRightTab('labels')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'labels'
                    ? 'bg-white text-slate-900 border border-slate-200/90 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${activeRightTab === 'labels' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>ETIQUETAS ({displayLabelsBadgeCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('zpl')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'zpl'
                    ? 'bg-white text-slate-900 border border-slate-200/90 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Code2 className={`w-3.5 h-3.5 ${activeRightTab === 'zpl' ? 'text-amber-600' : 'text-amber-500/80'}`} />
                <span>CÓDIGO ZPL</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('database')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeRightTab === 'database'
                    ? 'bg-white text-slate-900 border border-slate-200/90 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Database className={`w-3.5 h-3.5 ${activeRightTab === 'database' ? 'text-emerald-600' : 'text-emerald-500/80'}`} />
                <span>BANCO DE DADOS</span>
              </button>
            </div>

            {totalLabelsCount > 0 && activeRightTab === 'labels' && (
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {isPrinting
                    ? 'Enviando...'
                    : `Imprimir Zebra ZD220 (${displayLabelsBadgeCount})`}
                </span>
              </button>
            )}
          </div>

          {/* Main Right Content Surface */}
          <div className="bg-slate-200/45 border border-slate-200/90 rounded-2xl min-h-[575px] flex flex-col overflow-hidden">
            {/* TAB 1: ETIQUETAS */}
            {activeRightTab === 'labels' && (
              <>
                {totalLabelsCount === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <Barcode className="w-12 h-12 text-slate-300 stroke-[1.4]" />
                    <h3 className="text-sm font-extrabold text-slate-700 mt-3">
                      Nenhum item na lista
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-[270px] leading-relaxed">
                      Insira o nome de alguma peça no painel esquerdo para que as etiquetas sejam geradas automaticamente.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    {/* Preview Toolbar */}
                    <div className="bg-white/90 border-b border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                          {DEFAULT_PRINTER}
                        </span>
                        <span>
                          Formato: <strong>{paperFormat === '100x30' ? '100x30mm' : '100x220mm'}</strong>
                        </span>
                        {printStatusMessage && (
                          <span className="text-blue-600 font-bold ml-2">{printStatusMessage}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px]">
                          {[100, 120].map((z) => (
                            <button
                              key={z}
                              type="button"
                              onClick={() => setPreviewZoom(z)}
                              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                previewZoom === z ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                              }`}
                            >
                              {z}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Labels Visual Scroll Canvas */}
                    <div className="flex-1 p-5 sm:p-6 overflow-y-auto max-h-[640px] flex flex-col items-center gap-4">
                      {paperFormat === '100x30'
                        ? physicalLabels.map((inst) => (
                            <div
                              key={inst.key}
                              style={{
                                transform: `scale(${previewZoom / 100})`,
                                transformOrigin: 'top center',
                                marginBottom: previewZoom > 100 ? '18px' : '0px',
                              }}
                              className="shadow-md bg-white transition-transform duration-150 shrink-0"
                            >
                              {renderStandardLabel(inst)}
                            </div>
                          ))
                        : groupedSheets.map((sheetItems, sIdx) => (
                            <div
                              key={`sheet-${sIdx}`}
                              style={{
                                transform: `scale(${previewZoom / 100})`,
                                transformOrigin: 'top center',
                              }}
                              className="shadow-md bg-white transition-transform duration-150 shrink-0"
                            >
                              {renderGroupedSheet(sheetItems, sIdx, groupedSheets.length)}
                            </div>
                          ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: CÓDIGO ZPL */}
            {activeRightTab === 'zpl' && (
              <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Código ZPL II — Zebra ZD220 (203 DPI)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Comandos nativos gerados automaticamente a partir da lista e configurações do painel.
                    </p>
                  </div>

                  {generatedZplCode && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyZpl}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {zplCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{zplCopied ? 'Copiado!' : 'Copiar ZPL'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadZpl}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar .ZPL</span>
                      </button>
                    </div>
                  )}
                </div>

                {generatedZplCode ? (
                  <pre className="flex-1 bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed p-4 rounded-xl overflow-auto max-h-[480px] border border-slate-800 select-all">
                    {generatedZplCode}
                  </pre>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <Code2 className="w-10 h-10 text-slate-300" />
                    <p className="text-sm font-bold text-slate-600 mt-3">Nenhum código ZPL gerado</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
                      Adicione peças no painel esquerdo para visualizar e exportar o código ZPL II da Zebra ZD220.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: BANCO DE DADOS */}
            {activeRightTab === 'database' && (
              <div className="flex-1 flex flex-col bg-white/70">
                <div className="p-4 border-b border-slate-200/80 space-y-3 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Ordens de Produção do Sistema (PCP)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Selecione peças do banco de dados para adicionar à lista de impressão em lote.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsBatchModalOpen(true)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Lote Concluídos</span>
                      </button>
                      {filteredDbOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAddAllFilteredOrders}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Importar ({Math.min(50, filteredDbOrders.length)})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search & Status Filters */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={dbSearch}
                        onChange={(e) => setDbSearch(e.target.value)}
                        placeholder="Buscar OP, loja, peça, montador (use ';' para múltiplos)..."
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <select
                      value={dbStatusFilter}
                      onChange={(e) => setDbStatusFilter(e.target.value as typeof dbStatusFilter)}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="all">Todos ({orders.length})</option>
                      <option value="completed">Concluídos</option>
                      <option value="active">Em Produção</option>
                      <option value="pending">Aguardando Data</option>
                    </select>
                  </div>
                </div>

                {/* Orders List */}
                <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-100">
                  {filteredDbOrders.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-xs">
                      Nenhuma ordem encontrada no banco de dados para o filtro atual.
                    </div>
                  ) : (
                    filteredDbOrders.slice(0, 100).map((ord) => {
                      const isDone = ord.executionStatus === 'concluido' || ord.progress === 100;
                      return (
                        <div
                          key={ord.id}
                          className="px-4 py-3 bg-white hover:bg-slate-50/90 flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900">
                                {ord.orderId || ord.id}
                              </span>
                              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md truncate">
                                {ord.store}
                              </span>
                              {isDone && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Concluído
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-700 truncate mt-0.5 uppercase">
                              {ord.itemDescription}
                            </p>
                            <div className="flex items-center gap-3 text-[10.5px] text-slate-400 mt-0.5 font-medium">
                              <span>Qtd: <strong className="text-slate-600">{ord.quantity || 1} {ord.unit || 'un'}</strong></span>
                              {ord.assignedOperatorName && (
                                <span>Montador: <strong className="text-slate-600">{ord.assignedOperatorName}</strong></span>
                              )}
                              {ord.productionDate && <span>Data: {ord.productionDate}</span>}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddOrderLine(ord)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-lg text-[11px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Print Container specifically targeted as source for direct printing */}
      <div id="zebra-print-source" style={{ display: 'none' }}>
        {paperFormat === '100x30'
          ? physicalLabels.map((inst) => (
              <div key={`print-${inst.key}`} className="zebra-label-print-page">
                {renderStandardLabel(inst)}
              </div>
            ))
          : groupedSheets.map((sheetItems, sIdx) => (
              <div key={`print-sheet-${sIdx}`} className="zebra-label-print-page">
                {renderGroupedSheet(sheetItems, sIdx, groupedSheets.length)}
              </div>
            ))}
      </div>

      {/* Batch Label Generator Modal (for Completed Orders) */}
      {isBatchModalOpen && (
        <BatchLabelModal
          orders={orders.filter((o) => o.executionStatus === 'concluido' || o.progress === 100)}
          titleDate="Lote Geral de Concluídos"
          onClose={() => setIsBatchModalOpen(false)}
        />
      )}
    </div>
  );
};
