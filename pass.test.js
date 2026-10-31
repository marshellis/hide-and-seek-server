// node --test pass.test.js
const test = require('node:test'); const assert = require('node:assert');
const { createHmac } = require('crypto'); const { verifyPass, identify } = require('./pass');
const sign = (c, s) => { const b = Buffer.from(JSON.stringify(c)).toString('base64url'); return b + '.' + createHmac('sha256', s).update(b).digest('base64url'); };
const now = 1e6, claims = exp => ({ u: 'kida', a: '', c: '', room: 'hide-and-seek', exp, lb: true });
test('valid / tampered / wrong secret / expired', () => {
  const t = sign(claims(now + 60), 's');
  assert.equal(verifyPass(t, 's', now).u, 'kida');
  assert.equal(verifyPass(t, 'x', now), null); assert.equal(verifyPass('x' + t, 's', now), null); assert.equal(verifyPass(t, 's', now + 61), null);
});
test('no secret => unchanged; secret + pass => real name; secret + none => guest or refused', () => {
  assert.deepEqual(identify('anything', {}), { verified: false });
  assert.equal(identify(sign(claims(now + 60), 's'), { GAME_PASS_SECRET: 's' }, now).name, 'kida');
  assert.deepEqual(identify(undefined, { GAME_PASS_SECRET: 's' }), { verified: false });
  assert.equal(identify(undefined, { GAME_PASS_SECRET: 's', GAME_PASS_REQUIRED: '1' }), null);
});
