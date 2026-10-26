import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { PokerRoomController } from './src/engine/roomController';
import { ClientMessage, ServerMessage } from './src/shared/types';

function pokerMultiplayerPlugin(): Plugin {
  const rooms = new Map<string, PokerRoomController>();

  const getOrCreateRoom = (roomId: string) => {
    const cleanId = roomId.toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'CLUB888';
    let room = rooms.get(cleanId);
    if (!room) {
      room = new PokerRoomController(cleanId);
      rooms.set(cleanId, room);
    }
    return room;
  };

  const attachWsServer = (httpServer: any) => {
    if (!httpServer) return;
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws') {
        return; // Let Vite HMR handle its own websocket upgrades
      }

      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        const roomId = url.searchParams.get('room') || 'CLUB888';
        const room = getOrCreateRoom(roomId);
        const connId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        room.addClient({
          id: connId,
          playerId: '',
          name: '牌友',
          send: (msg: ServerMessage) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(msg));
            }
          },
        });

        ws.on('message', (raw) => {
          try {
            const parsed = JSON.parse(raw.toString()) as ClientMessage;
            room.handleMessage(connId, parsed);
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        });

        ws.on('close', () => {
          room.removeClient(connId);
        });
      });
    });
  };

  return {
    name: 'poker-multiplayer-ws',
    configureServer(server) {
      attachWsServer(server.httpServer);
    },
    configurePreviewServer(server) {
      attachWsServer(server.httpServer);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pokerMultiplayerPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
