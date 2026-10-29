import React, { useEffect, useState } from 'react';
import {
  PlayerActionType,
  PlayerState,
  PublicGameState,
} from '../../shared/types';
import { evaluate7Cards } from '../../engine/evaluator';
import { QUICK_EMOJIS, formatCard } from '../../shared/constants';
import { Eye, Sparkles, Clock, Coins, Coffee, LogOut, Smile } from 'lucide-react';

interface ActionControlsProps {
  state: PublicGameState;
  myPlayer?: PlayerState;
  bigBlind: number;
  onAction: (action: PlayerActionType, amount?: number) => void;
  onShowCards: (indices: [boolean, boolean]) => void;
  onRabbitHunt: () => void;
  onRequestTimebank: () => void;
  onOpenRebuy: () => void;
  onToggleSitOut: () => void;
  onLeaveSeat: () => void;
  onSendQuickEmoji: (emoji: string, label: string) => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  state,
  myPlayer,
  bigBlind,
  onAction,
  onShowCards,
  onRabbitHunt,
  onRequestTimebank,
  onOpenRebuy,
  onToggleSitOut,
  onLeaveSeat,
  onSendQuickEmoji,
}) => {
  const isMyTurn =
    myPlayer !== undefined &&
    state.activeSeat === myPlayer.seat &&
    state.street !== 'waiting' &&
    state.street !== 'showdown' &&
    !state.allInRunout;

  const maxTotalBet = myPlayer ? myPlayer.currentBet + myPlayer.chips : 0;
  const minRaiseTo = Math.min(
    maxTotalBet,
    Math.max(state.minRaiseAmount, state.currentHighestBet + bigBlind)
  );

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    setRaiseAmount(minRaiseTo);
  }, [minRaiseTo, state.street, state.currentHighestBet, isMyTurn]);

  if (!myPlayer) {
    return (
      <div className="w-full max-w-4xl mx-auto px-3 py-2 rounded-xl bg-slate-900/85 border border-slate-800 backdrop-blur-md flex items-center justify-center text-slate-300 text-xs sm:text-sm">
        <span>👋 您当前处于旁观模式，点击牌桌上的空座位即可入座参与牌局！</span>
      </div>
    );
  }

  const toCall = Math.max(0, state.currentHighestBet - myPlayer.currentBet);
  const canCheck = toCall === 0;
  const canRaise = maxTotalBet > state.currentHighestBet;

  // Evaluate current best 5-card hand if >= 3 community cards exist
  const currentEvaluatedHand =
    myPlayer.holeCards.length === 2 && state.communityCards.length >= 3
      ? evaluate7Cards([...myPlayer.holeCards, ...state.communityCards])
      : null;

  // Quick sizing presets (rounded up to integer multiples of bigBlind)
  const ceilToBB = (val: number): number => {
    if (bigBlind <= 0) return Math.ceil(val);
    return Math.ceil(val / bigBlind) * bigBlind;
  };

  const getQuickPresets = (): { label: string; value: number }[] => {
    if (!canRaise) return [];
    const presets: { label: string; value: number; isAllIn?: boolean }[] = [];
    const effectivePot = state.pot + toCall;

    if (state.street === 'preflop' && state.currentHighestBet <= bigBlind) {
      presets.push(
        { label: '2BB', value: bigBlind * 2 },
        { label: '3BB', value: bigBlind * 3 },
        { label: '4BB', value: bigBlind * 4 }
      );
    } else {
      presets.push(
        {
          label: '1/3池',
          value: ceilToBB(state.currentHighestBet + Math.max(bigBlind, effectivePot / 3)),
        },
        {
          label: '1/2池',
          value: ceilToBB(state.currentHighestBet + Math.max(bigBlind, effectivePot / 2)),
        },
        {
          label: '2/3池',
          value: ceilToBB(state.currentHighestBet + Math.max(bigBlind, (effectivePot * 2) / 3)),
        }
      );
    }

    presets.push(
      {
        label: '满池',
        value: ceilToBB(state.currentHighestBet + effectivePot),
      },
      {
        label: '全下',
        value: maxTotalBet,
        isAllIn: true,
      }
    );

    const minRaiseCeil = Math.min(maxTotalBet, ceilToBB(minRaiseTo));

    return presets.map((p) => ({
      label: p.label,
      value: p.isAllIn
        ? maxTotalBet
        : Math.max(minRaiseCeil, Math.min(maxTotalBet, ceilToBB(p.value))),
    }));
  };

  const canShowHoleCards =
    myPlayer.holeCards.length === 2 &&
    (state.street === 'showdown' || myPlayer.folded);

  const canRabbitHunt =
    state.config.allowRabbitHunt &&
    state.street === 'showdown' &&
    state.communityCards.length < 5 &&
    !state.rabbitHuntRevealed;

  return (
    <div className="relative w-full max-w-5xl mx-auto flex flex-col gap-1 sm:gap-1.5">
      {/* Mobile Emoji Popover */}
      {emojiMenuOpen && (
        <div className="absolute bottom-full right-0 mb-1.5 z-50 p-1.5 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl flex items-center gap-1 backdrop-blur-md">
          {QUICK_EMOJIS.map((item) => (
            <button
              key={item.emoji}
              onClick={() => {
                onSendQuickEmoji(item.emoji, item.label);
                setEmojiMenuOpen(false);
              }}
              title={item.label}
              className="hover:scale-125 active:scale-95 transition-transform px-1.5 py-1 text-base cursor-pointer"
            >
              {item.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Compact Single-Row Status & Utility Strip */}
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-slate-800/90 backdrop-blur-md">
        {/* Left: Hand Strength & Show Cards / Rabbit Hunt */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {myPlayer.holeCards.length === 2 && (
            <div className="shrink-0 flex items-center gap-1 text-[11px] sm:text-xs bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700">
              <span className="text-slate-400 hidden xs:inline">底牌:</span>
              <span className="font-bold text-white">
                {formatCard(myPlayer.holeCards[0])} {formatCard(myPlayer.holeCards[1])}
              </span>
            </div>
          )}

          {currentEvaluatedHand && (
            <div className="shrink-0 flex items-center gap-1 text-[11px] sm:text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-lg font-semibold">
              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{currentEvaluatedHand.name}</span>
            </div>
          )}

          {/* Show Cards & Rabbit Hunt Controls */}
          {canShowHoleCards && (
            <div className="shrink-0 flex items-center gap-1">
              <button
                onClick={() => onShowCards([true, false])}
                className="px-1.5 py-0.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 text-[11px] flex items-center gap-0.5 cursor-pointer transition"
              >
                <Eye className="w-2.5 h-2.5" />
                左({formatCard(myPlayer.holeCards[0])})
              </button>
              <button
                onClick={() => onShowCards([false, true])}
                className="px-1.5 py-0.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 text-[11px] flex items-center gap-0.5 cursor-pointer transition"
              >
                <Eye className="w-2.5 h-2.5" />
                右({formatCard(myPlayer.holeCards[1])})
              </button>
              <button
                onClick={() => onShowCards([true, true])}
                className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer transition shadow"
              >
                <Eye className="w-3 h-3" />
                亮双牌
              </button>
            </div>
          )}

          {canRabbitHunt && (
            <button
              onClick={onRabbitHunt}
              className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition"
            >
              🐰 发发看
            </button>
          )}
        </div>

        {/* Right: Quick Emojis & Utility Buttons */}
        <div className="shrink-0 flex items-center gap-1">
          {/* Desktop inline emojis */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-950/60 px-1.5 py-0.5 rounded-lg border border-slate-800">
            {QUICK_EMOJIS.map((item) => (
              <button
                key={item.emoji}
                onClick={() => onSendQuickEmoji(item.emoji, item.label)}
                title={item.label}
                className="hover:scale-125 transition-transform px-1 text-sm cursor-pointer"
              >
                {item.emoji}
              </button>
            ))}
          </div>

          {/* Mobile compact emoji button */}
          <button
            onClick={() => setEmojiMenuOpen((v) => !v)}
            className="md:hidden px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-medium flex items-center gap-0.5 cursor-pointer"
            title="发送快捷表情"
          >
            <Smile className="w-3 h-3" />
            <span>表情</span>
          </button>

          {state.config.mode === 'cash' && (
            <button
              onClick={onOpenRebuy}
              className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-[11px] font-medium flex items-center gap-0.5 cursor-pointer transition"
            >
              <Coins className="w-3 h-3" />
              <span>补码</span>
            </button>
          )}

          <button
            onClick={onToggleSitOut}
            className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-0.5 cursor-pointer transition border ${
              myPlayer.sittingOut
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Coffee className="w-3 h-3" />
            <span>{myPlayer.sittingOut ? '回桌' : '暂离'}</span>
          </button>

          <button
            onClick={onLeaveSeat}
            className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-[11px] font-medium flex items-center gap-0.5 cursor-pointer transition"
            title="起身离开当前座位"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden xs:inline">起身</span>
          </button>
        </div>
      </div>

      {/* Main Betting Controls when it is the player's turn */}
      {isMyTurn ? (
        <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-900/95 border-2 border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.2)] flex flex-col gap-1.5 sm:gap-2">
          {/* Raise Sizing Slider & Quick Presets */}
          {canRaise && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800">
              <div className="flex items-center justify-between sm:justify-start gap-1 w-full sm:w-auto">
                {getQuickPresets().map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setRaiseAmount(preset.value)}
                    className={`flex-1 sm:flex-none px-2 py-0.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer border ${
                      raiseAmount === preset.value
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto flex-1 max-w-md">
                <button
                  onClick={() =>
                    setRaiseAmount((prev) =>
                      Math.max(minRaiseTo, prev - bigBlind)
                    )
                  }
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer shrink-0"
                >
                  -
                </button>
                <input
                  type="range"
                  min={minRaiseTo}
                  max={maxTotalBet}
                  step={Math.max(1, bigBlind)}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 accent-amber-400 cursor-pointer h-1.5"
                />
                <button
                  onClick={() =>
                    setRaiseAmount((prev) =>
                      Math.min(maxTotalBet, prev + bigBlind)
                    )
                  }
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer shrink-0"
                >
                  +
                </button>
                <input
                  type="number"
                  min={minRaiseTo}
                  max={maxTotalBet}
                  value={raiseAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!Number.isNaN(val)) {
                      setRaiseAmount(Math.max(minRaiseTo, Math.min(maxTotalBet, val)));
                    }
                  }}
                  className="w-18 sm:w-22 px-1.5 py-0.5 rounded-lg bg-slate-950 border border-amber-500/50 text-amber-300 font-extrabold text-xs sm:text-sm text-center"
                />
              </div>
            </div>
          )}

          {/* Primary Action Buttons: TIMEBANK / FOLD / CHECK-CALL / BET-RAISE-ALLIN */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2.5">
            {state.config.actionTimeSeconds > 0 && (
              <button
                onClick={onRequestTimebank}
                className="px-2 sm:px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-[11px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer transition shrink-0"
                title="延长本回合思考时间 +20 秒"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>+20s</span>
              </button>
            )}

            {/* Fold Button */}
            <button
              onClick={() => onAction('fold')}
              className="flex-1 sm:flex-none sm:w-32 py-2 px-2 sm:px-4 rounded-xl bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer transition active:scale-98"
            >
              弃牌
            </button>

            {/* Check or Call Button */}
            {canCheck ? (
              <button
                onClick={() => onAction('check')}
                className="flex-1 sm:flex-none sm:w-40 py-2 px-2 sm:px-4 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer transition active:scale-98"
              >
                过牌
              </button>
            ) : (
              <button
                onClick={() =>
                  onAction(toCall >= myPlayer.chips ? 'allin' : 'call')
                }
                className="flex-1 sm:flex-none sm:w-44 py-2 px-2 sm:px-4 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-xs sm:text-sm shadow-lg cursor-pointer transition active:scale-98"
              >
                {toCall >= myPlayer.chips
                  ? `全下 (${myPlayer.chips})`
                  : `跟注 ${toCall}`}
              </button>
            )}

            {/* Bet / Raise / All-In Button */}
            {canRaise && (
              <button
                onClick={() => {
                  if (raiseAmount >= maxTotalBet) {
                    onAction('allin');
                  } else if (state.currentHighestBet === 0) {
                    onAction('bet', raiseAmount);
                  } else {
                    onAction('raise', raiseAmount);
                  }
                }}
                className="flex-[1.3] sm:flex-none sm:w-48 py-2 px-2 sm:px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer transition active:scale-98"
              >
                {raiseAmount >= maxTotalBet
                  ? `🚀 全下 (${maxTotalBet})`
                  : state.currentHighestBet === 0
                  ? `下注 ${raiseAmount}`
                  : `加注至 ${raiseAmount}`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={`px-3 py-1.5 rounded-xl border text-center text-[11px] sm:text-xs font-medium ${
            state.allInRunout
              ? 'bg-rose-950/80 border-rose-500/60 text-amber-300 animate-pulse font-bold'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
          }`}
        >
          {state.allInRunout
            ? '🔥 全下跑马开牌中！双方已亮出底牌，正在逐街发放公共牌...'
            : state.street === 'waiting'
            ? '等待房主点击牌桌中央的【开始发牌】...'
            : state.street === 'showdown'
            ? '本局摊牌结算中，即将自动发下一手牌...'
            : myPlayer.folded
            ? '您已弃牌，正在观战本局剩余行动...'
            : myPlayer.allIn
            ? '🔥 您已全下 (All-In)，等待其他玩家行动结束...'
            : '等待其他玩家行动中...'}
        </div>
      )}
    </div>
  );
};
