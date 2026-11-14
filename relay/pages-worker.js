// ============================================================================
// CONTRA: SHATTERED OPS HD - Pages Functions advanced mode (_worker.js)
//
// Served by Cloudflare Pages for the project root, so the game and the
// WebSocket relay share ONE origin (https://shattered-ops.pages.dev):
//
//   /api/health -> relay health probe (JSON, used by js/netplay.js)
//   /ws         -> WebSocket room relay (delegated to the Durable Object
//                  namespace bound as env.RELAY, scripts/shattered-ops-relay)
//   everything else -> static game assets via env.ASSETS
//
// The Durable Object class itself lives in relay/src/index.js and is deployed
// separately as the "shattered-ops-relay" Worker (Pages cannot deploy DO
// classes, it can only bind them with the script_name key).
// ============================================================================

// Durable Objects never move after creation, and a single relay instance is
// shared by every room. This instance name is versioned so it can be recreated
// in a better data center; `locationHint` pins new instances to APAC-NE
// (Hong Kong / Tokyo / Seoul / Taipei) which is much closer to CN players than
// the default US-West placement.
const RELAY_INSTANCE = 'global-apac-v1';
const RELAY_LOCATION_HINT = 'apac-ne';

function relayStub(env) {
  const id = env.RELAY.idFromName(RELAY_INSTANCE);
  return env.RELAY.get(id, { locationHint: RELAY_LOCATION_HINT });
}

function healthResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight for the health probe (same origin today, but keep it
    // working if the game is ever hosted on another static host).
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

    if (url.pathname === '/api/health') {
      try {
        const t0 = Date.now();
        const res = await relayStub(env).fetch(new Request('https://relay.internal/health', request));
        const edgeToDoMs = Date.now() - t0;
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
        // Diagnostics: how far the Durable Object is from the edge that served
        // this request (small = same/nearby data center, large = cross-region hop).
        data.edgeToDoMs = edgeToDoMs;
        data.edgeColo = (request.cf && request.cf.colo) || null;
        return healthResponse(JSON.stringify(data), res.status);
      } catch (e) {
        return healthResponse(JSON.stringify({ ok: false, error: 'relay unavailable' }), 503);
      }
    }

    if (url.pathname === '/ws') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }
      return relayStub(env).fetch(request);
    }

    // Everything else is a normal static game asset.
    return env.ASSETS.fetch(request);
  }
};
