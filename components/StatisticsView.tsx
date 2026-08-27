'use client';

import React, { useState } from 'react';
import { OrderItem, AssemblyOperator, ExecutionStatus } from '@/types/factory';

// Helper Speedometer Gauge Chart for Excel Dashboard
const SpeedometerGauge: React.FC<{ percentage: number }> = ({ percentage }) => {
  const p = Math.min(100, Math.max(0, percentage));
  const needleAngle = -90 + (p / 100) * 180;

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <div className="w-full max-w-[260px] aspect-[2/1.1] relative flex items-center justify-center">
        <svg viewBox="0 0 200 115" className="w-full h-full overflow-visible">
          {/* Semicircle background segments */}
          {/* Péssimo: 0-50% */}
          <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#ef4444" strokeWidth="22" strokeLinecap="butt" />
          {/* Ruim: 50-65% */}
          <path d="M 100 20 A 80 80 0 0 1 142 32" fill="none" stroke="#f97316" strokeWidth="22" strokeLinecap="butt" />
          {/* Regular: 65-80% */}
          <path d="M 142 32 A 80 80 0 0 1 170 56" fill="none" stroke="#eab308" strokeWidth="22" strokeLinecap="butt" />
          {/* Bom: 80-90% */}
          <path d="M 170 56 A 80 80 0 0 1 178 75" fill="none" stroke="#84cc16" strokeWidth="22" strokeLinecap="butt" />
          {/* Excelente: 90-100% */}
          <path d="M 178 75 A 80 80 0 0 1 180 100" fill="none" stroke="#10b981" strokeWidth="22" strokeLinecap="butt" />

          {/* Inner & Outer arcs for clean Excel finish */}
          <path d="M 9 100 A 91 91 0 0 1 191 100" fill="none" stroke="#0f172a" strokeWidth="1.5" />
          <path d="M 31 100 A 69 69 0 0 1 169 100" fill="none" stroke="#0f172a" strokeWidth="1.5" />

          {/* Pointer needle */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            <line x1="100" y1="100" x2="100" y2="28" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
            <polygon points="96,100 104,100 100,24" fill="#0f172a" />
            <circle cx="100" cy="100" r="7" fill="#0f172a" />
            <circle cx="100" cy="100" r="3" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {/* Value Overlay Box */}
      <div className="bg-white border-2 border-slate-900 shadow-md px-5 py-1 rounded-xl text-center font-black text-xl text-slate-900 -mt-5 z-10">
        {p.toFixed(2).replace('.', ',')}%
      </div>
    </div>
  );
};

