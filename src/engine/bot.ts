import {
  Card,
  PlayerActionType,
  PlayerState,
  PublicGameState,
} from '../shared/types';
import {
  detectDraws,
   estimateHandEquity,
  evaluate7Cards,
  evaluatePreflopHoleCards,
} from './evaluator';

export interface BotDecision {
  action: PlayerActionType;
  amount?: number;
  chatBubble?: string;
}

/**
 * Compute legal action for a bot based on its style (TAG, LAG, STATION, MANIAC, NIT)
 * and strength (novice, regular, shark).
 */
export function decideBotAction(
  state: PublicGameState,
  bot: PlayerState
): BotDecision {
  const style = bot.botStyle || 'TAG';
  const strength = bot.botStrength || 'regular';
  const bb = Math.max(1, state.config.mode === 'sng'
    ? (state.config.sngLevels[state.sngCurrentLevelIndex]?.bigBlind || state.config.bigBlind)
    : state.config.bigBlind);

  const toCall = Math.max(0, state.currentHighestBet - bot.currentBet);
  const canCheck = toCall === 0;
  const activeOpponents = state.players.filter(
    (p) => p.id !== bot.id && !p.folded && p.holeCards.length > 0
  ).length;

  // Determine late position bonus (Button or Cutoff)
  const activeSeats = state.players.filter((p) => !p.folded).map((p) => p.seat);
  const isLatePosition =
    bot.seat === state.dealerSeat || activeSeats.length <= 3;

  // Iterations based on bot strength
  const mcIterations =
    strength === 'shark' ? 180 : strength === 'regular' ? 90 : 35;

  // Add slight noise for novice bots so they misjudge hand strength occasionally
  const noise =
    strength === 'novice'
      ? (Math.random() - 0.5) * 0.18
      : strength === 'regular'
      ? (Math.random() - 0.5) * 0.06
      : 0;

  const totalPot = state.pot + toCall;
  const potOdds = toCall > 0 ? toCall / Math.max(1, totalPot) : 0;

  // Helper to construct a legal raise/bet amount (total bet on current street)
  const makeRaiseDecision = (desiredTotalBet: number, bubble?: string): BotDecision => {
    const maxTotalBet = bot.currentBet + bot.chips;
    const minTotalRaise = Math.max(
      state.minRaiseAmount,
      state.currentHighestBet + bb
    );

    if (maxTotalBet <= state.currentHighestBet) {
      // Cannot even raise, only call all-in
      return { action: 'allin', chatBubble: bubble };
    }

    if (desiredTotalBet >= maxTotalBet || minTotalRaise >= maxTotalBet) {
      return { action: 'allin', chatBubble: bubble };
    }

    // Round to nearest small blind / chip unit
    const step = Math.max(1, Math.floor(bb / 2));
    const rounded = Math.round(desiredTotalBet / step) * step;
    const clamped = Math.max(minTotalRaise, Math.min(maxTotalBet, rounded));

    if (clamped >= maxTotalBet) {
      return { action: 'allin', chatBubble: bubble };
    }

    return {
      action: state.currentHighestBet === 0 ? 'bet' : 'raise',
      amount: clamped,
      chatBubble: bubble,
    };
  };

  const makeCallOrCheck = (bubble?: string): BotDecision => {
    if (canCheck) return { action: 'check', chatBubble: bubble };
    if (toCall >= bot.chips) return { action: 'allin', chatBubble: bubble };
    return { action: 'call', chatBubble: bubble };
  };

  const makeFoldOrCheck = (): BotDecision => {
    if (canCheck) return { action: 'check' };
    return { action: 'fold' };
  };

  // =========================================================================
  // PRE-FLOP LOGIC
  // =========================================================================
  if (state.street === 'preflop') {
    const rawPreScore = evaluatePreflopHoleCards(bot.holeCards);
    const posBonus = isLatePosition ? 6 : 0;
    const preScore = Math.max(0, Math.min(100, rawPreScore + posBonus + noise * 45));

    const isUnopened = state.currentHighestBet <= bb;
    const facingBigRaise = toCall > bb * 4;
    const stackInBB = bot.chips / bb;

    // Short stack Push/Fold mode (< 11 BB in SNG or Cash)
    if (stackInBB <= 11 && preScore >= (style === 'NIT' ? 68 : style === 'TAG' ? 58 : 48)) {
      return { action: 'allin', chatBubble: Math.random() < 0.25 ? '短码拼了！全下！' : undefined };
    }

    switch (style) {
      case 'NIT': {
        // Only plays premium hands (preScore >= 68, e.g. 99+, AJs+, AQ+, KQs)
        if (preScore >= 85) {
          return makeRaiseDecision(Math.max(state.currentHighestBet * 3, bb * 3));
        }
        if (preScore >= 68) {
          if (facingBigRaise && preScore < 78) return makeFoldOrCheck();
          if (isUnopened) return makeRaiseDecision(bb * 3);
          return makeCallOrCheck();
        }
        if (canCheck) return { action: 'check' };
        if (toCall <= bb && preScore >= 52) return makeCallOrCheck();
        return makeFoldOrCheck();
      }

      case 'TAG': {
        // Plays strong hands, respects big 3-bets unless holding premium
        if (preScore >= 82) {
          const target = isUnopened ? bb * 3 : state.currentHighestBet * 2.8;
          return makeRaiseDecision(target);
        }
        if (preScore >= 60) {
          if (facingBigRaise && preScore < 74) return makeFoldOrCheck();
          if (isUnopened) return makeRaiseDecision(bb * 2.5);
          return makeCallOrCheck();
        }
        if (preScore >= 46 && isLatePosition && isUnopened) {
          return makeRaiseDecision(bb * 2.2);
        }
        if (toCall <= bb && preScore >= 42) {
          return makeCallOrCheck();
        }
        return makeFoldOrCheck();
      }

      case 'LAG': {
        // Wide opening range, frequent 3-bets and isolation raises
        if (preScore >= 72) {
          const target = isUnopened ? bb * 3 : state.currentHighestBet * 3;
          return makeRaiseDecision(target);
        }
        if (preScore >= 44) {
          if (isUnopened || (Math.random() < 0.45 && toCall <= bb * 4)) {
            return makeRaiseDecision(Math.max(bb * 2.8, state.currentHighestBet * 2.5));
          }
          if (!facingBigRaise || preScore >= 60) {
            return makeCallOrCheck();
          }
        }
        if (isLatePosition && isUnopened && Math.random() < 0.35) {
          return makeRaiseDecision(bb * 2.5, Math.random() < 0.15 ? '偷个盲注~' : undefined);
        }
        return makeFoldOrCheck();
      }

      case 'STATION': {
        // Calls a super wide range pre-flop, only raises monster hands
        if (preScore >= 88) {
          return makeRaiseDecision(bb * 3);
        }
        if (preScore >= 32 && toCall <= bot.chips * 0.35) {
          return makeCallOrCheck();
        }
        if (toCall <= bb * 2 && preScore >= 24) {
          return makeCallOrCheck();
        }
        return makeFoldOrCheck();
      }

      case 'MANIAC': {
        // Raises and bluffs constantly
        if (preScore >= 65 || Math.random() < 0.52) {
          const mult = 3 + Math.floor(Math.random() * 3);
          const target = isUnopened ? bb * mult : state.currentHighestBet * 2.6;
          if (Math.random() < 0.15 && stackInBB < 35) {
            return { action: 'allin', chatBubble: '敢跟吗？梭哈！🔥' };
          }
          return makeRaiseDecision(target);
        }
        if (preScore >= 28 || toCall <= bb * 3) {
          return makeCallOrCheck();
        }
        return makeFoldOrCheck();
      }
    }
  }

  // =========================================================================
  // POST-FLOP LOGIC (FLOP, TURN, RIVER)
  // =========================================================================
  const rawEquity = estimateHandEquity(
    bot.holeCards,
    state.communityCards,
    activeOpponents,
    mcIterations
  );
  const equity = Math.max(0.02, Math.min(0.99, rawEquity + noise));
  const draws = detectDraws(bot.holeCards, state.communityCards);
  const hasStrongDraw = draws.flushDraw || draws.openEndedStraightDraw;
  const evaluated = evaluate7Cards([...bot.holeCards, ...state.communityCards]);

  // Required equity margin compared to pot odds
  const profitableCall = equity >= potOdds - (hasStrongDraw ? 0.08 : 0);

  switch (style) {
    case 'NIT': {
      // Only bets/raises with strong made hands (high equity >= 0.72)
      if (equity >= 0.78) {
        return makeRaiseDecision(bot.currentBet + Math.max(bb * 2, Math.floor(state.pot * 0.65)));
      }
      if (equity >= 0.56 && (canCheck || toCall <= state.pot * 0.5)) {
        if (canCheck && equity >= 0.66) {
          return makeRaiseDecision(bot.currentBet + Math.floor(state.pot * 0.5));
        }
        return makeCallOrCheck();
      }
      if (hasStrongDraw && toCall <= state.pot * 0.25) {
        return makeCallOrCheck();
      }
      return makeFoldOrCheck();
    }

    case 'TAG': {
      // Value bets strong hands, semi-bluffs strong draws in position, respects pot odds
      if (equity >= 0.72) {
        const size = Math.floor(state.pot * (0.65 + Math.random() * 0.2));
        return makeRaiseDecision(state.currentHighestBet + Math.max(bb * 2, size));
      }
      if (equity >= 0.54) {
        if (canCheck) {
          // C-bet or value bet ~60% pot
          return makeRaiseDecision(bot.currentBet + Math.max(bb, Math.floor(state.pot * 0.58)));
        }
        if (profitableCall && toCall <= bot.chips * 0.6) {
          return makeCallOrCheck();
        }
      }
      if (hasStrongDraw) {
        if (canCheck && isLatePosition && Math.random() < 0.55) {
          // Semi-bluff
          return makeRaiseDecision(bot.currentBet + Math.max(bb, Math.floor(state.pot * 0.55)));
        }
        if (profitableCall) {
          return makeCallOrCheck();
        }
      }
      // Occasional C-bet bluff on dry flop when checked to
      if (canCheck && state.street === 'flop' && isLatePosition && Math.random() < 0.28) {
        return makeRaiseDecision(bot.currentBet + Math.max(bb, Math.floor(state.pot * 0.45)));
      }
      if (profitableCall && equity >= 0.36 && toCall <= state.pot * 0.35) {
        return makeCallOrCheck();
      }
      return makeFoldOrCheck();
    }

    case 'LAG': {
      // Aggressive post-flop: bets draws, barrels turns/rivers, raises weak bets
      if (equity >= 0.64 || (hasStrongDraw && Math.random() < 0.65)) {
        const size = Math.floor(state.pot * (0.7 + Math.random() * 0.25));
        return makeRaiseDecision(state.currentHighestBet + Math.max(bb * 2, size));
      }
      if (canCheck) {
        if (equity >= 0.42 || Math.random() < 0.48) {
          return makeRaiseDecision(bot.currentBet + Math.max(bb, Math.floor(state.pot * 0.65)));
        }
        return { action: 'check' };
      }
      // Facing a bet: call or bluff-raise occasionally
      if (Math.random() < 0.22 && toCall <= state.pot * 0.6 && bot.chips > toCall * 3) {
        return makeRaiseDecision(state.currentHighestBet * 2.4, Math.random() < 0.2 ? '这点注不够看！' : undefined);
      }
      if (profitableCall || (equity >= 0.32 && toCall <= state.pot * 0.5)) {
        return makeCallOrCheck();
      }
      return makeFoldOrCheck();
    }

    case 'STATION': {
      // Calling station: checks to trap or call down with any pair/draw/Ace-high
      if (evaluated.category >= 3 || equity >= 0.85) {
        // Trips or better: finally raises!
        return makeRaiseDecision(state.currentHighestBet + Math.max(bb * 2, Math.floor(state.pot * 0.6)));
      }
      if (canCheck) {
        if (equity >= 0.68 && Math.random() < 0.5) {
          return makeRaiseDecision(bot.currentBet + Math.max(bb, Math.floor(state.pot * 0.4)));
        }
        return { action: 'check' };
      }
      // Calls if has any pair (category >= 1), any draw, or reasonable equity
      if (
        evaluated.category >= 1 ||
        hasStrongDraw ||
        draws.gutshotStraightDraw ||
        equity >= 0.24 ||
        toCall <= bb * 2
      ) {
        return makeCallOrCheck(Math.random() < 0.15 ? '我跟！看看你有什么牌👀' : undefined);
      }
      return makeFoldOrCheck();
    }

    case 'MANIAC': {
      // Bets and raises relentlessly
      if (equity >= 0.45 || hasStrongDraw || Math.random() < 0.58) {
        const potMult = 0.75 + Math.random() * 0.65;
        const target = state.currentHighestBet + Math.max(bb * 2, Math.floor(state.pot * potMult));
        return makeRaiseDecision(target, Math.random() < 0.18 ? '加注！怕了就弃牌！💥' : undefined);
      }
      if (equity >= 0.22 || toCall <= state.pot * 0.5) {
        return makeCallOrCheck();
      }
      return makeFoldOrCheck();
    }
  }
}
