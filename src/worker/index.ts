import { PokerRoomController } from '../engine/roomController';
import { ClientMessage, ServerMessage } from '../shared/types';

export interface Env {
  POKER_ROOM: DurableObjectNamespace;
  ASSETS: Fetcher;
}

/**
 * Cloudflare Durable Object backed by SQLite (Free Tier compatible!)
 * Each Poker table room maps to one PokerRoomDO instance.
 */
export class PokerRoomDO {
  private state: DurableObjectState;
  private controller: PokerRoomController | null = null;
  private roomId: string = 'CLUB888';

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  private ensureController(roomId: string): PokerRoomController {
    if (!this.controller) {
      this.roomId = roomId;
      this.controller = new PokerRoomController(this.roomId);
    }
    return this.controller;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomId = (url.searchParams.get('room') || 'CLUB888').toUpperCase();
    const room = this.ensureController(roomId);

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    const connId = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    room.addClient({
      id: connId,
      playerId: '',
      name: '牌友',
      send: (msg: ServerMessage) => {
        try {
          server.send(JSON.stringify(msg));
        } catch {
          // Ignore send errors on closing socket
        }
      },
    });

    server.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as ClientMessage;
        room.handleMessage(connId, msg);
      } catch (e) {
        console.error('Invalid WS message in DO:', e);
      }
    });

    server.addEventListener('close', () => {
      room.removeClient(connId);
    });

    server.addEventListener('error', () => {
      room.removeClient(connId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route WebSocket requests `/ws?room=XXXX` to the specific Durable Object room
    if (url.pathname === '/ws') {
      const roomId = (url.searchParams.get('room') || 'CLUB888')
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
      const id = env.POKER_ROOM.idFromName(roomId || 'CLUB888');
      const stub = env.POKER_ROOM.get(id);
      return stub.fetch(request);
    }

    // Fallback to static assets (SPA)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Texas Holdem Poker Worker Running', { status: 200 });
  },
};
