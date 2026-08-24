'use client';

import React, { useState, useMemo } from 'react';
import { OrderItem, Store, AssemblyOperator, UserProfile } from '@/types/factory';
import { TrindadeLogo } from './TrindadeLogo';
import { OrderStatusModal } from './OrderStatusModal';
import { sanitizeUnit } from '@/lib/utils';

interface ReportsPageProps {
  orders: OrderItem[];
  setOrders?: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  stores: Store[];
  operators: AssemblyOperator[];
  currentUser?: UserProfile | null;
}

type ReportType = 'operator' | 'store' | 'general';
type DateFilterMode = 'single' | 'range' | 'all_time';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  orders,
  setOrders,
  stores,
  operators,
  currentUser,
}) => {
  // Modal State for Order Status & Motive Manager
  const [selectedOrderForStatusModal, setSelectedOrderForStatusModal] = useState<OrderItem | null>(null);

  const handleUpdateSingleOrder = (updatedOrder: OrderItem) => {
    if (setOrders) {
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );
    }
  };
  // Filters State
  const [reportType, setReportType] = useState<ReportType>('operator');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('all');
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [dateMode, setDateMode] = useState<DateFilterMode>('single');
  const [singleDate, setSingleDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
    return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date helper to normalize YYYY-MM-DD or DD/MM/YYYY formats
  const parseNormalizedDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  // Format date for display in Portuguese
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Toutes as datas';
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Filter logic
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Report Type / Entity Filter
      if (reportType === 'operator' && selectedOperatorId !== 'all') {
        if (order.assignedOperatorId !== selectedOperatorId) {
          // Check fallback match by code or name if assignedOperatorId isn't matching directly
          const matchedOp = operators.find((op) => op.id === selectedOperatorId);
          if (matchedOp) {
            const matchesCode = order.assignedOperatorCode && order.assignedOperatorCode === matchedOp.code;
            const matchesName = order.assignedOperatorName && order.assignedOperatorName.toLowerCase().includes(matchedOp.name.toLowerCase());
            if (!matchesCode && !matchesName) return false;
          } else {
            return false;
          }
        }
      }

      if (reportType === 'store' && selectedStore !== 'all') {
        if (order.store.toLowerCase() !== selectedStore.toLowerCase()) {
          return false;
        }
      }

      // 2. Date Filter
      if (dateMode === 'single' && singleDate) {
        const orderDateNorm = parseNormalizedDate(order.productionDate);
        if (!orderDateNorm || orderDateNorm !== singleDate) {
          return false;
        }
      } else if (dateMode === 'range' && startDate && endDate) {
        const orderDateNorm = parseNormalizedDate(order.productionDate);
        if (!orderDateNorm || orderDateNorm < startDate || orderDateNorm > endDate) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter === 'completed' && order.progress < 100) return false;
      if (statusFilter === 'in_progress' && (order.progress === 0 || order.progress === 100)) return false;
      if (statusFilter === 'pending' && order.progress > 0) return false;

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          order.orderId.toLowerCase().includes(q) ||
          order.itemDescription.toLowerCase().includes(q) ||
          order.store.toLowerCase().includes(q) ||
          (order.assignedOperatorName && order.assignedOperatorName.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [orders, reportType, selectedOperatorId, selectedStore, dateMode, singleDate, startDate, endDate, statusFilter, searchQuery, operators]);

  // Statistics
  const totalItems = filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter((o) => o.progress === 100).length;
  const completedItems = filteredOrders.filter((o) => o.progress === 100).reduce((sum, o) => sum + (o.quantity || 1), 0);
  const inProgressOrders = filteredOrders.filter((o) => o.progress > 0 && o.progress < 100).length;
  const pendingOrders = filteredOrders.filter((o) => o.progress === 0).length;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  // State for Print Modal / Preview
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Date helpers for Produção model sheet
  const formatProductionDate = (dateStr?: string) => {
    if (!dateStr) {
      const now = new Date();
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      return `${now.getDate()}/${months[now.getMonth()]}`;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      return `${day}/${months[monthIdx] || 'jul'}`;
    }
    return dateStr;
  };

  const getDayOfWeekName = (dateStr?: string) => {
    let dateObj = new Date();
    if (dateStr && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    const days = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
    return days[dateObj.getDay()];
  };

  // Group orders by Operator/Montador for the Produção model sheet
  const groupedByOperator = useMemo(() => {
    const map: {
      [key: string]: {
        name: string;
        orders: typeof filteredOrders;
        totalQty: number;
      };
    } = {};

    filteredOrders.forEach((order) => {
      const opName = order.assignedOperatorName
        ? order.assignedOperatorName.toUpperCase()
        : order.assignedOperatorCode
        ? `MONTADOR [${order.assignedOperatorCode}]`
        : 'MONTADOR NÃO ATRIBUÍDO';

      if (!map[opName]) {
        map[opName] = {
          name: opName,
          orders: [],
          totalQty: 0,
        };
      }
      map[opName].orders.push(order);
      map[opName].totalQty += order.quantity || 1;
    });

    return Object.values(map);
  }, [filteredOrders]);

  // Selected entities for display header
  const selectedOperatorObj = operators.find((op) => op.id === selectedOperatorId);
  const activeOperatorTitle = selectedOperatorId === 'all'
    ? 'Todos os Montadores'
    : selectedOperatorObj
    ? `${selectedOperatorObj.code} - ${selectedOperatorObj.name} (${selectedOperatorObj.specialty})`
    : 'Montador Selecionado';

  const activeStoreTitle = selectedStore === 'all' ? 'Todas as Lojas' : selectedStore;

  // Shared CSS for standalone tab print & iframe print
  const getPrintCSS = () => `
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #cbd5e1;
      color: #0f172a;
      margin: 0;
      padding: 16px;
    }
    .border-2 { border: 2px solid #0f172a !important; }
    .border-slate-900 { border-color: #0f172a !important; }
    .border-slate-800 { border-color: #1e293b !important; }
    .border-slate-400 { border-color: #94a3b8 !important; }
    .border-slate-300 { border-color: #cbd5e1 !important; }
    .bg-slate-300 { background-color: #cbd5e1 !important; }
    .bg-slate-200 { background-color: #e2e8f0 !important; }
    .bg-slate-100 { background-color: #f1f5f9 !important; }
    .bg-slate-500 { background-color: #64748b !important; }
    .bg-white { background-color: #ffffff !important; }
    .text-slate-900 { color: #0f172a !important; }
    .text-white { color: #ffffff !important; }
    .bg-\[\#346294\], .bg-blue-800 { background-color: #346294 !important; }
    .font-black { font-weight: 900 !important; }
    .font-bold { font-weight: 700 !important; }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .uppercase { text-transform: uppercase !important; }
    .tracking-widest { letter-spacing: 0.1em !important; }
    .tracking-wider { letter-spacing: 0.05em !important; }
    .p-1 { padding: 4px !important; }
    .p-1\.5 { padding: 6px !important; }
    .p-2 { padding: 8px !important; }
    .p-3 { padding: 12px !important; }
    .p-4 { padding: 16px !important; }
    .pl-2 { padding-left: 8px !important; }
    .pl-3 { padding-left: 12px !important; }
    .pr-2 { padding-right: 8px !important; }
    .pr-3 { padding-right: 12px !important; }
    .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
    .py-1\.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
    .py-2 { padding-top: 8px !important; padding-bottom: 8px !important; }
    .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
    .px-3 { padding-left: 12px !important; padding-right: 12px !important; }
    .my-1 { margin-top: 4px !important; margin-bottom: 4px !important; }
    .mb-1 { margin-bottom: 4px !important; }
    .-mx-3 { margin-left: -12px !important; margin-right: -12px !important; }
    .w-full { width: 100% !important; }
    .w-16 { width: 64px !important; }
    .space-y-3 > * + * { margin-top: 12px !important; }
    .space-y-4 > * + * { margin-top: 16px !important; }
    .rounded-lg { border-radius: 8px !important; }
    .rounded-md { border-radius: 6px !important; }
    .flex { display: flex !important; }
    .inline-flex { display: inline-flex !important; }
    .flex-col { flex-direction: column !important; }
    .justify-center { justify-content: center !important; }
    .items-center { align-items: center !important; }
    .gap-3 { gap: 12px !important; }
    .leading-none { line-height: 1 !important; }
    .shrink-0 { flex-shrink: 0 !important; }
    .overflow-hidden { overflow: hidden !important; }
    .whitespace-nowrap { white-space: nowrap !important; }

    svg { display: block; width: 32px !important; height: 32px !important; }

    table { width: 100%; border-collapse: collapse; font-family: system-ui, -apple-system, sans-serif; }
    td { padding: 6px 10px; border-bottom: 1px solid #94a3b8; font-size: 11px; font-weight: 700; color: #0f172a; }
    
    .no-print-bar {
      background: #0f172a;
      color: white;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 14px;
    }
    .btn-print {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      font-weight: bold;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-print:hover { background: #1d4ed8; }

    @media print {
      .no-print-bar { display: none !important; }
      @page { size: A4 portrait; margin: 0.6cm; }
      body { padding: 0 !important; background-color: #ffffff !important; }
      .bg-slate-300 { background-color: #ffffff !important; }
    }
  `;

  // Helper to open printable standalone HTML in a new tab (bypassing iframe sandbox and popup blockers)
  const openPrintWindow = () => {
    const reportElem = document.getElementById('printable-report-content');
    if (!reportElem) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PRODUÇÃO - TRINDADE ESQUADRIAS (${singleDate || 'Geral'})</title>
  <style>
    ${getPrintCSS()}
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>TRINDADE ESQUADRIAS DE ALUMÍNIO - FICHA OFICIAL DE PRODUÇÃO</span>
    <button class="btn-print" onclick="window.print()">Imprimir Agora (Ctrl+P)</button>
  </div>
  ${reportElem.innerHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Execute direct print
  const executePrint = () => {
    // 1. Try iframe print first
    try {
      const reportElem = document.getElementById('printable-report-content');
      if (reportElem) {
        let printIframe = document.getElementById('trindade-hidden-iframe') as HTMLIFrameElement;
        if (printIframe && printIframe.parentNode) {
          printIframe.parentNode.removeChild(printIframe);
        }

        printIframe = document.createElement('iframe');
        printIframe.id = 'trindade-hidden-iframe';
        printIframe.style.position = 'fixed';
        printIframe.style.top = '-9999px';
        printIframe.style.left = '-9999px';
        printIframe.style.width = '210mm';
        printIframe.style.height = '297mm';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);

        const iframeDoc = printIframe.contentWindow?.document || printIframe.contentDocument;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>PRODUÇÃO - TRINDADE ESQUADRIAS</title>
  <style>
    ${getPrintCSS()}
  </style>
</head>
<body>
  ${reportElem.innerHTML}
</body>
</html>`);
          iframeDoc.close();

          setTimeout(() => {
            try {
              printIframe.contentWindow?.focus();
              printIframe.contentWindow?.print();
            } catch (err) {
              console.warn('Iframe print error:', err);
              openPrintWindow();
            }
          }, 200);
        }
      }
    } catch (err) {
      console.warn('Execute print fallback to tab:', err);
      openPrintWindow();
    }

    // 2. Also attempt window.open in tab as backup
    openPrintWindow();
  };

  // Handle Print Action (Directly called on main button click)
  const handlePrint = () => {
    setIsPrintModalOpen(true);
    setTimeout(() => {
      executePrint();
    }, 150);
  };


  // Standalone Printable File Download (Guaranteed to work even in sandboxed iframes)
  const handleDownloadPrintableHTML = () => {
    const reportElem = document.getElementById('printable-report-content');
    if (!reportElem) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Relatorio_Trindade_Esquadrias_${singleDate || 'geral'}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #ffffff;
        color: #0f172a;
        margin: 0;
        padding: 24px;
        font-size: 11pt;
        line-height: 1.4;
      }
      .no-print-toolbar {
        background-color: #0f172a;
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      .btn-print {
        background-color: #2563eb;
        color: white;
        border: none;
        padding: 10px 20px;
        font-weight: bold;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
      }
      .btn-print:hover { background-color: #1d4ed8; }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        font-size: 10pt;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 8px 10px;
        text-align: left;
      }
      th {
        background-color: #f1f5f9;
        color: #0f172a;
        font-weight: bold;
      }
      .print-signatures {
        display: flex !important;
        justify-content: space-between;
        margin-top: 60px;
        padding-top: 20px;
      }
      .print-signature-line {
        width: 42%;
        border-top: 1px solid #475569;
        text-align: center;
        padding-top: 6px;
        font-size: 9pt;
      }
      @media print {
        .no-print-toolbar { display: none !important; }
        body { padding: 0 !important; }
      }
    </style>
  </head>
  <body>
    <div class="no-print-toolbar">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">🖨️</span>
        <span style="font-size: 14px; font-weight: bold;">
          Trindade Esquadrias - Documento Oficial de Impressão
        </span>
      </div>
      <button class="btn-print" onclick="window.print()">
        Imprimir / Salvar em PDF (Ctrl+P)
      </button>
    </div>
    <div>
      ${reportElem.innerHTML}
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 300);
      };
    </script>
  </body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_trindade_${reportType}_${singleDate || 'geral'}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Standalone Popup Window Print (Fallback for iframe restrictions)
  const openStandalonePrintWindow = () => {
    const reportElem = document.getElementById('printable-report-content');
    if (!reportElem) return;

    try {
      const printWin = window.open('', '_blank', 'width=1000,height=800');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8" />
              <title>Relatório Oficial de Montagem - Trindade Esquadrias</title>
              <style>
                body {
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  background-color: white;
                  color: #0f172a;
                  margin: 0;
                  padding: 24px;
                  font-size: 11pt;
                }
                .no-print-toolbar {
                  background-color: #0f172a;
                  color: white;
                  padding: 12px 20px;
                  border-radius: 12px;
                  margin-bottom: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                }
                .btn-print {
                  background-color: #2563eb;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  font-weight: bold;
                  border-radius: 8px;
                  cursor: pointer;
                  font-size: 12px;
                }
                .btn-print:hover { background-color: #1d4ed8; }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 16px;
                  font-size: 10pt;
                }
                th, td {
                  border: 1px solid #cbd5e1;
                  padding: 8px;
                  text-align: left;
                }
                th {
                  background-color: #f1f5f9;
                  color: #0f172a;
                  font-weight: bold;
                }
                .print-signatures {
                  display: flex !important;
                  justify-content: space-between;
                  margin-top: 50px;
                  padding-top: 20px;
                }
                .print-signature-line {
                  width: 45%;
                  border-top: 1px solid #475569;
                  text-align: center;
                  padding-top: 5px;
                  font-size: 9pt;
                }
                @media print {
                  .no-print-toolbar { display: none !important; }
                  body { padding: 0 !important; }
                }
              </style>
            </head>
            <body>
              <div class="no-print-toolbar">
                <span style="font-size: 13px; font-weight: bold;">
                  🖨️ Modo Impressão Direta - Trindade Esquadrias
                </span>
                <button class="btn-print" onclick="window.print()">
                  Imprimir / Salvar PDF (Ctrl+P)
                </button>
              </div>
              <div>
                ${reportElem.innerHTML}
              </div>
              <script>
                setTimeout(function() {
                  window.print();
                }, 400);
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        // Fallback when window.open is blocked by iframe/pop-up policy
        handleDownloadPrintableHTML();
      }
    } catch (e) {
      console.error('Error opening standalone print window:', e);
      handleDownloadPrintableHTML();
    }
  };

  // Export CSV Action
  const handleExportCSV = () => {
    const headers = ['Nº Ordem (OP)', 'Loja / Cliente', 'Descrição do Item / Esquadria', 'Qtd', 'Montador Responsável', 'Data Programada', 'Progresso (%)', 'Status Execução'];
    const rows = filteredOrders.map((o) => [
      `"${o.orderId}"`,
      `"${o.store}"`,
      `"${o.itemDescription.replace(/"/g, '""')}"`,
      o.quantity || 1,
      `"${o.assignedOperatorName || o.assignedOperatorCode || 'Não atribuído'}"`,
      `"${formatDateDisplay(o.productionDate || '')}"`,
      `${o.progress}%`,
      `"${o.progress === 100 ? 'CONCLUÍDO' : o.progress > 0 ? 'EM ANDAMENTO' : 'PENDENTE'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_trindade_${reportType}_${singleDate || 'geral'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Printable CSS Styles */}
      <style jsx global>{`
        @media print {
          /* Hide non-printable elements */
          aside,
          header,
          .no-print,
          button,
          input,
          select,
          nav {
            display: none !important;
          }

          /* Reset layout margins for full page print */
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          main {
            margin-left: 0 !important;
            padding: 0 !important;
          }

          .print-container {
            display: block !important;
            width: 100% !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
          }

          .print-header {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10pt !important;
          }

          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
            text-align: left !important;
          }

          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: bold !important;
          }

          .print-signatures {
            display: flex !important;
            justify-content: space-between;
            margin-top: 50px;
            padding-top: 20px;
            page-break-inside: avoid;
          }

          .print-signature-line {
            width: 45%;
            border-top: 1px solid #475569;
            text-align: center;
            padding-top: 5px;
            font-size: 9pt;
          }
        }
      `}</style>

      {/* Screen Header (Interactive) */}
      <div className="no-print bg-slate-900 p-6 rounded-3xl text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-full text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Emissão de Relatórios Oficiais de Produção</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Relatórios de Montagem & Lojas
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl leading-relaxed">
              Gere, consulte e imprima relatórios consolidados por montador, por loja parceira ou da produção geral da fábrica da Trindade Esquadrias.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              <span>Imprimir Relatório</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Configuration & Filters Bar */}
      <div className="no-print bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        {/* 1. Report Type Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportType('operator')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                reportType === 'operator'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">engineering</span>
              <span>Relatório por Montador</span>
            </button>

            <button
              type="button"
              onClick={() => setReportType('store')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                reportType === 'store'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">store</span>
              <span>Relatório por Loja / Cliente</span>
            </button>
          </div>
        </div>

        {/* 2. Specific Entity & Date Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entity Selector (Operator or Store depending on tab) */}
          {reportType === 'operator' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Selecionar Montador</label>
              <select
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="all">Todos os Montadores ({operators.length})</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.code} - {op.name} ({op.specialty})
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'store' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Selecionar Loja / Cliente</label>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
              >
                <option value="all">Todas as Lojas ({stores.length})</option>
                {stores.map((st) => (
                  <option key={st.id} value={st.name}>
                    {st.code} - {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Data de Produção</label>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
            />
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Buscar Ordem / Item</label>
            <div className="relative">
              <span className="material-symbols-outlined text-slate-400 absolute left-3.5 top-[12px] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por código ou descrição..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Screen Report Box (Visible on Screen, Hidden on Print) */}
      <div className="no-print bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-md space-y-6">
        {/* Screen Official Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl shrink-0">
              <TrindadeLogo variant="dark-bg" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                Trindade Esquadrias de Alumínio
              </h2>
              <p className="text-xs font-bold text-slate-600">
                Relatório de Montagem & Controle de Produção
              </p>
              <p className="text-[11px] text-slate-400">
                Fábrica / Central de Processamento | Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="text-left md:text-right text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <p className="font-bold text-slate-900">
              Tipo: <span className="text-blue-600 uppercase font-extrabold">{reportType === 'operator' ? 'Por Montador' : reportType === 'store' ? 'Por Loja / Cliente' : 'Geral Fábrica'}</span>
            </p>
            <p className="font-semibold">
              Filtro: <span className="text-slate-800 font-bold">{reportType === 'operator' ? activeOperatorTitle : reportType === 'store' ? activeStoreTitle : 'Produção Geral'}</span>
            </p>
            <p className="font-semibold">
              Data: <span className="text-slate-900 font-bold">{dateMode === 'single' ? formatDateDisplay(singleDate) : dateMode === 'range' ? `${formatDateDisplay(startDate)} até ${formatDateDisplay(endDate)}` : 'Histórico Completo'}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              Emissor: {currentUser?.name || 'Administrador'} ({currentUser?.role || 'Gerente'})
            </p>
          </div>
        </div>

        {/* Screen Table Content */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-blue-600">list_alt</span>
              <span>Ordens e Peças Cadastradas ({filteredOrders.length})</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Mostrando {filteredOrders.length} registros no sistema
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="material-symbols-outlined text-[48px] text-slate-300">folder_off</span>
              <h4 className="font-bold text-slate-700 text-sm">Nenhuma ordem encontrada para os filtros selecionados</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tente alterar a data (ex: selecionar 23/07/2026), escolher outro montador/loja ou pesquisar por outro termo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase font-extrabold tracking-wider border-b border-slate-200">
                    <th className="p-3">Nº Ordem (OP)</th>
                    <th className="p-3">Loja / Cliente</th>
                    <th className="p-3">Descrição da Esquadria / Peça</th>
                    <th className="p-3 text-center">Qtd</th>
                    <th className="p-3">Montador Responsável</th>
                    <th className="p-3 text-center">Data Programada</th>
                    <th className="p-3 text-center">Progresso</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                  {filteredOrders.map((ord, idx) => {
                    const isDone = ord.progress === 100;
                    const inProg = ord.progress > 0 && ord.progress < 100;

                    return (
                      <tr
                        key={ord.id ? `${ord.id}-${idx}` : `ord-${idx}`}
                        onClick={() => setSelectedOrderForStatusModal(ord)}
                        className="hover:bg-blue-50/70 cursor-pointer transition-colors group"
                      >
                        <td className="p-3 font-black text-slate-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderForStatusModal(ord);
                            }}
                            className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-300 hover:bg-blue-600 hover:text-white text-blue-800 px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-2xs hover:shadow-md cursor-pointer group/btn"
                            title="Clique para abrir relato de status, motivos de atraso e histórico da OP"
                          >
                            <span className="underline decoration-blue-400/60 underline-offset-2">{ord.orderId}</span>
                            <span className="material-symbols-outlined text-[15px] text-blue-600 group-hover/btn:text-white transition-colors">
                              edit_note
                            </span>
                          </button>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                          {ord.store}
                        </td>
                        <td className="p-3 font-medium text-slate-900 max-w-xs">
                          {ord.itemDescription}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-900 truncate">
                          {ord.quantity || 1} {sanitizeUnit(ord.unit)}
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {ord.assignedOperatorName || ord.assignedOperatorCode ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[15px] text-blue-600">engineering</span>
                              <span>
                                {ord.assignedOperatorCode ? `[${ord.assignedOperatorCode}] ` : ''}
                                {ord.assignedOperatorName || ''}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Não atribuído</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                          {ord.productionDate ? formatDateDisplay(ord.productionDate) : <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10px]">Aguardando Data</span>}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  isDone ? 'bg-emerald-500' : inProg ? 'bg-blue-500' : 'bg-slate-400'
                                }`}
                                style={{ width: `${ord.progress}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-900 text-[11px]">{ord.progress}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : inProg
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isDone ? 'bg-emerald-600' : inProg ? 'bg-blue-600' : 'bg-slate-400'
                              }`}
                            />
                            <span>{isDone ? 'Concluído' : inProg ? 'Em Montagem' : 'Aguardando'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary Box */}
        {filteredOrders.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-bold text-slate-900">Resumo da Produção do Relatório:</p>
              <p className="text-slate-600">
                Total de peças listadas: <strong>{totalItems} unidades</strong> | Conclusão média da equipe: <strong>{completionRate}%</strong>
              </p>
            </div>

            <div className="flex items-center gap-4 text-slate-700 font-bold">
              <span>Concluídos: <strong className="text-emerald-700">{completedOrders}</strong></span>
              <span>Em Andamento: <strong className="text-blue-700">{inProgressOrders}</strong></span>
              <span>Pendentes: <strong className="text-slate-500">{pendingOrders}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Official Factory Printable Ficha de Produção (Modelo Imprimir - Hidden on Screen, Printed/Exported directly) */}
      <div id="printable-report-content" className="print-container hidden print:block bg-slate-300 p-2 text-slate-900">
        <div className="border-2 border-slate-900 bg-slate-300 p-3 rounded-lg font-sans text-slate-900 space-y-3">
          {/* Header Box */}
          <div className="bg-slate-200 border-2 border-slate-900 pt-3 pb-0 px-3 text-center rounded-md space-y-1 overflow-hidden">
            <div className="flex justify-center mb-1">
              <TrindadeLogo variant="light-bg" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-widest text-slate-900 my-1">
              PRODUÇÃO
            </h1>
            <div className="bg-slate-500 text-white font-black text-xs py-1.5 text-center border-t-2 border-slate-900 -mx-3">
              {formatProductionDate(singleDate)}
            </div>
          </div>

          {/* Operator Groups */}
          {groupedByOperator.length === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-slate-900 rounded-lg text-slate-500 font-medium">
              Nenhuma ordem de montagem encontrada para a data ou filtros selecionados.
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByOperator.map((group) => (
                <div key={group.name} className="border-2 border-slate-900 bg-white overflow-hidden rounded-md">
                  {/* Operator Header Banner */}
                  <div className="bg-[#346294] text-white font-black text-center py-1.5 px-3 uppercase tracking-wider text-xs border-b-2 border-slate-900">
                    {group.name} {getDayOfWeekName(singleDate)}
                  </div>

                  {/* Items Table */}
                  <table className="w-full text-left border-collapse text-xs">
                    <tbody className="divide-y divide-slate-400 font-sans">
                      {group.orders.map((ord, idx) => {
                        const storePrefix = ord.store?.trim() ? `(${ord.store.trim()}) ` : '';
                        const qty = ord.quantity || 1;
                        const qtyPrefix = `${qty}x `;
                        
                        let cleanDesc = (ord.itemDescription || '').trim();
                        // Remove duplicated store in parenthesis if already at beginning of description
                        if (ord.store && cleanDesc.toLowerCase().startsWith(`(${ord.store.trim().toLowerCase()})`)) {
                          cleanDesc = cleanDesc.slice(ord.store.trim().length + 2).trim();
                        }
                        // Remove any existing/repeated quantity prefixes at the beginning like "1x ", "1X ", "2 x ", "1 - ", etc.
                        cleanDesc = cleanDesc.replace(/^(\d+\s*[xX\-]\s*)+/, '').trim();

                        return (
                          <tr key={ord.id || idx}>
                            <td className="p-2 pl-3 font-bold text-slate-900 text-xs">
                              {storePrefix && <span className="font-black text-slate-900">{storePrefix}</span>}
                              <span className="font-extrabold text-slate-900">{qtyPrefix}</span>
                              <span>{cleanDesc}</span>
                            </td>
                            <td className="p-2 pr-3 text-right font-black text-slate-900 text-sm whitespace-nowrap w-16">
                              {qty}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Soma Row */}
                      <tr className="bg-slate-200 font-black border-t-2 border-slate-900 text-xs">
                        <td className="p-2 pl-3 text-slate-900 uppercase">Soma</td>
                        <td className="p-2 pr-3 text-right text-slate-900">{group.totalQty}</td>
                      </tr>

                      {/* Checklist Row */}
                      <tr className="bg-slate-100 font-bold text-[10px] text-slate-800 border-t border-slate-400">
                        <td colSpan={2} className="p-2 text-center uppercase tracking-wider">
                          LIMPEZA:( &nbsp;&nbsp; ) &nbsp;&nbsp;&nbsp;&nbsp; ORGANIZAÇÃO:( &nbsp;&nbsp; ) &nbsp;&nbsp;&nbsp;&nbsp; DISCIPLINA:( &nbsp;&nbsp; )
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Print Preview & PDF Modal (Solves iframe print dialog restrictions) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-xl">
                  <span className="material-symbols-outlined text-[20px]">print</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Ficha de Produção Pronta para Impressão</h3>
                  <p className="text-xs text-slate-400">Trindade Esquadrias - Modelo Oficial de Fábrica</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Banner Notice about PDF saving */}
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">info</span>
                <span>
                  <strong>Dica para Impressão / PDF:</strong> Selecione a impressora ou escolha <strong>&quot;Salvar como PDF&quot;</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadPrintableHTML}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shrink-0 cursor-pointer"
              >
                Baixar Versão Offline (.HTML)
              </button>
            </div>

            {/* Document Preview Box */}
            <div className="p-6 overflow-y-auto bg-slate-300 grow">
              <div className="border-2 border-slate-900 bg-slate-300 p-4 rounded-xl max-w-2xl mx-auto space-y-3 text-xs shadow-md">
                {/* Header preview */}
                <div className="bg-slate-200 border-2 border-slate-900 pt-3 pb-0 px-3 text-center rounded-md space-y-1 overflow-hidden">
                  <div className="flex justify-center mb-1">
                    <TrindadeLogo variant="light-bg" />
                  </div>
                  <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 my-1">
                    PRODUÇÃO
                  </h2>
                  <div className="bg-slate-500 text-white font-black text-xs py-1.5 text-center border-t-2 border-slate-900 -mx-3">
                    {formatProductionDate(singleDate)}
                  </div>
                </div>

                {/* Groups preview */}
                {groupedByOperator.map((group) => (
                  <div key={group.name} className="border-2 border-slate-900 bg-white overflow-hidden rounded-md">
                    <div className="bg-[#346294] text-white font-black text-center py-1.5 px-3 uppercase text-xs border-b-2 border-slate-900 tracking-wider">
                      {group.name} {getDayOfWeekName(singleDate)}
                    </div>
                    <table className="w-full text-left border-collapse text-xs font-sans">
                      <tbody className="divide-y divide-slate-400">
                        {group.orders.map((ord, idx) => {
                          const storePrefix = ord.store?.trim() ? `(${ord.store.trim()}) ` : '';
                          const qty = ord.quantity || 1;
                          const qtyPrefix = `${qty}x `;
                          
                          let cleanDesc = (ord.itemDescription || '').trim();
                          // Remove duplicated store in parenthesis if already at beginning of description
                          if (ord.store && cleanDesc.toLowerCase().startsWith(`(${ord.store.trim().toLowerCase()})`)) {
                            cleanDesc = cleanDesc.slice(ord.store.trim().length + 2).trim();
                          }
                          // Remove any existing/repeated quantity prefixes at the beginning like "1x ", "1X ", "2 x ", "1 - ", etc.
                          cleanDesc = cleanDesc.replace(/^(\d+\s*[xX\-]\s*)+/, '').trim();

                          return (
                            <tr key={ord.id || idx}>
                              <td className="p-2 pl-3 font-bold text-slate-900">
                                {storePrefix && <span className="font-black text-slate-900">{storePrefix}</span>}
                                <span className="font-extrabold text-slate-900">{qtyPrefix}</span>
                                <span>{cleanDesc}</span>
                              </td>
                              <td className="p-2 pr-3 text-right font-black text-slate-900 w-16 whitespace-nowrap">{qty}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-200 font-black border-t-2 border-slate-900 text-xs">
                          <td className="p-2 pl-3 text-slate-900 uppercase">Soma</td>
                          <td className="p-2 pr-3 text-right text-slate-900">{group.totalQty}</td>
                        </tr>
                        <tr className="bg-slate-100 font-bold text-[10px] text-slate-800 border-t border-slate-400">
                          <td colSpan={2} className="p-2 text-center uppercase tracking-wider">
                            LIMPEZA:( &nbsp;&nbsp; ) &nbsp;&nbsp;&nbsp;&nbsp; ORGANIZAÇÃO:( &nbsp;&nbsp; ) &nbsp;&nbsp;&nbsp;&nbsp; DISCIPLINA:( &nbsp;&nbsp; )
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-white text-xs shrink-0">
              <span className="text-slate-400">Trindade Esquadrias - Ficha de Controle de Produção</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={openPrintWindow}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Abrir em Nova Aba para Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={executePrint}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Imprimir Agora (Ctrl+P)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Status & Delay History Modal */}
      <OrderStatusModal
        key={selectedOrderForStatusModal?.id || 'none'}
        order={selectedOrderForStatusModal}
        isOpen={!!selectedOrderForStatusModal}
        onClose={() => setSelectedOrderForStatusModal(null)}
        onUpdateOrder={handleUpdateSingleOrder}
        currentUser={currentUser}
      />
    </div>
  );
};
