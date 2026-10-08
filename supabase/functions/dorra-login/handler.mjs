const allowedOrigins = new Set(['https://uppedbicycle680.github.io', 'http://localhost:4173', 'http://127.0.0.1:4173']);
const invalidCredentials = {error: 'Invalid username or password.', code: 'INVALID_CREDENTIALS'};
const rateLimited = {error: 'Too many sign-in attempts. Wait a minute and try again.', code: 'RATE_LIMIT'};

async function readInput(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let bytes = 0, text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) { await reader.cancel(); return null; }
      text += decoder.decode(value, {stream: true});
    }
    return JSON.parse(text + decoder.decode());
  } catch { return null; }
}

// Dependencies are injected so the deployed request path can be regression-tested
// without admin credentials or creating real Auth users.
export function createLoginHandler({lookup, getEmail, authenticate, ipHash}) {
  return async request => {
    const origin = request.headers.get('Origin');
    const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
    if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (value, status = 200) => new Response(JSON.stringify(value), {status, headers});
    if (origin && !allowedOrigins.has(origin)) return reply({error: 'This website origin is not allowed.', code: 'ORIGIN_DENIED'}, 403);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'POST') return reply({error: 'Use POST to sign in.', code: 'METHOD_NOT_ALLOWED'}, 405);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply(invalidCredentials, 400);
    const input = await readInput(request);
    if (!input || typeof input.username !== 'string' || typeof input.password !== 'string') return reply(invalidCredentials, 400);
    const username = input.username.trim().toLowerCase(), password = input.password;
    if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 128) return reply(invalidCredentials, 400);
    try {
      // Only the service role can perform this lookup. Limits cover known and
      // unknown names, and a global cap also bounds attempts with spoofed IPs.
      const result = await lookup(username, await ipHash(request));
      if (result.limited) {
        headers['Retry-After'] = '60';
        return reply(rateLimited, 429);
      }
      const email = result.user_id ? await getEmail(result.user_id) : null;
      // Missing/disabled users still take the normal password verification path.
      const response = await authenticate(email || `${crypto.randomUUID()}@dorra-login.invalid`, password);
      if (response.error?.status === 429) return reply(rateLimited, 429);
      if (result.user_id && email && response.error?.code === 'email_not_confirmed') {
        return reply({error: 'Email not confirmed. Sign in with your email to request a confirmation link.', code: 'EMAIL_NOT_CONFIRMED'}, 401);
      }
      const session = response.data?.session;
      if (!result.user_id || !email || response.error || !session || session.user?.id !== result.user_id) return reply(invalidCredentials, 401);
      // No username-to-email mapping, admin data, or secrets leave the endpoint.
      return reply({access_token: session.access_token, refresh_token: session.refresh_token});
    } catch {
      return reply({error: 'Sign-in is temporarily unavailable. Try again shortly.', code: 'LOGIN_UNAVAILABLE'}, 503);
    }
  };
}
