import React, { useEffect, useState } from 'react';
import {
  BOT_STRENGTH_LABELS,
  BOT_STYLE_METADATA,
} from '../../shared/constants';
import {
  Card,
  HandWinnerInfo,
  PlayerState,
} from '../../shared/types';
import { PlayingCard } from './PlayingCard';
import { UserPlus, Bot, Trash2, WifiOff, Trophy } from 'lucide-react';

interface SeatNodeProps {
  seatIndex: number;
  positionStyle: { left: string; top: string; betOffset: { x: number; y: number } };
  isMobile: boolean;
  player?: PlayerState;
  isMe: boolean;
  amISeated: boolean;
  isHost: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActiveTurn: boolean;
  turnDeadline: number | null;
  actionTimeSeconds: number;
  bigBlindAmount: number;
  showStackInBB: boolean;
  fourColorDeck: boolean;
  winnerInfo?: HandWinnerInfo;
  winningCards?: Card[];
  floatingEmoji?: string;
  canModifySeats: boolean;
  onTakeSeat: (seat: number) => void;
  onOpenAddBot: (seat: number) => void;
  onRemoveBot: (seat: number) => void;
}

function isCardInList(card: Card, list?: Card[]): boolean {
  if (!list) return false;
  return list.some((c) => c.rank === card.rank && c.suit === card.suit);
}

