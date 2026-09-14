// Transfo transfer HTTP API — real chunked, resumable transfer endpoints.
// Honest status: implemented; NOT live-verified (server is not runnable here —
// no node_modules / no paired device present).
import express from 'express';
import { verifyToken } from '../../lib/auth.js';
import { createSession, appendChunk, getSession, listSessions, assembleFile, removeSession } from '../../lib/transfer.js';

const router = express.Router();

// Transfo data path is authenticated: every transfer call must carry a valid
// JWT (Authorization: Bearer <token>). Closes the previously-open /pull stream.
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = /^Bearer\s+(.+)$/i.exec(h);
  if (!t) return res.status(401).json({ error: 'unauthorized: missing Bearer token' });
  try { req.user = verifyToken(t[1]); next(); }
  catch { return res.status(401).json({ error: 'unauthorized: bad or expired token' }); }
}
// Apply to every transfer route (create/chunk/status/pull/delete).
router.use(requireAuth);

// POST /api/transfer/sessions  { name, size, type, chunkSize? } -> { id, chunkSize, totalChunks }
router.post('/sessions', async (req, res) => {
  try { res.status(201).json(await createSession(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/transfer/sessions/:id/chunk  { index, offset, data(base64) } -> { received, done }
router.post('/sessions/:id/chunk', async (req, res) => {
  try { res.json(await appendChunk(req.params.id, req.body || {})); }
  catch (e) { res.status(409).json({ error: e.message }); }
});

// GET /api/transfer/sessions/:id -> status (names, received, done)
router.get('/sessions/:id', (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json(s);
});

// GET /api/transfer/sessions -> list
router.get('/sessions', (_req, res) => res.json(listSessions()));

// GET /api/transfer/sessions/:id/pull -> streams assembled file to paired device / download
router.get('/sessions/:id/pull', async (req, res) => {
  try {
    const s = getSession(req.params.id);
    if (!s) return res.status(404).json({ error: 'not found' });
    const file = await assembleFile(req.params.id);
    res.download(file, s.name || 'transfer.bin');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/transfer/sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  const ok = await removeSession(req.params.id);
  res.status(ok ? 200 : 404).json({ removed: ok });
});

export default router;