// Deploy as a Cloudflare Worker. Set MYSCRIPT_APP_KEY, MYSCRIPT_HMAC_KEY,
// and a long random BESTILLING_TOKEN as Worker secrets.
// Optional variables: BESTILLING_ORIGIN and MYSCRIPT_LANGUAGE.
const encoder = new TextEncoder();
const upstream = 'https://cloud.myscript.com/api/v4.0/iink/recognize/';
const maxBodyBytes = 160000;

function validStrokes(strokes) {
  if (!Array.isArray(strokes) || strokes.length < 1 || strokes.length > 300) return false;
  let points = 0;
  for (const stroke of strokes) {
    if (!stroke || !Array.isArray(stroke.x) || !Array.isArray(stroke.y) || !Array.isArray(stroke.t)) return false;
    const length = stroke.x.length;
    points += length;
    if (!length || stroke.y.length !== length || stroke.t.length !== length || points > 12000) return false;
    const position = value => Number.isInteger(value) && value >= 0 && value <= 2500;
    if (!stroke.x.every(position) || !stroke.y.every(position)) return false;
    if (!stroke.t.every((value, index) => Number.isInteger(value) && value >= (stroke.t[index - 1] ?? 0))) return false;
  }
  return true;
}

async function readLimited(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return body + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }
}

export default {
  async fetch(request, env) {
    const origin = env.BESTILLING_ORIGIN || 'https://pizzano.github.io';
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Cache-Control': 'no-store',
      Vary: 'Origin'
    };
    const respond = (body, status) => Response.json(body, { status, headers });
    if (request.headers.get('Origin') !== origin) return respond({ error: 'Origin refused' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'Method refused' }, 405);
    const { MYSCRIPT_APP_KEY: applicationKey, MYSCRIPT_HMAC_KEY: hmacKey, BESTILLING_TOKEN: token } = env;
    if (!applicationKey || !hmacKey || !token || token.length < 32) return respond({ error: 'Service not configured' }, 503);
    if (request.headers.get('Authorization') !== 'Bearer ' + token) return respond({ error: 'Access refused' }, 401);

    let strokes;
    try {
      const raw = await readLimited(request);
      if (!raw) return respond({ error: 'Empty or oversized ink' }, 400);
      ({ strokes } = JSON.parse(raw));
      if (!validStrokes(strokes)) return respond({ error: 'Invalid ink' }, 400);
    } catch {
      return respond({ error: 'Invalid request' }, 400);
    }

    const body = JSON.stringify({
      contentType: 'Text',
      scaleX: 25.4 / 96,
      scaleY: 25.4 / 96,
      configuration: {
        lang: env.MYSCRIPT_LANGUAGE || 'nb_NO',
        text: { configuration: { customLexicon: ['k. rull', 'k. tall', 'kebabpizza', 'pepperoni', 'løk', 'chips', 'medium'] } }
      },
      strokes: strokes.map(({ x, y, t }) => ({ x, y, t }))
    });
    try {
      const key = await crypto.subtle.importKey('raw', encoder.encode(applicationKey + hmacKey), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      const hmac = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
      const result = await fetch(upstream, {
        method: 'POST',
        headers: { applicationKey, hmac, 'Content-Type': 'application/json', Accept: 'text/plain' },
        body,
        signal: AbortSignal.timeout(11000)
      });
      if (!result.ok) return respond({ error: 'Recognition unavailable' }, 502);
      const text = (await result.text()).trim().slice(0, 500);
      return respond({ text }, 200);
    } catch {
      return respond({ error: 'Recognition unavailable' }, 502);
    }
  }
};
