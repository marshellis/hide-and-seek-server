// Marshellis game pass verifier (CommonJS port of marshellis/galaga server/src/auth/pass.ts).
const { createHmac, timingSafeEqual } = require('crypto');

function verifyPass(token, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || !secret) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const c = JSON.parse(Buffer.from(body, 'base64url').toString()); return c.exp > nowSec ? c : null; } catch { return null; }
}

// null => refuse the connection. Without GAME_PASS_SECRET nothing changes (deploying this is safe).
function identify(pass, env = process.env, nowSec) {
  const secret = env.GAME_PASS_SECRET;
  if (!secret) return { verified: false };
  const c = verifyPass(pass, secret, nowSec);
  if (c) return { name: c.u.slice(0, 20), expiresAt: c.exp, verified: true };
  if (env.GAME_PASS_REQUIRED === '1') return null;
  return { verified: false };
}
module.exports = { verifyPass, identify };
