import { ClientMessage, ServerMessage } from '../shared/types';
import { PokerTableEngine } from './game';

export interface ConnectedClient {
  id: string; // connection id
  playerId: string;
  name: string;
  send: (msg: ServerMessage) => void;
}

export class PokerRoomController {
  public engine: PokerTableEngine;
  private clients: Map<string, ConnectedClient> = new Map();
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private runoutTimer: ReturnType<typeof setTimeout> | null = null;
  private autoNextHandTimer: ReturnType<typeof setTimeout> | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onStatePersist?: () => void;

  constructor(roomId: string, onStatePersist?: () => void) {
    this.engine = new PokerTableEngine(roomId);
    this.engine.enableDramaticRunout = true;
    this.onStatePersist = onStatePersist;
    this.startTicker();
  }

  private startTicker() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
      if (this.engine.handleTurnTimeout()) {
        this.broadcastState();
        this.scheduleNextEvents();
      }
    }, 1000);
  }

  public addClient(client: ConnectedClient) {
    this.clients.set(client.id, client);
  }

  public removeClient(connectionId: string) {
    const client = this.clients.get(connectionId);
    if (!client) return;
    this.clients.delete(connectionId);

    // Check if player still has another open tab/connection
    const stillConnected = Array.from(this.clients.values()).some(
      (c) => c.playerId === client.playerId
    );
    if (!stillConnected && client.playerId) {
      this.engine.markPlayerDisconnected(client.playerId);
      this.broadcastState();
    }
  }

  public handleMessage(connectionId: string, msg: ClientMessage) {
    const client = this.clients.get(connectionId);
    if (!client) return;

    const sendError = (err: string | null) => {
      if (err) {
        client.send({ type: 'ERROR', message: err });
      }
    };

    switch (msg.type) {
      case 'JOIN_ROOM': {
        client.playerId = msg.playerId;
        client.name = msg.name.trim() || '牌友';
        this.engine.registerPlayerConnection(client.playerId, client.name);
        this.broadcastState();
        break;
      }

      case 'TAKE_SEAT': {
        const err = this.engine.takeSeat(
          client.playerId,
          client.name,
          msg.seat,
          msg.buyIn
        );
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'LEAVE_SEAT': {
        const err = this.engine.leaveSeat(client.playerId);
        if (err) return sendError(err);
        this.broadcastState();
        this.scheduleNextEvents();
        break;
      }

      case 'ADD_BOT': {
        const err = this.engine.addBot(
          client.playerId,
          msg.seat,
          msg.style,
          msg.strength,
          msg.name,
          msg.hidePrefix
        );
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'REMOVE_BOT': {
        const err = this.engine.removeBot(client.playerId, msg.seat);
        if (err) return sendError(err);
        this.broadcastState();
        this.scheduleNextEvents();
        break;
      }

      case 'UPDATE_CONFIG': {
        const err = this.engine.updateConfig(client.playerId, msg.config);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'START_GAME':
      case 'NEXT_HAND': {
        this.clearTimers();
        this.engine.paused = false;
        const err = this.engine.startNewHand();
        if (err) return sendError(err);
        this.broadcastState();
        this.scheduleNextEvents();
        break;
      }

      case 'PAUSE_GAME': {
        if (client.playerId !== this.engine.hostId) {
          return sendError('只有房主可以暂停/继续牌局');
        }
        this.engine.paused = msg.paused;
        this.engine.addLog(
          msg.paused ? '⏸️ 房主已暂停自动发牌' : '▶️ 房主已恢复牌局'
        );
        if (msg.paused && this.autoNextHandTimer) {
          clearTimeout(this.autoNextHandTimer);
          this.autoNextHandTimer = null;
        }
        this.broadcastState();
        break;
      }

      case 'RESET_SNG': {
        this.clearTimers();
        const err = this.engine.resetSng(client.playerId);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'PLAYER_ACTION': {
        const err = this.engine.handlePlayerAction(
          client.playerId,
          msg.action,
          msg.amount
        );
        if (err) return sendError(err);
        this.broadcastState();
        this.scheduleNextEvents();
        break;
      }

      case 'REBUY': {
        const err = this.engine.requestRebuy(client.playerId, msg.amount);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'TOGGLE_SIT_OUT': {
        const err = this.engine.toggleSitOut(client.playerId);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'SHOW_CARDS': {
        const err = this.engine.showCards(client.playerId, msg.cardIndices);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'TRIGGER_RABBIT_HUNT': {
        const err = this.engine.triggerRabbitHunt(client.playerId);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'REQUEST_TIMEBANK': {
        const err = this.engine.requestTimebank(client.playerId);
        if (err) return sendError(err);
        this.broadcastState();
        break;
      }

      case 'SEND_CHAT': {
        const player = this.engine.players.find((p) => p.id === client.playerId);
        const senderName = player ? player.name : client.name;
        this.engine.addChatMessage(
          client.playerId,
          senderName,
          msg.text,
          msg.emoji
        );
        if (msg.emoji && player) {
          for (const c of this.clients.values()) {
            c.send({
              type: 'EMOJI_ANIMATION',
              fromSeat: player.seat,
              emoji: msg.emoji,
              senderName,
            });
          }
        }
        this.broadcastState();
        break;
      }
    }
  }

  private clearTimers() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.runoutTimer) {
      clearTimeout(this.runoutTimer);
      this.runoutTimer = null;
    }
    if (this.autoNextHandTimer) {
      clearTimeout(this.autoNextHandTimer);
      this.autoNextHandTimer = null;
    }
  }

  private scheduleNextEvents() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.runoutTimer) {
      clearTimeout(this.runoutTimer);
      this.runoutTimer = null;
    }

    // 0. Check if we are in dramatic All-In Runout ("跑马") mode!
    if (
      this.engine.allInRunout &&
      this.engine.street !== 'waiting' &&
      this.engine.street !== 'showdown'
    ) {
      // Suspenseful delay: 1.8s before Flop, 2.1s before Turn, 2.4s before River
      const runoutDelay =
        this.engine.street === 'preflop'
          ? 1800
          : this.engine.street === 'flop'
          ? 2100
          : 2400;

      this.runoutTimer = setTimeout(() => {
        this.runoutTimer = null;
        if (this.engine.stepAllInRunout()) {
          this.broadcastState();
          this.scheduleNextEvents();
        }
      }, runoutDelay);
      return;
    }

    // 1. Check if active player is a Bot
    const activePlayer = this.engine.getActivePlayer();
    if (
      activePlayer &&
      activePlayer.isBot &&
      this.engine.street !== 'waiting' &&
      this.engine.street !== 'showdown'
    ) {
      const delay = 650 + Math.floor(Math.random() * 650);
      this.botTimer = setTimeout(() => {
        this.botTimer = null;
        const res = this.engine.executeBotTurnIfActive();
        if (res.acted) {
          this.broadcastState();
          this.scheduleNextEvents();
        }
      }, delay);
      return;
    }

    // 2. If hand reached Showdown and game isn't paused or SNG finished, schedule auto next hand in 6.5s
    if (
      this.engine.street === 'showdown' &&
      !this.engine.paused &&
      !this.engine.sngFinished
    ) {
      if (this.autoNextHandTimer) clearTimeout(this.autoNextHandTimer);
      this.autoNextHandTimer = setTimeout(() => {
        this.autoNextHandTimer = null;
        if (
          this.engine.street === 'showdown' &&
          !this.engine.paused &&
          !this.engine.sngFinished
        ) {
          const err = this.engine.startNewHand();
          if (!err) {
            this.broadcastState();
            this.scheduleNextEvents();
          }
        }
      }, 6500);
    }
  }

  public broadcastState() {
    for (const client of this.clients.values()) {
      const state = this.engine.getPublicState(client.playerId);
      client.send({
        type: 'STATE_UPDATE',
        state,
        yourPlayerId: client.playerId,
      });
    }
    if (this.onStatePersist) {
      this.onStatePersist();
    }
  }

  public destroy() {
    this.clearTimers();
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
