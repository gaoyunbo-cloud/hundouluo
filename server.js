#!/usr/bin/env node
// ============================================================================
// CONTRA: SHATTERED OPS HD - Zero-Dependency Cross-Network Multiplayer Server
// Serves static HD game files + RFC 6455 WebSocket Room Relay (/ws)
// Usage: node server.js [port]
// ============================================================================
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = parseInt(process.env.PORT || process.argv[2] || '8888', 10);
const ROOT_DIR = __dirname;
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

// Active Multiplayer Rooms: code -> { code, host: Client, guest: Client, createdAt }
const rooms = new Map();

function generateRoomCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!rooms.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

// Encode an unmasked Server->Client RFC 6455 WebSocket frame
function encodeWsFrame(payloadBuffer, opcode = 0x01) {
  const len = payloadBuffer.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuffer]);
}

function sendJson(client, obj) {
  if (!client || client.closed) return;
  try {
    const data = Buffer.from(JSON.stringify(obj), 'utf8');
    client.socket.write(encodeWsFrame(data, 0x01));
  } catch (e) {}
}

function sendRawText(client, textBuffer) {
  if (!client || client.closed) return;
  try {
    client.socket.write(encodeWsFrame(textBuffer, 0x01));
  } catch (e) {}
}

// HTTP Static Server + Health Check API
const server = http.createServer((req, res) => {
  // CORS headers so external static hosts (e.g. GitHub Pages) can also use this relay!
  res.setHeader('Access-Control-Allow-Origin', '*');

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, mode: 'websocket-relay' }));
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const safePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(safePath).pipe(res);
  });
});

// RFC 6455 WebSocket Upgrade Handler (/ws)
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash('sha1')
    .update(key + WS_MAGIC)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  socket.setNoDelay(true);

  const client = {
    socket,
    closed: false,
    roomCode: null,
    role: null,
    recvBuf: Buffer.alloc(0)
  };

  socket.on('data', (chunk) => {
    client.recvBuf = Buffer.concat([client.recvBuf, chunk]);

    while (client.recvBuf.length >= 2) {
      const firstByte = client.recvBuf[0];
      const secondByte = client.recvBuf[1];
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (client.recvBuf.length < 4) return;
        payloadLen = client.recvBuf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (client.recvBuf.length < 10) return;
        payloadLen = Number(client.recvBuf.readBigUInt64BE(2));
        offset = 10;
      }

      if (payloadLen > 2 * 1024 * 1024) {
        socket.destroy();
        return;
      }

      const maskLen = masked ? 4 : 0;
      const totalFrameLen = offset + maskLen + payloadLen;
      if (client.recvBuf.length < totalFrameLen) return;

      const payload = Buffer.allocUnsafe(payloadLen);
      if (masked) {
        const maskKey = client.recvBuf.subarray(offset, offset + 4);
        const enc = client.recvBuf.subarray(offset + 4, totalFrameLen);
        for (let i = 0; i < payloadLen; i++) {
          payload[i] = enc[i] ^ maskKey[i & 3];
        }
      } else {
        client.recvBuf.copy(payload, 0, offset, totalFrameLen);
      }

      client.recvBuf = client.recvBuf.subarray(totalFrameLen);

      if (opcode === 0x08) {
        // Close frame
        cleanupClient(client);
        socket.end();
        return;
      } else if (opcode === 0x09) {
        // Ping -> Pong
        if (!client.closed) socket.write(encodeWsFrame(payload, 0x0a));
      } else if (opcode === 0x01 || opcode === 0x02) {
        handleClientMessage(client, payload);
      }
    }
  });

  socket.on('close', () => cleanupClient(client));
  socket.on('error', () => cleanupClient(client));
});

function handleClientMessage(client, payloadBuf) {
  // Fast-path relay: once paired in a room, game packets start with '{"t":"g"' or '{"t":"i"' or '{"t":"p"'
  // Only parse lobby control frames ('create', 'join', 'leave') on the server!
  const firstPreview = payloadBuf.subarray(0, 18).toString('utf8');
  if (
    client.roomCode &&
    (firstPreview.startsWith('{"t":"s"') ||
     firstPreview.startsWith('{"t":"i"') ||
     firstPreview.startsWith('{"t":"p"') ||
     firstPreview.startsWith('{"t":"o"') ||
     firstPreview.startsWith('{"t":"c"'))
  ) {
    const room = rooms.get(client.roomCode);
    if (!room) return;
    const peer = client.role === 'host' ? room.guest : room.host;
    if (peer && !peer.closed) {
      sendRawText(peer, payloadBuf);
    }
    return;
  }

  let msg;
  try {
    msg = JSON.parse(payloadBuf.toString('utf8'));
  } catch (e) {
    return;
  }

  if (msg.t === 'create') {
    cleanupClient(client);
    const code = generateRoomCode();
    client.roomCode = code;
    client.role = 'host';
    rooms.set(code, { code, host: client, guest: null, createdAt: Date.now() });
    sendJson(client, { t: 'created', code });
    return;
  }

  if (msg.t === 'join') {
    const code = String(msg.code || '').trim();
    const room = rooms.get(code);
    if (!room || !room.host || room.host.closed) {
      sendJson(client, { t: 'error', message: 'Room not found or host is offline. Please check the 6-digit code.' });
      return;
    }
    if (room.guest && !room.guest.closed) {
      sendJson(client, { t: 'error', message: 'Room is already full (2/2 players).' });
      return;
    }
    cleanupClient(client);
    client.roomCode = code;
    client.role = 'guest';
    room.guest = client;

    sendJson(client, { t: 'joined', code, role: 'guest' });
    sendJson(room.host, { t: 'peer_joined', code });
    return;
  }

  if (msg.t === 'leave') {
    cleanupClient(client);
  }
}

function cleanupClient(client) {
  if (!client.roomCode) return;
  const code = client.roomCode;
  const role = client.role;
  client.roomCode = null;
  client.role = null;

  const room = rooms.get(code);
  if (!room) return;

  if (role === 'host') {
    if (room.guest && !room.guest.closed) {
      sendJson(room.guest, { t: 'peer_left', message: 'Host (1P) disconnected' });
      room.guest.roomCode = null;
      room.guest.role = null;
    }
    rooms.delete(code);
  } else if (role === 'guest') {
    room.guest = null;
    if (room.host && !room.host.closed) {
      sendJson(room.host, { t: 'peer_left', message: 'Partner (2P) left the room' });
    }
  }
}

// Periodic cleanup of stale empty rooms (> 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if ((!room.host || room.host.closed) || (!room.guest && now - room.createdAt > 7200000)) {
      rooms.delete(code);
    }
  }
}, 60000).unref();

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        list.push(net.address);
      }
    }
  }
  return list;
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log('==============================================================');
    console.log('  CONTRA: SHATTERED OPS HD - Online Co-op Relay Server Ready!');
    console.log('==============================================================');
    console.log(`  Local URL:  http://localhost:${PORT}`);
    ips.forEach((ip) => console.log(`  LAN URL:    http://${ip}:${PORT}`));
    console.log('--------------------------------------------------------------');
    console.log(`  Public Tunnel Command (Zero-install cross-network co-op):`);
    console.log(`  ssh -R 80:localhost:${PORT} nokey@localhost.run`);
    console.log('==============================================================');
  });
}

module.exports = { server, encodeWsFrame };
