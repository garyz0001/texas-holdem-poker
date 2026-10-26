import { BlindLevel, BotStrength, BotStyle, Card, Rank, Suit, TableConfig } from './types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export const SUIT_NAMES_ZH: Record<Suit, string> = {
  s: '黑桃',
  h: '红桃',
  d: '方块',
  c: '梅花',
};

export const RANK_LABELS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function formatCard(card: Card): string {
  return `${SUIT_SYMBOLS[card.suit]}${RANK_LABELS[card.rank]}`;
}

export const DEFAULT_SNG_LEVELS: BlindLevel[] = [
  { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
  { level: 2, smallBlind: 15, bigBlind: 30, ante: 0 },
  { level: 3, smallBlind: 25, bigBlind: 50, ante: 5 },
  { level: 4, smallBlind: 50, bigBlind: 100, ante: 10 },
  { level: 5, smallBlind: 75, bigBlind: 150, ante: 15 },
  { level: 6, smallBlind: 100, bigBlind: 200, ante: 25 },
  { level: 7, smallBlind: 150, bigBlind: 300, ante: 30 },
  { level: 8, smallBlind: 200, bigBlind: 400, ante: 50 },
  { level: 9, smallBlind: 300, bigBlind: 600, ante: 75 },
  { level: 10, smallBlind: 500, bigBlind: 1000, ante: 100 },
  { level: 11, smallBlind: 800, bigBlind: 1600, ante: 200 },
  { level: 12, smallBlind: 1000, bigBlind: 2000, ante: 250 },
];

export const SNG_BLIND_PRESETS: Record<string, { label: string; desc: string; levels: BlindLevel[]; minutes: number; hands: number }> = {
  turbo: {
    label: '闪电赛 (Turbo)',
    desc: '盲注翻倍快，适合 15-20 分钟快速决出冠军',
    minutes: 3,
    hands: 5,
    levels: [
      { level: 1, smallBlind: 10, bigBlind: 20, ante: 0 },
      { level: 2, smallBlind: 20, bigBlind: 40, ante: 5 },
      { level: 3, smallBlind: 40, bigBlind: 80, ante: 10 },
      { level: 4, smallBlind: 75, bigBlind: 150, ante: 15 },
      { level: 5, smallBlind: 150, bigBlind: 300, ante: 30 },
      { level: 6, smallBlind: 300, bigBlind: 600, ante: 60 },
      { level: 7, smallBlind: 500, bigBlind: 1000, ante: 100 },
      { level: 8, smallBlind: 1000, bigBlind: 2000, ante: 200 },
    ],
  },
  standard: {
    label: '标准赛 (Standard)',
    desc: '经典单桌 SNG 盲注结构，攻守兼备',
    minutes: 5,
    hands: 8,
    levels: DEFAULT_SNG_LEVELS,
  },
  deep: {
    label: '深筹赛 (Deepstack)',
    desc: '盲注平滑上升，更多翻牌后技术博弈空间',
    minutes: 8,
    hands: 12,
    levels: [
      { level: 1, smallBlind: 5, bigBlind: 10, ante: 0 },
      { level: 2, smallBlind: 10, bigBlind: 20, ante: 0 },
      { level: 3, smallBlind: 15, bigBlind: 30, ante: 0 },
      { level: 4, smallBlind: 20, bigBlind: 40, ante: 5 },
      { level: 5, smallBlind: 30, bigBlind: 60, ante: 5 },
      { level: 6, smallBlind: 50, bigBlind: 100, ante: 10 },
      { level: 7, smallBlind: 75, bigBlind: 150, ante: 15 },
      { level: 8, smallBlind: 100, bigBlind: 200, ante: 20 },
      { level: 9, smallBlind: 150, bigBlind: 300, ante: 30 },
      { level: 10, smallBlind: 250, bigBlind: 500, ante: 50 },
      { level: 11, smallBlind: 400, bigBlind: 800, ante: 80 },
      { level: 12, smallBlind: 600, bigBlind: 1200, ante: 120 },
    ],
  },
};

export const DEFAULT_TABLE_CONFIG: TableConfig = {
  roomName: '好友德扑俱乐部',
  mode: 'cash',
  maxSeats: 6,
  startingChips: 2000,
  minBuyIn: 1000,
  maxBuyIn: 5000,
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  actionTimeSeconds: 30,
  sngBlindMode: 'hands',
  sngLevelDurationMinutes: 5,
  sngHandsPerLevel: 8,
  sngLevels: DEFAULT_SNG_LEVELS,
  allowRabbitHunt: true,
};

export interface BotStyleMeta {
  style: BotStyle;
  name: string;
  shortTag: string;
  description: string;
  color: string;
  avatar: string;
  defaultNames: string[];
}

export const BOT_STYLE_METADATA: Record<BotStyle, BotStyleMeta> = {
  TAG: {
    style: 'TAG',
    name: '紧凶型 (TAG)',
    shortTag: '紧凶鲨鱼',
    description: '精选起手牌，重视位置与底池赔率，翻后采用蒙特卡洛胜率计算进行价值下注与持续下注(C-Bet)。',
    color: 'emerald',
    avatar: '🦈',
    defaultNames: ['冷面鲨鱼·阿哲', 'GTO教父·老K', '紧凶机器·艾伦', '稳健派·维克多'],
  },
  LAG: {
    style: 'LAG',
    name: '松凶型 (LAG)',
    shortTag: '松凶刺客',
    description: '手牌范围宽，高频3-Bet与翻后激进施压，善于利用听牌半诈唬(Semi-Bluff)迫使对手弃牌。',
    color: 'amber',
    avatar: '🐆',
    defaultNames: ['松凶猎手·丹尼', '激进派·汤姆', '偷鸡大师·杰克', '施压狂人·卢克'],
  },
  STATION: {
    style: 'STATION',
    name: '跟注站 (Station)',
    shortTag: '粘池跟注站',
    description: '极度好奇公共牌，只要有一点牌力或听牌就会一路跟注到底，极难被诈唬走，但很少主动加注。',
    color: 'sky',
    avatar: '🐳',
    defaultNames: ['铁头跟注·老王', '好奇宝宝·阿呆', '不信邪·胖虎', '看牌狂魔·大熊'],
  },
  MANIAC: {
    style: 'MANIAC',
    name: '疯鱼/激进狂 (Maniac)',
    shortTag: '气氛组疯鱼',
    description: '无视牌力频繁大额加注、超池下注甚至全下(All-In)，专门搞乱牌桌节奏，制造超级大底池。',
    color: 'rose',
    avatar: '🃏',
    defaultNames: ['全下狂魔·疯狗', '梭哈战神·盲僧', '气氛组长·浪子', '暴躁老哥·阿飞'],
  },
  NIT: {
    style: 'NIT',
    name: '紧弱/岩石型 (Nit)',
    shortTag: '保守岩石',
    description: '极度保守，只玩顶级强牌(JJ+/AK/AQ)，翻后不中大牌绝不恋战，一旦他加注通常代表持有坚果牌。',
    color: 'slate',
    avatar: '🪨',
    defaultNames: ['万年老铁·石敢当', '等AA专业户·老张', '绝不冒险·老陈', '保守学者·林叔'],
  },
};

export const BOT_STRENGTH_LABELS: Record<BotStrength, { name: string; desc: string }> = {
  novice: {
    name: '初级 (娱乐)',
    desc: '偶有破绽，对底池赔率不够敏感，适合轻松娱乐',
  },
  regular: {
    name: '进阶 (常客)',
    desc: '掌握基本位置感与牌力评估，打法符合所选人设',
  },
  shark: {
    name: '大师 (高强)',
    desc: '深度蒙特卡洛胜率模拟 + 精确赔率与对手范围感知',
  },
};

export const QUICK_EMOJIS = [
  { emoji: '👏', label: 'NH 好牌!' },
  { emoji: '😎', label: '全下梭哈!' },
  { emoji: '🤔', label: '容我想想...' },
  { emoji: '🐔', label: '肯定在偷鸡!' },
  { emoji: '😭', label: '河杀太惨了' },
  { emoji: '🍻', label: 'GG 干杯!' },
  { emoji: '🐟', label: '老板大气!' },
  { emoji: '🔥', label: '手气火热!' },
];