export const SeatNode: React.FC<SeatNodeProps> = ({
  seatIndex,
  positionStyle,
  isMobile,
  player,
  isMe,
  amISeated,
  isHost,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isActiveTurn,
  turnDeadline,
  actionTimeSeconds,
  bigBlindAmount,
  showStackInBB,
  fourColorDeck,
  winnerInfo,
  winningCards,
  floatingEmoji,
  canModifySeats,
  onTakeSeat,
  onOpenAddBot,
  onRemoveBot,
}) => {
  const [remainingRatio, setRemainingRatio] = useState(1);
  const [remainingSec, setRemainingSec] = useState(0);

  useEffect(() => {
    if (!isActiveTurn || !turnDeadline || actionTimeSeconds <= 0) {
      setRemainingRatio(1);
      return;
    }

    const updateTimer = () => {
      const leftMs = Math.max(0, turnDeadline - Date.now());
      const totalMs = actionTimeSeconds * 1000;
      setRemainingRatio(Math.min(1, leftMs / totalMs));
      setRemainingSec(Math.ceil(leftMs / 1000));
    };

    updateTimer();
    const id = setInterval(updateTimer, 150);
    return () => clearInterval(id);
  }, [isActiveTurn, turnDeadline, actionTimeSeconds]);

  // Empty Seat View
  if (!player) {
    return (
      <div
        style={{ left: positionStyle.left, top: positionStyle.top }}
        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
      >
        <div className="w-20 h-12 sm:w-32 sm:h-16 rounded-xl sm:rounded-2xl border border-dashed border-slate-600/70 bg-slate-900/65 backdrop-blur-sm flex flex-col items-center justify-center gap-0.5 sm:gap-1 p-1 sm:p-1.5 shadow-inner hover:border-emerald-500/60 transition-colors">
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-none">
            #{seatIndex + 1} 空位
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            {!amISeated && canModifySeats && (
              <button
                onClick={() => onTakeSeat(seatIndex)}
                className="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] sm:text-xs font-semibold flex items-center gap-0.5 shadow cursor-pointer transition"
              >
                <UserPlus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                入座
              </button>
            )}
            {isHost && canModifySeats && (
              <button
                onClick={() => onOpenAddBot(seatIndex)}
                className="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-indigo-100 text-[10px] sm:text-xs font-medium flex items-center gap-0.5 shadow cursor-pointer transition"
                title="在此座位添加 AI 人机"
              >
                <Bot className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                +AI
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const botMeta =
    player.isBot && player.botStyle && !player.hideBotStyle
      ? BOT_STYLE_METADATA[player.botStyle]
      : null;

  const formatStack = (chips: number) => {
    if (showStackInBB && bigBlindAmount > 0) {
      const bbs = (chips / bigBlindAmount).toFixed(1).replace(/\.0$/, '');
      return `${bbs}BB`;
    }
    return chips.toLocaleString();
  };

  const hasCards = player.holeCards.length === 2;
  const showCard0 = isMe || player.revealedCards[0];
  const showCard1 = isMe || player.revealedCards[1];

  // Determine card size: on mobile, opponent unrevealed cards are tiny `xs`, revealed are `sm`, my own cards are `md`
  const cardSize = isMe
    ? 'md'
    : isMobile
    ? showCard0 || showCard1
      ? 'sm'
      : 'xs'
    : 'sm';

  return (
    <div
      style={{ left: positionStyle.left, top: positionStyle.top }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none ${
        isActiveTurn ? 'z-30' : isMe ? 'z-25' : 'z-20'
      }`}
    >
      {/* Floating Emoji Reaction */}
      {floatingEmoji && (
        <div
          key={floatingEmoji + Date.now()}
          className="absolute -top-12 z-50 text-2xl sm:text-4xl drop-shadow-lg animate-emoji-float pointer-events-none"
        >
          {floatingEmoji}
        </div>
      )}

      {/* Current Street Bet Pill positioned toward table center */}
      {player.currentBet > 0 && (
        <div
          style={{
            transform: `translate(${positionStyle.betOffset.x}px, ${positionStyle.betOffset.y}px)`,
          }}
          className="absolute z-30 pointer-events-none flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-amber-400/70 shadow-[0_3px_10px_rgba(0,0,0,0.75)] whitespace-nowrap"
        >
          <span className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border border-white/60 inline-block shrink-0" />
          <span className="text-[10px] sm:text-xs font-extrabold text-amber-300 tracking-tight">
            {formatStack(player.currentBet)}
          </span>
        </div>
      )}

      {/* Winner Celebration Banner */}
      {winnerInfo && (
        <div className="mb-0.5 sm:mb-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-extrabold text-[10px] sm:text-xs shadow-[0_0_16px_rgba(251,191,36,0.9)] flex items-center gap-1 animate-bounce z-30 whitespace-nowrap">
          <Trophy className="w-3 h-3 shrink-0" />
          <span>+{winnerInfo.amountWon.toLocaleString()}</span>
          {winnerInfo.handName && (
            <span className="text-[9px] sm:text-[10px] bg-slate-950/20 px-1 rounded">
              {winnerInfo.handName}
            </span>
          )}
        </div>
      )}

      {/* Live All-In Runout Equity % Badge ("跑马胜率") */}
      {!winnerInfo && player.allInEquity !== undefined && !player.folded && (
        <div
          className={`mb-0.5 px-2 py-0.5 rounded-full font-black text-[10px] sm:text-xs shadow-lg z-30 whitespace-nowrap border ${
            player.allInEquity >= 50
              ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.8)]'
              : 'bg-rose-600/95 text-white border-rose-300/60'
          }`}
        >
          🔥 胜率 {player.allInEquity}%
        </div>
      )}

      {/* Hole Cards above / overlapping the player pod */}
      {hasCards && (
        <div
          className={`flex items-center justify-center -space-x-1.5 sm:-space-x-2 mb-[-6px] sm:mb-[-10px] z-10 transition-transform ${
            player.folded ? 'opacity-35 scale-90 grayscale' : ''
          }`}
        >
          <PlayingCard
            card={player.holeCards[0]}
            faceDown={!showCard0}
            size={cardSize}
            fourColor={fourColorDeck}
            highlighted={
              showCard0 && isCardInList(player.holeCards[0], winningCards)
            }
            className="-rotate-4"
          />
          <PlayingCard
            card={player.holeCards[1]}
            faceDown={!showCard1}
            size={cardSize}
            fourColor={fourColorDeck}
            highlighted={
              showCard1 && isCardInList(player.holeCards[1], winningCards)
            }
            className="rotate-4"
          />
        </div>
      )}

      {/* Main Player Pod (Compact on Mobile for Opponents, Full Size on Desktop) */}
      <div
        className={`relative ${
          isMe
            ? 'w-28 sm:w-40 py-1 px-1.5 sm:p-2'
            : 'w-[86px] sm:w-38 py-1 px-1.5 sm:p-2'
        } rounded-xl sm:rounded-2xl backdrop-blur-md transition-all duration-200 ${
          isActiveTurn
            ? 'bg-slate-900/95 border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.65)] scale-105'
            : winnerInfo
            ? 'bg-slate-900/95 border-2 border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.6)]'
            : isMe
            ? 'bg-slate-900/95 border border-emerald-500/80 shadow-xl'
            : 'bg-slate-900/90 border border-slate-700/80 shadow-md'
        } ${player.folded ? 'opacity-60' : ''}`}
      >
        {/* Dealer / SB / BB Badges */}
        <div className="absolute -top-2 -left-1.5 flex items-center gap-0.5 z-30">
          {isDealer && (
            <span
              className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 font-black text-[9px] sm:text-[11px] flex items-center justify-center border border-slate-950 shadow"
              title="庄家按钮 (Dealer Button)"
            >
              D
            </span>
          )}
          {isSmallBlind && (
            <span className="px-1 py-0.1 rounded-full bg-sky-600 text-white font-bold text-[8px] sm:text-[10px] border border-slate-950 shadow">
              SB
            </span>
          )}
          {isBigBlind && (
            <span className="px-1 py-0.1 rounded-full bg-purple-600 text-white font-bold text-[8px] sm:text-[10px] border border-slate-950 shadow">
              BB
            </span>
          )}
        </div>

        {/* Host Remove Bot Button */}
        {isHost && player.isBot && canModifySeats && (
          <button
            onClick={() => onRemoveBot(seatIndex)}
            className="absolute -top-2 -right-1.5 w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer z-30"
            title="移除此人机"
          >
            <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </button>
        )}

        {/* Disconnected or Elimination Badge */}
        {!player.connected && !player.isBot && (
          <div className="absolute -top-2 -right-1.5 px-1 py-0.2 rounded-full bg-rose-600 text-white text-[9px] flex items-center gap-0.5">
            <WifiOff className="w-2.5 h-2.5" />
          </div>
        )}

        {player.eliminatedRank && (
          <div className="absolute -top-2 right-1 px-1 py-0.2 rounded-full bg-amber-500/90 text-slate-950 font-extrabold text-[9px] shadow">
            #{player.eliminatedRank}名
          </div>
        )}

        {/* Player Name & Bot Tag */}
        <div className="flex items-center justify-between gap-1">
          <div className="truncate text-[11px] sm:text-xs font-bold text-slate-100 flex items-center gap-1">
            {isMe && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
            )}
            <span className="truncate">{player.name}</span>
          </div>
          {botMeta && (
            <span
              className="hidden sm:inline-block shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-600/60"
              title={`${botMeta.name} - ${
                player.botStrength ? BOT_STRENGTH_LABELS[player.botStrength].name : ''
              }`}
            >
              {botMeta.shortTag}
            </span>
          )}
        </div>

        {/* Stack Size */}
        <div className="mt-0.5 flex items-center justify-between">
          <span
            className={`text-[11px] sm:text-sm font-extrabold tracking-tight truncate ${
              player.chips === 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {player.chips === 0 && player.allIn
              ? 'ALL-IN'
              : player.chips === 0
              ? '0(空)'
              : `${isMobile ? '' : '🪙 '}${formatStack(player.chips)}`}
          </span>

          {player.sittingOut && (
            <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300">
              暂离
            </span>
          )}
        </div>

        {/* Last Action Pill */}
        {player.lastAction && (
          <div
            className={`mt-0.5 text-center text-[10px] sm:text-[11px] font-bold py-0.2 sm:py-0.5 px-1 rounded truncate ${
              player.lastAction.type === 'fold'
                ? 'bg-slate-800 text-slate-400'
                : player.lastAction.type === 'allin'
                ? 'bg-rose-600/90 text-white animate-pulse'
                : player.lastAction.type === 'raise' ||
                  player.lastAction.type === 'bet'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                : player.lastAction.type === 'call'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'bg-sky-500/20 text-sky-300'
            }`}
          >
            {player.lastAction.label}
          </div>
        )}

        {/* Turn Countdown Bar */}
        {isActiveTurn && actionTimeSeconds > 0 && (
          <div className="mt-1 w-full bg-slate-800 h-1 sm:h-1.5 rounded-full overflow-hidden flex items-center">
            <div
              style={{ width: `${remainingRatio * 100}%` }}
              className={`h-full transition-all duration-150 ${
                remainingRatio > 0.5
                  ? 'bg-emerald-400'
                  : remainingRatio > 0.25
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
          </div>
        )}
        {isActiveTurn && actionTimeSeconds > 0 && !isMobile && (
          <div className="text-[10px] text-amber-300 font-mono text-right mt-0.5 leading-none">
            ⏱️ {remainingSec}s
          </div>
        )}
      </div>
    </div>
  );
};
