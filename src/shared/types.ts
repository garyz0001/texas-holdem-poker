export type Suit = 's' | 'h' | 'd' | 'c'; // Spades ♠, Hearts ♥, Diamonds ♦, Clubs ♣
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type GameMode = 'cash' | 'sng';

export type Street = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export type BotStyle =
  | 'TAG'       // 紧凶型 (Tight-Aggressive: 稳健鲨鱼，懂位置、赔率、胜率计算)
  | 'LAG'       // 松凶型 (Loose-Aggressive: 激进施压，高频3-bet与半诈唬)
  | 'STATION'   // 跟注站 (Calling Station: 粘池鱼，喜欢看牌，不易被诈唬)
  | 'MANIAC'    // 疯鱼型 (Maniac: 激进狂，大注/全下施压，搞乱牌桌气氛)
  | 'NIT';      // 岩石型 (Nit: 紧弱保守，只玩顶级强牌，遇重注即弃)

export type BotStrength = 'novice' | 'regular' | 'shark';

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface TableConfig {
  roomName: string;
  mode: GameMode;
  maxSeats: number; // 2 to 9
  startingChips: number; // Default buy-in for cash, starting stack for SNG
  minBuyIn: number; // Cash mode min buy-in
  maxBuyIn: number; // Cash mode max buy-in
  smallBlind: number; // Used in cash mode (and level 1 in SNG)
  bigBlind: number;
  ante: number;
  actionTimeSeconds: number; // 0 = unlimited, or 15, 20, 30, 45, 60
  // SNG specific settings
  sngBlindMode: 'time' | 'hands'; // Escalate by minutes or hands played
  sngLevelDurationMinutes: number; // e.g., 5 mins per level
  sngHandsPerLevel: number; // e.g., 8 hands per level
  sngLevels: BlindLevel[];
  allowRabbitHunt: boolean;
}

export type PlayerActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface PlayerState {
  id: string;
  name: string;
  seat: number; // 0 to maxSeats - 1
  chips: number;
  currentBet: number; // Bet in current street
  totalHandBet: number; // Total bet in current hand
  holeCards: Card[]; // Empty or hidden for other players unless revealed
  revealedCards: [boolean, boolean]; // Whether player chose to show card 0 / card 1
  folded: boolean;
  allIn: boolean;
  sittingOut: boolean;
  connected: boolean;
  isBot: boolean;
  botStyle?: BotStyle;
  botStrength?: BotStrength;
  lastAction?: {
    type: PlayerActionType;
    amount?: number;
    label: string;
  };
  eliminatedRank?: number; // In SNG, finishing place (e.g., 3rd, 2nd, 1st)
  pendingRebuy?: number; // Chips queued for next hand
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
  name: string; // 主池 / 边池 1 / 边池 2
}

export interface HandWinnerInfo {
  playerId: string;
  playerName: string;
  amountWon: number;
  potName: string;
  handName?: string; // e.g. "同花顺 (Straight Flush)"
  bestFiveCards?: Card[];
}

export interface LedgerEntry {
  playerId: string;
  playerName: string;
  isBot: boolean;
  botStyle?: BotStyle;
  totalBuyIn: number; // Total chips bought in (initial + rebuys)
  currentChips: number; // Current stack on table (or cashed out stack)
  netProfit: number; // currentChips - totalBuyIn
  handsPlayed: number;
  handsWon: number;
  vpipCount: number; // Voluntarily Put chips In Pot
  pfrCount: number; // Pre-Flop Raise
  sngRank?: number;
  activeOnTable: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  emoji?: string;
}

export interface PublicGameState {
  roomId: string;
  hostId: string;
  config: TableConfig;
  street: Street;
  handNumber: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  activeSeat: number | null;
  turnDeadline: number | null; // epoch ms when current turn expires
  communityCards: Card[];
  rabbitCards: Card[]; // Remaining undealt board cards if Rabbit Hunt triggered
  rabbitHuntRevealed: boolean;
  pot: number;
  sidePots: SidePot[];
  currentHighestBet: number;
  minRaiseAmount: number; // Minimum total bet to raise to
  lastFullRaiseSize: number;
  players: PlayerState[];
  winners: HandWinnerInfo[];
  ledger: Record<string, LedgerEntry>;
  actionLog: string[];
  chatMessages: ChatMessage[];
  // SNG state
  sngStarted: boolean;
  sngFinished: boolean;
  sngCurrentLevelIndex: number;
  sngLevelStartTime: number | null;
  sngNextBlindIncreaseAt: number | null; // timestamp for time-based SNG
  paused: boolean;
}

export type ClientMessage =
  | { type: 'JOIN_ROOM'; name: string; playerId: string }
  | { type: 'TAKE_SEAT'; seat: number; buyIn?: number }
  | { type: 'LEAVE_SEAT' }
  | { type: 'ADD_BOT'; seat: number; style: BotStyle; strength: BotStrength; name?: string }
  | { type: 'REMOVE_BOT'; seat: number }
  | { type: 'UPDATE_CONFIG'; config: Partial<TableConfig> }
  | { type: 'START_GAME' }
  | { type: 'PAUSE_GAME'; paused: boolean }
  | { type: 'NEXT_HAND' }
  | { type: 'RESET_SNG' }
  | { type: 'PLAYER_ACTION'; action: PlayerActionType; amount?: number }
  | { type: 'REBUY'; amount: number }
  | { type: 'TOGGLE_SIT_OUT' }
  | { type: 'SHOW_CARDS'; cardIndices: [boolean, boolean] }
  | { type: 'TRIGGER_RABBIT_HUNT' }
  | { type: 'SEND_CHAT'; text: string; emoji?: string }
  | { type: 'REQUEST_TIMEBANK' };

export type ServerMessage =
  | { type: 'STATE_UPDATE'; state: PublicGameState; yourPlayerId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'EMOJI_ANIMATION'; fromSeat: number; emoji: string; senderName: string };
