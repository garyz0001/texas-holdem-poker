import {
  BOT_STYLE_METADATA,
  DEFAULT_TABLE_CONFIG,
  formatCard,
} from '../shared/constants';
import {
  BotStrength,
  BotStyle,
  Card,
  ChatMessage,
  HandWinnerInfo,
  LedgerEntry,
  PlayerActionType,
  PlayerState,
  PublicGameState,
  SidePot,
  Street,
  TableConfig,
} from '../shared/types';
import { decideBotAction } from './bot';
import {
  calculateAllInEquities,
  createDeck,
  evaluate7Cards,
  shuffleDeck,
} from './evaluator';

export class PokerTableEngine {
  public roomId: string;
  public hostId: string = '';
  public config: TableConfig;
  public street: Street = 'waiting';
  public handNumber: number = 0;
  public dealerSeat: number = -1;
  public smallBlindSeat: number = -1;
  public bigBlindSeat: number = -1;
  public activeSeat: number | null = null;
  public turnDeadline: number | null = null;

  public deck: Card[] = [];
  public communityCards: Card[] = [];
  public rabbitCards: Card[] = [];
  public rabbitHuntRevealed: boolean = false;
  public allInRunout: boolean = false;
  public enableDramaticRunout: boolean = false;

  public pot: number = 0;
  public sidePots: SidePot[] = [];
  public currentHighestBet: number = 0;
  public minRaiseAmount: number = 0;
  public lastFullRaiseSize: number = 0;

  public players: PlayerState[] = [];
  public winners: HandWinnerInfo[] = [];
  public ledger: Record<string, LedgerEntry> = {};
  public actionLog: string[] = [];
  public chatMessages: ChatMessage[] = [];

  // SNG state
  public sngStarted: boolean = false;
  public sngFinished: boolean = false;
  public sngCurrentLevelIndex: number = 0;
  public sngLevelStartTime: number | null = null;
  public sngNextBlindIncreaseAt: number | null = null;
  public paused: boolean = false;

  // Internal hand tracking
  private seatsToAct: Set<number> = new Set();
  private handStartStacks: Map<string, number> = new Map();
  private vpipRecordedThisHand: Set<string> = new Set();
  private pfrRecordedThisHand: Set<string> = new Set();

  constructor(roomId: string, customConfig?: Partial<TableConfig>) {
    this.roomId = roomId;
    this.config = {
      ...DEFAULT_TABLE_CONFIG,
      ...customConfig,
      sngLevels: customConfig?.sngLevels
        ? [...customConfig.sngLevels]
        : [...DEFAULT_TABLE_CONFIG.sngLevels],
    };
    this.addLog(`🎉 房间 [${this.roomId}] 已创建，等待牌友入座...`);
  }

  public addLog(text: string) {
    const time = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    this.actionLog.push(`[${time}] ${text}`);
    if (this.actionLog.length > 120) {
      this.actionLog.shift();
    }
  }

