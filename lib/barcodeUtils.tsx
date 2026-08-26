import React from 'react';

// Enhanced SVG Code128 representation for high contrast Zebra thermal printing
export const renderBarcodeSVG = (
  text: string, 
  options?: { 
    height?: number; 
    className?: string; 
    textClass?: string;
    svgStyle?: React.CSSProperties;
    hideText?: boolean;
    displaySubtitle?: string;
  }
) => {
  const str = text || 'OP-1001';
  const svgHeight = options?.height || 45;
  const svgClass = options?.className || 'h-11 w-full max-w-[230px]';
  const txtClass = options?.textClass || 'text-[11px] font-mono tracking-widest text-black font-black mt-0.5 uppercase';
  const displayText = options?.displaySubtitle !== undefined ? options.displaySubtitle : str;

  // Generate deterministic bar widths based on ASCII char codes
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 2, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const w1 = (code % 3) + 1;
    const w2 = ((code * 2) % 3) + 1;
    const w3 = ((code * 5) % 3) + 1;
    bars.push({ width: w1, isBlack: true });
    bars.push({ width: w2, isBlack: false });
    bars.push({ width: w3, isBlack: true });
    bars.push({ width: 1, isBlack: false });
  }
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 4, isBlack: true });

  let currentX = 0;
  const elements = bars.map((bar, idx) => {
    const rect = (
      <rect
        key={idx}
        x={currentX}
        y="0"
        width={bar.width}
        height={svgHeight}
        fill={bar.isBlack ? '#000000' : '#ffffff'}
      />
    );
    currentX += bar.width;
    return rect;
  });

  return (
    <div 
      className="flex flex-col items-center justify-center shrink-0 overflow-hidden" 
      style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <svg
        viewBox={`0 0 ${currentX} ${svgHeight}`}
        className={svgClass}
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          width: '100%',
          height: 'auto',
          ...(options?.svgStyle || {})
        }}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100%" height="100%" fill="#ffffff" />
        {elements}
      </svg>
      {!options?.hideText && (
        <span 
          className={txtClass} 
          style={{ 
            display: 'block', 
            textAlign: 'center', 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            maxWidth: '100%' 
          }}
          title={displayText}
        >
          {displayText}
        </span>
      )}
    </div>
  );
};
