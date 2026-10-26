import { Card, Rank, Suit } from '../shared/types';
import { RANK_LABELS } from '../shared/constants';

export const ALL_SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const ALL_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle using crypto.getRandomValues when available
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const copy = [...deck];
  const randomBuffer = new Uint32Array(copy.length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(randomBuffer);
    for (let i = copy.length - 1; i > 0; i--) {
      const j = randomBuffer[i] % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  } else {
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
  }
  return copy;
}

export interface EvaluatedHand {
  category: number; // 0=HighCard, 1=OnePair, 2=TwoPair, 3=Trips, 4=Straight, 5=Flush, 6=FullHouse, 7=Quads, 8=StraightFlush, 9=RoyalFlush
  score: number; // Exact comparable integer score
  name: string; // e.g. "葫芦 (A满K)"
  categoryName: string; // e.g. "葫芦"
  bestFive: Card[];
}

export const HAND_CATEGORY_NAMES: Record<number, string> = {
  9: '皇家同花顺',
  8: '同花顺',
  7: '四条 (金刚)',
  6: '葫芦',
  5: '同花',
  4: '顺子',
  3: '三条',
  2: '两对',
  1: '一对',
  0: '高牌',
};

/**
 * Evaluate exactly 5 cards
 */
export function evaluate5Cards(cards: Card[]): EvaluatedHand {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const suits = sorted.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check straight (including A-5-4-3-2 wheel)
  let isStraight = false;
  let straightHigh = 0;
  let orderedFive = sorted;

  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHigh = ranks[0];
  } else if (
    ranks[0] === 14 &&
    ranks[1] === 5 &&
    ranks[2] === 4 &&
    ranks[3] === 3 &&
    ranks[4] === 2
  ) {
    isStraight = true;
    straightHigh = 5;
    // Put Ace at the end for wheel display 5-4-3-2-A
    orderedFive = [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]];
  }

  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        category: 9,
        score: 9 * 1e10 + 14,
        name: '皇家同花顺',
        categoryName: '皇家同花顺',
        bestFive: orderedFive,
      };
    }
    return {
      category: 8,
      score: 8 * 1e10 + straightHigh,
      name: `同花顺 (${RANK_LABELS[straightHigh as Rank]}高)`,
      categoryName: '同花顺',
      bestFive: orderedFive,
    };
  }

  // Count rank frequencies
  const counts = new Map<Rank, number>();
  for (const r of ranks) {
    counts.set(r, (counts.get(r) || 0) + 1);
  }

  // Sort groups by (count DESC, rank DESC)
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  // Reorder cards to match group priority
  const groupedFive = [...sorted].sort((a, b) => {
    const ca = counts.get(a.rank)!;
    const cb = counts.get(b.rank)!;
    if (cb !== ca) return cb - ca;
    return b.rank - a.rank;
  });

  const encodeTiebreaker = (rList: number[]) =>
    rList.reduce((acc, r) => acc * 16 + r, 0);

  if (groups[0][1] === 4) {
    const quadRank = groups[0][0];
    const kicker = groups[1][0];
    return {
      category: 7,
      score: 7 * 1e10 + encodeTiebreaker([quadRank, kicker]),
      name: `四条 (${RANK_LABELS[quadRank]}四条)`,
      categoryName: '四条',
      bestFive: groupedFive,
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    const tripRank = groups[0][0];
    const pairRank = groups[1][0];
    return {
      category: 6,
      score: 6 * 1e10 + encodeTiebreaker([tripRank, pairRank]),
      name: `葫芦 (${RANK_LABELS[tripRank]}满${RANK_LABELS[pairRank]})`,
      categoryName: '葫芦',
      bestFive: groupedFive,
    };
  }

  if (isFlush) {
    return {
      category: 5,
      score: 5 * 1e10 + encodeTiebreaker(ranks),
      name: `同花 (${RANK_LABELS[ranks[0]]}高)`,
      categoryName: '同花',
      bestFive: sorted,
    };
  }

  if (isStraight) {
    return {
      category: 4,
      score: 4 * 1e10 + straightHigh,
      name: `顺子 (${RANK_LABELS[straightHigh as Rank]}高)`,
      categoryName: '顺子',
      bestFive: orderedFive,
    };
  }

  if (groups[0][1] === 3) {
    const tripRank = groups[0][0];
    const kickers = [groups[1][0], groups[2][0]];
    return {
      category: 3,
      score: 3 * 1e10 + encodeTiebreaker([tripRank, ...kickers]),
      name: `三条 (${RANK_LABELS[tripRank]}三条)`,
      categoryName: '三条',
      bestFive: groupedFive,
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = groups[0][0];
    const lowPair = groups[1][0];
    const kicker = groups[2][0];
    return {
      category: 2,
      score: 2 * 1e10 + encodeTiebreaker([highPair, lowPair, kicker]),
      name: `两对 (${RANK_LABELS[highPair]}与${RANK_LABELS[lowPair]})`,
      categoryName: '两对',
      bestFive: groupedFive,
    };
  }

  if (groups[0][1] === 2) {
    const pairRank = groups[0][0];
    const kickers = [groups[1][0], groups[2][0], groups[3][0]];
    return {
      category: 1,
      score: 1 * 1e10 + encodeTiebreaker([pairRank, ...kickers]),
      name: `一对 (${RANK_LABELS[pairRank]}对子)`,
      categoryName: '一对',
      bestFive: groupedFive,
    };
  }

  return {
    category: 0,
    score: encodeTiebreaker(ranks),
    name: `高牌 (${RANK_LABELS[ranks[0]]}高)`,
    categoryName: '高牌',
    bestFive: sorted,
  };
}

/**
 * Evaluate best 5-card hand out of 5 to 7 cards
 */
export function evaluate7Cards(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards to evaluate, got ${cards.length}`);
  }
  if (cards.length === 5) {
    return evaluate5Cards(cards);
  }

  let best: EvaluatedHand | null = null;
  const n = cards.length;

  // Iterate all C(n, 5) combinations (max 21 for n=7)
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const hand = evaluate5Cards([cards[i], cards[j], cards[k], cards[l], cards[m]]);
            if (!best || hand.score > best.score) {
              best = hand;
            }
          }
        }
      }
    }
  }

  return best!;
}

/**
 * Pre-flop Chen-style / Sklansky hand strength score normalized to 0..100
 */
export function evaluatePreflopHoleCards(holeCards: Card[]): number {
  if (holeCards.length !== 2) return 30;
  const [c1, c2] = holeCards[0].rank >= holeCards[1].rank ? holeCards : [holeCards[1], holeCards[0]];
  const high = c1.rank;
  const low = c2.rank;
  const suited = c1.suit === c2.suit;
  const isPair = high === low;

  let base = 0;
  if (high === 14) base = 10;
  else if (high === 13) base = 8;
  else if (high === 12) base = 7;
  else if (high === 11) base = 6;
  else base = high / 2;

  if (isPair) {
    base = Math.max(5, base * 2);
    if (high === 14) return 100;
    if (high === 13) return 96;
    if (high === 12) return 92;
    if (high === 11) return 88;
    if (high === 10) return 84;
  } else {
    if (suited) base += 2;
    const gap = high - low - 1;
    if (gap === 0) {
      if (high < 12) base += 1;
    } else if (gap === 1) {
      base -= 1;
    } else if (gap === 2) {
      base -= 2;
    } else if (gap === 3) {
      base -= 4;
    } else {
      base -= 5;
    }
  }

  // Normalize roughly from [-2..20] to [5..98]
  return Math.max(5, Math.min(98, Math.round(((base + 3) / 21) * 95)));
}

/**
 * Detect flush draw or straight draw on Flop/Turn for AI semi-bluffing
 */
export function detectDraws(holeCards: Card[], communityCards: Card[]): {
  flushDraw: boolean;
  openEndedStraightDraw: boolean;
  gutshotStraightDraw: boolean;
} {
  const all = [...holeCards, ...communityCards];
  if (all.length >= 7 || all.length < 5) {
    return { flushDraw: false, openEndedStraightDraw: false, gutshotStraightDraw: false };
  }

  // Suit counts
  const suitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const c of all) suitCounts[c.suit]++;
  const flushDraw = Object.values(suitCounts).some((count) => count === 4);

  // Straight draw check: test how many distinct ranks from 2..14 complete a 5-card straight
  const existingRanks = new Set<number>(all.map((c) => c.rank));
  let straightCompletingRanks = 0;

  for (let testRank = 2; testRank <= 14; testRank++) {
    if (existingRanks.has(testRank)) continue;
    const ranks = new Set(existingRanks);
    ranks.add(testRank);
    if (ranks.has(14)) ranks.add(1); // Ace low

    let formsStraight = false;
    for (let low = 1; low <= 10; low++) {
      if (
        ranks.has(low) &&
        ranks.has(low + 1) &&
        ranks.has(low + 2) &&
        ranks.has(low + 3) &&
        ranks.has(low + 4)
      ) {
        formsStraight = true;
        break;
      }
    }
    if (formsStraight) straightCompletingRanks++;
  }

  return {
    flushDraw,
    openEndedStraightDraw: straightCompletingRanks >= 2,
    gutshotStraightDraw: straightCompletingRanks === 1,
  };
}

/**
 * Fast Monte Carlo Equity estimator for AI bots
 * Returns estimated probability (0..1) of winning against `numOpponents` random hands
 */
export function estimateHandEquity(
  holeCards: Card[],
  communityCards: Card[],
  numOpponents: number,
  iterations = 120
): number {
  if (holeCards.length < 2) return 0.5;
  const opps = Math.max(1, Math.min(8, numOpponents));

  const usedKey = new Set(
    [...holeCards, ...communityCards].map((c) => `${c.rank}${c.suit}`)
  );
  const remainingDeck = createDeck().filter((c) => !usedKey.has(`${c.rank}${c.suit}`));

  let wins = 0;
  const neededBoard = 5 - communityCards.length;
  const totalDraw = neededBoard + opps * 2;

  for (let iter = 0; iter < iterations; iter++) {
    // Partial Fisher-Yates for only `totalDraw` cards
    for (let i = 0; i < totalDraw; i++) {
      const r = i + Math.floor(Math.random() * (remainingDeck.length - i));
      const tmp = remainingDeck[i];
      remainingDeck[i] = remainingDeck[r];
      remainingDeck[r] = tmp;
    }

    const simBoard = [
      ...communityCards,
      ...remainingDeck.slice(0, neededBoard),
    ];
    const myScore = evaluate7Cards([...holeCards, ...simBoard]).score;

    let beaten = false;
    let tied = false;
    for (let o = 0; o < opps; o++) {
      const oppHole = [
        remainingDeck[neededBoard + o * 2],
        remainingDeck[neededBoard + o * 2 + 1],
      ];
      const oppScore = evaluate7Cards([...oppHole, ...simBoard]).score;
      if (oppScore > myScore) {
        beaten = true;
        break;
      } else if (oppScore === myScore) {
        tied = true;
      }
    }

    if (!beaten) {
      wins += tied ? 0.5 : 1;
    }
  }

  return wins / iterations;
}