// Helper Vertical Bar Chart for Produced Pieces (Quantity)
const ExcelBarChartQuantity: React.FC<{ data: { name: string; qty: number }[] }> = ({ data }) => {
  const maxQty = Math.max(10, ...data.map((d) => d.qty));

  return (
    <div className="w-full h-full min-h-[260px] flex flex-col justify-between pt-3 pb-1">
      <div className="flex-1 flex items-end justify-between gap-2 px-2 border-b-2 border-slate-700 relative">
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 border-t border-b border-dashed border-slate-400">
          <div className="border-b border-dashed border-slate-400 w-full" />
          <div className="border-b border-dashed border-slate-400 w-full" />
          <div className="border-b border-dashed border-slate-400 w-full" />
        </div>

        {data.map((item, idx) => {
          const heightPct = Math.max(8, Math.round((item.qty / maxQty) * 100));

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group z-10">
              <span className="text-[11px] font-black text-slate-900 mb-1 group-hover:scale-110 transition-transform">
                {item.qty}
              </span>

              <div
                className="w-full max-w-[42px] bg-gradient-to-t from-sky-800 via-sky-600 to-sky-400 rounded-t-md shadow-md border-t border-x border-sky-300 transition-all duration-300 group-hover:brightness-110"
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-2 px-2 pt-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 text-center">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight block truncate" title={item.name}>
              {item.name.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper Vertical Bar Chart for % Individual Efficiency
const ExcelBarChartEfficiency: React.FC<{ data: { name: string; pct: number }[] }> = ({ data }) => {
  return (
    <div className="w-full h-full min-h-[220px] flex flex-col justify-between pt-3 pb-1">
      <div className="flex-1 flex items-end justify-between gap-2 px-2 border-b-2 border-slate-700 relative">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 border-t border-b border-dashed border-slate-400">
          <div className="border-b border-dashed border-slate-400 w-full" />
          <div className="border-b border-dashed border-slate-400 w-full" />
        </div>

        {data.map((item, idx) => {
          const heightPct = Math.max(6, Math.min(100, item.pct));

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group z-10">
              <span className="text-[10px] font-black text-slate-900 mb-1">
                {item.pct}%
              </span>

              <div
                className="w-full max-w-[36px] bg-gradient-to-t from-blue-900 via-blue-700 to-sky-400 rounded-t-sm shadow-sm border-t border-x border-blue-300 transition-all duration-300 group-hover:brightness-110"
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-2 px-2 pt-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 text-center">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight block truncate" title={item.name}>
              {item.name.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface StatisticsViewProps {
  orders: OrderItem[];
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  operators?: AssemblyOperator[];
  searchQuery?: string;
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  orders,
  setOrders,
  operators = [],
  searchQuery = '',
}) => {
  const [activeDashTab, setActiveDashTab] = useState<'dash' | 'reasons' | 'ranking'>('dash');
  const [filterShift, setFilterShift] = useState<string>('todos');
  const [filterPerformance, setFilterPerformance] = useState<string>('todos');
  const [rankingSortBy, setRankingSortBy] = useState<'efficiency' | 'delivered'>('efficiency');
  const [selectedReasonForModal, setSelectedReasonForModal] = useState<{
    reason: string;
    totalDeficitQty: number;
    affectedOrders: OrderItem[];
    colorStyle: { color: string; bg: string; border: string; barColor: string; icon: string };
  } | null>(null);
  const [showMuralPrintModal, setShowMuralPrintModal] = useState<boolean>(false);
  const [localSearch, setLocalSearch] = useState<string>(searchQuery);
  const [selectedOperatorForModal, setSelectedOperatorForModal] = useState<AssemblyOperator | null>(null);
  const [assignmentToast, setAssignmentToast] = useState<string | null>(null);

  const searchTerm = (localSearch || searchQuery).toLowerCase().trim();

  // Helper to compute delivered pieces for an order item
  const getDeliveredQuantity = (item: OrderItem): number => {
    if (item.executionStatus === 'concluido') return item.quantity;
    if (item.executionStatus === 'nao_produzido') return 0;
    // For 'parcial' or 'pendente', calculate based on percentage progress
    return Math.min(item.quantity, Math.round((item.quantity * (item.progress || 0)) / 100));
  };

  // Color & Icon mapping dictionary for deficit reasons
  const REASON_STYLE_MAP: Record<string, { color: string; bg: string; border: string; barColor: string; icon: string }> = {
    'FALTA DE PERFIL': { color: 'text-amber-900', bg: 'bg-amber-50', border: 'border-amber-200', barColor: 'bg-amber-500', icon: 'inventory_2' },
    'FALTA DE VIDRO': { color: 'text-sky-900', bg: 'bg-sky-50', border: 'border-sky-200', barColor: 'bg-sky-500', icon: 'window' },
    'FALTA DE ACESSÓRIO': { color: 'text-purple-900', bg: 'bg-purple-50', border: 'border-purple-200', barColor: 'bg-purple-500', icon: 'extension' },
    'FUNCIONÁRIO FALTA/ATRAZO': { color: 'text-rose-900', bg: 'bg-rose-50', border: 'border-rose-200', barColor: 'bg-rose-500', icon: 'person_off' },
    'QUEBRA DE MAQUINÁRIO': { color: 'text-orange-900', bg: 'bg-orange-50', border: 'border-orange-200', barColor: 'bg-orange-500', icon: 'build_circle' },
    'QUEDA DE ENERGIA': { color: 'text-yellow-900', bg: 'bg-yellow-50', border: 'border-yellow-200', barColor: 'bg-yellow-500', icon: 'power_off' },
    'PROBLEMAS COMPRESSOR': { color: 'text-cyan-900', bg: 'bg-cyan-50', border: 'border-cyan-200', barColor: 'bg-cyan-500', icon: 'compress' },
    'ERRO PCP': { color: 'text-violet-900', bg: 'bg-violet-50', border: 'border-violet-200', barColor: 'bg-violet-500', icon: 'assignment_late' },
    'ERRO DE CORTE': { color: 'text-red-900', bg: 'bg-red-50', border: 'border-red-200', barColor: 'bg-red-500', icon: 'content_cut' },
    'ERRO DE USINAGEM': { color: 'text-indigo-900', bg: 'bg-indigo-50', border: 'border-indigo-200', barColor: 'bg-indigo-500', icon: 'precision_manufacturing' },
    'OPERACIONAL': { color: 'text-slate-900', bg: 'bg-slate-100', border: 'border-slate-300', barColor: 'bg-slate-600', icon: 'engineering' },
  };

  const DEFAULT_REASON_STYLE = { color: 'text-slate-800', bg: 'bg-slate-50', border: 'border-slate-200', barColor: 'bg-slate-500', icon: 'report_problem' };

  // Calculate real deficit reasons from orders
  const deficitByReasonMap: Record<string, { totalDeficit: number; ordersList: OrderItem[] }> = {};

  orders.forEach((ord) => {
    const delivered = getDeliveredQuantity(ord);
    const deficit = Math.max(0, (ord.quantity || 0) - delivered);

    if (deficit > 0) {
      let rawReason = ord.delayReason || ord.pendingReason;
      if (!rawReason && ord.statusHistory && ord.statusHistory.length > 0) {
        const lastReasonLog = [...ord.statusHistory].reverse().find((h) => h.reason);
        if (lastReasonLog) rawReason = lastReasonLog.reason;
      }

      const reason = rawReason ? rawReason.trim().toUpperCase() : 'MOTIVO NÃO ESPECIFICADO / PENDENTE';

      if (!deficitByReasonMap[reason]) {
        deficitByReasonMap[reason] = { totalDeficit: 0, ordersList: [] };
      }
      deficitByReasonMap[reason].totalDeficit += deficit;
      deficitByReasonMap[reason].ordersList.push(ord);
    }
  });

  const realDeficitReasons = Object.entries(deficitByReasonMap)
    .map(([reason, data]) => ({
      reason,
      totalDeficitQty: data.totalDeficit,
      affectedOrdersCount: data.ordersList.length,
      affectedOrders: data.ordersList,
      colorStyle: REASON_STYLE_MAP[reason] || DEFAULT_REASON_STYLE,
    }))
    .sort((a, b) => b.totalDeficitQty - a.totalDeficitQty);

  const totalRealDeficitQty = realDeficitReasons.reduce((acc, curr) => acc + curr.totalDeficitQty, 0);

  // Fallback demo/benchmark data if no orders currently have deficit reported
  const demoDeficitReasons = [
    { reason: 'FALTA DE PERFIL', totalDeficitQty: 85, affectedOrdersCount: 4, affectedOrders: [], colorStyle: REASON_STYLE_MAP['FALTA DE PERFIL'] },
    { reason: 'FALTA DE VIDRO', totalDeficitQty: 52, affectedOrdersCount: 3, affectedOrders: [], colorStyle: REASON_STYLE_MAP['FALTA DE VIDRO'] },
    { reason: 'ERRO DE CORTE', totalDeficitQty: 34, affectedOrdersCount: 2, affectedOrders: [], colorStyle: REASON_STYLE_MAP['ERRO DE CORTE'] },
    { reason: 'QUEBRA DE MAQUINÁRIO', totalDeficitQty: 28, affectedOrdersCount: 2, affectedOrders: [], colorStyle: REASON_STYLE_MAP['QUEBRA DE MAQUINÁRIO'] },
    { reason: 'FALTA DE ACESSÓRIO', totalDeficitQty: 18, affectedOrdersCount: 1, affectedOrders: [], colorStyle: REASON_STYLE_MAP['FALTA DE ACESSÓRIO'] },
    { reason: 'FUNCIONÁRIO FALTA/ATRAZO', totalDeficitQty: 12, affectedOrdersCount: 1, affectedOrders: [], colorStyle: REASON_STYLE_MAP['FUNCIONÁRIO FALTA/ATRAZO'] },
  ];

  const displayDeficitReasons = totalRealDeficitQty > 0 ? realDeficitReasons : demoDeficitReasons;
  const totalDisplayDeficitQty = displayDeficitReasons.reduce((acc, curr) => acc + curr.totalDeficitQty, 0);
  const isUsingDemoDeficitData = totalRealDeficitQty === 0;

  // Compute metrics for a single operator
  const getOperatorMetrics = (opId: string) => {
    const assignedOrders = orders.filter((o) => o.assignedOperatorId === opId);
    const totalAssignedQty = assignedOrders.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    const totalDeliveredQty = assignedOrders.reduce((acc, curr) => acc + getDeliveredQuantity(curr), 0);
    const pendingQty = Math.max(0, totalAssignedQty - totalDeliveredQty);
    const efficiencyIndex = totalAssignedQty > 0 ? Math.round((totalDeliveredQty / totalAssignedQty) * 100) : 0;

    const completedOrdersCount = assignedOrders.filter((o) => o.executionStatus === 'concluido').length;
    const totalOrdersCount = assignedOrders.length;

    // 5S Metrics for this specific operator (Limpeza, Organização, Disciplina)
    const ordersWith5S = assignedOrders.filter((o) => o.cleanlinessScore || o.organizationScore || o.disciplineScore);
    const count5S = ordersWith5S.length;

    const cleanlinessAvg = count5S > 0 ? ordersWith5S.reduce((acc, o) => acc + (o.cleanlinessScore || 5), 0) / count5S : 5;
    const organizationAvg = count5S > 0 ? ordersWith5S.reduce((acc, o) => acc + (o.organizationScore || 5), 0) / count5S : 5;
    const disciplineAvg = count5S > 0 ? ordersWith5S.reduce((acc, o) => acc + (o.disciplineScore || 5), 0) / count5S : 5;

    const cleanlinessPct = (cleanlinessAvg / 5) * 100;
    const organizationPct = (organizationAvg / 5) * 100;
    const disciplinePct = (disciplineAvg / 5) * 100;
    const fiveSPct = (cleanlinessPct + organizationPct + disciplinePct) / 3;

    // Composite Weighted Ranking Index: 80% Productivity + 20% 5S (Limpeza, Organização, Disciplina)
    const compositeScore = Number(((efficiencyIndex * 0.80) + (fiveSPct * 0.20)).toFixed(1));

    return {
      assignedOrders,
      totalAssignedQty,
      totalDeliveredQty,
      pendingQty,
      efficiencyIndex, // pure productivity %
      cleanlinessAvg,
      organizationAvg,
      disciplineAvg,
      fiveSPct, // 5S average %
      compositeScore, // 80% Prod + 20% 5S
      completedOrdersCount,
      totalOrdersCount,
    };
  };

  // Unassigned orders
  const unassignedOrders = orders.filter((o) => !o.assignedOperatorId);
  const unassignedQty = unassignedOrders.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const unassignedDeliveredQty = unassignedOrders.reduce((acc, curr) => acc + getDeliveredQuantity(curr), 0);

  // Overall Factory Totals
  const totalFactoryAssignedQty = orders.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalFactoryDeliveredQty = orders.reduce((acc, curr) => acc + getDeliveredQuantity(curr), 0);
  const overallEfficiency = totalFactoryAssignedQty > 0 ? Math.round((totalFactoryDeliveredQty / totalFactoryAssignedQty) * 100) : 0;

  // 5S Metrics calculation (Limpeza, Organização, Disciplina)
  const ordersWith5S = orders.filter((o) => o.cleanlinessScore || o.organizationScore || o.disciplineScore);
  const total5SCount = ordersWith5S.length;

  const avgCleanliness = total5SCount > 0
    ? ordersWith5S.reduce((acc, o) => acc + (o.cleanlinessScore || 5), 0) / total5SCount
    : 5.0;

  const avgOrganization = total5SCount > 0
    ? ordersWith5S.reduce((acc, o) => acc + (o.organizationScore || 5), 0) / total5SCount
    : 5.0;

  const avgDiscipline = total5SCount > 0
    ? ordersWith5S.reduce((acc, o) => acc + (o.disciplineScore || 5), 0) / total5SCount
    : 5.0;

  const overall5SScore = ((avgCleanliness + avgOrganization + avgDiscipline) / 3).toFixed(1);

  // Filter operators
  const filteredOperators = operators.filter((op) => {
    const metrics = getOperatorMetrics(op.id);

    // Search filter
    if (searchTerm) {
      const matchName = op.name.toLowerCase().includes(searchTerm);
      const matchRole = op.role.toLowerCase().includes(searchTerm);
      const matchCode = op.code.toLowerCase().includes(searchTerm);
      const matchSpecialty = op.specialty.toLowerCase().includes(searchTerm);
      if (!matchName && !matchRole && !matchCode && !matchSpecialty) return false;
    }

    // Shift filter
    if (filterShift !== 'todos') {
      if (filterShift === '1' && !op.shift?.includes('1º')) return false;
      if (filterShift === '2' && !op.shift?.includes('2º')) return false;
    }

    // Performance filter
    if (filterPerformance === 'alta' && metrics.efficiencyIndex < 90) return false;
    if (filterPerformance === 'meta' && (metrics.efficiencyIndex < 70 || metrics.efficiencyIndex >= 90)) return false;
    if (filterPerformance === 'atencao' && (metrics.efficiencyIndex >= 70 && metrics.totalAssignedQty > 0)) return false;

    return true;
  });

  // Find Top Performer based on Composite Score (80% Prod + 20% 5S)
  const topPerformer = operators.reduce<{ op: AssemblyOperator; delivered: number; efficiency: number; composite: number } | null>((acc, op) => {
    const m = getOperatorMetrics(op.id);
    if (m.totalAssignedQty > 0) {
      if (!acc || m.compositeScore > acc.composite) {
        return { op, delivered: m.totalDeliveredQty, efficiency: m.efficiencyIndex, composite: m.compositeScore };
      }
    }
    return acc;
  }, null);

  // Ranked operators list using composite score (80% Produtividade + 20% 5S)
  const rankedOperators = [...operators]
    .map((op) => ({
      op,
      metrics: getOperatorMetrics(op.id),
    }))
    .sort((a, b) => {
      if (rankingSortBy === 'efficiency') {
        if (b.metrics.compositeScore !== a.metrics.compositeScore) {
          return b.metrics.compositeScore - a.metrics.compositeScore;
        }
        if (b.metrics.efficiencyIndex !== a.metrics.efficiencyIndex) {
          return b.metrics.efficiencyIndex - a.metrics.efficiencyIndex;
        }
        return b.metrics.totalDeliveredQty - a.metrics.totalDeliveredQty;
      } else {
        if (b.metrics.totalDeliveredQty !== a.metrics.totalDeliveredQty) {
          return b.metrics.totalDeliveredQty - a.metrics.totalDeliveredQty;
        }
        return b.metrics.compositeScore - a.metrics.compositeScore;
      }
    });

  const podium1 = rankedOperators[0];
  const podium2 = rankedOperators[1];
  const podium3 = rankedOperators[2];

  // Quick reassign handler
  const handleAssignOrderToOperator = (orderId: string, operatorId: string) => {
    const targetOp = operators.find((o) => o.id === operatorId);
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            assignedOperatorId: targetOp ? targetOp.id : undefined,
            assignedOperatorName: targetOp ? targetOp.name : undefined,
            assignedOperatorCode: targetOp ? targetOp.code : undefined,
          };
        }
        return ord;
      })
    );

    setAssignmentToast(`Pedido atribuído com sucesso para ${targetOp ? targetOp.name : 'Nenhum Montador'}`);
    setTimeout(() => setAssignmentToast(null), 3000);
  };

  // Structured rows formatted for the Excel Dashboard layout matching user's screenshot
  const operatorExcelRows = operators.map((op) => {
    const m = getOperatorMetrics(op.id);
    return {
      id: op.id,
      name: op.name,
      code: op.code,
      assigned: m.totalAssignedQty,
      delivered: m.totalDeliveredQty,
      previstoDia: (m.totalAssignedQty / 1).toFixed(2).replace('.', ','),
      efetivoDia: (m.totalDeliveredQty / 1).toFixed(2).replace('.', ','),
      efficiency: m.efficiencyIndex,
    };
  });

  // Helper to construct full HTML document for mural sheet
  const getMuralHTML = () => {
    const elem = document.getElementById('mural-printable-sheet');
    const content = elem ? elem.innerHTML : '';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Boletim Oficial de Produtividade - Trindade Esquadrias</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
  <style>
    @page { size: A4 portrait; margin: 5mm; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #000000; padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-grid-2col { display: grid !important; grid-template-columns: 5fr 7fr !important; gap: 12px !important; }
    .print-podium-3col { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
    .print-page-break { page-break-before: always !important; break-before: page !important; margin-top: 12px !important; }
    .no-print { display: none !important; }
  </style>
</head>
<body>
  <div style="max-width: 1050px; margin: 0 auto;">
    ${content}
  </div>
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
  };

  // Open mural print document in a new standalone tab (bypassing iframe sandbox restrictions)
  const openPrintInNewTab = () => {
    setShowMuralPrintModal(true);
    setTimeout(() => {
      const htmlContent = getMuralHTML();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 150);
  };

  // Trigger print via hidden iframe or window.print
  const triggerPrintMural = () => {
    setShowMuralPrintModal(true);
    setTimeout(() => {
      try {
        const elem = document.getElementById('mural-printable-sheet');
        if (!elem) {
          window.print();
          return;
        }

        let printIframe = document.getElementById('trindade-mural-hidden-iframe') as HTMLIFrameElement;
        if (printIframe && printIframe.parentNode) {
          printIframe.parentNode.removeChild(printIframe);
        }

        printIframe = document.createElement('iframe');
        printIframe.id = 'trindade-mural-hidden-iframe';
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
          iframeDoc.write(getMuralHTML());
          iframeDoc.close();

          setTimeout(() => {
            try {
              printIframe.contentWindow?.focus();
              printIframe.contentWindow?.print();
            } catch {
              window.print();
            }
          }, 350);
        } else {
          window.print();
        }
      } catch {
        window.print();
      }
    }, 150);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 sm:space-y-8 pb-32 animate-fadeIn">
      
      {/* Toast Notification */}
      {assignmentToast && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-emerald-500 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-sm font-semibold">{assignmentToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
            <span className="material-symbols-outlined text-base">analytics</span>
            <span>Painel de Estatísticas da Fábrica • TRINDADE ESQUADRIAS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Produtividade dos Montadores</h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Painel de gestão de desempenho individual, metas atingidas, velocímetro de performance geral e gráficos da produção.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto shrink-0 flex-wrap">
          <button
            onClick={triggerPrintMural}
            className="px-4 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">print</span>
            <span>Imprimir para Mural</span>
          </button>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-2xl text-right">
            <span className="block text-[11px] font-bold text-slate-300 uppercase">Total Entregue</span>
            <span className="text-2xl font-black text-emerald-300">{totalFactoryDeliveredQty.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-300">peças</span></span>
          </div>
        </div>
      </div>

      {/* Excel Sub-Nav Tabs Switcher */}
      <div className="flex items-center gap-2 border-b-2 border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveDashTab('dash')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            activeDashTab === 'dash'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-base">dashboard</span>
          <span>DASH • Performance Geral</span>
        </button>

        <button
          onClick={() => setActiveDashTab('reasons')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            activeDashTab === 'reasons'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-base">pie_chart</span>
          <span>DASH Motivos Perda Produção</span>
        </button>

        <button
          onClick={() => setActiveDashTab('ranking')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            activeDashTab === 'ranking'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
          }`}
        >
          <span className="material-symbols-outlined text-base">emoji_events</span>
          <span>Ranking & Mural de Impressão</span>
        </button>
      </div>

      {/* TAB 1: EXCEL DASHBOARD VIEW (MATCHING USER SCREENSHOT) */}
      {activeDashTab === 'dash' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Sub Header Strip */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xl shadow-xs">
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-lg text-white uppercase tracking-tight">PRODUTIVIDADE - FÁBRICA</h2>
                  <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase rounded-full">
                    julho-26
                  </span>
                </div>
                <p className="text-xs text-slate-300">Layout fiel ao modelo da planilha oficial de produção</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">PERFORMANCE GERAL</span>
                <span className="text-xl font-black text-emerald-400">{overallEfficiency.toFixed(2).replace('.', ',')}%</span>
              </div>

              <button
                onClick={triggerPrintMural}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs uppercase flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Gerar p/ Mural</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN (5 cols): Table + Individual Performance Bar Chart */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
              
              {/* 1. Header & Table: PERFORMANCE INDIVIDUAL */}
              <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-md overflow-hidden">
                <div className="bg-[#0b2545] text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                  <h3 className="font-black text-xs uppercase tracking-wider text-white">
                    PERFORMANCE INDIVIDUAL
                  </h3>
                  <span className="text-[10px] font-bold text-slate-300">TRINDADE</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0b2545] text-white font-black uppercase text-[10px] border-t border-slate-700">
                        <th className="py-2 px-3 border-r border-slate-700">MONTADOR</th>
                        <th className="py-2 px-3 text-right border-r border-slate-700">PREVISTO P/ DIA</th>
                        <th className="py-2 px-3 text-right border-r border-slate-700">EFETIVO P/ DIA</th>
                        <th className="py-2 px-3 text-center">% PROD.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-bold text-slate-900">
                      {operatorExcelRows.map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        return (
                          <tr key={row.id} className={isEven ? 'bg-white' : 'bg-slate-50'}>
                            <td className="py-2 px-3 border-r border-slate-200 uppercase font-black text-slate-950">
                              {row.name.split(' ')[0]}
                            </td>
                            <td className="py-2 px-3 text-right font-mono border-r border-slate-200 text-slate-700">
                              {row.previstoDia}
                            </td>
                            <td className="py-2 px-3 text-right font-mono border-r border-slate-200 text-slate-900">
                              {row.efetivoDia}
                            </td>
                            <td className="py-2 px-3 text-center font-black">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${
                                row.efficiency >= 85 ? 'bg-emerald-100 text-emerald-900' : row.efficiency >= 60 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                              }`}>
                                {row.efficiency}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Chart: PERFORMANCE INDIVIDUAL (% Column Chart) */}
              <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-md p-4 flex flex-col space-y-3">
                <div className="bg-[#0b2545] text-white -mx-4 -mt-4 px-4 py-2 rounded-t-xl font-black text-xs uppercase tracking-wider text-center">
                  PERFORMANCE INDIVIDUAL (%)
                </div>

                <ExcelBarChartEfficiency
                  data={operatorExcelRows.map((r) => ({ name: r.name, pct: r.efficiency }))}
                />
              </div>

            </div>

            {/* RIGHT COLUMN (7 cols): Speedometer Panel + Produced Pieces Bar Chart */}
            <div className="lg:col-span-7 space-y-6 flex flex-col justify-between">
              
              {/* 1. Middle Panel: PERFORMANCE GERAL (Gauge Meter & Totals) */}
              <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-md overflow-hidden p-5 space-y-4">
                <div className="bg-[#0b2545] text-white -mx-5 -mt-5 px-5 py-2.5 font-black text-xs uppercase tracking-wider text-center border-b border-slate-800">
                  PERFORMANCE GERAL
                </div>

                <div className="flex flex-col md:flex-row items-center justify-around gap-6 pt-2">
                  {/* Speedometer Gauge Chart */}
                  <div className="flex-1 flex justify-center">
                    <SpeedometerGauge percentage={overallEfficiency} />
                  </div>

                  {/* Speedometer Legend */}
                  <div className="space-y-1.5 text-xs font-bold border-l-0 md:border-l border-slate-200 pl-0 md:pl-6 shrink-0">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs" />
                      <span>EXCELENTE (90-100%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-lime-700">
                      <span className="w-3 h-3 rounded-full bg-lime-500 shadow-xs" />
                      <span>BOM (80-89%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-yellow-700">
                      <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-xs" />
                      <span>REGULAR (65-79%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-orange-700">
                      <span className="w-3 h-3 rounded-full bg-orange-500 shadow-xs" />
                      <span>RUIM (50-64%)</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-700">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shadow-xs" />
                      <span>PÉSSIMO (&lt;50%)</span>
                    </div>
                  </div>
                </div>

                {/* Quantities Footer */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                  <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-black text-slate-500 block">QUANT. PREVISTA</span>
                    <span className="text-2xl font-black text-slate-900">{totalFactoryAssignedQty.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl text-center">
                    <span className="text-[10px] uppercase font-black text-slate-500 block">QUANT. PRODUZIDO</span>
                    <span className="text-2xl font-black text-sky-700">{totalFactoryDeliveredQty.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {/* 5S OPERATIONAL METRICS PANEL */}
              <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-md p-5 space-y-4">
                <div className="bg-[#0b2545] text-white -mx-5 -mt-5 px-5 py-2.5 font-black text-xs uppercase tracking-wider text-center border-b border-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-sm">fact_check</span>
                    MÉTRICAS OPERACIONAIS 5S (LIMPEZA, ORGANIZAÇÃO E DISCIPLINA)
                  </span>
                  <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-black">
                    Média: {overall5SScore} / 5.0
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Limpeza Bar */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-cyan-600">cleaning_services</span>
                        Limpeza
                      </span>
                      <span className="text-slate-900 font-black">{avgCleanliness.toFixed(1)} / 5</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(avgCleanliness / 5) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 text-right">
                      {Math.round((avgCleanliness / 5) * 100)}% de conformidade
                    </div>
                  </div>

                  {/* Organização Bar */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-indigo-600">inventory_2</span>
                        Organização
                      </span>
                      <span className="text-slate-900 font-black">{avgOrganization.toFixed(1)} / 5</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(avgOrganization / 5) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 text-right">
                      {Math.round((avgOrganization / 5) * 100)}% de conformidade
                    </div>
                  </div>

                  {/* Disciplina Bar */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                        Disciplina
                      </span>
                      <span className="text-slate-900 font-black">{avgDiscipline.toFixed(1)} / 5</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(avgDiscipline / 5) * 100}%` }}
                      />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 text-right">
                      {Math.round((avgDiscipline / 5) * 100)}% de conformidade
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Large Chart: PEÇAS PRODUZIDAS */}
              <div className="bg-white rounded-2xl border-2 border-slate-800 shadow-md p-5 flex flex-col space-y-4 flex-1">
                <div className="bg-[#0b2545] text-white -mx-5 -mt-5 px-5 py-2.5 font-black text-xs uppercase tracking-wider text-center border-b border-slate-800">
                  PEÇAS PRODUZIDAS
                </div>

                <ExcelBarChartQuantity
                  data={operatorExcelRows.map((r) => ({ name: r.name, qty: r.delivered }))}
                />
              </div>

            </div>

          </div>
        </div>
      )}

      {/* TAB 2 & 3 CONTAINER */}
      {activeDashTab === 'ranking' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Total Peças Produzidas */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Peças Entregues</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">precision_manufacturing</span>
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900">
                  {totalFactoryDeliveredQty.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-slate-500 ml-1.5">peças / pares</span>
                </div>
                <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  <span>{overallEfficiency}% de conclusão geral da fábrica</span>
                </p>
              </div>
            </div>

            {/* Card 2: Total Peças Atribuídas */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Peças Atribuídas</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">assignment</span>
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900">
                  {totalFactoryAssignedQty.toLocaleString('pt-BR')}
                  <span className="text-xs font-normal text-slate-500 ml-1.5">peças planejadas</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Em {orders.length} pedidos / ordens na produção
                </p>
              </div>
            </div>

            {/* Card 3: Taxa de Eficiência */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Índice Geral de Eficiência</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                  overallEfficiency >= 85 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  <span className="material-symbols-outlined text-xl">speed</span>
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900">
                  {overallEfficiency}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      overallEfficiency >= 85 ? 'bg-emerald-500' : overallEfficiency >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, overallEfficiency)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Top Destaque */}
            <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-5 rounded-2xl border border-emerald-800 shadow-sm flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Montador Destaque</span>
                <span className="material-symbols-outlined text-amber-400 text-2xl">emoji_events</span>
              </div>
              {topPerformer ? (
                <div>
                  <p className="font-bold text-base text-white truncate">{topPerformer.op.name}</p>
                  <div className="flex items-center gap-2 text-xs text-emerald-200 mt-1">
                    <span>{topPerformer.delivered} peças entregues</span>
                    <span>•</span>
                    <span className="font-bold text-emerald-300">{topPerformer.efficiency}% meta</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-300">Nenhum montador com entregas registradas ainda.</p>
              )}
            </div>

          </div>

          {/* SECTION: RANKING DOS MONTADORES */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-8">
        
        {/* Ranking Header & Sort Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-900 font-black flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-2xl">emoji_events</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">Ranking dos Montadores</h2>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black uppercase rounded-full tracking-wide">
                  Classificação Oficial
                </span>
              </div>
              <p className="text-xs text-slate-500">Pódio de liderança e tabela de colocação por desempenho e entregas</p>
            </div>
          </div>

          {/* Sort selector & Print Button */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              onClick={triggerPrintMural}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Gerar p/ Mural</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setRankingSortBy('efficiency')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rankingSortBy === 'efficiency'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                % Eficiência
              </button>
              <button
                onClick={() => setRankingSortBy('delivered')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  rankingSortBy === 'delivered'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Peças Entregues
              </button>
            </div>
          </div>
        </div>

        {/* Podium Top 3 Cards */}
        {rankedOperators.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-end pt-2">
            
            {/* 2º LUGAR (Prata) - Shown left on desktop */}
            {podium2 ? (
              <div className="order-2 md:order-1 bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-200/50 rounded-3xl p-6 border-2 border-slate-300/80 shadow-sm flex flex-col items-center text-center space-y-3 relative hover:shadow-md transition-all">
                <span className="absolute -top-3 px-3 py-1 bg-slate-200 text-slate-800 text-[10px] font-black uppercase rounded-full border border-slate-300 shadow-2xs tracking-wider flex items-center gap-1">
                  <span>🥈</span> 2º LUGAR • PRATA
                </span>
                
                <div className="w-16 h-16 rounded-2xl bg-slate-300 text-slate-800 font-black text-2xl flex items-center justify-center shadow-inner mt-2">
                  {podium2.op.name.charAt(0)}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-base">{podium2.op.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">{podium2.op.code} • {podium2.op.role}</p>
                </div>

                <div className="w-full bg-white/80 rounded-2xl p-3 border border-slate-200/60 space-y-1">
                  <div className="text-2xl font-black text-slate-800 flex items-center justify-center gap-1">
                    <span>{podium2.metrics.compositeScore}%</span>
                  </div>
                  <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                    Prod: {podium2.metrics.efficiencyIndex}% (80%) • 5S: {Math.round(podium2.metrics.fiveSPct)}% (20%)
                  </div>
                  <div className="text-xs font-semibold text-slate-600 pt-0.5">
                    {podium2.metrics.totalDeliveredQty} / {podium2.metrics.totalAssignedQty} pcs entregues
                  </div>
                </div>
              </div>
            ) : <div className="order-2 md:order-1" />}

            {/* 1º LUGAR (Ouro) - Center Prominent */}
            {podium1 && (
              <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/10 via-amber-100/60 to-amber-200/40 rounded-3xl p-6 border-2 border-amber-400 shadow-lg flex flex-col items-center text-center space-y-3 relative scale-102 hover:scale-104 transition-all">
                <span className="absolute -top-3.5 px-4 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-xs font-black uppercase rounded-full border border-amber-300 shadow-md tracking-wider flex items-center gap-1.5">
                  <span>👑</span> 1º LUGAR • CAMPEÃO
                </span>

                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black text-3xl flex items-center justify-center shadow-md mt-2 ring-4 ring-amber-300/50">
                  {podium1.op.name.charAt(0)}
                </div>

                <div>
                  <h4 className="font-black text-slate-900 text-lg">{podium1.op.name}</h4>
                  <p className="text-xs font-bold text-amber-800 font-mono">{podium1.op.code} • {podium1.op.role}</p>
                </div>

                <div className="w-full bg-white rounded-2xl p-4 border border-amber-300/80 shadow-xs space-y-1">
                  <div className="text-3xl font-black text-emerald-600">
                    {podium1.metrics.compositeScore}%
                  </div>
                  <div className="text-[10px] font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-full inline-block">
                    Prod: {podium1.metrics.efficiencyIndex}% (80%) • 5S: {Math.round(podium1.metrics.fiveSPct)}% (20%)
                  </div>
                  <div className="text-xs font-bold text-slate-700 pt-0.5">
                    {podium1.metrics.totalDeliveredQty} / {podium1.metrics.totalAssignedQty} peças entregues
                  </div>
                </div>
              </div>
            )}

            {/* 3º LUGAR (Bronze) - Right desktop */}
            {podium3 ? (
              <div className="order-3 bg-gradient-to-b from-amber-900/5 via-amber-800/10 to-amber-900/20 rounded-3xl p-6 border-2 border-amber-800/30 shadow-sm flex flex-col items-center text-center space-y-3 relative hover:shadow-md transition-all">
                <span className="absolute -top-3 px-3 py-1 bg-amber-900/20 text-amber-950 text-[10px] font-black uppercase rounded-full border border-amber-800/40 shadow-2xs tracking-wider flex items-center gap-1">
                  <span>🥉</span> 3º LUGAR • BRONZE
                </span>

                <div className="w-16 h-16 rounded-2xl bg-amber-800/20 text-amber-950 font-black text-2xl flex items-center justify-center shadow-inner mt-2">
                  {podium3.op.name.charAt(0)}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-base">{podium3.op.name}</h4>
                  <p className="text-xs text-slate-500 font-mono">{podium3.op.code} • {podium3.op.role}</p>
                </div>

                <div className="w-full bg-white/80 rounded-2xl p-3 border border-amber-800/20 space-y-1">
                  <div className="text-2xl font-black text-slate-800">
                    {podium3.metrics.compositeScore}%
                  </div>
                  <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full inline-block">
                    Prod: {podium3.metrics.efficiencyIndex}% (80%) • 5S: {Math.round(podium3.metrics.fiveSPct)}% (20%)
                  </div>
                  <div className="text-xs font-semibold text-slate-600 pt-0.5">
                    {podium3.metrics.totalDeliveredQty} / {podium3.metrics.totalAssignedQty} pcs entregues
                  </div>
                </div>
              </div>
            ) : <div className="order-3" />}

          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider text-slate-500">
              Tabela Completa de Posicionamento ({rankedOperators.length} Montadores)
            </h3>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              Ponderação: 80% Produtividade + 20% (Limpeza + Organização + Disciplina)
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-16 text-center">Posição</th>
                  <th className="py-3 px-4">Montador</th>
                  <th className="py-3 px-4">Turno</th>
                  <th className="py-3 px-4 text-right">Atribuído / Entregue</th>
                  <th className="py-3 px-4 text-center">Produtividade (80%)</th>
                  <th className="py-3 px-4 text-center">5S: L, O, D (20%)</th>
                  <th className="py-3 px-4 text-center bg-blue-50/50 text-blue-900">Nota Ranking</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {rankedOperators.map(({ op, metrics }, index) => {
                  const rank = index + 1;
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;

                  return (
                    <tr
                      key={op.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isGold ? 'bg-amber-50/40' : isSilver ? 'bg-slate-50/30' : isBronze ? 'bg-amber-900/5' : ''
                      }`}
                    >
                      {/* Rank Position */}
                      <td className="py-3.5 px-4 text-center font-black">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-1 rounded-xl font-black text-xs min-w-[36px] ${
                            isGold
                              ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-300'
                              : isSilver
                              ? 'bg-slate-300 text-slate-900'
                              : isBronze
                              ? 'bg-amber-800 text-amber-50'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isGold ? '🥇 1º' : isSilver ? '🥈 2º' : isBronze ? '🥉 3º' : `#${rank}`}
                        </span>
                      </td>

                      {/* Operator Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center shrink-0">
                            {op.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{op.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Shift */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {op.shift}
                      </td>

                      {/* Quantities */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-emerald-700">{metrics.totalDeliveredQty}</span>
                        <span className="text-slate-400"> / {metrics.totalAssignedQty} pcs</span>
                      </td>

                      {/* Productivity (80%) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                metrics.efficiencyIndex >= 90
                                  ? 'bg-emerald-500'
                                  : metrics.efficiencyIndex >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, metrics.efficiencyIndex)}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-800 text-xs">
                            {metrics.efficiencyIndex}%
                          </span>
                        </div>
                      </td>

                      {/* 5S Evaluation (20%) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                            {Math.round(metrics.fiveSPct)}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            L: {metrics.cleanlinessAvg.toFixed(1)} | O: {metrics.organizationAvg.toFixed(1)} | D: {metrics.disciplineAvg.toFixed(1)}
                          </span>
                        </div>
                      </td>

                      {/* Composite Ranking Score */}
                      <td className="py-3.5 px-4 text-center bg-blue-50/30">
                        <span className="font-black text-sm text-blue-950 bg-blue-100/80 px-2.5 py-1 rounded-xl border border-blue-200 inline-block shadow-2xs">
                          {metrics.compositeScore}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            metrics.compositeScore >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : metrics.compositeScore >= 70
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {metrics.compositeScore >= 90 ? 'Alta Eficiência' : metrics.compositeScore >= 70 ? 'Em Meta' : 'Atenção'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedOperatorForModal(op)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Ver Pedidos
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Visual Chart Comparison Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">bar_chart</span>
              <span>Comparativo de Desempenho: Atribuído vs. Entregue</span>
            </h3>
            <p className="text-xs text-slate-500">Comparação gráfica do volume de peças de cada montador</p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" />
              <span className="text-slate-600">Peças Atribuídas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-slate-900 font-bold">Peças Entregues</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {operators.map((op) => {
            const m = getOperatorMetrics(op.id);
            const maxVal = Math.max(...operators.map((o) => getOperatorMetrics(o.id).totalAssignedQty), 1);
            const assignedBarWidth = Math.round((m.totalAssignedQty / maxVal) * 100);
            const deliveredBarWidth = Math.round((m.totalDeliveredQty / maxVal) * 100);

            return (
              <div key={op.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{op.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({op.code})</span>
                  </div>
                  <div className="text-right font-medium">
                    <span className="text-emerald-700 font-bold">{m.totalDeliveredQty}</span>
                    <span className="text-slate-400"> / {m.totalAssignedQty} pcs</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.efficiencyIndex >= 90
                        ? 'bg-emerald-100 text-emerald-800'
                        : m.efficiencyIndex >= 70
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {m.efficiencyIndex}%
                    </span>
                  </div>
                </div>

                {/* Double Bar Graphic */}
                <div className="space-y-1">
                  {/* Assigned Bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className="bg-slate-300 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(3, assignedBarWidth)}%` }}
                    />
                  </div>

                  {/* Delivered Bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.efficiencyIndex >= 90 ? 'bg-emerald-500' : m.efficiencyIndex >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.max(0, deliveredBarWidth)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      )}

      {/* SECTION: GRÁFICO DE DÉFICIT DE PRODUÇÃO POR MOTIVOS */}
      {activeDashTab === 'reasons' && (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fadeIn">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 font-black flex items-center justify-center border border-rose-200 shadow-xs">
              <span className="material-symbols-outlined text-2xl">pie_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-xl">Déficit de Produção por Motivo</h3>
                {isUsingDemoDeficitData ? (
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase rounded-full">
                    Amostra de Referência
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold uppercase rounded-full">
                    Dados em Tempo Real
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Análise quantitativa de peças não produzidas ou em atraso conforme relatos da conferência</p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Perda / Déficit</span>
              <span className="text-lg font-black text-rose-600">{totalDisplayDeficitQty} <span className="text-xs font-normal text-slate-500">peças</span></span>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Motivos Mapeados</span>
              <span className="text-lg font-black text-slate-800">{displayDeficitReasons.length} <span className="text-xs font-normal text-slate-500">categorias</span></span>
            </div>
          </div>
        </div>

        {/* 100% Proportional Stacked Segment Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>Distribuição Proporcional dos Motivos (100% do Déficit)</span>
            <span className="text-slate-400 font-mono">{totalDisplayDeficitQty} peças totais</span>
          </div>

          <div className="h-5 w-full bg-slate-100 rounded-2xl overflow-hidden flex p-0.5 gap-0.5 shadow-inner">
            {displayDeficitReasons.map((item, idx) => {
              const pct = totalDisplayDeficitQty > 0 ? Math.round((item.totalDeficitQty / totalDisplayDeficitQty) * 100) : 0;
              if (pct === 0) return null;

              return (
                <div
                  key={idx}
                  title={`${item.reason}: ${item.totalDeficitQty} pcs (${pct}%)`}
                  className={`h-full ${item.colorStyle.barColor} transition-all duration-300 hover:opacity-80 cursor-pointer first:rounded-l-xl last:rounded-r-xl`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Reason Bars Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {displayDeficitReasons.map((item, idx) => {
            const pct = totalDisplayDeficitQty > 0 ? Math.round((item.totalDeficitQty / totalDisplayDeficitQty) * 100) : 0;
            const maxVal = displayDeficitReasons[0]?.totalDeficitQty || 1;
            const relativeWidth = Math.round((item.totalDeficitQty / maxVal) * 100);

            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border ${item.colorStyle.border} ${item.colorStyle.bg} flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-all`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl ${item.colorStyle.barColor} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                      <span className="material-symbols-outlined text-lg">{item.colorStyle.icon}</span>
                    </div>
                    <div>
                      <h4 className={`font-black text-xs uppercase tracking-wide ${item.colorStyle.color}`}>
                        {item.reason}
                      </h4>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {item.affectedOrdersCount > 0 ? `${item.affectedOrdersCount} ordem(ns) impactada(s)` : 'Sem ordens vinculadas'}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-white/90 rounded-full font-black text-xs shadow-2xs border border-slate-200/80 text-slate-800">
                    {pct}%
                  </span>
                </div>

                {/* Progress fill */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Quantidade Não Produzida</span>
                    <span className="font-black text-slate-900">{item.totalDeficitQty} pcs</span>
                  </div>

                  <div className="w-full bg-white/80 h-2 rounded-full overflow-hidden border border-slate-200/60">
                    <div
                      className={`h-full rounded-full ${item.colorStyle.barColor}`}
                      style={{ width: `${Math.max(5, relativeWidth)}%` }}
                    />
                  </div>
                </div>

                {/* Action button if orders are present */}
                {item.affectedOrders && item.affectedOrders.length > 0 && (
                  <button
                    onClick={() => setSelectedReasonForModal(item)}
                    className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Ver Ordens Afetadas</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

      </div>
      )}

      {/* Filters & Operator List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Índice Individual por Montador</h3>
            <p className="text-xs text-slate-500">Métricas comparativas detalhadas de produção e entregas</p>
          </div>

          {/* Controls / Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar montador..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48"
              />
            </div>

            {/* Turno Filter */}
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos os Turnos</option>
              <option value="1">1º Turno</option>
              <option value="2">2º Turno</option>
            </select>

            {/* Desempenho Filter */}
            <select
              value={filterPerformance}
              onChange={(e) => setFilterPerformance(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos os Desempenhos</option>
              <option value="alta">Alta Eficiência (≥90%)</option>
              <option value="meta">Em Meta (70%-89%)</option>
              <option value="atencao">Atenção (&lt;70%)</option>
            </select>
          </div>
        </div>

        {/* Operator Detailed Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredOperators.map((op) => {
            const metrics = getOperatorMetrics(op.id);
            const isHigh = metrics.efficiencyIndex >= 90;
            const isMid = metrics.efficiencyIndex >= 70 && metrics.efficiencyIndex < 90;

            return (
              <div
                key={op.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6"
              >
                {/* Operator Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white font-black text-lg flex items-center justify-center shadow-md shrink-0">
                      {op.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">{op.name}</h4>
                        <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          {op.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{op.role} • {op.specialty}</p>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">{op.shift}</span>
                    </div>
                  </div>

                  {/* Efficiency Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 border ${
                      isHigh
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isMid
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {isHigh ? 'Alta Eficiência' : isMid ? 'Em Meta' : 'Atenção'}
                  </span>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50/80 rounded-2xl p-4 border border-slate-100 text-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Atribuído</span>
                    <span className="text-xl font-black text-slate-800">{metrics.totalAssignedQty}</span>
                    <span className="text-[10px] text-slate-400 block">peças</span>
                  </div>

                  <div className="border-x border-slate-200 px-2">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Entregue</span>
                    <span className="text-xl font-black text-emerald-600">{metrics.totalDeliveredQty}</span>
                    <span className="text-[10px] text-emerald-700 block">peças</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pendente</span>
                    <span className="text-xl font-black text-slate-600">{metrics.pendingQty}</span>
                    <span className="text-[10px] text-slate-400 block">peças</span>
                  </div>
                </div>

                {/* Progress Bar & Weighted Scores */}
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-slate-200/80 pb-2">
                    <span className="text-slate-700">Índice Ranking Global (Ponderado)</span>
                    <span className="text-sm font-black text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {metrics.compositeScore}%
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-600">Produtividade (Peso 80%)</span>
                      <span className="text-slate-900 font-extrabold">{metrics.efficiencyIndex}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          metrics.efficiencyIndex >= 90 ? 'bg-emerald-500' : metrics.efficiencyIndex >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, metrics.efficiencyIndex)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold pt-1">
                      <span className="text-slate-600">5S: Limpeza, Organização, Disciplina (Peso 20%)</span>
                      <span className="text-indigo-900 font-extrabold">{Math.round(metrics.fiveSPct)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, metrics.fiveSPct)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between pt-0.5">
                      <span>L: {metrics.cleanlinessAvg.toFixed(1)}/5 • O: {metrics.organizationAvg.toFixed(1)}/5 • D: {metrics.disciplineAvg.toFixed(1)}/5</span>
                      <span>{metrics.completedOrdersCount} / {metrics.totalOrdersCount} ordens concluídas</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {metrics.assignedOrders.length} pedido(s) atribuídos
                  </span>

                  <button
                    onClick={() => setSelectedOperatorForModal(op)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <span>Ver Pedidos</span>
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operator Modal Detail */}
      {selectedOperatorForModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col my-8">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center">
                  {selectedOperatorForModal.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">{selectedOperatorForModal.name}</h3>
                  <p className="text-xs text-slate-300">
                    {selectedOperatorForModal.role} • {selectedOperatorForModal.code}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOperatorForModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Modal Body: List of Assigned Orders */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <h4 className="font-bold text-slate-900 text-sm">
                Lista de Pedidos Atribuídos a este Montador
              </h4>

              {(() => {
                const opOrders = orders.filter((o) => o.assignedOperatorId === selectedOperatorForModal.id);
                if (opOrders.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <span className="material-symbols-outlined text-3xl text-slate-400">inbox</span>
                      <p className="text-sm font-semibold text-slate-600">Nenhum pedido atribuído a este montador no momento.</p>
                      <p className="text-xs text-slate-400">Atribua ordens através do Painel de Planejamento.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {opOrders.map((ord) => {
                      const delivered = getDeliveredQuantity(ord);

                      return (
                        <div
                          key={ord.id}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-sm">{ord.orderId}</span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                                {ord.store}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700">{ord.itemDescription}</p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 text-right">
                            <div>
                              <span className="text-xs text-slate-500 block">Atribuído / Entregue</span>
                              <span className="font-bold text-slate-900 text-sm">
                                {delivered} / {ord.quantity} pcs
                              </span>
                            </div>

                            <div className="w-24">
                              <span className="text-[10px] font-bold text-slate-500 block text-center mb-0.5">{ord.progress || 0}%</span>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full rounded-full"
                                  style={{ width: `${ord.progress || 0}%` }}
                                />
                              </div>
                            </div>

                            {/* Option to unassign or reassign */}
                            <button
                              onClick={() => {
                                handleAssignOrderToOperator(ord.id, '');
                              }}
                              title="Remover atribuição"
                              className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                            >
                              Desatribuir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
              <button
                onClick={() => setSelectedOperatorForModal(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deficit Reason Orders Modal */}
      {selectedReasonForModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-8 animate-fadeIn">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl ${selectedReasonForModal.colorStyle.barColor} text-white font-black flex items-center justify-center shadow-md`}>
                  <span className="material-symbols-outlined text-2xl">{selectedReasonForModal.colorStyle.icon}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight uppercase">{selectedReasonForModal.reason}</h3>
                  <p className="text-xs text-slate-300">
                    {selectedReasonForModal.totalDeficitQty} peças não produzidas por este motivo
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReasonForModal(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <h4 className="font-bold text-slate-900 text-sm">
                Lista de Ordens Impactadas pelo Motivo {selectedReasonForModal.reason}
              </h4>

              {selectedReasonForModal.affectedOrders.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs">
                  Nenhum pedido individual cadastrado para esta categoria no momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedReasonForModal.affectedOrders.map((ord) => {
                    const delivered = getDeliveredQuantity(ord);
                    const deficit = Math.max(0, ord.quantity - delivered);

                    return (
                      <div key={ord.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">{ord.orderId}</span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                              {ord.store}
                            </span>
                          </div>
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold uppercase rounded-full">
                            Déficit: {deficit} pcs
                          </span>
                        </div>

                        <p className="text-xs font-medium text-slate-700">{ord.itemDescription}</p>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                          <span>Montador: <strong className="text-slate-800">{ord.assignedOperatorName || 'Não atribuído'}</strong></span>
                          <span>Entregue: <strong className="text-emerald-700">{delivered} / {ord.quantity} pcs</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
              <button
                onClick={() => setSelectedReasonForModal(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MURAL PRINTABLE REPORT MODAL */}
      {showMuralPrintModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          
          {/* Inject print styles */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 5mm;
              }

              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              /* Hide standard page elements visually */
              body * {
                visibility: hidden !important;
              }

              /* Remove backdrop blur & dark background overlay during print */
              .fixed.inset-0 {
                position: static !important;
                background: transparent !important;
                backdrop-filter: none !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
              }

              /* Reveal mural printable sheet and all descendants */
              #mural-printable-sheet,
              #mural-printable-sheet * {
                visibility: visible !important;
              }

              #mural-printable-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
                border: none !important;
                overflow: visible !important;
                z-index: 999999 !important;
              }

              /* Force side-by-side 2-column layout in print view (A4 width) */
              #mural-printable-sheet .print-grid-2col {
                display: grid !important;
                grid-template-columns: 5fr 7fr !important;
                gap: 12px !important;
              }

              #mural-printable-sheet .print-podium-3col {
                display: grid !important;
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                gap: 8px !important;
              }

              #mural-printable-sheet .print-page-break {
                page-break-before: always !important;
                break-before: page !important;
                margin-top: 12px !important;
              }

              .no-print, .no-print * {
                display: none !important;
                visibility: hidden !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-fadeIn">
            
            {/* Modal Controls Bar (Hidden during print) */}
            <div className="no-print bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-2xl">print</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Relatório de Produtividade para Mural</h3>
                  <p className="text-xs text-slate-300">Layout otimizado para impressão em folha A4 e afixação no mural da fábrica</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={openPrintInNewTab}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer uppercase tracking-wider"
                  title="Abre o documento para impressão"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>IMPRIMIR</span>
                </button>
                <button
                  onClick={() => setShowMuralPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
            </div>

            {/* PRINTABLE SHEET CONTAINER */}
            <div id="mural-printable-sheet" className="p-8 space-y-6 overflow-y-auto bg-white text-slate-900">
              
              {/* Document Header */}
              <div className="border-b-4 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800">
                    <span>BOLETIM OFICIAL DE PRODUTIVIDADE • TRINDADE ESQUADRIAS</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase tracking-tight mt-1">
                    Painel de Produtividade dos Montadores
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Acompanhamento Diário de Produção, Metas Individuais e Indicador Geral de Performance
                  </p>
                </div>

                <div className="text-left sm:text-right font-mono text-xs text-slate-700 bg-slate-100 p-3 rounded-2xl border border-slate-200 shrink-0">
                  <p><strong className="text-slate-900">EMISSÃO:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p><strong className="text-slate-900">STATUS:</strong> OFICIAL DA FÁBRICA</p>
                </div>
              </div>

              {/* SECTION 1: EXCEL DASHBOARD GRAPHICAL PANEL (Matching User Screenshot) */}
              <div className="border-2 border-slate-900 rounded-2xl p-5 bg-white space-y-6 shadow-sm">
                
                <div className="bg-[#0b2545] text-white p-3 rounded-xl flex items-center justify-between">
                  <h2 className="font-black text-sm uppercase tracking-wider">DASHBOARD DE DESEMPENHO DA PRODUÇÃO</h2>
                  <span className="text-xs font-bold text-amber-300">TRINDADE</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-grid-2col">
                  
                  {/* LEFT: Table + Individual Performance Bar Chart */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Performance Table */}
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#0b2545] text-white font-black uppercase text-[10px]">
                            <th className="py-2 px-2.5 border-r border-slate-700">MONTADOR</th>
                            <th className="py-2 px-2 text-right border-r border-slate-700">PREVISTO DIA</th>
                            <th className="py-2 px-2 text-right border-r border-slate-700">EFETIVO DIA</th>
                            <th className="py-2 px-2 text-center">% PROD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-bold text-slate-900">
                          {operatorExcelRows.map((row, idx) => (
                            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="py-1.5 px-2.5 border-r border-slate-200 uppercase font-black text-slate-950">
                                {row.name.split(' ')[0]}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200 text-slate-700">
                                {row.previstoDia}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200 text-slate-900">
                                {row.efetivoDia}
                              </td>
                              <td className="py-1.5 px-2 text-center font-black">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  row.efficiency >= 85 ? 'bg-emerald-100 text-emerald-900' : row.efficiency >= 60 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                                }`}>
                                  {row.efficiency}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Chart: PERFORMANCE INDIVIDUAL (%) */}
                    <div className="border border-slate-800 rounded-xl p-3 bg-white space-y-2">
                      <div className="bg-[#0b2545] text-white -mx-3 -mt-3 p-2 rounded-t-lg text-[11px] font-black uppercase text-center">
                        PERFORMANCE INDIVIDUAL (%)
                      </div>
                      <ExcelBarChartEfficiency
                        data={operatorExcelRows.map((r) => ({ name: r.name, pct: r.efficiency }))}
                      />
                    </div>

                  </div>

                  {/* RIGHT: Speedometer + Quantities Bar Chart */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Performance Geral Gauge Box */}
                    <div className="border border-slate-800 rounded-xl p-4 bg-white space-y-3">
                      <div className="bg-[#0b2545] text-white -mx-4 -mt-4 p-2 rounded-t-lg text-[11px] font-black uppercase text-center">
                        PERFORMANCE GERAL
                      </div>

                      <div className="flex items-center justify-around gap-4 pt-1">
                        <SpeedometerGauge percentage={overallEfficiency} />

                        <div className="space-y-1 text-[11px] font-bold border-l border-slate-200 pl-4">
                          <div className="text-emerald-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>EXCELENTE (90-100%)</span>
                          </div>
                          <div className="text-lime-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-lime-500" />
                            <span>BOM (80-89%)</span>
                          </div>
                          <div className="text-yellow-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                            <span>REGULAR (65-79%)</span>
                          </div>
                          <div className="text-orange-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                            <span>RUIM (50-64%)</span>
                          </div>
                          <div className="text-rose-700 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span>PÉSSIMO (&lt;50%)</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                        <div className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-center">
                          <span className="text-[9px] uppercase font-black text-slate-500 block">QUANT. PREVISTA</span>
                          <span className="text-lg font-black text-slate-900">{totalFactoryAssignedQty.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-300 p-2 rounded-lg text-center">
                          <span className="text-[9px] uppercase font-black text-slate-500 block">QUANT. PRODUZIDO</span>
                          <span className="text-lg font-black text-sky-700">{totalFactoryDeliveredQty.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart: PEÇAS PRODUZIDAS */}
                    <div className="border border-slate-800 rounded-xl p-4 bg-white space-y-2">
                      <div className="bg-[#0b2545] text-white -mx-4 -mt-4 p-2 rounded-t-lg text-[11px] font-black uppercase text-center">
                        PEÇAS PRODUZIDAS POR MONTADOR
                      </div>
                      <ExcelBarChartQuantity
                        data={operatorExcelRows.map((r) => ({ name: r.name, qty: r.delivered }))}
                      />
                    </div>

                  </div>

                </div>

              </div>

              {/* PAGE 2: Podium, Leaderboard, Deficit Summary and Signatures */}
              <div className="print-page-break space-y-6">
                
                {/* Podium Section */}
                {rankedOperators.length > 0 && (
                  <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50 space-y-3">
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 text-center border-b border-slate-200 pb-2">
                      🏆 PÓDIO DOS DESTAQUES DA PRODUÇÃO
                    </h3>

                    <div className="grid grid-cols-3 gap-3 pt-1 print-podium-3col">
                      {/* 2º LUGAR */}
                      <div className="bg-white border border-slate-300 p-3 rounded-xl text-center flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-600">🥈 2º LUGAR • PRATA</span>
                        <div className="py-2">
                          <strong className="text-sm font-black text-slate-900 block">{podium2?.op.name || '-'}</strong>
                          <span className="text-[10px] text-slate-500 font-mono">{podium2?.op.code}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 bg-slate-100 py-1 rounded-lg">
                          {podium2 ? `${podium2.metrics.compositeScore}% (Prod: ${podium2.metrics.efficiencyIndex}% | 5S: ${Math.round(podium2.metrics.fiveSPct)}%)` : '-'}
                        </div>
                      </div>

                      {/* 1º LUGAR */}
                      <div className="bg-amber-100 border-2 border-amber-400 p-3 rounded-xl text-center flex flex-col justify-between shadow-xs">
                        <span className="text-[10px] font-black uppercase text-amber-950">👑 1º LUGAR • CAMPEÃO</span>
                        <div className="py-2">
                          <strong className="text-base font-black text-slate-950 block">{podium1?.op.name || '-'}</strong>
                          <span className="text-[10px] text-amber-900 font-mono font-bold">{podium1?.op.code}</span>
                        </div>
                        <div className="text-xs font-black text-emerald-800 bg-white py-1 rounded-lg border border-amber-300">
                          {podium1 ? `${podium1.metrics.compositeScore}% (Prod: ${podium1.metrics.efficiencyIndex}% | 5S: ${Math.round(podium1.metrics.fiveSPct)}%)` : '-'}
                        </div>
                      </div>

                      {/* 3º LUGAR */}
                      <div className="bg-white border border-slate-300 p-3 rounded-xl text-center flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase text-amber-900">🥉 3º LUGAR • BRONZE</span>
                        <div className="py-2">
                          <strong className="text-sm font-black text-slate-900 block">{podium3?.op.name || '-'}</strong>
                          <span className="text-[10px] text-slate-500 font-mono">{podium3?.op.code}</span>
                        </div>
                        <div className="text-xs font-bold text-slate-800 bg-slate-100 py-1 rounded-lg">
                          {podium3 ? `${podium3.metrics.compositeScore}% (Prod: ${podium3.metrics.efficiencyIndex}% | 5S: ${Math.round(podium3.metrics.fiveSPct)}%)` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete Leaderboard Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">
                      CLASSIFICAÇÃO GERAL DOS MONTADORES
                    </h3>
                    <span className="text-[10px] font-bold text-slate-600">
                      Critério: 80% Produtividade + 20% 5S (Limpeza, Organização, Disciplina)
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse border border-slate-400 text-xs">
                    <thead>
                      <tr className="bg-slate-200 text-slate-900 font-black uppercase border-b border-slate-400 text-[10px]">
                        <th className="py-2 px-3 text-center border-r border-slate-300 w-12">Pos.</th>
                        <th className="py-2 px-3 border-r border-slate-300">Montador / Código</th>
                        <th className="py-2 px-3 border-r border-slate-300 text-center">Turno</th>
                        <th className="py-2 px-3 border-r border-slate-300 text-right">Atribuído / Entregue</th>
                        <th className="py-2 px-3 border-r border-slate-300 text-center">Prod. (80%)</th>
                        <th className="py-2 px-3 border-r border-slate-300 text-center">5S (20%)</th>
                        <th className="py-2 px-3 border-r border-slate-300 text-center bg-slate-300">Ranking Final</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 font-medium text-slate-900">
                      {rankedOperators.map(({ op, metrics }, index) => {
                        const rank = index + 1;
                        const isGold = rank === 1;
                        const isSilver = rank === 2;
                        const isBronze = rank === 3;

                        return (
                          <tr key={op.id} className={rank % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="py-2 px-3 text-center font-black border-r border-slate-300">
                              {isGold ? '1º 🥇' : isSilver ? '2º 🥈' : isBronze ? '3º 🥉' : `#${rank}`}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-300">
                              <strong className="text-slate-950 font-bold">{op.name}</strong>
                            </td>
                            <td className="py-2 px-3 text-center border-r border-slate-300">{op.shift}</td>
                            <td className="py-2 px-3 text-right font-mono border-r border-slate-300">{metrics.totalDeliveredQty} / {metrics.totalAssignedQty} pcs</td>
                            <td className="py-2 px-3 text-center font-bold border-r border-slate-300">
                              {metrics.efficiencyIndex}%
                            </td>
                            <td className="py-2 px-3 text-center font-bold border-r border-slate-300">
                              {Math.round(metrics.fiveSPct)}%
                            </td>
                            <td className="py-2 px-3 text-center font-black border-r border-slate-300 bg-slate-100">
                              {metrics.compositeScore}%
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-[10px]">
                              {metrics.compositeScore >= 90 ? 'EXCELENTE' : metrics.compositeScore >= 70 ? 'EM META' : 'ATENÇÃO'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary of Deficit Reasons for Factory Notice */}
                {displayDeficitReasons.length > 0 && (
                  <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50 space-y-2">
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">
                      RESUMO DE MOTIVOS DE DEFICIT DE PRODUÇÃO (OBSERVAÇÃO DA CONFERÊNCIA)
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {displayDeficitReasons.map((item, idx) => {
                        const pct = totalDisplayDeficitQty > 0 ? Math.round((item.totalDeficitQty / totalDisplayDeficitQty) * 100) : 0;
                        return (
                          <div key={idx} className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[11px] truncate">{item.reason}</span>
                            <span className="font-mono font-black text-slate-900 shrink-0 ml-1">{item.totalDeficitQty} pcs ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Signature and Manager Notes Footer */}
                <div className="pt-6 border-t border-slate-400 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs font-medium text-slate-700">
                  <div className="space-y-8">
                    <div>
                      <span className="font-bold text-slate-900 uppercase block mb-1">Anotações da Supervisão da Produção:</span>
                      <div className="h-16 border border-slate-300 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-500 italic">
                        [Espaço reservado para avisos, metas da próxima semana e felicitações da gerência]
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end space-y-6 text-center">
                    <div className="border-t border-slate-800 pt-2 w-3/4 mx-auto">
                      <strong className="block text-slate-950 font-black uppercase">Visto do Supervisor de Produção</strong>
                      <span className="text-[10px] text-slate-500">Controle de Qualidade & Produtividade</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Bottom Actions (Hidden during print) */}
            <div className="no-print bg-slate-100 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Pressione <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-[10px] font-mono">Ctrl+P</kbd> para abrir o diálogo de impressão do navegador.
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMuralPrintModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={openPrintInNewTab}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer uppercase tracking-wider"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>IMPRIMIR</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