  public addChatMessage(senderId: string, senderName: string, text: string, emoji?: string, isSystem = false) {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId,
      senderName,
      text,
      timestamp: Date.now(),
      isSystem,
      emoji,
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 80) {
      this.chatMessages.shift();
    }
  }

  public getCurrentBlinds(): { sb: number; bb: number; ante: number; level: number } {
    if (this.config.mode === 'sng') {
      const levels = this.config.sngLevels;
      const idx = Math.min(this.sngCurrentLevelIndex, levels.length - 1);
      const lvl = levels[idx] || {
        level: 1,
        smallBlind: this.config.smallBlind,
        bigBlind: this.config.bigBlind,
        ante: this.config.ante,
      };
      return {
        sb: lvl.smallBlind,
        bb: lvl.bigBlind,
        ante: lvl.ante,
        level: lvl.level,
      };
    }
    return {
      sb: this.config.smallBlind,
      bb: this.config.bigBlind,
      ante: this.config.ante,
      level: 1,
    };
  }

  public registerPlayerConnection(playerId: string, name: string) {
    if (!this.hostId) {
      this.hostId = playerId;
    }
    const existing = this.players.find((p) => p.id === playerId);
    if (existing) {
      existing.name = name || existing.name;
      existing.connected = true;
    }
    if (this.ledger[playerId]) {
      this.ledger[playerId].playerName = name || this.ledger[playerId].playerName;
    }
  }

  public markPlayerDisconnected(playerId: string) {
    const existing = this.players.find((p) => p.id === playerId);
    if (existing) {
      existing.connected = false;
    }
  }

  public updateConfig(requesterId: string, partial: Partial<TableConfig>): string | null {
    if (requesterId !== this.hostId) {
      return '只有房主可以修改牌桌设置';
    }
    if (this.street !== 'waiting' && this.street !== 'showdown') {
      return '请等待当前手牌结束后再修改设置';
    }

    const oldMode = this.config.mode;
    const newMaxSeats = partial.maxSeats
      ? Math.max(2, Math.min(9, partial.maxSeats))
      : this.config.maxSeats;

    // Ensure no seated player is beyond newMaxSeats
    const maxOccupiedSeat = this.players.reduce((m, p) => Math.max(m, p.seat), -1);
    if (maxOccupiedSeat >= newMaxSeats) {
      return `当前座位 ${maxOccupiedSeat + 1} 有人入座，无法将最大人数缩减到 ${newMaxSeats}`;
    }

    this.config = {
      ...this.config,
      ...partial,
      maxSeats: newMaxSeats,
    };

    if (oldMode !== this.config.mode) {
      this.sngStarted = false;
      this.sngFinished = false;
      this.sngCurrentLevelIndex = 0;
    }

    this.addLog(
      `⚙️ 房主更新了设置：${this.config.mode === 'sng' ? '单桌锦标赛(SNG)' : '常规桌'} | ${this.config.maxSeats}人桌 | 盲注 ${this.config.smallBlind}/${this.config.bigBlind}`
    );
    return null;
  }

  public takeSeat(
    playerId: string,
    name: string,
    seat: number,
    buyIn?: number
  ): string | null {
    if (seat < 0 || seat >= this.config.maxSeats) {
      return '无效的座位号';
    }
    if (this.players.some((p) => p.seat === seat)) {
      return '该座位已被占用';
    }
    if (this.players.some((p) => p.id === playerId)) {
      return '您已经在牌桌上入座了';
    }
    if (this.config.mode === 'sng' && this.sngStarted && !this.sngFinished) {
      return '单桌锦标赛已经开始，无法中途入座';
    }

    let chips = this.config.startingChips;
    if (this.config.mode === 'cash' && buyIn !== undefined) {
      chips = Math.max(
        this.config.minBuyIn,
        Math.min(this.config.maxBuyIn, Math.floor(buyIn))
      );
    }

    const isHandActive = this.street !== 'waiting' && this.street !== 'showdown';

    const newPlayer: PlayerState = {
      id: playerId,
      name: name.trim() || '神秘牌友',
      seat,
      chips,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      revealedCards: [false, false],
      folded: isHandActive, // Wait until next hand if joining mid-hand
      allIn: false,
      sittingOut: false,
      connected: true,
      isBot: false,
    };

    this.players.push(newPlayer);
    this.players.sort((a, b) => a.seat - b.seat);

    if (!this.hostId) {
      this.hostId = playerId;
    }

    // Update ledger
    const prevLedger = this.ledger[playerId];
    if (prevLedger) {
      prevLedger.totalBuyIn += chips;
      prevLedger.currentChips = chips;
      prevLedger.netProfit = prevLedger.currentChips - prevLedger.totalBuyIn;
      prevLedger.activeOnTable = true;
    } else {
      this.ledger[playerId] = {
        playerId,
        playerName: newPlayer.name,
        isBot: false,
        totalBuyIn: chips,
        currentChips: chips,
        netProfit: 0,
        handsPlayed: 0,
        handsWon: 0,
        vpipCount: 0,
        pfrCount: 0,
        activeOnTable: true,
      };
    }

    this.addLog(`🪑 ${newPlayer.name} 入座了 #${seat + 1} 号位 (带入 ${chips})`);
    return null;
  }

  public leaveSeat(playerId: string): string | null {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return '您当前未入座';

    const player = this.players[idx];

    // If hand is active and player hasn't folded, fold them first
    if (this.street !== 'waiting' && this.street !== 'showdown' && !player.folded) {
      this.handlePlayerAction(playerId, 'fold');
    }

    if (this.ledger[playerId]) {
      this.ledger[playerId].currentChips = player.chips;
      this.ledger[playerId].netProfit =
        player.chips - this.ledger[playerId].totalBuyIn;
      this.ledger[playerId].activeOnTable = false;
    }

    this.players.splice(idx, 1);
    this.addLog(`👋 ${player.name} 离开了座位 #${player.seat + 1}`);
    return null;
  }

  public addBot(
    requesterId: string,
    seat: number,
    style: BotStyle,
    strength: BotStrength,
    customName?: string,
    hidePrefix?: boolean
  ): string | null {
    if (requesterId !== this.hostId) {
      return '只有房主可以添加人机';
    }
    if (seat < 0 || seat >= this.config.maxSeats) {
      return '无效的座位号';
    }
    if (this.players.some((p) => p.seat === seat)) {
      return '该座位已被占用';
    }
    if (this.config.mode === 'sng' && this.sngStarted && !this.sngFinished) {
      return '锦标赛进行中无法添加人机';
    }

    const meta = BOT_STYLE_METADATA[style];
    const usedNames = new Set(this.players.map((p) => p.name));

    const formatCandidate = (rawName: string) => {
      if (hidePrefix) {
        const parts = rawName.split('·');
        return parts[parts.length - 1].trim();
      }
      return `${meta.avatar} ${rawName}`;
    };

    const candidateNames = meta.defaultNames
      .map(formatCandidate)
      .filter((n) => !usedNames.has(n));

    const finalDisplayName = customName?.trim()
      ? hidePrefix
        ? customName.trim().split('·').pop()!.trim()
        : `${meta.avatar} ${customName.trim()}`
      : candidateNames[0] ||
        (hidePrefix ? `AI#${seat + 1}` : `${meta.avatar} ${meta.shortTag}#${seat + 1}`);

    const botId = `bot_${seat}_${Date.now().toString(36)}`;
    const chips = this.config.startingChips;
    const isHandActive = this.street !== 'waiting' && this.street !== 'showdown';

    const botPlayer: PlayerState = {
      id: botId,
      name: finalDisplayName,
      seat,
      chips,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: [],
      revealedCards: [false, false],
      folded: isHandActive,
      allIn: false,
      sittingOut: false,
      connected: true,
      isBot: true,
      botStyle: style,
      botStrength: strength,
      hideBotStyle: !!hidePrefix,
    };

    this.players.push(botPlayer);
    this.players.sort((a, b) => a.seat - b.seat);

    this.ledger[botId] = {
      playerId: botId,
      playerName: botPlayer.name,
      isBot: true,
      botStyle: style,
      totalBuyIn: chips,
      currentChips: chips,
      netProfit: 0,
      handsPlayed: 0,
      handsWon: 0,
      vpipCount: 0,
      pfrCount: 0,
      activeOnTable: true,
    };

    this.addLog(
      hidePrefix
        ? `🤖 添加了人机 [${botPlayer.name}] 到 #${seat + 1} 号位`
        : `🤖 添加了人机 [${botPlayer.name}] (${meta.name}) 到 #${seat + 1} 号位`
    );
    return null;
  }

  public removeBot(requesterId: string, seat: number): string | null {
    if (requesterId !== this.hostId) {
      return '只有房主可以移除人机';
    }
    const bot = this.players.find((p) => p.seat === seat && p.isBot);
    if (!bot) return '该座位没有可移除的人机';
    return this.leaveSeat(bot.id);
  }

  public requestRebuy(playerId: string, amount: number): string | null {
    if (this.config.mode !== 'cash') {
      return '锦标赛(SNG)模式不支持中途补码';
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return '请先入座后再补码';

    const cleanAmount = Math.max(100, Math.min(this.config.maxBuyIn, Math.floor(amount)));

    if (this.street === 'waiting' || this.street === 'showdown' || player.folded) {
      player.chips += cleanAmount;
      if (this.ledger[playerId]) {
        this.ledger[playerId].totalBuyIn += cleanAmount;
        this.ledger[playerId].currentChips = player.chips;
        this.ledger[playerId].netProfit =
          player.chips - this.ledger[playerId].totalBuyIn;
      }
      this.addLog(`💰 ${player.name} 补充了 ${cleanAmount} 筹码 (当前总筹码: ${player.chips})`);
    } else {
      player.pendingRebuy = (player.pendingRebuy || 0) + cleanAmount;
      this.addLog(`⏳ ${player.name} 申请在下局开始时补码 ${cleanAmount}`);
    }
    return null;
  }

  public resetSng(requesterId: string): string | null {
    if (requesterId !== this.hostId) {
      return '只有房主可以重置锦标赛';
    }
    this.street = 'waiting';
    this.sngStarted = false;
    this.sngFinished = false;
    this.sngCurrentLevelIndex = 0;
    this.sngLevelStartTime = null;
    this.sngNextBlindIncreaseAt = null;
    this.handNumber = 0;
    this.communityCards = [];
    this.rabbitCards = [];
    this.pot = 0;
    this.sidePots = [];
    this.winners = [];
    this.activeSeat = null;
    this.turnDeadline = null;

    for (const p of this.players) {
      p.chips = this.config.startingChips;
      p.currentBet = 0;
      p.totalHandBet = 0;
      p.holeCards = [];
      p.revealedCards = [false, false];
      p.folded = false;
      p.allIn = false;
      p.eliminatedRank = undefined;
      p.lastAction = undefined;

      if (this.ledger[p.id]) {
        this.ledger[p.id].totalBuyIn = this.config.startingChips;
        this.ledger[p.id].currentChips = this.config.startingChips;
        this.ledger[p.id].netProfit = 0;
        this.ledger[p.id].sngRank = undefined;
      }
    }

    this.addLog(`🏆 单桌锦标赛(SNG)已重置，所有选手恢复初始记分牌 ${this.config.startingChips}！`);
    return null;
  }

  /**
   * Start a new hand
   */
  public startNewHand(): string | null {
    if (this.paused) {
      return '牌局已暂停';
    }

    // Apply any pending rebuys in cash mode, and auto-rebuy busted bots in cash mode!
    if (this.config.mode === 'cash') {
      for (const p of this.players) {
        if (p.pendingRebuy && p.pendingRebuy > 0) {
          const add = p.pendingRebuy;
          p.chips += add;
          p.pendingRebuy = 0;
          if (this.ledger[p.id]) {
            this.ledger[p.id].totalBuyIn += add;
          }
          this.addLog(`💰 ${p.name} 补码 ${add} 已生效`);
        }
        if (p.isBot && p.chips === 0) {
          const rebuyAmt = this.config.startingChips;
          p.chips = rebuyAmt;
          if (this.ledger[p.id]) {
            this.ledger[p.id].totalBuyIn += rebuyAmt;
          }
          this.addLog(`🤖 人机 ${p.name} 自动补码 ${rebuyAmt}`);
        }
      }
    }

    const eligiblePlayers = this.players.filter(
      (p) => p.chips > 0 && !p.sittingOut
    );

    if (eligiblePlayers.length < 2) {
      this.street = 'waiting';
      this.activeSeat = null;
      this.turnDeadline = null;
      return '至少需要 2 名有筹码的在座玩家才能发牌';
    }

    // Handle SNG initialization and blind level escalation
    if (this.config.mode === 'sng') {
      if (!this.sngStarted) {
        this.sngStarted = true;
        this.sngFinished = false;
        this.sngCurrentLevelIndex = 0;
        this.sngLevelStartTime = Date.now();
        if (this.config.sngBlindMode === 'time') {
          this.sngNextBlindIncreaseAt =
            Date.now() + this.config.sngLevelDurationMinutes * 60 * 1000;
        }
        this.addLog(
          `🏆 单桌锦标赛(SNG)正式开赛！共 ${eligiblePlayers.length} 名选手参赛！`
        );
      } else {
        // Check if blind level should escalate
        const maxIdx = this.config.sngLevels.length - 1;
        if (this.sngCurrentLevelIndex < maxIdx) {
          if (this.config.sngBlindMode === 'hands') {
            if (
              this.handNumber > 0 &&
              this.handNumber % this.config.sngHandsPerLevel === 0
            ) {
              this.sngCurrentLevelIndex++;
              const b = this.getCurrentBlinds();
              this.addLog(
                `📈 锦标赛盲注升级至 Level ${b.level}：小盲 ${b.sb} / 大盲 ${b.bb}${b.ante > 0 ? ` (前注 ${b.ante})` : ''}`
              );
            }
          } else if (
            this.config.sngBlindMode === 'time' &&
            this.sngNextBlindIncreaseAt &&
            Date.now() >= this.sngNextBlindIncreaseAt
          ) {
            this.sngCurrentLevelIndex++;
            this.sngLevelStartTime = Date.now();
            this.sngNextBlindIncreaseAt =
              Date.now() + this.config.sngLevelDurationMinutes * 60 * 1000;
            const b = this.getCurrentBlinds();
            this.addLog(
              `⏰ 锦标赛涨盲时间到！升级至 Level ${b.level}：小盲 ${b.sb} / 大盲 ${b.bb}${b.ante > 0 ? ` (前注 ${b.ante})` : ''}`
            );
          }
        }
      }
    }

    this.handNumber++;
    this.street = 'preflop';
    this.deck = shuffleDeck(createDeck());
    this.communityCards = [];
    this.rabbitCards = [];
    this.rabbitHuntRevealed = false;
    this.allInRunout = false;
    this.winners = [];
    this.pot = 0;
    this.sidePots = [];
    this.vpipRecordedThisHand.clear();
    this.pfrRecordedThisHand.clear();
    this.handStartStacks.clear();

    // Reset player hand states
    for (const p of this.players) {
      this.handStartStacks.set(p.id, p.chips);
      p.currentBet = 0;
      p.totalHandBet = 0;
      p.holeCards = [];
      p.revealedCards = [false, false];
      p.allIn = false;
      p.allInEquity = undefined;
      p.lastAction = undefined;
      if (p.chips > 0 && !p.sittingOut) {
        p.folded = false;
        if (this.ledger[p.id]) {
          this.ledger[p.id].handsPlayed++;
        }
      } else {
        p.folded = true;
      }
    }

    // Advance Dealer Button
    const activeSeats = eligiblePlayers.map((p) => p.seat);
    this.dealerSeat = this.getNextOccupiedSeat(this.dealerSeat, activeSeats);

    // Heads-Up (2 players) special rule: Dealer IS Small Blind!
    if (activeSeats.length === 2) {
      this.smallBlindSeat = this.dealerSeat;
      this.bigBlindSeat = this.getNextOccupiedSeat(this.dealerSeat, activeSeats);
    } else {
      this.smallBlindSeat = this.getNextOccupiedSeat(this.dealerSeat, activeSeats);
      this.bigBlindSeat = this.getNextOccupiedSeat(this.smallBlindSeat, activeSeats);
    }

    const { sb, bb, ante, level } = this.getCurrentBlinds();

    this.addLog(
      `🃏 === 第 #${this.handNumber} 手牌开始 (${this.config.mode === 'sng' ? `SNG Lv.${level} ` : ''}盲注 ${sb}/${bb}${ante > 0 ? ` 前注 ${ante}` : ''}) ===`
    );

    // Post Antes if configured
    if (ante > 0) {
      for (const p of eligiblePlayers) {
        const anteAmt = Math.min(p.chips, ante);
        if (anteAmt > 0) {
          p.chips -= anteAmt;
          p.totalHandBet += anteAmt;
          this.pot += anteAmt;
          if (p.chips === 0) p.allIn = true;
        }
      }
    }

    // Post Small Blind and Big Blind
    const sbPlayer = this.players.find((p) => p.seat === this.smallBlindSeat)!;
    const bbPlayer = this.players.find((p) => p.seat === this.bigBlindSeat)!;

    this.postBlind(sbPlayer, sb, '小盲');
    this.postBlind(bbPlayer, bb, '大盲');

    this.currentHighestBet = Math.max(sbPlayer.currentBet, bbPlayer.currentBet);
    this.lastFullRaiseSize = bb;
    this.minRaiseAmount = this.currentHighestBet + bb;

    // Deal 2 hole cards to each eligible player
    for (const p of eligiblePlayers) {
      p.holeCards = [this.deck.pop()!, this.deck.pop()!];
    }

    // Pre-generate 5 board cards in rabbitCards so Rabbit Hunt works anytime
    // Note: actual flop/turn/river will pop from `this.deck`, and we'll store undealt ones on early end.

    // Determine who needs to act pre-flop
    this.seatsToAct = new Set(
      eligiblePlayers.filter((p) => !p.allIn).map((p) => p.seat)
    );

    // Pre-flop first actor: seat after Big Blind (in Heads-Up, that's Small Blind / Dealer!)
    const firstActorSeat = this.getNextSeatInSet(this.bigBlindSeat, this.seatsToAct);
    if (firstActorSeat === null || this.canSkipStraightToShowdown()) {
      if (this.enableDramaticRunout) {
        this.enterAllInRunout();
      } else {
        this.advanceStreet();
      }
    } else {
      this.setActiveSeat(firstActorSeat);
    }

    this.updateSidePots();
    this.syncLedgerStacks();
    return null;
  }

  private postBlind(player: PlayerState, amount: number, label: string) {
    const actual = Math.min(player.chips, amount);
    player.chips -= actual;
    player.currentBet += actual;
    player.totalHandBet += actual;
    this.pot += actual;
    if (player.chips === 0) {
      player.allIn = true;
    }
    player.lastAction = {
      type: player.allIn ? 'allin' : 'bet',
      amount: actual,
      label: `${label} ${actual}`,
    };
  }

  /**
   * Process a player's betting action
   */
  public handlePlayerAction(
    playerId: string,
    action: PlayerActionType,
    amount?: number
  ): string | null {
    if (this.street === 'waiting' || this.street === 'showdown') {
      return '当前不在下注阶段';
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return '未找到玩家';
    if (player.seat !== this.activeSeat) {
      return '还没轮到您行动';
    }
    if (player.folded || player.allIn) {
      return '您已经弃牌或全下';
    }

    const { bb } = this.getCurrentBlinds();
    const toCall = Math.max(0, this.currentHighestBet - player.currentBet);

    switch (action) {
      case 'fold': {
        player.folded = true;
        player.lastAction = { type: 'fold', label: '弃牌' };
        this.seatsToAct.delete(player.seat);
        this.addLog(`🏳️ ${player.name} 弃牌`);
        break;
      }

      case 'check': {
        if (toCall > 0) {
          return `需要跟注 ${toCall} 才能看牌，无法过牌`;
        }
        player.lastAction = { type: 'check', label: '过牌' };
        this.seatsToAct.delete(player.seat);
        this.addLog(`✊ ${player.name} 过牌`);
        break;
      }

      case 'call': {
        if (toCall === 0) {
          // Treat as check
          player.lastAction = { type: 'check', label: '过牌' };
          this.seatsToAct.delete(player.seat);
          this.addLog(`✊ ${player.name} 过牌`);
          break;
        }
        const actualCall = Math.min(player.chips, toCall);
        player.chips -= actualCall;
        player.currentBet += actualCall;
        player.totalHandBet += actualCall;
        this.pot += actualCall;

        this.recordVpip(player.id);

        if (player.chips === 0) {
          player.allIn = true;
          player.lastAction = {
            type: 'allin',
            amount: player.currentBet,
            label: `全下跟注 ${player.currentBet}`,
          };
          this.addLog(`🔥 ${player.name} 全下跟注 (${actualCall})`);
        } else {
          player.lastAction = {
            type: 'call',
            amount: player.currentBet,
            label: `跟注 ${player.currentBet}`,
          };
          this.addLog(`📞 ${player.name} 跟注 ${actualCall}`);
        }
        this.seatsToAct.delete(player.seat);
        break;
      }

      case 'bet':
      case 'raise':
      case 'allin': {
        const maxTotalBet = player.currentBet + player.chips;
        let targetTotalBet =
          action === 'allin'
            ? maxTotalBet
            : amount !== undefined
            ? Math.floor(amount)
            : this.minRaiseAmount;

        if (targetTotalBet > maxTotalBet) {
          targetTotalBet = maxTotalBet;
        }

        // If targetTotalBet is not enough to even call, force all-in call
        if (targetTotalBet <= this.currentHighestBet && targetTotalBet < maxTotalBet) {
          return `加注金额必须大于当前最高注 (${this.currentHighestBet})`;
        }

        // Validate minimum raise unless player is going all-in
        if (targetTotalBet < this.minRaiseAmount && targetTotalBet < maxTotalBet) {
          return `最小加注总额为 ${this.minRaiseAmount}`;
        }

        const addedChips = targetTotalBet - player.currentBet;
        const previousHighest = this.currentHighestBet;
        const raiseIncrement = targetTotalBet - previousHighest;

        player.chips -= addedChips;
        player.currentBet = targetTotalBet;
        player.totalHandBet += addedChips;
        this.pot += addedChips;

        this.recordVpip(player.id);
        if (this.street === 'preflop' && raiseIncrement > 0) {
          this.recordPfr(player.id);
        }

        if (player.chips === 0) {
          player.allIn = true;
        }

        if (targetTotalBet > previousHighest) {
          this.currentHighestBet = targetTotalBet;
          // Did this raise constitute a full raise that reopens betting for everyone?
          if (raiseIncrement >= this.lastFullRaiseSize || previousHighest === 0) {
            this.lastFullRaiseSize = Math.max(bb, raiseIncrement);
          }
          this.minRaiseAmount = this.currentHighestBet + this.lastFullRaiseSize;

          // Reopen action for all other non-folded, non-all-in players
          for (const p of this.players) {
            if (p.id !== player.id && !p.folded && !p.allIn) {
              this.seatsToAct.add(p.seat);
            }
          }
        }

        this.seatsToAct.delete(player.seat);

        if (player.allIn) {
          player.lastAction = {
            type: 'allin',
            amount: player.currentBet,
            label: `全下 ${player.currentBet}`,
          };
          this.addLog(`🚀 ${player.name} 全下 All-In 至 ${player.currentBet}！`);
        } else if (previousHighest === 0) {
          player.lastAction = {
            type: 'bet',
            amount: player.currentBet,
            label: `下注 ${player.currentBet}`,
          };
          this.addLog(`💵 ${player.name} 下注 ${player.currentBet}`);
        } else {
          player.lastAction = {
            type: 'raise',
            amount: player.currentBet,
            label: `加注至 ${player.currentBet}`,
          };
          this.addLog(`📈 ${player.name} 加注至 ${player.currentBet}`);
        }
        break;
      }
    }

    this.updateSidePots();
    this.syncLedgerStacks();

    // Check if only 1 non-folded player remains!
    const nonFolded = this.players.filter((p) => !p.folded);
    if (nonFolded.length === 1) {
      this.resolveUncontestedWinner(nonFolded[0]);
      return null;
    }

    // Check if current betting round is complete
    const nextSeat =
      this.seatsToAct.size > 0
        ? this.getNextSeatInSet(player.seat, this.seatsToAct)
        : null;

    if (nextSeat === null) {
      if (
        this.enableDramaticRunout &&
        this.canSkipStraightToShowdown() &&
        this.street !== 'river'
      ) {
        this.enterAllInRunout();
      } else {
        this.advanceStreet();
      }
    } else {
      this.setActiveSeat(nextSeat);
    }

    return null;
  }

  /**
   * Enter dramatic All-In runout mode: reveal all active contenders' hole cards
   * and compute live win equity before dealing remaining streets one by one.
   */
  private enterAllInRunout() {
    this.allInRunout = true;
    this.activeSeat = null;
    this.turnDeadline = null;
    this.seatsToAct.clear();

    for (const p of this.players) {
      p.currentBet = 0;
      if (!p.folded && p.holeCards.length === 2) {
        p.revealedCards = [true, true];
      }
    }
    this.currentHighestBet = 0;

    const contenders = this.players.filter((p) => !p.folded);
    const handsSummary = contenders
      .map((p) => `${p.name}[${p.holeCards.map(formatCard).join('')}]`)
      .join(' vs ');
    this.addLog(`🔥 全下跑马亮牌：${handsSummary}！即将依次发出公共牌...`);
    this.updateAllInEquities();
  }

  private updateAllInEquities() {
    const contenders = this.players.filter(
      (p) => !p.folded && p.holeCards.length === 2
    );
    const equities = calculateAllInEquities(contenders, this.communityCards);
    for (const p of this.players) {
      p.allInEquity = !p.folded ? equities[p.id] : undefined;
    }
  }

  /**
   * Called by PokerRoomController timer to deal the next street during an All-In runout
   */
  public stepAllInRunout(): boolean {
    if (!this.allInRunout || this.street === 'showdown' || this.street === 'waiting') {
      return false;
    }
    this.advanceStreet();
    return true;
  }

  private recordVpip(playerId: string) {
    if (this.street === 'preflop' && !this.vpipRecordedThisHand.has(playerId)) {
      this.vpipRecordedThisHand.add(playerId);
      if (this.ledger[playerId]) {
        this.ledger[playerId].vpipCount++;
      }
    }
  }

  private recordPfr(playerId: string) {
    if (this.street === 'preflop' && !this.pfrRecordedThisHand.has(playerId)) {
      this.pfrRecordedThisHand.add(playerId);
      if (this.ledger[playerId]) {
        this.ledger[playerId].pfrCount++;
      }
    }
  }

  private canSkipStraightToShowdown(): boolean {
    const activeCanAct = this.players.filter((p) => !p.folded && !p.allIn);
    // If <= 1 player has chips left and no one owes a call to match highest bet
    const anyoneOwesBet = activeCanAct.some(
      (p) => p.currentBet < this.currentHighestBet
    );
    return activeCanAct.length <= 1 && !anyoneOwesBet;
  }

  /**
   * Advance to the next street (Flop -> Turn -> River -> Showdown)
   */
  private advanceStreet() {
    const { bb } = this.getCurrentBlinds();

    // Reset current street bets
    for (const p of this.players) {
      p.currentBet = 0;
      if (!p.folded && !p.allIn) {
        p.lastAction = undefined;
      }
    }
    this.currentHighestBet = 0;
    this.lastFullRaiseSize = bb;
    this.minRaiseAmount = bb;

    if (this.street === 'preflop') {
      this.street = 'flop';
      this.communityCards.push(
        this.deck.pop()!,
        this.deck.pop()!,
        this.deck.pop()!
      );
      this.addLog(
        `🃏 翻牌 (Flop): ${this.communityCards.map(formatCard).join(' ')} | 底池: ${this.pot}`
      );
    } else if (this.street === 'flop') {
      this.street = 'turn';
      this.communityCards.push(this.deck.pop()!);
      this.addLog(
        `🃏 转牌 (Turn): ${formatCard(this.communityCards[3])} | 公共牌: ${this.communityCards.map(formatCard).join(' ')} | 底池: ${this.pot}`
      );
    } else if (this.street === 'turn') {
      this.street = 'river';
      this.communityCards.push(this.deck.pop()!);
      this.addLog(
        `🃏 河牌 (River): ${formatCard(this.communityCards[4])} | 公共牌: ${this.communityCards.map(formatCard).join(' ')} | 底池: ${this.pot}`
      );
    } else if (this.street === 'river') {
      this.resolveShowdown();
      return;
    }

    // If everyone is all-in (or at most 1 player is not all-in), run out remaining streets to showdown!
    const playersAbleToBet = this.players.filter((p) => !p.folded && !p.allIn);
    if (playersAbleToBet.length <= 1) {
      this.seatsToAct.clear();
      if (this.enableDramaticRunout) {
        this.allInRunout = true;
        this.activeSeat = null;
        this.turnDeadline = null;
        if (this.street === 'river') {
          // River was just dealt during All-In runout -> resolve winners immediately!
          this.resolveShowdown();
        } else {
          this.updateAllInEquities();
        }
        return;
      }
      this.advanceStreet();
      return;
    }

    this.seatsToAct = new Set(playersAbleToBet.map((p) => p.seat));
    // Post-flop first actor is the first active player to the left of the Dealer button
    const firstPostflopSeat = this.getNextSeatInSet(
      this.dealerSeat,
      this.seatsToAct
    );
    if (firstPostflopSeat !== null) {
      this.setActiveSeat(firstPostflopSeat);
    } else {
      this.resolveShowdown();
    }
  }

  /**
   * Resolve winner when everyone else folded
   */
  private resolveUncontestedWinner(winner: PlayerState) {
    // Save undealt community cards for Rabbit Hunt!
    const needed = 5 - this.communityCards.length;
    this.rabbitCards = [...this.communityCards];
    for (let i = 0; i < needed; i++) {
      this.rabbitCards.push(this.deck.pop()!);
    }

    this.street = 'showdown';
    this.activeSeat = null;
    this.turnDeadline = null;
    this.seatsToAct.clear();

    winner.chips += this.pot;
    this.winners = [
      {
        playerId: winner.id,
        playerName: winner.name,
        amountWon: this.pot,
        potName: '底池',
        handName: '对手全部弃牌',
      },
    ];

    if (this.ledger[winner.id]) {
      this.ledger[winner.id].handsWon++;
    }

    this.addLog(`🏆 ${winner.name} 赢得底池 ${this.pot} (其余玩家弃牌)`);
    this.finalizeHandEliminationsAndLedger();
  }

  /**
   * Resolve Showdown with full Side Pot evaluation
   */
  private resolveShowdown() {
    this.street = 'showdown';
    this.allInRunout = false;
    this.activeSeat = null;
    this.turnDeadline = null;
    this.seatsToAct.clear();

    for (const p of this.players) {
      p.allInEquity = undefined;
    }

    this.updateSidePots();

    const nonFolded = this.players.filter((p) => !p.folded);
    // Reveal all non-folded players' hole cards at showdown
    for (const p of nonFolded) {
      p.revealedCards = [true, true];
    }

    // Evaluate each non-folded player's 7-card hand
    const evaluations = new Map<string, ReturnType<typeof evaluate7Cards>>();
    for (const p of nonFolded) {
      const ev = evaluate7Cards([...p.holeCards, ...this.communityCards]);
      evaluations.set(p.id, ev);
    }

    this.winners = [];
    const wonAtLeastOnePot = new Set<string>();

    const potsToAward: SidePot[] =
      this.sidePots.length > 0
        ? this.sidePots
        : [
            {
              amount: this.pot,
              eligiblePlayerIds: nonFolded.map((p) => p.id),
              name: '主池',
            },
          ];

    for (const sidePot of potsToAward) {
      if (sidePot.amount <= 0) continue;
      const eligible = sidePot.eligiblePlayerIds.filter((id) =>
        evaluations.has(id)
      );
      if (eligible.length === 0) continue;

      let bestScore = -1;
      let potWinners: string[] = [];

      for (const pid of eligible) {
        const score = evaluations.get(pid)!.score;
        if (score > bestScore) {
          bestScore = score;
          potWinners = [pid];
        } else if (score === bestScore) {
          potWinners.push(pid);
        }
      }

      const share = Math.floor(sidePot.amount / potWinners.length);
      let remainder = sidePot.amount % potWinners.length;

      for (const wid of potWinners) {
        const wPlayer = this.players.find((p) => p.id === wid)!;
        const oddChip = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder--;

        const totalAward = share + oddChip;
        wPlayer.chips += totalAward;
        wonAtLeastOnePot.add(wid);

        const ev = evaluations.get(wid)!;
        this.winners.push({
          playerId: wid,
          playerName: wPlayer.name,
          amountWon: totalAward,
          potName: sidePot.name,
          handName: ev.name,
          bestFiveCards: ev.bestFive,
        });

        this.addLog(
          `🏆 ${wPlayer.name} 凭 [${ev.name}] 赢得${sidePot.name} ${totalAward} 筹码！`
        );
      }
    }

    for (const wid of wonAtLeastOnePot) {
      if (this.ledger[wid]) {
        this.ledger[wid].handsWon++;
      }
    }

    this.finalizeHandEliminationsAndLedger();
  }

  /**
   * Calculate main pot and side pots from players' `totalHandBet`
   */
  private updateSidePots() {
    const contributors = this.players.filter((p) => p.totalHandBet > 0);
    if (contributors.length === 0) {
      this.sidePots = [];
      return;
    }

    // Distinct bet levels from all-in players, plus the maximum bet level
    const distinctLevels = Array.from(
      new Set(contributors.map((p) => p.totalHandBet))
    ).sort((a, b) => a - b);

    const pots: SidePot[] = [];
    let prevLevel = 0;

    for (const level of distinctLevels) {
      const slice = level - prevLevel;
      if (slice <= 0) continue;

      const involved = contributors.filter((p) => p.totalHandBet >= level);
      const potSliceAmount = slice * involved.length;
      const eligible = involved.filter((p) => !p.folded).map((p) => p.id);

      // Merge into previous pot if eligible players set is identical
      const prevPot = pots[pots.length - 1];
      const sameEligible =
        prevPot &&
        prevPot.eligiblePlayerIds.length === eligible.length &&
        prevPot.eligiblePlayerIds.every((id) => eligible.includes(id));

      if (sameEligible) {
        prevPot.amount += potSliceAmount;
      } else {
        pots.push({
          amount: potSliceAmount,
          eligiblePlayerIds: eligible,
          name: pots.length === 0 ? '主池' : `边池 ${pots.length}`,
        });
      }

      prevLevel = level;
    }

    // Return uncalled bet if single player bet more than everyone else and wasn't called?
    // Wait: during betting streets we keep sidePots for display; at showdown, if the top pot only has 1 eligible player AND only 1 contributor, return the uncalled excess or award it cleanly!
    this.sidePots = pots;
  }

  private finalizeHandEliminationsAndLedger() {
    this.syncLedgerStacks();

    if (this.config.mode === 'sng' && this.sngStarted && !this.sngFinished) {
      // Find players who started this hand with > 0 chips and now have 0 chips
      const newlyBusted = this.players.filter(
        (p) =>
          p.chips === 0 &&
          p.eliminatedRank === undefined &&
          (this.handStartStacks.get(p.id) || 0) > 0
      );

      if (newlyBusted.length > 0) {
        const survivorsCount = this.players.filter((p) => p.chips > 0).length;
        // Sort newly busted by starting stack ascending (smaller stack gets worse rank)
        newlyBusted.sort(
          (a, b) =>
            (this.handStartStacks.get(a.id) || 0) -
            (this.handStartStacks.get(b.id) || 0)
        );

        let rankToAssign = survivorsCount + newlyBusted.length;
        for (const busted of newlyBusted) {
          busted.eliminatedRank = rankToAssign;
          if (this.ledger[busted.id]) {
            this.ledger[busted.id].sngRank = rankToAssign;
          }
          this.addLog(
            `💥 ${busted.name} 遗憾出局，获得锦标赛第 ${rankToAssign} 名！`
          );
          rankToAssign--;
        }
      }

      const remainingPlayers = this.players.filter((p) => p.chips > 0);
      if (remainingPlayers.length === 1) {
        const champion = remainingPlayers[0];
        champion.eliminatedRank = 1;
        if (this.ledger[champion.id]) {
          this.ledger[champion.id].sngRank = 1;
        }
        this.sngFinished = true;
        this.addLog(
          `👑 恭喜 ${champion.name} 夺得本次单桌锦标赛(SNG)总冠军！🎉`
        );
      }
    }
  }

  private syncLedgerStacks() {
    for (const p of this.players) {
      if (this.ledger[p.id]) {
        this.ledger[p.id].currentChips = p.chips;
        this.ledger[p.id].netProfit =
          p.chips - this.ledger[p.id].totalBuyIn;
      }
    }
  }

  public showCards(playerId: string, indices: [boolean, boolean]): string | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.holeCards.length < 2) {
      return '当前没有可展示的手牌';
    }
    if (this.street !== 'showdown' && !player.folded) {
      return '只能在弃牌后或摊牌阶段主动亮牌';
    }
    player.revealedCards = indices;
    const shown: string[] = [];
    if (indices[0] && player.holeCards[0]) shown.push(formatCard(player.holeCards[0]));
    if (indices[1] && player.holeCards[1]) shown.push(formatCard(player.holeCards[1]));
    if (shown.length > 0) {
      this.addLog(`👀 ${player.name} 亮出了手牌: [ ${shown.join(' ')} ]`);
    }
    return null;
  }

  public triggerRabbitHunt(playerId: string): string | null {
    if (!this.config.allowRabbitHunt) {
      return '房主已关闭发发看(Rabbit Hunt)功能';
    }
    if (this.street !== 'showdown' || this.rabbitCards.length < 5 || this.communityCards.length >= 5) {
      return '当前手牌无需发发看';
    }
    if (this.rabbitHuntRevealed) {
      return null;
    }
    this.rabbitHuntRevealed = true;
    const player = this.players.find((p) => p.id === playerId);
    const who = player ? player.name : '牌友';
    this.addLog(
      `🐰 ${who} 触发了【发发看】：原本完整公共牌为 ${this.rabbitCards.map(formatCard).join(' ')}`
    );
    return null;
  }

  public toggleSitOut(playerId: string): string | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return '未入座';
    player.sittingOut = !player.sittingOut;
    this.addLog(
      `${player.sittingOut ? '☕' : '⚡'} ${player.name} ${player.sittingOut ? '设为暂离(Sit Out)' : '回到了牌桌'}`
    );
    return null;
  }

  public requestTimebank(playerId: string): string | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.seat !== this.activeSeat || !this.turnDeadline) {
      return '当前不是您的思考回合';
    }
    this.turnDeadline += 20 * 1000;
    this.addLog(`⏱️ ${player.name} 使用了延时卡 (+20秒)`);
    return null;
  }

  private setActiveSeat(seat: number) {
    this.activeSeat = seat;
    if (this.config.actionTimeSeconds > 0) {
      this.turnDeadline = Date.now() + this.config.actionTimeSeconds * 1000;
    } else {
      this.turnDeadline = null;
    }
  }

  public getActivePlayer(): PlayerState | null {
    if (this.activeSeat === null) return null;
    return this.players.find((p) => p.seat === this.activeSeat) || null;
  }

  /**
   * Execute AI bot turn if the current active player is a bot
   */
  public executeBotTurnIfActive(): { acted: boolean; bot?: PlayerState; chatBubble?: string } {
    const active = this.getActivePlayer();
    if (!active || !active.isBot) {
      return { acted: false };
    }

    const decision = decideBotAction(this.getPublicState(active.id), active);
    const err = this.handlePlayerAction(active.id, decision.action, decision.amount);
    if (err) {
      // Fallback safe action if raise sizing failed validation
      const toCall = Math.max(0, this.currentHighestBet - active.currentBet);
      this.handlePlayerAction(active.id, toCall === 0 ? 'check' : 'fold');
    }

    if (decision.chatBubble) {
      this.addChatMessage(active.id, active.name, decision.chatBubble);
    }

    return { acted: true, bot: active, chatBubble: decision.chatBubble };
  }

  /**
   * Handle turn timeout for human players
   */
  public handleTurnTimeout(): boolean {
    const active = this.getActivePlayer();
    if (!active || !this.turnDeadline) return false;
    if (Date.now() < this.turnDeadline) return false;

    if (active.isBot) {
      this.executeBotTurnIfActive();
      return true;
    }

    const toCall = Math.max(0, this.currentHighestBet - active.currentBet);
    const defaultAction: PlayerActionType = toCall === 0 ? 'check' : 'fold';
    this.addLog(`⏰ ${active.name} 思考超时，自动${defaultAction === 'check' ? '过牌' : '弃牌'}`);
    this.handlePlayerAction(active.id, defaultAction);
    return true;
  }

  private getNextOccupiedSeat(fromSeat: number, occupiedSeats: number[]): number {
    if (occupiedSeats.length === 0) return 0;
    const sorted = [...occupiedSeats].sort((a, b) => a - b);
    for (const s of sorted) {
      if (s > fromSeat) return s;
    }
    return sorted[0];
  }

  private getNextSeatInSet(fromSeat: number, seatSet: Set<number>): number | null {
    if (seatSet.size === 0) return null;
    const sorted = Array.from(seatSet).sort((a, b) => a - b);
    for (const s of sorted) {
      if (s > fromSeat) return s;
    }
    return sorted[0];
  }

  /**
   * Generate sanitized public state for a specific player (hiding other players' unrevealed hole cards)
   */
  public getPublicState(viewerId: string): PublicGameState {
    const sanitizedPlayers: PlayerState[] = this.players.map((p) => {
      const isViewer = p.id === viewerId;
      const visibleCards: Card[] = [];

      if (p.holeCards.length === 2) {
        if (isViewer) {
          visibleCards.push(p.holeCards[0], p.holeCards[1]);
        } else {
          // Only include revealed cards for opponents; hidden cards are masked as { rank: 2, suit: 's' } only if we didn't filter,
          // Wait: let's pass holeCards only if revealed, OR pass null/masked?
          // Let's keep holeCards length = 2 so the UI knows the player has 2 cards in hand, and use `revealedCards` to know if they are face-up!
          // For unrevealed cards of other players, replace with dummy card { rank: 2, suit: 's' } on wire so nobody can cheat via DevTools WebSocket inspector!
          visibleCards.push(
            p.revealedCards[0] ? p.holeCards[0] : { rank: 2, suit: 's' },
            p.revealedCards[1] ? p.holeCards[1] : { rank: 2, suit: 's' }
          );
        }
      }

      return {
        ...p,
        holeCards: visibleCards,
        revealedCards: isViewer ? [true, true] : [...p.revealedCards],
      };
    });

    return {
      roomId: this.roomId,
      hostId: this.hostId,
      config: this.config,
      street: this.street,
      handNumber: this.handNumber,
      dealerSeat: this.dealerSeat,
      smallBlindSeat: this.smallBlindSeat,
      bigBlindSeat: this.bigBlindSeat,
      activeSeat: this.activeSeat,
      turnDeadline: this.turnDeadline,
      communityCards: [...this.communityCards],
      rabbitCards: this.rabbitHuntRevealed ? [...this.rabbitCards] : [],
      rabbitHuntRevealed: this.rabbitHuntRevealed,
      allInRunout: this.allInRunout,
      pot: this.pot,
      sidePots: [...this.sidePots],
      currentHighestBet: this.currentHighestBet,
      minRaiseAmount: this.minRaiseAmount,
      lastFullRaiseSize: this.lastFullRaiseSize,
      players: sanitizedPlayers,
      winners: [...this.winners],
      ledger: { ...this.ledger },
      actionLog: [...this.actionLog],
      chatMessages: [...this.chatMessages],
      sngStarted: this.sngStarted,
      sngFinished: this.sngFinished,
      sngCurrentLevelIndex: this.sngCurrentLevelIndex,
      sngLevelStartTime: this.sngLevelStartTime,
      sngNextBlindIncreaseAt: this.sngNextBlindIncreaseAt,
      paused: this.paused,
    };
  }
}
