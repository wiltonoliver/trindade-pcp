import React from 'react';

interface TrindadeLogoProps {
  className?: string;
  variant?: 'dark-bg' | 'light-bg';
}

export const TrindadeLogo: React.FC<TrindadeLogoProps> = ({
  className = '',
  variant = 'dark-bg',
}) => {
  const isDark = variant === 'dark-bg';

  return (
    <div
      className={`flex items-center gap-3 ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}
    >
      {/* Trindade 4-square esquadrias icon */}
      <div
        className="bg-white p-1.5 rounded-xl shadow-md border border-slate-100 shrink-0 flex items-center justify-center"
        style={{
          backgroundColor: '#ffffff',
          padding: '4px 6px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          className="w-8 h-8"
          style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', display: 'block' }}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top-Left Square (Dark Green) */}
          <rect x="6" y="6" width="38" height="38" rx="4" stroke="#009639" strokeWidth="12" fill="none" />
          {/* Top-Right Square (Lime Green) */}
          <rect x="54" y="16" width="28" height="28" rx="3" stroke="#82C325" strokeWidth="9" fill="none" />
          {/* Bottom-Left Square (Yellow-Green) */}
          <rect x="16" y="54" width="28" height="28" rx="3" stroke="#D3E000" strokeWidth="9" fill="none" />
          {/* Bottom-Right Square (Olive/Light Green) */}
          <rect x="54" y="54" width="38" height="38" rx="4" stroke="#82C325" strokeWidth="12" fill="none" />
        </svg>
      </div>

      {/* Trindade Text Branding */}
      <div
        className="flex flex-col justify-center leading-none"
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: '1' }}
      >
        <span
          className={`font-black text-lg tracking-tight ${
            isDark ? 'text-white' : 'text-[#06245E]'
          }`}
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 900,
            fontSize: '18px',
            lineHeight: '1.1',
            color: isDark ? '#ffffff' : '#06245E',
          }}
        >
          TRINDADE
        </span>
        <span
          className="text-[9px] font-bold tracking-[0.2em] text-[#009639] mt-0.5 uppercase"
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: '#009639',
            marginTop: '2px',
            textTransform: 'uppercase',
          }}
        >
          - ESQUADRIAS -
        </span>
      </div>
    </div>
  );
};
