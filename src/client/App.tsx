import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  BotStrength,
  BotStyle,
  Card,
  ClientMessage,
  PlayerActionType,
  PublicGameState,
  ServerMessage,
  TableConfig,
} from '../shared/types';
import { PlayingCard } from './components/PlayingCard';
import { SeatNode } from './components/SeatNode';
import { ActionControls } from './components/ActionControls';
import {
  AddBotModal,
  BuyInModal,
  LedgerModal,
  SettingsModal,
} from './components/Modals';
import { sound } from './utils/sound';
import {
  Bot,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Settings,
  Receipt,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  ScrollText,
  Send,
  Users,
  Sparkles,
  LogOut,
  Layers,
  Coins,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// Generate or retrieve persistent playerId & nickname
function getStoredPlayerId(): string {
  const key = 'poker_player_id_v1';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function getStoredNickname(): string {
  return localStorage.getItem('poker_nickname_v1') || '';
}

// Hand-tuned Portrait (Vertical) seat coordinates [cx%, cy%] for mobile phones (2..9 seats)
// Visual Index 0 is always at the bottom center (viewer's seat)
const MOBILE_PORTRAIT_COORDS: Record<number, Array<[number, number]>> = {
  2: [
    [50, 97],
    [50, 3],
  ],
  3: [
    [50, 97],
    [4, 28],
    [96, 28],
  ],
  4: [
    [50, 97],
    [3, 50],
    [50, 3],
    [97, 50],
  ],
  5: [
    [50, 97],
    [3, 66],
    [12, 12],
    [88, 12],
    [97, 66],
  ],
  6: [
    [50, 97],
    [3, 68],
    [3, 28],
    [50, 3],
    [97, 28],
    [97, 68],
  ],
  7: [
    [50, 97],
    [3, 72],
    [3, 36],
    [25, 3],
    [75, 3],
    [97, 36],
    [97, 72],
  ],
  8: [
    [50, 97],
    [3, 75],
    [3, 45],
    [8, 15],
    [50, 2],
    [92, 15],
    [97, 45],
    [97, 75],
  ],
  9: [
    [50, 98],
    [3, 78],
    [2, 50],
    [6, 22],
    [27, 2],
    [73, 2],
    [94, 22],
    [98, 50],
    [97, 78],
  ],
};

/**
 * Compute seat positions around the poker table for N seats (2..9).
 * Seat 0 of the visual layout is always at the bottom center (6 o'clock).
 */
function getVisualSeatPosition(
  visualIndex: number,
  totalSeats: number,
  isMobile: boolean
): { left: string; top: string; betOffset: { x: number; y: number } } {
  if (isMobile) {
    const coordsList = MOBILE_PORTRAIT_COORDS[totalSeats] || MOBILE_PORTRAIT_COORDS[6];
    const [cx, cy] = coordsList[visualIndex % coordsList.length];

    // Direction vector pointing inward toward table center (50, 50)
    const dx = 50 - cx;
    const dy = 50 - cy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    // Offset bet chip pill inward away from the player pod
    const betDistX = nx * 46;
    const betDistY = ny * 48;

    return {
      left: `${cx}%`,
      top: `${cy}%`,
      betOffset: { x: Math.round(betDistX), y: Math.round(betDistY) },
    };
  }

  // Desktop Horizontal Oval Layout
  const angle = Math.PI / 2 + (visualIndex / totalSeats) * Math.PI * 2;
  const rx = 43; // horizontal radius %
  const ry = 39; // vertical radius %

  const cx = 50 + rx * Math.cos(angle);
  const cy = 50 + ry * Math.sin(angle);

  const betDistX = -Math.cos(angle) * 78;
  const betDistY = -Math.sin(angle) * 58;

  return {
    left: `${cx.toFixed(1)}%`,
    top: `${cy.toFixed(1)}%`,
    betOffset: { x: Math.round(betDistX), y: Math.round(betDistY) },
  };
}

function isCardInList(card: Card, list?: Card[]): boolean {
  if (!list) return false;
  return list.some((c) => c.rank === card.rank && c.suit === card.suit);
}

export const App: React.FC = () => {
  const [playerId] = useState<string>(getStoredPlayerId);
  const [nickname, setNickname] = useState<string>(getStoredNickname);
  const [roomInput, setRoomInput] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('room') || '').toUpperCase();
  });
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Responsive Mobile Portrait Detection (< 640px)
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // UI Preferences
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sound.enabled);
  const [showStackInBB, setShowStackInBB] = useState<boolean>(false);
  const [fourColorDeck, setFourColorDeck] = useState<boolean>(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'log' | 'chat'>('log');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');

  // Modals state
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [ledgerOpen, setLedgerOpen] = useState<boolean>(false);
  const [addBotSeat, setAddBotSeat] = useState<number | null>(null);
  const [buyInTargetSeat, setBuyInTargetSeat] = useState<number | null>(null);
  const [rebuyModalOpen, setRebuyModalOpen] = useState<boolean>(false);

  // Floating emoji animations per seat
  const [seatEmojis, setSeatEmojis] = useState<Record<number, string>>({});

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const prevStreetRef = useRef<string>('waiting');
  const prevHandNumberRef = useRef<number>(0);
  const prevBoardCountRef = useRef<number>(0);
  const prevAllInRunoutRef = useRef<boolean>(false);
  const prevActiveSeatRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const sendMessage = (msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      showToast('正在连接服务器，请稍候...');
    }
  };

  // Connect to WebSocket when entering a room
  useEffect(() => {
    if (!inRoom || !roomInput) return;

    const cleanRoom = roomInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'CLUB888';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws?room=${encodeURIComponent(cleanRoom)}`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            name: nickname.trim() || '神秘牌友',
            playerId,
          } satisfies ClientMessage)
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          if (msg.type === 'STATE_UPDATE') {
            setGameState(msg.state);
          } else if (msg.type === 'ERROR') {
            showToast(msg.message);
          } else if (msg.type === 'EMOJI_ANIMATION') {
            setSeatEmojis((prev) => ({
              ...prev,
              [msg.fromSeat]: msg.emoji,
            }));
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 1800);
        }
      };
    };

    connect();

    // Update browser URL so user can easily copy/share URL
    const newUrl = `${window.location.pathname}?room=${cleanRoom}`;
    window.history.replaceState({}, '', newUrl);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [inRoom, roomInput, playerId]);

  // Trigger sound effects & confetti on state transitions
  useEffect(() => {
    if (!gameState) return;
    const myPlayer = gameState.players.find((p) => p.id === playerId);

    // 1. New Hand Dealt -> Play 4-card dealing cascade!
    if (
      gameState.handNumber > 0 &&
      gameState.handNumber !== prevHandNumberRef.current
    ) {
      sound.playCardDeal(4, 0.085);
      prevHandNumberRef.current = gameState.handNumber;
      prevBoardCountRef.current = 0;
    }

    // 2. Community Cards Dealt (Flop = 3 cards, Turn = 1 card, River = 1 card)
    const newBoardLen = gameState.communityCards.length;
    if (newBoardLen > prevBoardCountRef.current) {
      const added = newBoardLen - prevBoardCountRef.current;
      sound.playCardDeal(added >= 3 ? 3 : 1, 0.11);
    }
    prevBoardCountRef.current = newBoardLen;

    // 3. All-In Runout ("跑马") Triggered -> Play dramatic suspense heartbeat!
    if (gameState.allInRunout && !prevAllInRunoutRef.current) {
      sound.playAllInSuspense();
    }
    prevAllInRunoutRef.current = gameState.allInRunout;

    // 4. Showdown win sound & confetti
    if (gameState.street !== prevStreetRef.current) {
      if (gameState.street === 'showdown') {
        sound.playWin();
        const didIWin = gameState.winners.some((w) => w.playerId === playerId);
        if (didIWin || gameState.sngFinished) {
          confetti({
            particleCount: 70,
            spread: 65,
            origin: { y: 0.6 },
          });
        }
      }
      prevStreetRef.current = gameState.street;
    }

    // 5. Active turn alert sound when it becomes MY turn
    if (
      gameState.activeSeat !== prevActiveSeatRef.current &&
      myPlayer &&
      gameState.activeSeat === myPlayer.seat &&
      gameState.street !== 'waiting' &&
      gameState.street !== 'showdown' &&
      !gameState.allInRunout
    ) {
      sound.playTurnAlert();
    }
    prevActiveSeatRef.current = gameState.activeSeat;
  }, [gameState, playerId]);

  // Auto-scroll action log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.actionLog.length, gameState?.chatMessages.length]);

  const handleEnterRoom = (targetRoomCode?: string) => {
    const cleanName = nickname.trim() || `牌友${Math.floor(100 + Math.random() * 900)}`;
    setNickname(cleanName);
    localStorage.setItem('poker_nickname_v1', cleanName);

    const code = (
      targetRoomCode ||
      roomInput.trim() ||
      `VIP${Math.floor(100 + Math.random() * 900)}`
    )
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    setRoomInput(code);
    setInRoom(true);
  };

  // ============================================================================
  // LOBBY VIEW (Not in room yet)
  // ============================================================================
  if (!inRoom || !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[radial-gradient(circle_at_top,#0f291e_0%,#020617_75%)]">
        <div className="w-full max-w-md rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-[0_0_30px_rgba(16,185,129,0.4)] text-3xl mb-1">
              ♠️
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              好友德州扑克俱乐部
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              支持常规桌 & 单桌锦标赛 (SNG) · 5种性格 AI 人机陪练 · 好友免登录联机
            </p>
          </div>

          {inRoom && !gameState ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-sm text-slate-300">
                正在连接房间 <span className="font-bold text-emerald-400">{roomInput}</span>...
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  您的牌桌昵称
                </label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="输入您的昵称，如：德扑阿哲"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none text-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  房间号 (留空则随机创建新房间)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="例如: CLUB888"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none text-amber-400 font-mono font-bold text-sm uppercase tracking-wider"
                />
              </div>

              <button
                onClick={() => handleEnterRoom()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base shadow-[0_0_25px_rgba(16,185,129,0.4)] cursor-pointer transition active:scale-98"
              >
                {roomInput.trim() ? `进入 / 创建房间 [${roomInput.trim()}]` : '✨ 立即创建新牌局'}
              </button>

              <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="font-bold text-emerald-400 mb-0.5">💵 常规桌 & 🏆 SNG</div>
                  <div className="text-slate-400">可自由设置人数、带入、盲注与涨盲结构</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="font-bold text-indigo-400 mb-0.5">🤖 5种风格 AI 人机</div>
                  <div className="text-slate-400">紧凶/松凶/跟注站/疯鱼/岩石随心搭配</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // ACTIVE ROOM VIEW
  // ============================================================================
  const isHost = gameState.hostId === playerId;
  const myPlayer = gameState.players.find((p) => p.id === playerId);
  const maxSeats = gameState.config.maxSeats;

  // Rotate visual seats so `myPlayer.seat` is always at visual index 0 (bottom center)
  const baseSeatOffset = myPlayer ? myPlayer.seat : 0;

  // Current blinds info
  const currentSngLevel =
    gameState.config.mode === 'sng'
      ? gameState.config.sngLevels[
          Math.min(
            gameState.sngCurrentLevelIndex,
            gameState.config.sngLevels.length - 1
          )
        ]
      : null;

  const currentSB = currentSngLevel
    ? currentSngLevel.smallBlind
    : gameState.config.smallBlind;
  const currentBB = currentSngLevel
    ? currentSngLevel.bigBlind
    : gameState.config.bigBlind;
  const currentAnte = currentSngLevel
    ? currentSngLevel.ante
    : gameState.config.ante;

  const emptySeats: number[] = [];
  for (let s = 0; s < maxSeats; s++) {
    if (!gameState.players.some((p) => p.seat === s)) {
      emptySeats.push(s);
    }
  }

  const canModifySeats =
    gameState.config.mode === 'cash' ||
    !gameState.sngStarted ||
    gameState.sngFinished;

  // Best 5 winning cards for highlighting at showdown
  const allWinningCards: Card[] = gameState.winners.flatMap(
    (w) => w.bestFiveCards || []
  );

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleTakeSeatClick = (seat: number) => {
    if (gameState.config.mode === 'cash') {
      setBuyInTargetSeat(seat);
    } else {
      sendMessage({ type: 'TAKE_SEAT', seat });
    }
  };

  // Helper to render a single community card slot (0..4)
  const renderBoardSlot = (idx: number) => {
    const dealtCard = gameState.communityCards[idx];
    const rabbitCard =
      !dealtCard && gameState.rabbitHuntRevealed
        ? gameState.rabbitCards[idx]
        : undefined;

    if (dealtCard) {
      return (
        <PlayingCard
          key={idx}
          card={dealtCard}
          size={isMobile ? 'md' : 'lg'}
          fourColor={fourColorDeck}
          highlighted={
            gameState.street === 'showdown' &&
            isCardInList(dealtCard, allWinningCards)
          }
        />
      );
    }

    if (rabbitCard) {
      return (
        <div key={idx} className="relative">
          <PlayingCard
            card={rabbitCard}
            size={isMobile ? 'md' : 'lg'}
            fourColor={fourColorDeck}
            dimmed
          />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1 py-0.1 rounded bg-amber-500 text-slate-950 font-black text-[8px] sm:text-[9px] whitespace-nowrap shadow">
            🐰发发看
          </span>
        </div>
      );
    }

    return (
      <div
        key={idx}
        className="w-12 h-17 sm:w-16 sm:h-23 rounded-lg sm:rounded-xl border border-white/10 bg-black/20 shadow-inner flex items-center justify-center"
      >
        <span className="text-white/10 text-sm sm:text-lg font-bold">♠</span>
      </div>
    );
  };

  const latestLogLine =
    gameState.actionLog[gameState.actionLog.length - 1] || '等待发牌...';

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Error Toast Notification */}
      {errorToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-2xl border border-rose-400 animate-bounce">
          ⚠️ {errorToast}
        </div>
      )}

      {/* ====================================================================
          TOP NAVIGATION & STATUS BAR (Compact single row on mobile)
      ==================================================================== */}
      <header className="shrink-0 w-full px-2 sm:px-6 py-1.5 sm:py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-1 z-30">
        {/* Left: Room Code, Copy Invite, Mode & Blinds */}
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
            <span className="text-[11px] sm:text-sm font-black font-mono text-emerald-400">
              #{gameState.roomId}
            </span>
            <button
              onClick={handleCopyInviteLink}
              className="px-1.5 py-0.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs font-semibold flex items-center gap-0.5 cursor-pointer transition"
              title="复制房间链接发给好友即可直接联机"
            >
              {copiedLink ? (
                <>
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span>邀请</span>
                </>
              )}
            </button>
          </div>

          {/* Mode & Blinds Pill */}
          <div
            className={`px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center gap-1 truncate ${
              gameState.config.mode === 'sng'
                ? 'bg-sky-950/70 border-sky-500/40 text-sky-300'
                : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span>
              {gameState.config.mode === 'sng'
                ? `🏆Lv.${currentSngLevel?.level || 1}`
                : '💵常规'}
            </span>
            <span className="text-slate-500">|</span>
            <span>
              {currentSB}/{currentBB}
              {currentAnte > 0 ? `(${currentAnte})` : ''}
            </span>
          </div>
        </div>

        {/* Right: Utility & Host Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Toggle Chips vs BB Display */}
          <button
            onClick={() => setShowStackInBB((v) => !v)}
            className={`px-1.5 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border flex items-center gap-0.5 cursor-pointer transition ${
              showStackInBB
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="切换筹码数值 / 大盲注倍数的显示方式"
          >
            <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{showStackInBB ? 'BB' : '筹码'}</span>
          </button>

          {/* Toggle 4-color deck (desktop only to keep mobile header 1-line) */}
          <button
            onClick={() => setFourColorDeck((v) => !v)}
            className="hidden sm:flex px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold items-center gap-1 cursor-pointer transition"
            title="切换四色扑克牌 / 传统双色扑克牌"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{fourColorDeck ? '四色牌' : '双色牌'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(sound.toggle())}
            className="p-1 sm:p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer transition"
            title="开关音效"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
            )}
          </button>

          {/* Ledger Modal Button */}
          <button
            onClick={() => setLedgerOpen(true)}
            className="px-1.5 sm:px-2 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-bold flex items-center gap-0.5 cursor-pointer transition"
          >
            <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>战绩</span>
          </button>

          {/* Host: Add Bot Button */}
          {isHost && emptySeats.length > 0 && canModifySeats && (
            <button
              onClick={() => setAddBotSeat(emptySeats[0])}
              className="px-1.5 sm:px-2 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] sm:text-xs font-bold flex items-center gap-0.5 cursor-pointer shadow transition"
            >
              <Bot className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>+AI</span>
            </button>
          )}

          {/* Host: Settings Button */}
          {isHost && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1 sm:px-2 sm:py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 cursor-pointer transition"
              title="牌桌设置"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">设置</span>
            </button>
          )}

          {/* Exit Room Button */}
          <button
            onClick={() => {
              sendMessage({ type: 'LEAVE_SEAT' });
              setInRoom(false);
              setGameState(null);
            }}
            className="p-1 sm:p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 border border-slate-700 text-slate-400 hover:text-rose-300 cursor-pointer transition"
            title="返回大厅"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* ====================================================================
          CENTER POKER TABLE ARENA (Flex-1 adaptive height, no page scroll!)
          - Vertical Stadium on Mobile (< 640px)
          - Horizontal Oval on Desktop (>= 640px)
      ==================================================================== */}
      <main className="relative flex-1 min-h-0 w-full flex items-center justify-center py-7 sm:py-10 px-2 sm:px-12 overflow-hidden">
        {/* Outer Table Container: Adaptive Vertical on Mobile, Horizontal on Desktop */}
        <div
          className={
            isMobile
              ? 'relative w-[74%] max-w-[290px] h-full max-h-[450px] min-h-[200px]'
              : 'relative w-full max-w-4xl h-full max-h-[460px] min-h-[280px] aspect-[16/9]'
          }
        >
          {/* Wooden / Leather Rail */}
          <div className="w-full h-full rounded-[150px] sm:rounded-[240px] p-3 sm:p-5 poker-table-rail flex items-center justify-center">
            {/* Inner Felt Surface */}
            <div
              className={`w-full h-full rounded-[138px] sm:rounded-[220px] border-2 border-amber-400/25 relative flex flex-col items-center justify-center p-2 sm:p-4 ${
                gameState.config.mode === 'sng'
                  ? 'poker-table-felt-sng'
                  : 'poker-table-felt'
              }`}
            >
              {/* Subtle Felt Center Ring */}
              <div className="absolute inset-4 sm:inset-10 rounded-[125px] sm:rounded-[190px] border border-white/10 pointer-events-none" />

              {/* Center Pot & Side Pots Display */}
              <div className="z-10 flex flex-col items-center mb-1.5 sm:mb-2">
                <div className="px-3 sm:px-4 py-0.5 sm:py-1 rounded-full bg-slate-950/85 border border-amber-400/40 shadow-lg flex items-center gap-1.5">
                  <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">
                    底池:
                  </span>
                  <span className="text-sm sm:text-lg font-black text-amber-400">
                    🪙 {gameState.pot.toLocaleString()}
                  </span>
                </div>

                {/* Side Pots breakdown if multiple pots exist */}
                {gameState.sidePots.length > 1 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap justify-center max-w-[180px] sm:max-w-none">
                    {gameState.sidePots.map((sp, i) => (
                      <span
                        key={i}
                        className="text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full bg-slate-900/90 text-amber-200 border border-amber-500/30 font-semibold"
                      >
                        {sp.name}: {sp.amount.toLocaleString()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Community Cards Board:
                  - On Mobile Portrait: 2-row layout (Flop 3 cards on top row, Turn + River 2 cards on bottom row) so cards are big & never collide with left/right seats!
                  - On Desktop: Single row of 5 cards */}
              {isMobile ? (
                <div className="z-10 flex flex-col items-center gap-1.5 my-1">
                  <div className="flex items-center justify-center gap-1.5">
                    {[0, 1, 2].map((idx) => renderBoardSlot(idx))}
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    {[3, 4].map((idx) => renderBoardSlot(idx))}
                  </div>
                </div>
              ) : (
                <div className="z-10 flex items-center justify-center gap-2.5 my-1 min-h-[92px]">
                  {[0, 1, 2, 3, 4].map((idx) => renderBoardSlot(idx))}
                </div>
              )}

              {/* Center Table Action Prompts (Start Hand / Next Hand / Quick Bot Fill / SNG Champion) */}
              <div className="z-20 mt-1 sm:mt-2 flex flex-wrap items-center justify-center gap-1.5 px-2">
                {gameState.allInRunout && (
                  <div className="px-3 py-1 rounded-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white font-black text-[11px] sm:text-xs shadow-[0_0_20px_rgba(244,63,94,0.8)] animate-pulse">
                    🔥 ALL-IN 跑马逐街开牌中...
                  </div>
                )}

                {gameState.sngFinished && (
                  <div className="flex flex-col items-center gap-1.5 bg-slate-950/95 px-3 sm:px-5 py-2 sm:py-3 rounded-2xl border-2 border-amber-400 shadow-2xl text-center">
                    <div className="text-amber-300 font-black text-xs sm:text-base">
                      👑 冠军：{gameState.players.find((p) => p.chips > 0)?.name}
                    </div>
                    {isHost && (
                      <button
                        onClick={() => sendMessage({ type: 'RESET_SNG' })}
                        className="px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer shadow"
                      >
                        <RotateCcw className="w-3 h-3" />
                        重置锦标赛
                      </button>
                    )}
                  </div>
                )}

                {!gameState.sngFinished &&
                  (gameState.street === 'waiting' || gameState.street === 'showdown') && (
                    <div className="flex flex-col sm:flex-row items-center gap-1.5 justify-center">
                      {isHost ? (
                        <>
                          {gameState.players.length < 2 ? (
                            <div className="flex flex-col sm:flex-row items-center gap-1.5 bg-slate-950/85 px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] sm:text-xs text-slate-300 text-center">
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                需至少2人入座
                              </span>
                              {emptySeats.length > 0 && (
                                <button
                                  onClick={() => setAddBotSeat(emptySeats[0])}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  +添加人机
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                sendMessage({
                                  type:
                                    gameState.street === 'waiting'
                                      ? 'START_GAME'
                                      : 'NEXT_HAND',
                                })
                              }
                              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.6)] flex items-center gap-1 cursor-pointer transition hover:scale-105"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              {gameState.street === 'waiting'
                                ? '开始发牌'
                                : '下一手牌'}
                            </button>
                          )}

                          {gameState.street === 'showdown' && (
                            <button
                              onClick={() =>
                                sendMessage({
                                  type: 'PAUSE_GAME',
                                  paused: !gameState.paused,
                                })
                              }
                              className="px-2.5 py-1 sm:py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-[11px] sm:text-xs flex items-center gap-1 cursor-pointer"
                            >
                              {gameState.paused ? (
                                <>
                                  <Play className="w-3 h-3 text-emerald-400" />
                                  继续
                                </>
                              ) : (
                                <>
                                  <Pause className="w-3 h-3 text-amber-400" />
                                  暂停
                                </>
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="px-2.5 py-1 rounded-full bg-slate-950/75 text-slate-300 text-[11px] border border-slate-800">
                          {gameState.street === 'waiting'
                            ? '等待房主开局...'
                            : '即将发下一手牌...'}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* ==================================================================
              SEAT NODES AROUND THE TABLE (0 .. maxSeats - 1)
          ================================================================== */}
          {Array.from({ length: maxSeats }, (_, actualSeatIndex) => {
            const visualIndex =
              (actualSeatIndex - baseSeatOffset + maxSeats) % maxSeats;
            const posStyle = getVisualSeatPosition(
              visualIndex,
              maxSeats,
              isMobile
            );
            const seatedPlayer = gameState.players.find(
              (p) => p.seat === actualSeatIndex
            );
            const winnerInfo = seatedPlayer
              ? gameState.winners.find((w) => w.playerId === seatedPlayer.id)
              : undefined;

            return (
              <SeatNode
                key={actualSeatIndex}
                seatIndex={actualSeatIndex}
                positionStyle={posStyle}
                isMobile={isMobile}
                player={seatedPlayer}
                isMe={seatedPlayer?.id === playerId}
                amISeated={!!myPlayer}
                isHost={isHost}
                isDealer={
                  gameState.street !== 'waiting' &&
                  gameState.dealerSeat === actualSeatIndex
                }
                isSmallBlind={
                  gameState.street !== 'waiting' &&
                  gameState.smallBlindSeat === actualSeatIndex
                }
                isBigBlind={
                  gameState.street !== 'waiting' &&
                  gameState.bigBlindSeat === actualSeatIndex
                }
                isActiveTurn={
                  gameState.street !== 'waiting' &&
                  gameState.street !== 'showdown' &&
                  gameState.activeSeat === actualSeatIndex
                }
                turnDeadline={gameState.turnDeadline}
                actionTimeSeconds={gameState.config.actionTimeSeconds}
                bigBlindAmount={currentBB}
                showStackInBB={showStackInBB}
                fourColorDeck={fourColorDeck}
                winnerInfo={winnerInfo}
                winningCards={allWinningCards}
                floatingEmoji={seatEmojis[actualSeatIndex]}
                canModifySeats={canModifySeats}
                onTakeSeat={handleTakeSeatClick}
                onOpenAddBot={(s) => setAddBotSeat(s)}
                onRemoveBot={(s) => sendMessage({ type: 'REMOVE_BOT', seat: s })}
              />
            );
          })}
        </div>
      </main>

      {/* ====================================================================
          BOTTOM PLAYER CONTROLS & COLLAPSIBLE LOG/CHAT PANEL
      ==================================================================== */}
      <footer className="shrink-0 relative w-full px-2 sm:px-6 pb-1.5 sm:pb-2.5 pt-0.5 space-y-1 sm:space-y-1.5 z-30">
        <ActionControls
          state={gameState}
          myPlayer={myPlayer}
          bigBlind={currentBB}
          onAction={(action: PlayerActionType, amount?: number) => {
            if (action === 'fold') sound.playFold();
            else if (action === 'check') sound.playCheck();
            else sound.playChip();
            sendMessage({ type: 'PLAYER_ACTION', action, amount });
          }}
          onShowCards={(cardIndices) =>
            sendMessage({ type: 'SHOW_CARDS', cardIndices })
          }
          onRabbitHunt={() => sendMessage({ type: 'TRIGGER_RABBIT_HUNT' })}
          onRequestTimebank={() => sendMessage({ type: 'REQUEST_TIMEBANK' })}
          onOpenRebuy={() => setRebuyModalOpen(true)}
          onToggleSitOut={() => sendMessage({ type: 'TOGGLE_SIT_OUT' })}
          onLeaveSeat={() => sendMessage({ type: 'LEAVE_SEAT' })}
          onSendQuickEmoji={(emoji, label) =>
            sendMessage({ type: 'SEND_CHAT', text: label, emoji })
          }
        />

        {/* Action Log & Chat Box (Floating overlay when expanded so it never pushes viewport height!) */}
        <div className="relative w-full max-w-5xl mx-auto rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md">
          {mobileDrawerOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl overflow-hidden z-40 backdrop-blur-xl">
              {activeBottomTab === 'log' ? (
                <div className="h-32 overflow-y-auto px-3 py-2 space-y-1 font-mono text-[11px] sm:text-xs text-slate-300">
                  {gameState.actionLog.map((line, i) => (
                    <div key={i} className="leading-relaxed">
                      {line}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              ) : (
                <div className="p-2.5 flex flex-col gap-2">
                  <div className="h-24 overflow-y-auto px-2 space-y-1 text-xs">
                    {gameState.chatMessages.length === 0 ? (
                      <div className="text-slate-500 py-2">
                        暂无聊天消息，发个表情或打个招呼吧~
                      </div>
                    ) : (
                      gameState.chatMessages.map((m) => (
                        <div key={m.id}>
                          <span className="font-bold text-amber-300">
                            {m.senderName}:{' '}
                          </span>
                          <span className="text-slate-200">
                            {m.emoji ? `${m.emoji} ` : ''}
                            {m.text}
                          </span>
                        </div>
                      ))
                    )}
                    <div ref={logEndRef} />
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!chatInput.trim()) return;
                      sendMessage({ type: 'SEND_CHAT', text: chatInput.trim() });
                      setChatInput('');
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="输入聊天消息按回车发送..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 px-3 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      发送
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Compact Single-Line Ticker & Tab Bar */}
          <div className="flex items-center justify-between px-2.5 py-1 bg-slate-950/80 rounded-xl text-[11px] sm:text-xs">
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => {
                  if (activeBottomTab === 'log' && mobileDrawerOpen) {
                    setMobileDrawerOpen(false);
                  } else {
                    setActiveBottomTab('log');
                    setMobileDrawerOpen(true);
                  }
                }}
                className={`flex items-center gap-1 font-bold cursor-pointer transition ${
                  activeBottomTab === 'log' && mobileDrawerOpen
                    ? 'text-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ScrollText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>播报</span>
              </button>
              <button
                onClick={() => {
                  if (activeBottomTab === 'chat' && mobileDrawerOpen) {
                    setMobileDrawerOpen(false);
                  } else {
                    setActiveBottomTab('chat');
                    setMobileDrawerOpen(true);
                  }
                }}
                className={`flex items-center gap-1 font-bold cursor-pointer transition ${
                  activeBottomTab === 'chat' && mobileDrawerOpen
                    ? 'text-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>聊天({gameState.chatMessages.length})</span>
              </button>
            </div>

            {/* Latest log ticker in the middle */}
            <div
              onClick={() => setMobileDrawerOpen((v) => !v)}
              className="flex-1 mx-2 truncate text-[11px] text-slate-300 font-mono text-right cursor-pointer"
              title="点击展开/收起牌局记录"
            >
              {latestLogLine}
            </div>

            <button
              onClick={() => setMobileDrawerOpen((v) => !v)}
              className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
              title="展开/收起记录面板"
            >
              {mobileDrawerOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* ====================================================================
          MODALS
      ==================================================================== */}
      <SettingsModal
        config={gameState.config}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(partial: Partial<TableConfig>) =>
          sendMessage({ type: 'UPDATE_CONFIG', config: partial })
        }
      />

      <AddBotModal
        isOpen={addBotSeat !== null}
        targetSeat={addBotSeat}
        emptySeats={emptySeats}
        onClose={() => setAddBotSeat(null)}
        onAddBot={(
          seat: number,
          style: BotStyle,
          strength: BotStrength,
          name?: string,
          hidePrefix?: boolean
        ) =>
          sendMessage({
            type: 'ADD_BOT',
            seat,
            style,
            strength,
            name,
            hidePrefix,
          })
        }
      />

      <LedgerModal
        isOpen={ledgerOpen}
        ledger={gameState.ledger}
        roomId={gameState.roomId}
        mode={gameState.config.mode}
        handNumber={gameState.handNumber}
        onClose={() => setLedgerOpen(false)}
      />

      <BuyInModal
        isOpen={buyInTargetSeat !== null}
        title={`入座 #${(buyInTargetSeat ?? 0) + 1} 号位 - 选择带入筹码`}
        minAmount={gameState.config.minBuyIn}
        maxAmount={gameState.config.maxBuyIn}
        defaultAmount={gameState.config.startingChips}
        onClose={() => setBuyInTargetSeat(null)}
        onConfirm={(amount) => {
          if (buyInTargetSeat !== null) {
            sendMessage({ type: 'TAKE_SEAT', seat: buyInTargetSeat, buyIn: amount });
          }
        }}
      />

      <BuyInModal
        isOpen={rebuyModalOpen}
        title="常规桌补充筹码 (Rebuy / Top-Up)"
        minAmount={100}
        maxAmount={gameState.config.maxBuyIn}
        defaultAmount={gameState.config.startingChips}
        onClose={() => setRebuyModalOpen(false)}
        onConfirm={(amount) => sendMessage({ type: 'REBUY', amount })}
      />
    </div>
  );
};
