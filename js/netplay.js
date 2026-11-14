// ============================================================================
// CONTRA: SHATTERED OPS HD - Cross-Network Real-Time Online Co-op Engine
// Supports Dual Transports:
//   1) WebSocket Relay Server (server.js / wss:// tunnel - 100% NAT penetration)
//   2) Serverless WebRTC P2P (PeerJS + Domestic/Global STUN - Zero backend)
// Architecture: Host-Authoritative 30Hz World Sync + 60Hz Client Interpolation
//               + Monotonic Sequence Input Streaming (Zero Desync / Zero Drop)
// ============================================================================
window.Contra = window.Contra || {};

(function (ns) {
  'use strict';

  const PEERJS_CDNS = [
    'https://fastly.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
  ];

  // Domestic + Global STUN ICE servers for fast cross-carrier NAT traversal
  const ICE_SERVERS = [
    { urls: 'stun:stun.qq.com:3478' },
    { urls: 'stun:stun.miwifi.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' }
  ];

  function r1(n) {
    return Math.round((n || 0) * 10) / 10;
  }

  function loadPeerJS() {
    if (typeof window !== 'undefined' && window.Peer) {
      return Promise.resolve(window.Peer);
    }
    return new Promise((resolve, reject) => {
      let idx = 0;
      function tryNext() {
        if (idx >= PEERJS_CDNS.length) {
          reject(new Error('Failed to load WebRTC P2P module. Check network or switch to WebSocket Server mode.'));
          return;
        }
        const s = document.createElement('script');
        s.src = PEERJS_CDNS[idx++];
        s.async = true;
        s.onload = () => {
          if (window.Peer) resolve(window.Peer);
          else tryNext();
        };
        s.onerror = tryNext;
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  class NetplayManager {
    constructor() {
      this.active = false;          // True once room is connected with peer
      this.role = null;             // 'host' (1P Bill) | 'guest' (2P Lance) | null
      this.transport = 'auto';      // 'ws' | 'p2p'
      this.roomCode = '';
      this.status = 'offline';      // 'offline' | 'connecting' | 'waiting' | 'connected' | 'error'
      this.statusText = 'Not Connected';
      this.rttMs = 0;

      this.ws = null;
      this.peer = null;
      this.conn = null;
      this.customWsUrl = '';

      this.game = null;
      this.onStatusChange = null;

      // Host: event replication buffer & remote Guest input state
      this._eventQueue = [];
      this._remoteInput = {
        l: 0, r: 0, u: 0, d: 0, f: 0, jp: 0,
        fs: 0, js: 0, ds: 0, gs: 0, ss: 0
      };
      this._ackSeq = { fs: 0, js: 0, ds: 0, gs: 0, ss: 0 };

      // Guest: monotonic sequence counters for edge-triggered actions
      this._localSeq = { fs: 0, js: 0, ds: 0, gs: 0, ss: 0 };
      this._lastBgm = null;
      this._pingTimer = null;
      this._connectTimer = null;
      this._iceWatch = null;

      // Auto mode: relay pairing first, then try to upgrade to a real direct
      // WebRTC link (signaling is relayed, so only NAT decides the outcome).
      this.autoMode = false;
      this.detectedRelayUrl = '';
      this._direct = null;        // { pc, channel, timer, pendingIce }
      this._directActive = false;
    }

    bindGame(game) {
      this.game = game;
      this._installHostFXHooks(game);
    }

    isHost() {
      return this.active && this.role === 'host';
    }

    isGuest() {
      return this.active && this.role === 'guest';
    }

    _setStatus(status, text) {
      if (status === 'error') this._clearConnectTimer();
      this.status = status;
      this.statusText = text;
      if (this.onStatusChange) {
        this.onStatusChange({
          status: this.status,
          text: this.statusText,
          role: this.role,
          roomCode: this.roomCode,
          transport: this.transport,
          rttMs: this.rttMs,
          active: this.active
        });
      }
    }

    // Detect if current origin runs server.js (/api/health)
    async detectBestTransport() {
      if (this.customWsUrl) return 'ws';
      if (typeof window === 'undefined' || !window.location) return 'p2p';
      if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
        return 'p2p';
      }
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), 1200) : null;
        const res = await fetch('/api/health', ctrl ? { signal: ctrl.signal } : undefined);
        if (timer) clearTimeout(timer);
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.ok) return 'ws';
        }
      } catch (e) {}
      return 'p2p';
    }

    getDefaultWsUrl() {
      if (this.customWsUrl) return this.customWsUrl;
      if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
        const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        return proto + window.location.host + '/ws';
      }
      return 'ws://localhost:8888/ws';
    }

    getInviteLink() {
      if (!this.roomCode || typeof window === 'undefined') return '';
      const url = new URL(window.location.href);
      url.searchParams.set('room', this.roomCode);
      url.searchParams.set('mode', this.autoMode ? 'auto' : this.transport);
      const relayUrl = this.customWsUrl || this.detectedRelayUrl;
      if (this.transport === 'ws' && relayUrl) {
        url.searchParams.set('ws', relayUrl);
      }
      return url.toString();
    }

    disconnect(reasonText) {
      this._clearConnectTimer();
      this._clearIceWatch();
      this._directActive = false;
      this._cleanupDirect();
      if (this._pingTimer) {
        clearInterval(this._pingTimer);
        this._pingTimer = null;
      }
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
        this.ws = null;
      }
      if (this.conn) {
        try { this.conn.close(); } catch (e) {}
        this.conn = null;
      }
      if (this.peer) {
        try { this.peer.destroy(); } catch (e) {}
        this.peer = null;
      }
      const wasGuest = this.role === 'guest';
      this.active = false;
      this.role = null;
      this.roomCode = '';
      this.rttMs = 0;

      if (wasGuest && this.game) {
        ns.audio.stopBGM();
        this.game.state = 'title';
      }
      this._setStatus('offline', reasonText || 'Disconnected');
    }

    _clearConnectTimer() {
      if (this._connectTimer) {
        clearTimeout(this._connectTimer);
        this._connectTimer = null;
      }
    }

    _clearIceWatch() {
      if (this._iceWatch) {
        clearInterval(this._iceWatch);
        this._iceWatch = null;
      }
    }

    // Fail fast (and with an actionable hint) when NAT traversal is hopeless,
    // instead of leaving the player on "Connecting..." for the full timeout.
    _watchP2PIce(conn) {
      this._clearIceWatch();
      const startedAt = Date.now();
      this._iceWatch = setInterval(() => {
        if (!conn || this.active || this.conn !== conn) {
          this._clearIceWatch();
          return;
        }
        const pc = conn.peerConnection;
        const state = pc && pc.iceConnectionState;
        if (state === 'failed') {
          this._clearIceWatch();
          const hint = this.role === 'host'
            ? 'the partner could not reach you directly (strict NAT). Ask them to retry, or switch Netplay Transport to "Auto Select" to use the WebSocket relay.'
            : 'your network could not open a direct path to the host (strict NAT). Switch Netplay Transport to "Auto Select" to use the WebSocket relay.';
          this._setStatus('error', 'P2P direct connection failed — ' + hint);
          this.conn = null;
          if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
          return;
        }
        if (Date.now() - startedAt > 35000) this._clearIceWatch();
      }, 400);
    }

    // Safety net: give the player feedback if the relay is unreachable or the
    // P2P handshake cannot complete. Non-destructive on purpose: a slow
    // WebRTC/ICE negotiation can still succeed afterwards, and a premature
    // disconnect() would kill it, so the transport keeps trying in the background.
    _armConnectTimeout(ms, hint) {
      this._clearConnectTimer();
      this._connectTimer = setTimeout(() => {
        this._connectTimer = null;
        if (this.active) return;
        this._setStatus(
          'error',
          `Still not connected after ${Math.round(ms / 1000)}s — the network handshake may be slow. ${hint || ''}`.trim()
        );
      }, ms);
    }

    // Guard against the most common lobby mistake: a player who already owns or
    // joined a room clicks CREATE/JOIN again. That used to silently tear the old
    // room down, so the two players ended up with mismatched codes and
    // "peer-unavailable" errors. Now the room is kept and the user gets a hint.
    _warnAlreadyInRoom() {
      if (!this.roomCode) return false;
      if (this.role === 'host') {
        this._setStatus(
          'error',
          `You are already hosting room ${this.roomCode}. Your partner must enter this code on their own device — do not click JOIN on this page. Press DISCONNECT to close this room first.`
        );
        return true;
      }
      if (this.active) {
        this._setStatus(
          'error',
          `You are already connected to room ${this.roomCode}. Press DISCONNECT first if you want to leave it.`
        );
        return true;
      }
      return false;
    }

    // ========================================================================
    // Create Room (Host = 1P Bill) & Join Room (Guest = 2P Lance)
    // ========================================================================
    async createRoom(preferredMode, wsUrlOverride) {
      if (this._warnAlreadyInRoom()) return;
      this.disconnect();
      if (wsUrlOverride !== undefined) this.customWsUrl = wsUrlOverride.trim();
      // The old PeerJS-only P2P mode is superseded by Auto (relay pairing +
      // automatic direct upgrade); treat legacy 'p2p' requests as Auto.
      const requestedMode = preferredMode === 'p2p' ? 'auto' : preferredMode;
      const isAuto = (!requestedMode || requestedMode === 'auto');
      this.autoMode = isAuto;
      const mode = isAuto ? await this.detectBestTransport() : requestedMode;

      this.transport = mode;
      this.role = 'host';
      this._setStatus('connecting', 'Creating cross-network room...');

      if (mode === 'ws') {
        this._connectWs('create');
      } else {
        await this._createP2PRoom();
      }
    }

    async joinRoom(code, preferredMode, wsUrlOverride) {
      const cleanCode = String(code || '').replace(/\D/g, '').slice(0, 6);
      if (cleanCode.length !== 6) {
        this._setStatus('error', 'Please enter a valid 6-digit room code');
        return;
      }

      if (this._warnAlreadyInRoom()) return;

      this.disconnect();
      if (wsUrlOverride !== undefined) this.customWsUrl = wsUrlOverride.trim();
      // The old PeerJS-only P2P mode is superseded by Auto (relay pairing +
      // automatic direct upgrade); treat legacy 'p2p' requests as Auto.
      const requestedMode = preferredMode === 'p2p' ? 'auto' : preferredMode;
      const isAuto = (!requestedMode || requestedMode === 'auto');
      this.autoMode = isAuto;
      const mode = isAuto ? await this.detectBestTransport() : requestedMode;

      this.transport = mode;
      this.role = 'guest';
      this.roomCode = cleanCode;
      this._setStatus('connecting', `Connecting to room ${cleanCode}...`);

      if (mode === 'ws') {
        this._connectWs('join', cleanCode);
        this._armConnectTimeout(20000, 'Check that the host created the room with the same transport mode and try again.');
      } else {
        this._armConnectTimeout(30000, 'If this keeps happening, switch Netplay Transport to "Auto Select", or fill in a custom relay URL under the transport selector.');
        await this._joinP2PRoom(cleanCode);
      }
    }

    // ------------------------------------------------------------------------
    // Transport 1: WebSocket Room Relay
    // ------------------------------------------------------------------------
    _connectWs(action, code) {
      const url = this.getDefaultWsUrl();
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        this._setStatus('error', `Cannot connect to server: ${url}`);
        return;
      }
      this.ws = ws;

      ws.onopen = () => {
        if (action === 'create') {
          ws.send(JSON.stringify({ t: 'create' }));
        } else {
          ws.send(JSON.stringify({ t: 'join', code }));
        }
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          this._handleRawMessage(ev.data);
        }
      };

      ws.onerror = () => {
        if (!this.active && this.ws === ws) {
          this._setStatus('error', `WebSocket connection failed (${url}). You can switch to Cloud P2P mode.`);
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) {
          this.ws = null;
          if (this.status !== 'error') {
            this.disconnect('Connection to relay server closed');
          }
        }
      };
    }

    // ------------------------------------------------------------------------
    // Transport 2: Serverless WebRTC P2P (PeerJS Cloud + Multi-STUN)
    // ------------------------------------------------------------------------
    async _createP2PRoom() {
      let PeerClass;
      try {
        PeerClass = await loadPeerJS();
      } catch (err) {
        this._setStatus('error', err.message);
        return;
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const peerId = 'contra-ops-hd-' + code;

      const peer = new PeerClass(peerId, {
        config: { iceServers: ICE_SERVERS }
      });
      this.peer = peer;

      peer.on('open', () => {
        this.roomCode = code;
        this._setStatus('waiting', `Room Ready (${code}) — Waiting for 2P partner to join...`);
      });

      peer.on('connection', (conn) => {
        if (this.conn && this.conn.open) {
          conn.close();
          return;
        }
        this.conn = conn;
        this._bindP2PConn(conn);
        this._watchP2PIce(conn);
      });

      peer.on('error', (err) => {
        const type = err && err.type;
        if (type === 'unavailable-id') {
          this._createP2PRoom();
          return;
        }
        if (type === 'peer-unavailable') {
          // A guest's peer vanished while the WebRTC handshake was in flight
          // (closed the tab / refreshed / their signaling socket dropped).
          // Our room is still valid, so keep waiting instead of failing hard.
          if (this.conn && !this.conn.open) {
            try { this.conn.close(); } catch (e) {}
            this.conn = null;
          }
          this._setStatus(
            'waiting',
            `Room ${this.roomCode || ''} is still open — the partner's connection dropped during the handshake. Ask them to open the invite link again.`
          );
          return;
        }
        this._setStatus('error', 'P2P signaling error: ' + (type || 'Connection failed'));
      });
    }

    async _joinP2PRoom(code) {
      let PeerClass;
      try {
        PeerClass = await loadPeerJS();
      } catch (err) {
        this._setStatus('error', err.message);
        return;
      }
      // The join attempt may have been cancelled/timed out while the P2P
      // module was loading - do not create a stale peer in that case.
      if (this.role !== 'guest' || this.roomCode !== code) return;

      const peer = new PeerClass({
        config: { iceServers: ICE_SERVERS }
      });
      this.peer = peer;

      peer.on('open', () => {
        // PeerJS 1.5.x serializers: raw / json / binary / binary-utf8 / default.
        // 'none' is not a valid key (it throws "not a constructor" inside connect()),
        // and this game exchanges plain JSON strings, so 'raw' is the right mode.
        let conn;
        try {
          conn = peer.connect('contra-ops-hd-' + code, {
            reliable: true,
            serialization: 'raw'
          });
        } catch (err) {
          this._setStatus('error', `P2P connection failed: ${err && err.message ? err.message : 'unknown error'}`);
          return;
        }
        this.conn = conn;
        this._bindP2PConn(conn);
        this._watchP2PIce(conn);
      });

      peer.on('error', (err) => {
        const msg = err && err.type === 'peer-unavailable'
          ? `Room ${code} not found — the code is wrong or the host's room is closed. Only the host clicks CREATE; ask them for a fresh 6-digit code.`
          : 'P2P connection error: ' + (err && err.type ? err.type : 'Network restricted') + ' — please retry.';
        this._setStatus('error', msg);
      });
    }

    _bindP2PConn(conn) {
      conn.on('open', () => {
        this._onPeerPaired();
      });
      conn.on('data', (data) => {
        if (typeof data === 'string') {
          this._handleRawMessage(data);
        } else if (data && typeof data === 'object') {
          this._handlePacket(data);
        }
      });
      conn.on('close', () => {
        this.disconnect('Partner left the online session');
      });
      conn.on('error', () => {
        this.disconnect('P2P data channel interrupted');
      });
    }

    // Low-level packet sender across active transport
    _send(obj) {
      const raw = JSON.stringify(obj);
      const direct = this._direct;
      if (this._directActive && direct && direct.channel && direct.channel.readyState === 'open') {
        try { direct.channel.send(raw); return; } catch (e) {}
      }
      if (this.transport === 'ws' && this.ws && this.ws.readyState === 1) {
        this.ws.send(raw);
      } else if (this.transport === 'p2p' && this.conn && this.conn.open) {
        this.conn.send(raw);
      }
    }

    // ========================================================================
    // Relay-assisted direct P2P upgrade (Auto mode)
    // The relay is always used for pairing; once paired, both browsers open an
    // RTCPeerConnection and exchange SDP/ICE through the relay. If the direct
    // link comes up, game data switches to it (low latency); otherwise the
    // relay keeps carrying the game (slow but reliable).
    // ========================================================================
    _startDirectUpgrade() {
      if (this._direct || this._directActive || typeof RTCPeerConnection === 'undefined') return;
      const self = this;
      let pc;
      try {
        pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      } catch (e) {
        return;
      }
      const entry = { pc, channel: null, timer: null, pendingIce: [] };
      this._direct = entry;

      pc.onicecandidate = (ev) => {
        if (ev.candidate && self.active) {
          self._send({ t: 'rtc-ice', c: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') self._abortDirectUpgrade('ice-failed');
      };
      pc.ondatachannel = (ev) => self._bindDirectChannel(ev.channel);

      if (this.role === 'guest') {
        const dc = pc.createDataChannel('game', { ordered: true });
        this._bindDirectChannel(dc);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            self._send({ t: 'rtc-offer', sdp: pc.localDescription.sdp, type: pc.localDescription.type });
          })
          .catch(() => self._abortDirectUpgrade('offer-failed'));
      }

      entry.timer = setTimeout(() => self._abortDirectUpgrade('timeout'), 12000);
    }

    _handleDirectSignal(msg) {
      if (!this._direct) this._startDirectUpgrade();
      if (!this._direct) return;
      const pc = this._direct.pc;
      const entry = this._direct;
      const self = this;

      const flushIce = () => {
        const pending = entry.pendingIce.splice(0);
        pending.forEach((c) => pc.addIceCandidate(c).catch(() => {}));
      };

      if (msg.t === 'rtc-offer') {
        pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
          .then(() => { flushIce(); return pc.createAnswer(); })
          .then((answer) => pc.setLocalDescription(answer))
          .then(() => {
            self._send({ t: 'rtc-answer', sdp: pc.localDescription.sdp, type: pc.localDescription.type });
          })
          .catch(() => self._abortDirectUpgrade('answer-failed'));
      } else if (msg.t === 'rtc-answer') {
        if (pc.signalingState === 'have-local-offer') {
          pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
            .then(flushIce)
            .catch(() => self._abortDirectUpgrade('remote-answer-failed'));
        }
      } else if (msg.t === 'rtc-ice' && msg.c) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          pc.addIceCandidate(msg.c).catch(() => {});
        } else {
          entry.pendingIce.push(msg.c);
        }
      }
    }

    _bindDirectChannel(dc) {
      if (!this._direct) return;
      this._direct.channel = dc;
      const self = this;
      dc.onopen = () => self._onDirectOpen();
      dc.onmessage = (ev) => {
        const data = ev.data;
        if (typeof data === 'string') self._handleRawMessage(data);
        else if (data && typeof data === 'object') self._handlePacket(data);
      };
      dc.onclose = () => self._onDirectLost();
      dc.onerror = () => self._onDirectLost();
      if (dc.readyState === 'open') self._onDirectOpen();
    }

    _onDirectOpen() {
      if (this._directActive || !this._direct) return;
      if (this._direct.timer) {
        clearTimeout(this._direct.timer);
        this._direct.timer = null;
      }
      this._directActive = true;
      const roleLabel = this.role === 'host' ? '1P BILL (HOST)' : '2P LANCE (GUEST)';
      this._setStatus('connected', `Online Co-op Connected! Role: ${roleLabel} · DIRECT P2P (low latency)`);
    }

    _onDirectLost() {
      if (!this._directActive) return;
      this._directActive = false;
      this._cleanupDirect();
      if (!this.active) return;
      const roleLabel = this.role === 'host' ? '1P BILL (HOST)' : '2P LANCE (GUEST)';
      if (this.ws && this.ws.readyState === 1) {
        this._setStatus('connected', `Online Co-op Connected! Role: ${roleLabel} · relay fallback (direct link lost)`);
      } else {
        this.disconnect('Direct P2P link lost and the relay is unavailable');
      }
    }

    _abortDirectUpgrade() {
      if (!this._direct || this._directActive) return;
      this._cleanupDirect();
      if (!this.active) return;
      const roleLabel = this.role === 'host' ? '1P BILL (HOST)' : '2P LANCE (GUEST)';
      this._setStatus('connected', `Online Co-op Connected! Role: ${roleLabel} · relay (direct P2P unavailable — NAT)`);
    }

    _cleanupDirect() {
      const d = this._direct;
      this._direct = null;
      if (!d) return;
      if (d.timer) {
        clearTimeout(d.timer);
        d.timer = null;
      }
      if (d.channel) {
        d.channel.onopen = null;
        d.channel.onmessage = null;
        d.channel.onclose = null;
        d.channel.onerror = null;
        try { d.channel.close(); } catch (e) {}
      }
      try { d.pc.close(); } catch (e) {}
    }

    _onPeerPaired() {
      this._clearConnectTimer();
      this._clearIceWatch();
      this.active = true;
      this._ackSeq = { fs: 0, js: 0, ds: 0, gs: 0, ss: 0 };
      this._localSeq = { fs: 0, js: 0, ds: 0, gs: 0, ss: 0 };
      this._eventQueue = [];

      const roleLabel = this.role === 'host' ? '1P BILL (HOST)' : '2P LANCE (GUEST)';
      this._setStatus('connected', `Online Co-op Connected! Role: ${roleLabel}`);

      if (this._pingTimer) clearInterval(this._pingTimer);
      this._pingTimer = setInterval(() => {
        if (this.active) this._send({ t: 'p', ts: Date.now() });
      }, 1500);

      // Host immediately launches 2-Player Online Co-op Session!
      if (this.role === 'host' && this.game) {
        this.game.startNewGame(true, this.game.selectedStartStage || 1);
      }

      // Auto mode: relay pairing succeeded - try to upgrade to a real direct
      // link. Signaling rides on the relay, so only NAT decides the outcome.
      if (this.autoMode && this.transport === 'ws') {
        const self = this;
        setTimeout(() => {
          if (self.active && !self._directActive) self._startDirectUpgrade();
        }, 300);
      }
    }

    _handleRawMessage(str) {
      let msg;
      try {
        msg = JSON.parse(str);
      } catch (e) {
        return;
      }
      this._handlePacket(msg);
    }

    _handlePacket(msg) {
      if (!msg || !msg.t) return;

      switch (msg.t) {
        case 'created':
          this.roomCode = msg.code;
          this._setStatus('waiting', `Room Created (${msg.code}) — Waiting for 2P partner to join...`);
          break;

        case 'joined':
          this.roomCode = msg.code;
          this._onPeerPaired();
          break;

        case 'peer_joined':
          this._onPeerPaired();
          break;

        case 'peer_left':
          this.disconnect(msg.message || 'Partner disconnected');
          break;

        case 'error':
          this._setStatus('error', msg.message || 'Online session error');
          break;

        case 'p':
          // Ping -> Pong
          this._send({ t: 'o', ts: msg.ts });
          break;

        case 'o':
          // Pong RTT calculation
          this.rttMs = Math.max(1, Date.now() - (msg.ts || Date.now()));
          this._setStatus('connected', this.statusText);
          break;

        case 'i':
          // Guest -> Host 60Hz Input Packet
          if (this.isHost()) {
            this._remoteInput = msg;
          }
          break;

        case 's':
          // Host -> Guest 30Hz World Snapshot
          if (this.isGuest() && this.game) {
            this.applyWorldSnapshot(this.game, msg);
          }
          break;

        case 'rtc-offer':
        case 'rtc-answer':
        case 'rtc-ice':
          // Relay-assisted direct P2P upgrade signaling.
          this._handleDirectSignal(msg);
          break;

        case 'c':
          // Quick Tactical Callout or Co-op Command!
          if (msg.cmd === 'konami' && this.isHost() && this.game) {
            this.game.activateKonami();
            break;
          }
          if (this.game && this.game.particles) {
            const pIdx = msg.p === 1 ? 1 : 0;
            const pl = this.game.players[pIdx];
            if (pl && pl.active) {
              this.game.particles.spawnText(pl.x, pl.y - 102, msg.txt, pIdx === 0 ? '#40f8ff' : '#ffd740', 18);
              ns.audio.sfx('weaponSwap');
            }
          }
          break;
      }
    }

    requestKonami() {
      if (this.isGuest()) {
        this._send({ t: 'c', cmd: 'konami' });
      }
    }

    sendCallout(text) {
      if (!this.active || !this.game) return;
      const pIdx = this.role === 'host' ? 0 : 1;
      const pl = this.game.players[pIdx];
      if (pl && pl.active) {
        this.game.particles.spawnText(pl.x, pl.y - 102, text, pIdx === 0 ? '#40f8ff' : '#ffd740', 18);
        ns.audio.sfx('weaponSwap');
      }
      this._send({ t: 'c', p: pIdx, txt: text });
    }

    // ========================================================================
    // Guest Input Streaming & Host Remote Input Consumption
    // ========================================================================
    sendGuestInputFrame() {
      if (!this.isGuest()) return;
      const inp = ns.input.getLocalPrimaryInput();

      // Edge-triggered actions must be sampled every frame...
      if (inp.firePressed) this._localSeq.fs++;
      if (inp.jumpPressed) this._localSeq.js++;
      if (inp.dashPressed) this._localSeq.ds++;
      if (inp.grenadePressed) this._localSeq.gs++;
      if (inp.swapPressed) this._localSeq.ss++;

      // ...but directional/held state only needs ~30Hz. Coalescing halves the
      // relay traffic (important for the Cloudflare relay request quota) while
      // keeping action latency at <= one frame.
      this._inputFrameCounter = (this._inputFrameCounter || 0) + 1;
      if (this._inputFrameCounter % 2 !== 0) return;

      this._send({
        t: 'i',
        l: inp.left ? 1 : 0,
        r: inp.right ? 1 : 0,
        u: inp.up ? 1 : 0,
        d: inp.down ? 1 : 0,
        f: inp.fire ? 1 : 0,
        jp: inp.jump ? 1 : 0,
        fs: this._localSeq.fs,
        js: this._localSeq.js,
        ds: this._localSeq.ds,
        gs: this._localSeq.gs,
        ss: this._localSeq.ss
      });
    }

    getRemoteGuestInput() {
      const m = this._remoteInput;
      const firePressed = m.fs > this._ackSeq.fs;
      const jumpPressed = m.js > this._ackSeq.js;
      const dashPressed = m.ds > this._ackSeq.ds;
      const grenadePressed = m.gs > this._ackSeq.gs;
      const swapPressed = m.ss > this._ackSeq.ss;

      this._ackSeq.fs = m.fs;
      this._ackSeq.js = m.js;
      this._ackSeq.ds = m.ds;
      this._ackSeq.gs = m.gs;
      this._ackSeq.ss = m.ss;

      return {
        left: !!m.l,
        right: !!m.r,
        up: !!m.u,
        down: !!m.d,
        fire: !!m.f,
        jump: !!m.jp,
        firePressed,
        jumpPressed,
        dashPressed,
        grenadePressed,
        swapPressed
      };
    }

    // ========================================================================
    // Host Discrete FX/SFX Hook -> Replicated to Guest
    // ========================================================================
    _installHostFXHooks(game) {
      const self = this;
      const pSys = game.particles;

      function pushEv(tuple) {
        if (self.isHost() && self._eventQueue.length < 36) {
          self._eventQueue.push(tuple);
        }
      }

      const origSfx = ns.audio.sfx.bind(ns.audio);
      ns.audio.sfx = function (name) {
        origSfx(name);
        pushEv(['sfx', name]);
      };

      const origExp = pSys.spawnExplosion.bind(pSys);
      pSys.spawnExplosion = function (x, y, radius, heavy) {
        origExp(x, y, radius, heavy);
        pushEv(['exp', Math.round(x), Math.round(y), Math.round(radius || 48), heavy ? 1 : 0]);
      };

      const origMuz = pSys.spawnMuzzle.bind(pSys);
      pSys.spawnMuzzle = function (x, y, ax, ay, glow) {
        origMuz(x, y, ax, ay, glow);
        pushEv(['muz', Math.round(x), Math.round(y), r1(ax), r1(ay), glow || 'gold']);
      };

      const origShell = pSys.spawnShell.bind(pSys);
      pSys.spawnShell = function (x, y, facing) {
        origShell(x, y, facing);
        pushEv(['shl', Math.round(x), Math.round(y), facing]);
      };

      const origGhost = pSys.spawnGhost.bind(pSys);
      pSys.spawnGhost = function (x, y, facing, isP1, pose) {
        origGhost(x, y, facing, isP1, pose);
        pushEv(['gho', Math.round(x), Math.round(y), facing, isP1 ? 1 : 0, pose]);
      };

      const origSparks = pSys.spawnHitSparks.bind(pSys);
      pSys.spawnHitSparks = function (x, y, count, col) {
        origSparks(x, y, count, col);
        pushEv(['spk', Math.round(x), Math.round(y), count || 6, col || '#ffd740']);
      };

      const origSplash = pSys.spawnWaterSplash.bind(pSys);
      pSys.spawnWaterSplash = function (x, y, isLava) {
        origSplash(x, y, isLava);
        pushEv(['wat', Math.round(x), Math.round(y), isLava ? 1 : 0]);
      };

      const origText = pSys.spawnText.bind(pSys);
      pSys.spawnText = function (x, y, text, color, size) {
        origText(x, y, text, color, size);
        pushEv(['txt', Math.round(x), Math.round(y), text, color || '#fff', size || 16]);
      };
    }

    // ========================================================================
    // Host -> Guest 30Hz Compact World Snapshot Serializer & Applier
    // ========================================================================
    broadcastWorldSnapshot(game) {
      if (!this.isHost()) return;

      const snap = {
        t: 's',
        gs: game.state,
        st: game.stageNum,
        di: game.diffIndex,
        ka: game.konamiActive ? 1 : 0,
        cx: r1(game.cameraX),
        sm: r1(game.shakeMag),
        st2: game.shakeTime,
        sf: r1(game.screenFlash),
        bw: game.bossWarnTimer,
        tm: game.stateTimer,
        hi: game.highScore,
        cl: game.continuesLeft,
        bgm: ns.audio.currentTrack || '',
        ev: this._eventQueue,
        pl: game.players.map((p) => ({
          a: p.active ? 1 : 0,
          x: r1(p.x),
          y: r1(p.y),
          vx: r1(p.vx),
          vy: r1(p.vy),
          f: p.facing,
          ax: r1(p.aimX),
          ay: r1(p.aimY),
          og: p.onGround ? 1 : 0,
          iw: p.inWater ? 1 : 0,
          s: p.state,
          lv: p.lives,
          hp: p.hp,
          mh: p.maxHp,
          sc: p.score,
          cb: p.combo,
          sl: p.slots,
          as: p.activeSlot,
          rf: p.rapidFire ? 1 : 0,
          gr: p.grenades,
          dc: p.dashCooldown,
          dt: p.dashTimer,
          iv: p.invulnTimer,
          bt: p.barrierTimer,
          at: p.animTimer,
          mv: p.moving ? 1 : 0,
          dd: p.deathTimer
        }))
      };
      this._eventQueue = [];

      if (game.level) {
        snap.br = game.level.bridgeSegments.map((b) => [b.alive ? 1 : 0, b.triggered ? 1 : 0, b.fuse]);
        snap.mp = game.level.movingPlatforms.map((m) => [r1(m.x), r1(m.y)]);
        snap.lg = game.level.laserGates.map((l) => [l.active ? 1 : 0, l.warning ? 1 : 0]);
      }

      const ent = game.entities;
      snap.en = ent.enemies.map((e) => [
        e.type, r1(e.x), r1(e.y), r1(e.vx || 0), r1(e.vy || 0),
        e.facing || -1, r1(e.angle || 0), e.open ? 1 : 0, r1(e.riseProgress || 0),
        e.shootTimer || 50, e.flashTimer || 0, r1(e.aimX || -1), r1(e.aimY || 0)
      ]);
      snap.co = ent.containers.map((c) => [c.kind, r1(c.x), r1(c.y), c.openAmount || 0, c.flashTimer || 0, c.power]);
      snap.pu = ent.powerups.map((p) => [r1(p.x), r1(p.y), p.powerType]);
      snap.pb = ent.playerBullets.map((b) => [b.weapon, r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), r1(b.radius || 8), b.lv2 ? 1 : 0]);
      snap.eb = ent.enemyBullets.map((b) => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy), r1(b.radius || 7), b.color || '#ff1744', b.destructible ? 1 : 0]);
      snap.gn = ent.grenades.map((g) => [r1(g.x), r1(g.y), r1(g.vx), r1(g.vy), r1(g.rot)]);
      snap.nz = ent.napalmZones.map((n) => [r1(n.x), r1(n.y), n.r]);

      if (game.boss) {
        snap.bs = this._serializeBoss(game.boss);
      }

      this._send(snap);
    }

    _serializeBoss(b) {
      const out = {
        a: b.active ? 1 : 0,
        dy: b.dying ? 1 : 0,
        dd: b.dead ? 1 : 0,
        fl: b.flash || 0,
        hr: r1(b.getHealthRatio() * 1000) / 1000
      };
      if (b.core) {
        out.c = [b.core.hp, b.core.maxHp, b.core.flash];
        out.cn = b.cannons.map((c) => [c.alive ? 1 : 0, c.flash]);
        out.ey = [b.eye.alive ? 1 : 0, b.eye.flash];
      } else if (b.head && b.segments) {
        out.hp = b.hp; out.mh = b.maxHp;
        out.hd = [r1(b.head.x), r1(b.head.y)];
        out.sg = b.segments.map((s) => [r1(s.x), r1(s.y), r1(s.r)]);
      } else if (b.tentacles) {
        out.hp = b.hp; out.mh = b.maxHp;
        out.p2 = b.phase2 ? 1 : 0;
        out.tn = b.tentacles.map((t) => [
          t.alive ? 1 : 0,
          t.flash,
          t.segs.map((s) => [Math.round(s.x), Math.round(s.y)])
        ]);
      } else {
        out.hp = b.hp; out.mh = b.maxHp;
        out.x = r1(b.x); out.y = r1(b.y); out.vx = r1(b.vx || 0);
      }
      return out;
    }

    applyWorldSnapshot(game, snap) {
      // Ensure matching Stage & Boss instance on Guest
      if (!game.level || game.stageNum !== snap.st) {
        game.stageNum = snap.st;
        game.level = new ns.Level(snap.st);
        game.particles.clear();
        game.particles.initWeather(game.level.theme);
        game.boss = ns.createBoss(game.level.bossType, 1);
        if (window.highlightStageBtn) window.highlightStageBtn(snap.st);
      }

      game.twoPlayers = true;
      game.diffIndex = snap.di || 0;
      const prevKa = game.konamiActive;
      game.konamiActive = !!snap.ka;
      if (!prevKa && game.konamiActive && typeof window !== 'undefined' && window.updateKonamiBadge) {
        window.updateKonamiBadge(true);
      }
      game.state = snap.gs;
      game.cameraX = snap.cx;
      game.shakeMag = snap.sm;
      game.shakeTime = snap.st2;
      game.screenFlash = snap.sf;
      game.bossWarnTimer = snap.bw;
      game.stateTimer = snap.tm;
      game.highScore = snap.hi;
      game.continuesLeft = snap.cl;

      // Sync BGM smoothly
      if (snap.bgm !== this._lastBgm) {
        this._lastBgm = snap.bgm;
        if (snap.bgm) ns.audio.startBGM(snap.bgm);
        else ns.audio.stopBGM();
      }

      // Sync Players
      while (game.players.length < snap.pl.length) {
        game.players.push(new ns.Player(game.players.length, 120, 120, 3, 3));
      }
      for (let i = 0; i < snap.pl.length; i++) {
        const sp = snap.pl[i];
        const p = game.players[i];
        p.active = !!sp.a;
        p.x = sp.x; p.y = sp.y; p.vx = sp.vx; p.vy = sp.vy;
        p.facing = sp.f; p.aimX = sp.ax; p.aimY = sp.ay;
        p.onGround = !!sp.og; p.inWater = !!sp.iw; p.state = sp.s;
        p.lives = sp.lv; p.hp = sp.hp; p.maxHp = sp.mh;
        p.score = sp.sc; p.combo = sp.cb;
        p.slots = sp.sl; p.activeSlot = sp.as;
        p.rapidFire = !!sp.rf; p.grenades = sp.gr;
        p.dashCooldown = sp.dc; p.dashTimer = sp.dt;
        p.invulnTimer = sp.iv; p.barrierTimer = sp.bt;
        p.animTimer = sp.at; p.moving = !!sp.mv; p.deathTimer = sp.dd;
      }

      // Sync Level dynamic parts
      if (snap.br && game.level) {
        for (let i = 0; i < snap.br.length && i < game.level.bridgeSegments.length; i++) {
          game.level.bridgeSegments[i].alive = !!snap.br[i][0];
          game.level.bridgeSegments[i].triggered = !!snap.br[i][1];
          game.level.bridgeSegments[i].fuse = snap.br[i][2];
        }
      }
      if (snap.mp && game.level) {
        for (let i = 0; i < snap.mp.length && i < game.level.movingPlatforms.length; i++) {
          game.level.movingPlatforms[i].x = snap.mp[i][0];
          game.level.movingPlatforms[i].y = snap.mp[i][1];
        }
      }
      if (snap.lg && game.level) {
        for (let i = 0; i < snap.lg.length && i < game.level.laserGates.length; i++) {
          game.level.laserGates[i].active = !!snap.lg[i][0];
          game.level.laserGates[i].warning = !!snap.lg[i][1];
        }
      }

      // Sync Entities
      const ent = game.entities;
      ent.enemies = (snap.en || []).map((a) => ({
        type: a[0], x: a[1], y: a[2], vx: a[3], vy: a[4],
        facing: a[5], angle: a[6], open: !!a[7], riseProgress: a[8],
        shootTimer: a[9], flashTimer: a[10], aimX: a[11], aimY: a[12]
      }));
      ent.containers = (snap.co || []).map((a) => ({
        kind: a[0], x: a[1], y: a[2], openAmount: a[3], flashTimer: a[4], power: a[5]
      }));
      ent.powerups = (snap.pu || []).map((a) => ({ x: a[0], y: a[1], powerType: a[2] }));
      ent.playerBullets = (snap.pb || []).map((a) => ({
        weapon: a[0], x: a[1], y: a[2], vx: a[3], vy: a[4], radius: a[5], lv2: !!a[6]
      }));
      ent.enemyBullets = (snap.eb || []).map((a) => ({
        x: a[0], y: a[1], vx: a[2], vy: a[3], radius: a[4], color: a[5], destructible: !!a[6]
      }));
      ent.grenades = (snap.gn || []).map((a) => ({
        x: a[0], y: a[1], vx: a[2], vy: a[3], rot: a[4]
      }));
      ent.napalmZones = (snap.nz || []).map((a) => ({ x: a[0], y: a[1], r: a[2] }));

      // Sync Boss
      if (snap.bs && game.boss) {
        const sb = snap.bs;
        const b = game.boss;
        b.active = !!sb.a; b.dying = !!sb.dy; b.dead = !!sb.dd; b.flash = sb.fl;
        if (sb.c && b.core) {
          b.core.hp = sb.c[0]; b.core.maxHp = sb.c[1]; b.core.flash = sb.c[2];
          sb.cn.forEach((cn, idx) => { if (b.cannons[idx]) { b.cannons[idx].alive = !!cn[0]; b.cannons[idx].flash = cn[1]; } });
          if (b.eye) { b.eye.alive = !!sb.ey[0]; b.eye.flash = sb.ey[1]; }
        } else if (sb.hd && b.head) {
          b.hp = sb.hp; b.maxHp = sb.mh;
          b.head.x = sb.hd[0]; b.head.y = sb.hd[1];
          b.segments = sb.sg.map((s) => ({ x: s[0], y: s[1], r: s[2] }));
        } else if (sb.tn && b.tentacles) {
          b.hp = sb.hp; b.maxHp = sb.mh;
          b.phase2 = !!sb.p2;
          sb.tn.forEach((tn, idx) => {
            if (b.tentacles[idx]) {
              b.tentacles[idx].alive = !!tn[0];
              b.tentacles[idx].flash = tn[1];
              b.tentacles[idx].segs = tn[2].map((pt) => ({ x: pt[0], y: pt[1] }));
            }
          });
        } else {
          b.hp = sb.hp; b.maxHp = sb.mh;
          b.x = sb.x; b.y = sb.y; b.vx = sb.vx;
        }
      }

      // Replay Discrete FX & SFX Events on Guest!
      const evs = snap.ev || [];
      const pSys = game.particles;
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        switch (ev[0]) {
          case 'sfx': ns.audio.sfx(ev[1]); break;
          case 'exp': pSys.spawnExplosion(ev[1], ev[2], ev[3], !!ev[4]); break;
          case 'muz': pSys.spawnMuzzle(ev[1], ev[2], ev[3], ev[4], ev[5]); break;
          case 'shl': pSys.spawnShell(ev[1], ev[2], ev[3]); break;
          case 'gho': pSys.spawnGhost(ev[1], ev[2], ev[3], !!ev[4], ev[5]); break;
          case 'spk': pSys.spawnHitSparks(ev[1], ev[2], ev[3], ev[4]); break;
          case 'wat': pSys.spawnWaterSplash(ev[1], ev[2], !!ev[3]); break;
          case 'txt': pSys.spawnText(ev[1], ev[2], ev[3], ev[4], ev[5]); break;
        }
      }
    }

    // Smooth 60FPS Dead-Reckoning Step on Guest between 30Hz Snapshots!
    stepGuestDeadReckoning(game) {
      if (!game.level) return;
      game.particles.update(game.level, game.level.theme);

      if (game.state !== 'playing') return;

      for (let i = 0; i < game.players.length; i++) {
        const p = game.players[i];
        if (!p.active) continue;
        p.x += p.vx;
        if (!p.onGround) p.y += p.vy;
        if (p.moving) p.animTimer++;
      }

      const ent = game.entities;
      for (let i = 0; i < ent.playerBullets.length; i++) {
        ent.playerBullets[i].x += ent.playerBullets[i].vx;
        ent.playerBullets[i].y += ent.playerBullets[i].vy;
      }
      for (let i = 0; i < ent.enemyBullets.length; i++) {
        ent.enemyBullets[i].x += ent.enemyBullets[i].vx;
        ent.enemyBullets[i].y += ent.enemyBullets[i].vy;
      }
      for (let i = 0; i < ent.enemies.length; i++) {
        ent.enemies[i].x += ent.enemies[i].vx || 0;
        if (ent.enemies[i].vy) ent.enemies[i].y += ent.enemies[i].vy;
      }
      for (let i = 0; i < ent.grenades.length; i++) {
        ent.grenades[i].x += ent.grenades[i].vx;
        ent.grenades[i].y += ent.grenades[i].vy;
        ent.grenades[i].rot += 0.28;
      }
    }
  }

  ns.netplay = new NetplayManager();
})(window.Contra);
