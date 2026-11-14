// ============================================================================
// CONTRA: SHATTERED OPS HD - Cloudflare WebSocket Room Relay
//
// Same protocol as the local Node relay (server.js), but running on
// Cloudflare Workers + one Durable Object so it works for players on any
// network (both sides only make outbound HTTPS/WSS 443 connections).
//
//   wss://<worker-host>/ws     - WebSocket room relay
//   https://<worker-host>/health - health probe used by the game client
//
// Protocol (JSON text frames):
//   client -> relay: {"t":"create"} / {"t":"join","code":"123456"} / {"t":"leave"}
//   relay  -> client: {"t":"created","code"} / {"t":"joined","code","role"}
//                     {"t":"peer_joined","code"} / {"t":"peer_left","message"}
//                     {"t":"error","message"}
//   once paired, all game packets are forwarded verbatim to the other player:
//   {"t":"s"...} world snapshots, {"t":"i"...} guest input, {"t":"p"/"o"} ping,
//   {"t":"c"...} callouts.
// ============================================================================

const WS_MAGIC_ROOM_PREFIX = 'contra-ops-hd-';

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

function makeRoomCode(rooms) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

export class RelayRoom {
  constructor(state) {
    this.state = state;
    // code -> { code, host, guest, createdAt }
    this.rooms = new Map();
    // Connected clients (for debugging / stats)
    this.clients = new Set();
    // Lightweight diagnostics surfaced through /health
    this.stats = { conns: 0, msgs: 0, creates: 0, joins: 0, closed: 0, sends: 0, lastType: null, lastError: null };
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/api/health' || url.pathname === '/') {
      const colo = (request.cf && request.cf.colo) || null;
      return jsonResponse({ ok: true, rooms: this.rooms.size, mode: 'ws-relay-worker', colo, stats: this.stats });
    }

    if (url.pathname !== '/ws') {
      return new Response('Not found', { status: 404 });
    }

    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const c = { ws: server, roomCode: null, role: null, closed: false };
    this.clients.add(c);
    this.stats.conns++;

    server.addEventListener('message', (event) => {
      this.stats.msgs++;
      try {
        this.handleMessage(c, event.data);
      } catch (e) {
        // Never let a malformed packet kill the relay.
        this.stats.lastError = String((e && e.message) || e);
      }
    });
    server.addEventListener('close', () => { this.stats.closed++; this.onSocketGone(c); });
    server.addEventListener('error', () => this.onSocketGone(c));

    return new Response(null, { status: 101, webSocket: client });
  }

  send(target, obj) {
    if (!target || target.closed) return;
    try {
      target.ws.send(JSON.stringify(obj));
      this.stats.sends++;
    } catch (e) {
      this.stats.lastError = 'send-fail: ' + String((e && e.message) || e);
    }
  }

  relay(target, raw) {
    if (!target || target.closed) return;
    try {
      target.ws.send(raw);
    } catch (e) {}
  }

  handleMessage(client, data) {
    let raw;
    if (typeof data === 'string') {
      raw = data;
    } else if (data instanceof ArrayBuffer) {
      raw = new TextDecoder().decode(data);
    } else if (ArrayBuffer.isView(data)) {
      raw = new TextDecoder().decode(data);
    } else {
      return;
    }

    // Fast path: paired players' game packets are forwarded verbatim.
    if (
      client.roomCode &&
      (raw.startsWith('{"t":"s"') ||
        raw.startsWith('{"t":"i"') ||
        raw.startsWith('{"t":"p"') ||
        raw.startsWith('{"t":"o"') ||
        raw.startsWith('{"t":"c"'))
    ) {
      const room = this.rooms.get(client.roomCode);
      if (!room) return;
      const peer = client.role === 'host' ? room.guest : room.host;
      this.relay(peer, raw);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!msg || !msg.t) return;
    this.stats.lastType = String(msg.t);

    if (msg.t === 'create') {
      this.stats.creates++;
      this.leaveRoom(client);
      const code = makeRoomCode(this.rooms);
      client.roomCode = code;
      client.role = 'host';
      this.rooms.set(code, { code, host: client, guest: null, createdAt: Date.now() });
      this.send(client, { t: 'created', code });
      return;
    }

    if (msg.t === 'join') {
      this.stats.joins++;
      const code = String(msg.code || '').trim();
      const room = this.rooms.get(code);
      if (!room || !room.host || room.host.closed) {
        this.send(client, { t: 'error', message: 'Room not found or host is offline. Please check the 6-digit code.' });
        return;
      }
      if (room.guest && !room.guest.closed) {
        this.send(client, { t: 'error', message: 'Room is already full (2/2 players).' });
        return;
      }
      this.leaveRoom(client);
      client.roomCode = code;
      client.role = 'guest';
      room.guest = client;

      this.send(client, { t: 'joined', code, role: 'guest' });
      this.send(room.host, { t: 'peer_joined', code });
      return;
    }

    if (msg.t === 'leave') {
      this.leaveRoom(client);
      return;
    }

    // Paired players: forward anything else verbatim (e.g. WebRTC SDP/ICE for
    // the relay-assisted direct-P2P upgrade).
    if (client.roomCode) {
      const room = this.rooms.get(client.roomCode);
      if (!room) return;
      const peer = client.role === 'host' ? room.guest : room.host;
      this.relay(peer, raw);
    }
  }

  // Leave the current room (if any) without destroying the socket. Used by the
  // lobby control messages, e.g. creating a new room while already in one.
  leaveRoom(client) {
    if (!client) return;
    const code = client.roomCode;
    const role = client.role;
    client.roomCode = null;
    client.role = null;
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    if (role === 'host') {
      if (room.guest && !room.guest.closed) {
        this.send(room.guest, { t: 'peer_left', message: 'Host (1P) disconnected' });
        room.guest.roomCode = null;
        room.guest.role = null;
      }
      this.rooms.delete(code);
    } else if (role === 'guest') {
      room.guest = null;
      if (room.host && !room.host.closed) {
        this.send(room.host, { t: 'peer_left', message: 'Partner (2P) left the room' });
      }
    }
  }

  // The underlying WebSocket went away: mark it closed and free its room slot.
  onSocketGone(client) {
    if (!client || client.closed) return;
    client.closed = true;
    this.clients.delete(client);
    this.leaveRoom(client);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight (the static game page probes /health from another origin).
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    }

    if (url.pathname === '/health') {
      // Report live room count from the relay instance.
      const id = env.RELAY.idFromName('global');
      return env.RELAY.get(id).fetch(request);
    }

    // All WebSocket traffic is handled by a single relay instance so that the
    // "create room" and "join room" sockets live in the same process.
    const id = env.RELAY.idFromName('global');
    return env.RELAY.get(id).fetch(request);
  }
};
