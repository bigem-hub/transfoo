import express from 'express';
import { signToken, verifyToken } from '../../lib/auth.js';
const router = express.Router();

// In-memory pairing-session cache (short-lived, honest per project scope).
const pairCache = new Map();        // code -> { created, deviceName, token, user }
const CODE_LEN = 6;

function makeCode() { return String(Math.floor(100000 + Math.random()*900000)); }
function expired(ts) { return Date.now() - ts > 600000; } // 10 min

router.get('/', (req, res) => { res.json({ pairing: 'ready', endpoint: '/api/pairing' }); });

// Initiate pairing: generate short-lived pairing code (no permanent password stored).
router.post('/', (req, res) => {
  const name = (req.body && req.body.deviceName) ? req.body.deviceName : 'Unknown';
  const code = makeCode();
  pairCache.set(code, { created: Date.now(), deviceName: name, token: null, user: null });
  res.json({ code, deviceName: name, expiresIn: '10m', authorize: '/api/pairing/authorize' });
});

// Real handshake: provide pairing code + Bearer JWT to exchange for paired token.
router.post('/authorize', (req, res) => {
  const { code } = req.body || {};
  const sess = pairCache.get(code);
  if (!sess) return res.status(401).json({ error: 'invalid pairing code' });
  if (expired(sess.created)) { pairCache.delete(code); return res.status(401).json({ error: 'pairing session expired (code valid for 10 minutes)' }); }
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return res.status(401).json({ error: 'pairing authorization requires Bearer JWT' });
  try {
    const user = verifyToken(m[1]);
    const token = signToken(user);
    sess.user = user; sess.token = token; pairCache.delete(code);
    res.json({ paired: true, deviceName: sess.deviceName, token, pairedAt: new Date().toISOString() });
  } catch (e) { res.status(401).json({ error: 'invalid JWT: '+e.message }); }
});

router.delete('/:id', (req, res) => {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return res.status(401).json({ error: 'unauthorized' });
  try { verifyToken(m[1]); res.json({ revoked: req.params.id, at: new Date().toISOString() }); } catch (e) { res.status(401).json({ error: 'bad token' }); }
});

export default router;
