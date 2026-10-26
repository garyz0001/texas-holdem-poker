import React, { useEffect, useState } from 'react';
import {
  PlayerActionType,
  PlayerState,
  PublicGameState,
} from '../../shared/types';
import { evaluate7Cards } from '../../engine/evaluator';
import { QUICK_EMOJIS, formatCard } from '../../shared/constants';
import { Eye, Sparkles, Clock, Coins, Coffee, LogOut } from 'lucide-react';

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
    state.street !== 'showdown';

  const maxTotalBet = myPlayer ? myPlayer.currentBet + myPlayer.chips : 0;
  const minRaiseTo = Math.min(
    maxTotalBet,
    Math.max(state.minRaiseAmount, state.currentHighestBet + bigBlind)
  );

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTo);

  useEffect(() => {
    setRaiseAmount(minRaiseTo);
  }, [minRaiseTo, state.street, state.currentHighestBet, isMyTurn]);

  if (!myPlayer) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex items-center justify-between text-slate-300 text-sm">
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

  // Quick sizing presets
  const getQuickPresets = (): { label: string; value: number }[] => {
    if (!canRaise) return [];
    const presets: { label: string; value: number }[] = [];
    const effectivePot = state.pot + toCall;

    if (state.street === 'preflop' && state.currentHighestBet <= bigBlind) {
      presets.push(
        { label: '2.2 BB', value: Math.round(bigBlind * 2.2) },
        { label: '3 BB', value: bigBlind * 3 },
        { label: '4 BB', value: bigBlind * 4 }
      );
    } else {
      presets.push(
        {
          label: '1/3 池',
          value: state.currentHighestBet + Math.max(bigBlind, Math.round(effectivePot * 0.33)),
        },
        {
          label: '1/2 池',
          value: state.currentHighestBet + Math.max(bigBlind, Math.round(effectivePot * 0.5)),
        },
        {
          label: '2/3 池',
          value: state.currentHighestBet + Math.max(bigBlind, Math.round(effectivePot * 0.67)),
        }
      );
    }

    presets.push(
      {
        label: '满池 (Pot)',
        value: state.currentHighestBet + effectivePot,
      },
      {
        label: '全下 (All-In)',
        value: maxTotalBet,
      }
    );

    return presets.map((p) => ({
      label: p.label,
      value: Math.max(minRaiseTo, Math.min(maxTotalBet, p.value)),
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
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-2">
      {/* Top Status & Quick Emoji Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-800/90 backdrop-blur-md">
        {/* Left: Hand Strength & Hole Card Summary */}
        <div className="flex items-center gap-2 flex-wrap">
          {myPlayer.holeCards.length === 2 && (
            <div className="flex items-center gap-1.5 text-xs bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-slate-400">底牌:</span>
              <span className="font-bold text-white">
                {formatCard(myPlayer.holeCards[0])} {formatCard(myPlayer.holeCards[1])}
              </span>
            </div>
          )}

          {currentEvaluatedHand && (
            <div className="flex items-center gap-1 text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>当前牌型：{currentEvaluatedHand.name}</span>
            </div>
          )}

          {/* Show Cards & Rabbit Hunt Controls */}
          {canShowHoleCards && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onShowCards([true, false])}
                className="px-2 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Eye className="w-3 h-3" />
                亮左牌 ({formatCard(myPlayer.holeCards[0])})
              </button>
              <button
                onClick={() => onShowCards([false, true])}
                className="px-2 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-500/40 text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Eye className="w-3 h-3" />
                亮右牌 ({formatCard(myPlayer.holeCards[1])})
              </button>
              <button
                onClick={() => onShowCards([true, true])}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer transition shadow"
              >
                <Eye className="w-3.5 h-3.5" />
                亮出双手牌
              </button>
            </div>
          )}

          {canRabbitHunt && (
            <button
              onClick={onRabbitHunt}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 font-semibold text-xs flex items-center gap-1 cursor-pointer transition"
            >
              🐰 发发看 (看剩余公共牌)
            </button>
          )}
        </div>

        {/* Right: Quick Emojis & Utility Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-950/60 px-1.5 py-0.5 rounded-lg border border-slate-800">
            {QUICK_EMOJIS.map((item) => (
              <button
                key={item.emoji}
                onClick={() => onSendQuickEmoji(item.emoji, item.label)}
                title={item.label}
                className="hover:scale-125 transition-transform px-1 py-0.5 text-sm cursor-pointer"
              >
                {item.emoji}
              </button>
            ))}
          </div>

          {state.config.mode === 'cash' && (
            <button
              onClick={onOpenRebuy}
              className="px-2 py-1 rounded-lg bg-amber-600/25 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-xs font-medium flex items-center gap-1 cursor-pointer transition"
            >
              <Coins className="w-3.5 h-3.5" />
              补码
            </button>
          )}

          <button
            onClick={onToggleSitOut}
            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition border ${
              myPlayer.sittingOut
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            {myPlayer.sittingOut ? '回到牌局' : '暂离'}
          </button>

          <button
            onClick={onLeaveSeat}
            className="px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-medium flex items-center gap-1 cursor-pointer transition"
            title="起身离开当前座位"
          >
            <LogOut className="w-3.5 h-3.5" />
            起身
          </button>
        </div>
      </div>

      {/* Main Betting Controls when it is the player's turn */}
      {isMyTurn ? (
        <div className="p-3 rounded-2xl bg-slate-900/95 border-2 border-amber-400/80 shadow-[0_0_30px_rgba(251,191,36,0.2)] flex flex-col gap-2.5">
          {/* Raise Sizing Slider & Quick Presets */}
          {canRaise && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                {getQuickPresets().map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setRaiseAmount(preset.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      raiseAmount === preset.value
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <button
                  onClick={() =>
                    setRaiseAmount((prev) =>
                      Math.max(minRaiseTo, prev - bigBlind)
                    )
                  }
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                >
                  -
                </button>
                <input
                  type="range"
                  min={minRaiseTo}
                  max={maxTotalBet}
                  step={Math.max(1, Math.floor(bigBlind / 2))}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 accent-amber-400 cursor-pointer"
                />
                <button
                  onClick={() =>
                    setRaiseAmount((prev) =>
                      Math.min(maxTotalBet, prev + bigBlind)
                    )
                  }
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
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
                  className="w-22 px-2 py-1 rounded-lg bg-slate-950 border border-amber-500/50 text-amber-300 font-extrabold text-sm text-center"
                />
              </div>
            </div>
          )}

          {/* Primary Action Buttons: FOLD / CHECK-CALL / BET-RAISE-ALLIN */}
          <div className="grid grid-cols-3 sm:flex items-center justify-end gap-2.5">
            {state.config.actionTimeSeconds > 0 && (
              <button
                onClick={onRequestTimebank}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                title="延长本回合思考时间 +20 秒"
              >
                <Clock className="w-4 h-4" />
                延时 +20s
              </button>
            )}

            {/* Fold Button */}
            <button
              onClick={() => onAction('fold')}
              className="sm:w-36 py-2.5 px-4 rounded-xl bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-sm shadow-lg cursor-pointer transition active:scale-98"
            >
              弃牌 (Fold)
            </button>

            {/* Check or Call Button */}
            {canCheck ? (
              <button
                onClick={() => onAction('check')}
                className="sm:w-44 py-2.5 px-4 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-sm shadow-lg cursor-pointer transition active:scale-98"
              >
                过牌 (Check)
              </button>
            ) : (
              <button
                onClick={() =>
                  onAction(toCall >= myPlayer.chips ? 'allin' : 'call')
                }
                className="sm:w-48 py-2.5 px-4 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-sm shadow-lg cursor-pointer transition active:scale-98"
              >
                {toCall >= myPlayer.chips
                  ? `全下跟注 (${myPlayer.chips})`
                  : `跟注 ${toCall} (Call)`}
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
                className="sm:w-52 py-2.5 px-4 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer transition active:scale-98"
              >
                {raiseAmount >= maxTotalBet
                  ? `🚀 全下 All-In (${maxTotalBet})`
                  : state.currentHighestBet === 0
                  ? `下注 ${raiseAmount} (Bet)`
                  : `加注至 ${raiseAmount} (Raise)`}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center text-xs text-slate-400">
          {state.street === 'waiting'
            ? '等待房主点击牌桌中央的【开始发牌】...'
            : state.street === 'showdown'
            ? '本局摊牌结算中，即将自动发下一手牌（房主也可点击【立即下一局】）...'
            : myPlayer.folded
            ? '您已弃牌，正在观战本局剩余行动...'
            : myPlayer.allIn
            ? '🔥 您已全下 (All-In)，等待底池摊牌开奖！'
            : '等待其他玩家行动中...'}
        </div>
      )}
    </div>
  );
};
