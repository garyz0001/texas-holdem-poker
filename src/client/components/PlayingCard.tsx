import React from 'react';
import { Card } from '../../shared/types';
import { RANK_LABELS, SUIT_SYMBOLS } from '../../shared/constants';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'board';
  highlighted?: boolean;
  dimmed?: boolean;
  fourColor?: boolean;
  className?: string;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  size = 'md',
  highlighted = false,
  dimmed = false,
  fourColor = true,
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-7 h-10 text-[10px] rounded p-0.5',
    sm: 'w-9 h-13 text-xs rounded-md p-1',
    md: 'w-12 h-17 sm:w-13 sm:h-19 text-xs sm:text-sm rounded-lg p-1 sm:p-1.5',
    lg: 'w-16 h-23 text-base rounded-xl p-1.5',
    board: 'w-10 h-14 sm:w-16 sm:h-23 text-xs sm:text-base rounded-lg sm:rounded-xl p-1 sm:p-1.5',
  }[size];

  if (faceDown || !card) {
    return (
      <div
        className={`${sizeClasses} relative select-none border border-amber-500/40 bg-gradient-to-br from-rose-900 via-red-950 to-slate-900 shadow-md flex items-center justify-center overflow-hidden animate-card-deal ${
          dimmed ? 'opacity-40 grayscale' : ''
        } ${className}`}
      >
        <div className="absolute inset-0.5 sm:inset-1 rounded border border-amber-400/25 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:5px_5px] opacity-35" />
        <span className="text-amber-400/60 text-[9px] sm:text-xs font-bold">♠</span>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const rankLabel = RANK_LABELS[card.rank];

  const suitColor = fourColor
    ? {
        s: 'text-slate-900',
        h: 'text-rose-600',
        d: 'text-blue-600',
        c: 'text-emerald-700',
      }[card.suit]
    : card.suit === 'h' || card.suit === 'd'
    ? 'text-rose-600'
    : 'text-slate-900';

  const suitBgTint = fourColor
    ? {
        s: 'from-white to-slate-100',
        h: 'from-white to-rose-50/70',
        d: 'from-white to-blue-50/70',
        c: 'from-white to-emerald-50/70',
      }[card.suit]
    : 'from-white to-slate-100';

  const centerSuitSize = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-lg sm:text-2xl',
    lg: 'text-3xl',
    board: 'text-base sm:text-3xl',
  }[size];

  return (
    <div
      className={`${sizeClasses} relative select-none bg-gradient-to-b ${suitBgTint} border ${
        highlighted
          ? 'border-amber-400 ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.75)] -translate-y-1'
          : 'border-slate-300 shadow-md'
      } flex flex-col justify-between transition-all duration-200 animate-card-deal ${
        dimmed ? 'opacity-45 brightness-75' : ''
      } ${className}`}
    >
      {/* Top-left rank & suit */}
      <div className={`flex flex-col items-center leading-none ${suitColor}`}>
        <span className="font-extrabold tracking-tighter">{rankLabel}</span>
        <span className="text-[0.75em]">{suitSymbol}</span>
      </div>

      {/* Center large suit pip */}
      <div className={`self-center leading-none ${suitColor} ${centerSuitSize}`}>
        {suitSymbol}
      </div>

      {/* Bottom-right rank (desktop only) */}
      <div
        className={`self-end leading-none rotate-180 ${suitColor} opacity-80 hidden sm:flex flex-col items-center`}
      >
        <span className="text-[0.75em] font-bold">{rankLabel}</span>
      </div>
    </div>
  );
};
