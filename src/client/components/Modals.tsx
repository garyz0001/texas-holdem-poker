import React, { useState } from 'react';
import {
  BOT_STRENGTH_LABELS,
  BOT_STYLE_METADATA,
  SNG_BLIND_PRESETS,
} from '../../shared/constants';
import {
  BotStrength,
  BotStyle,
  LedgerEntry,
  TableConfig,
} from '../../shared/types';
import { X, Settings, Bot, Receipt, Coins, Copy, Check, Sparkles } from 'lucide-react';

// ============================================================================
// 1. TABLE SETTINGS MODAL (Host configuration for Cash & SNG)
// ============================================================================
interface SettingsModalProps {
  config: TableConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (partial: Partial<TableConfig>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  isOpen,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<TableConfig>({ ...config });
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');

  if (!isOpen) return null;

  const applySngPreset = (key: string) => {
    const preset = SNG_BLIND_PRESETS[key];
    if (!preset) return;
    setSelectedPreset(key);
    setForm((prev) => ({
      ...prev,
      sngLevels: [...preset.levels],
      sngLevelDurationMinutes: preset.minutes,
      sngHandsPerLevel: preset.hands,
      smallBlind: preset.levels[0].smallBlind,
      bigBlind: preset.levels[0].bigBlind,
      ante: preset.levels[0].ante,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>牌桌与赛制设置 (房主管理)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-sm">
          {/* Game Mode Switch */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              选择游戏模式
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, mode: 'cash' })}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  form.mode === 'cash'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-base flex items-center justify-between">
                  <span>💵 常规桌 (Cash Game)</span>
                  {form.mode === 'cash' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-extrabold">
                      当前选择
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  盲注恒定不变，随时自由入座、离座与无限次补充筹码 (Rebuy)。
                </p>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, mode: 'sng' })}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  form.mode === 'sng'
                    ? 'bg-sky-950/60 border-sky-400 text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-base flex items-center justify-between">
                  <span>🏆 单桌锦标赛 (SNG)</span>
                  {form.mode === 'sng' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-sky-400 text-slate-950 font-extrabold">
                      当前选择
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  所有人相同初始记分牌，盲注按手数或时间自动升级，淘汰制决出冠亚季军！
                </p>
              </button>
            </div>
          </div>

          {/* Seat Count & Action Timer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                牌桌最大人数 (2 - 9人)
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[2, 4, 6, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, maxSeats: n })}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer border transition ${
                      form.maxSeats === n
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {n}人{n === 2 ? '(单挑)' : n === 6 ? '(6-Max)' : n === 9 ? '(满员)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                出牌思考倒计时
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { sec: 15, label: '15秒' },
                  { sec: 20, label: '20秒' },
                  { sec: 30, label: '30秒' },
                  { sec: 45, label: '45秒' },
                  { sec: 0, label: '不限时' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => setForm({ ...form, actionTimeSeconds: item.sec })}
                    className={`px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer border transition ${
                      form.actionTimeSeconds === item.sec
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Starting Stack & Buy-in settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {form.mode === 'sng' ? '锦标赛初始记分牌' : '默认带入筹码'}
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={form.startingChips}
                onChange={(e) =>
                  setForm({ ...form, startingChips: Math.max(100, Number(e.target.value)) })
                }
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
              />
            </div>

            {form.mode === 'cash' && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    最小允许带入
                  </label>
                  <input
                    type="number"
                    min={50}
                    step={100}
                    value={form.minBuyIn}
                    onChange={(e) =>
                      setForm({ ...form, minBuyIn: Math.max(50, Number(e.target.value)) })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    最大允许带入
                  </label>
                  <input
                    type="number"
                    min={form.minBuyIn}
                    step={500}
                    value={form.maxBuyIn}
                    onChange={(e) =>
                      setForm({ ...form, maxBuyIn: Math.max(form.minBuyIn, Number(e.target.value)) })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                  />
                </div>
              </>
            )}
          </div>

          {/* Cash Game Blinds vs SNG Blind Structure */}
          {form.mode === 'cash' ? (
            <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  小盲注 (SB)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.smallBlind}
                  onChange={(e) => {
                    const sb = Math.max(1, Number(e.target.value));
                    setForm({ ...form, smallBlind: sb, bigBlind: Math.max(sb * 2, form.bigBlind) });
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  大盲注 (BB)
                </label>
                <input
                  type="number"
                  min={form.smallBlind}
                  value={form.bigBlind}
                  onChange={(e) =>
                    setForm({ ...form, bigBlind: Math.max(form.smallBlind, Number(e.target.value)) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  前注 (Ante)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.ante}
                  onChange={(e) =>
                    setForm({ ...form, ante: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-sky-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-sky-400">
                  🏆 单桌锦标赛 (SNG) 涨盲节奏与盲注结构表
                </span>
                <div className="flex items-center gap-1.5">
                  {Object.entries(SNG_BLIND_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applySngPreset(key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer border transition ${
                        selectedPreset === key
                          ? 'bg-sky-500 text-slate-950 border-sky-300'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    升盲触发方式
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, sngBlindMode: 'hands' })}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                        form.sngBlindMode === 'hands'
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      按手数升盲 (推荐)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, sngBlindMode: 'time' })}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer ${
                        form.sngBlindMode === 'time'
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}
                    >
                      按时间升盲
                    </button>
                  </div>
                </div>

                {form.sngBlindMode === 'hands' ? (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      每打多少手牌升一级盲注
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={form.sngHandsPerLevel}
                      onChange={(e) =>
                        setForm({ ...form, sngHandsPerLevel: Math.max(1, Number(e.target.value)) })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      每个盲注级别持续分钟数
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={form.sngLevelDurationMinutes}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sngLevelDurationMinutes: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Blind Levels Preview Table */}
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/70">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-3">级别</th>
                      <th className="py-1.5 px-3">小盲 (SB)</th>
                      <th className="py-1.5 px-3">大盲 (BB)</th>
                      <th className="py-1.5 px-3">前注 (Ante)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-200">
                    {form.sngLevels.map((lvl) => (
                      <tr key={lvl.level}>
                        <td className="py-1 px-3 font-bold text-sky-400">Lv.{lvl.level}</td>
                        <td className="py-1 px-3">{lvl.smallBlind}</td>
                        <td className="py-1 px-3">{lvl.bigBlind}</td>
                        <td className="py-1 px-3 text-amber-300">{lvl.ante}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Extra toggles */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <div className="font-bold text-slate-200">🐰 允许发发看 (Rabbit Hunt)</div>
              <div className="text-xs text-slate-400">
                当牌局在河牌前提前结束时，允许玩家点击查看原本会发出的公共牌
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.allowRabbitHunt}
              onChange={(e) => setForm({ ...form, allowRabbitHunt: e.target.checked })}
              className="w-5 h-5 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg cursor-pointer"
          >
            保存牌桌设置
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. ADD AI BOT MODAL (Select style & strength, or auto-fill empty seats)
// ============================================================================
interface AddBotModalProps {
  isOpen: boolean;
  targetSeat: number | null;
  emptySeats: number[];
  onClose: () => void;
  onAddBot: (seat: number, style: BotStyle, strength: BotStrength, name?: string) => void;
}

export const AddBotModal: React.FC<AddBotModalProps> = ({
  isOpen,
  targetSeat,
  emptySeats,
  onClose,
  onAddBot,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<BotStyle>('TAG');
  const [selectedStrength, setSelectedStrength] = useState<BotStrength>('shark');
  const [customName, setCustomName] = useState<string>('');

  if (!isOpen || targetSeat === null) return null;

  const styles: BotStyle[] = ['TAG', 'LAG', 'STATION', 'MANIAC', 'NIT'];
  const strengths: BotStrength[] = ['novice', 'regular', 'shark'];

  const handleAutoFillAll = () => {
    const rotation: { style: BotStyle; strength: BotStrength }[] = [
      { style: 'TAG', strength: 'shark' },
      { style: 'LAG', strength: 'regular' },
      { style: 'STATION', strength: 'novice' },
      { style: 'MANIAC', strength: 'regular' },
      { style: 'NIT', strength: 'shark' },
    ];
    emptySeats.forEach((seat, idx) => {
      const pick = rotation[idx % rotation.length];
      onAddBot(seat, pick.style, pick.strength);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Bot className="w-5 h-5 text-indigo-400" />
            <span>添加 AI 人机陪打 (座位 #{targetSeat + 1})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
          {/* Style selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. 选择人机打法风格 (5种性格人设)
            </label>
            <div className="space-y-2">
              {styles.map((st) => {
                const meta = BOT_STYLE_METADATA[st];
                const active = selectedStyle === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStyle(st)}
                    className={`w-full p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                      active
                        ? 'bg-indigo-950/70 border-indigo-400 text-white shadow-md'
                        : 'bg-slate-800/50 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-2xl shrink-0">{meta.avatar}</span>
                    <div className="flex-1">
                      <div className="font-bold flex items-center justify-between">
                        <span>{meta.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-indigo-500/30">
                          {meta.shortTag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strength selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              2. 选择 AI 算力与决策强度
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {strengths.map((str) => {
                const info = BOT_STRENGTH_LABELS[str];
                const active = selectedStrength === str;
                return (
                  <button
                    key={str}
                    type="button"
                    onClick={() => setSelectedStrength(str)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs text-amber-300">{info.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{info.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Custom Name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              自定义人机昵称（选填，留空则自动使用趣味名称）
            </label>
            <input
              type="text"
              placeholder="例如：德扑之神·发哥"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          {emptySeats.length > 1 ? (
            <button
              type="button"
              onClick={handleAutoFillAll}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <Sparkles className="w-4 h-4" />
              一键补满全部 {emptySeats.length} 个空座 (混合阵容)
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={() => {
                onAddBot(targetSeat, selectedStyle, selectedStrength, customName);
                onClose();
              }}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg cursor-pointer"
            >
              确认添加人机
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. REAL-TIME LEDGER & STATS MODAL (战绩账单与 HUD 数据统计)
// ============================================================================
interface LedgerModalProps {
  isOpen: boolean;
  ledger: Record<string, LedgerEntry>;
  roomId: string;
  mode: 'cash' | 'sng';
  handNumber: number;
  onClose: () => void;
}

export const LedgerModal: React.FC<LedgerModalProps> = ({
  isOpen,
  ledger,
  roomId,
  mode,
  handNumber,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const entries = Object.values(ledger).sort((a, b) => {
    if (mode === 'sng' && a.sngRank && b.sngRank) {
      return a.sngRank - b.sngRank;
    }
    return b.netProfit - a.netProfit;
  });

  const copySummaryText = () => {
    const lines = [
      `🃏 【德州扑克俱乐部战绩单】 房间: ${roomId} (${mode === 'sng' ? 'SNG锦标赛' : '常规桌'} | 共 ${handNumber} 手牌)`,
      '----------------------------------------',
      ...entries.map((e, i) => {
        const sign = e.netProfit > 0 ? `+${e.netProfit}` : `${e.netProfit}`;
        const rankStr = e.sngRank ? ` [第${e.sngRank}名]` : '';
        return `${i + 1}. ${e.playerName}${rankStr} | 带入: ${e.totalBuyIn} | 剩余: ${e.currentChips} | 净胜负: ${sign}`;
      }),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Receipt className="w-5 h-5 text-amber-400" />
            <span>实时战绩账单与数据统计 (Ledger & HUD)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">玩家</th>
                <th className="py-2.5 px-3">总带入</th>
                <th className="py-2.5 px-3">当前筹码</th>
                <th className="py-2.5 px-3">净胜负</th>
                <th className="py-2.5 px-3">手数 / 胜局</th>
                <th className="py-2.5 px-3" title="主动入池率 / 翻前加注率">
                  VPIP / PFR
                </th>
                {mode === 'sng' && <th className="py-2.5 px-3">名次</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {entries.map((entry) => {
                const vpip =
                  entry.handsPlayed > 0
                    ? Math.round((entry.vpipCount / entry.handsPlayed) * 100)
                    : 0;
                const pfr =
                  entry.handsPlayed > 0
                    ? Math.round((entry.pfrCount / entry.handsPlayed) * 100)
                    : 0;
                return (
                  <tr key={entry.playerId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold flex items-center gap-1.5">
                      <span>{entry.playerName}</span>
                      {!entry.activeOnTable && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          已离座
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {entry.totalBuyIn.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-amber-300">
                      {entry.currentChips.toLocaleString()}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-extrabold ${
                        entry.netProfit > 0
                          ? 'text-emerald-400'
                          : entry.netProfit < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {entry.netProfit > 0
                        ? `+${entry.netProfit.toLocaleString()}`
                        : entry.netProfit.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-300">
                      {entry.handsPlayed} 手 / 胜 {entry.handsWon}
                    </td>
                    <td className="py-2.5 px-3 text-xs font-mono text-indigo-300">
                      {vpip}% / {pfr}%
                    </td>
                    {mode === 'sng' && (
                      <td className="py-2.5 px-3 font-bold text-amber-400">
                        {entry.sngRank ? `🏅 第 ${entry.sngRank} 名` : '比赛中'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          <button
            onClick={copySummaryText}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制结算账单到剪贴板！
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制战绩结算单 (发群里结算)
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. REBUY / BUY-IN MODAL
// ============================================================================
interface BuyInModalProps {
  isOpen: boolean;
  title: string;
  minAmount: number;
  maxAmount: number;
  defaultAmount: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

export const BuyInModal: React.FC<BuyInModalProps> = ({
  isOpen,
  title,
  minAmount,
  maxAmount,
  defaultAmount,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState(defaultAmount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Coins className="w-5 h-5 text-amber-400" />
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="text-3xl font-black text-amber-400">
              🪙 {amount.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              允许范围: {minAmount.toLocaleString()} - {maxAmount.toLocaleString()}
            </div>
          </div>

          <input
            type="range"
            min={minAmount}
            max={maxAmount}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setAmount(minAmount)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
            >
              最小 ({minAmount})
            </button>
            <button
              type="button"
              onClick={() => setAmount(defaultAmount)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 cursor-pointer"
            >
              标准 ({defaultAmount})
            </button>
            <button
              type="button"
              onClick={() => setAmount(maxAmount)}
              className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-300 cursor-pointer"
            >
              满码 ({maxAmount})
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-950 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={() => {
              onConfirm(amount);
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm cursor-pointer shadow-lg"
          >
            确认带入
          </button>
        </div>
      </div>
    </div>
  );
};
