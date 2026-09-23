// Transfo API Server - Vercel Serverless Function
// This serves as the cloud API endpoint for Transfo apps

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'transfo-secret-change-in-production';
const PORT = process.env.PORT || 4000;

// In-memory storage for demo (replace with database in production)
const sessions = new Map();
const pairCache = new Map(); // code -> { created, deviceName }
const users = new Map(); // email -> { password, token }

// Auth middleware
function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const token = auth.slice(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Generate JWT
function generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// --- Auth Routes ---
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    // In production, verify against hashed password in database
    // For demo, accept any email/password
    const token = generateToken(email || 'user');
    res.json({ token, user: { email: email || 'user' } });
});

app.post('/api/auth/register', (req, res) => {
    const { email, password } = req.body;
    // In production, hash password and store in database
    const token = generateToken(email || 'user');
    res.json({ token, user: { email: email || 'user' } });
});

// --- Pairing Routes ---
app.post('/api/pairing', (req, res) => {
    const { deviceName } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pairCache.set(code, { created: Date.now(), name: deviceName || 'Unknown Device' });
    res.json({ code, deviceName: deviceName || 'Unknown Device', expiresIn: '5m', authorize: '/api/pairing/authorize' });
});

app.post('/api/pairing/authorize', (req, res) => {
    const { code, token } = req.body;
    const entry = pairCache.get(code);
    if (!entry) return res.status(400).json({ error: 'Invalid or expired code' });
    if (Date.now() - entry.created > 5 * 60 * 1000) {
        pairCache.delete(code);
        return res.status(400).json({ error: 'Code expired' });
    }
    pairCache.delete(code);
    const pairedToken = 'paired-' + crypto.randomBytes(16).toString('hex');
    res.json({ paired: true, deviceName: entry.name, token: pairedToken, pairedAt: new Date().toISOString() });
});

app.delete('/api/pairing/:code', (req, res) => {
    pairCache.delete(req.params.code);
    res.json({ revoked: true });
});

// --- Transfer Routes ---
// (sessions/pairCache/users declared once at top)

app.post('/api/transfer/sessions', (req, res) => {
    const { name, size, chunkSize } = req.body;
    const id = crypto.randomUUID();
    sessions.set(id, { id, name: name || 'file', size: size || 0, chunkSize: chunkSize || 262144, received: 0, done: false, chunks: [] });
    const totalChunks = size > 0 ? Math.ceil(size / (chunkSize || 262144)) : 0;
    res.status(201).json({ id, chunkSize: chunkSize || 262144, totalChunks, name: name || 'file', size: size || 0 });
});

app.get('/api/transfer/sessions', (req, res) => {
    const list = Array.from(sessions.values()).map(s => ({ id: s.id, name: s.name, size: s.size, received: s.received, done: s.done }));
    res.json(list);
});

app.get('/api/transfer/sessions/:id', (req, res) => {
    const sess = sessions.get(req.params.id);
    if (!sess) return res.status(404).json({ error: 'Not found' });
    res.json({ id: sess.id, name: sess.name, size: sess.size, received: sess.received, done: sess.done, chunkSize: sess.chunkSize });
});

app.delete('/api/transfer/sessions/:id', (req, res) => {
    sessions.delete(req.params.id);
    res.json({ removed: true });
});

app.post('/api/transfer/sessions/:id/chunk', (req, res) => {
    // Base64 chunk upload (parsed by express.json above)
    const { id } = req.params;
    const sess = sessions.get(id);
    if (!sess) return res.status(404).json({ error: 'session not found' });
    const { index, data, offset } = req.body || {};
    const buf = Buffer.from(data || '', 'base64');
    sess.chunks.push({ index: index ?? 0, offset: offset ?? sess.received, data: buf });
    sess.received += buf.length;
    if (sess.size > 0 && sess.received >= sess.size) sess.done = true;
    res.json({ id: sess.id, received: sess.received, size: sess.size, done: sess.done });
});

app.get('/api/transfer/sessions/:id/pull', (req, res) => {
    const sess = sessions.get(req.params.id);
    if (!sess) return res.status(404).json({ error: 'session not found' });
    const ordered = [...sess.chunks].sort((a, b) => a.index - b.index).map((c) => c.data);
    const body = Buffer.concat(ordered);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${sess.name}"`);
    res.send(body);
});

// --- Devices ---
app.get('/api/devices', (req, res) => {
    res.json([{ id: 'cloud', name: 'Transfo Cloud', ip: 'transfoo.vercel.app', port: 443 }]);
});

app.get('/api/pairing', (req, res) => {
    res.json({ pairing: 'ready', endpoint: '/api/pairing' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.1.0', timestamp: new Date().toISOString() });
});

// Vercel serverless entry point. A plain (req, res) handler (instead of
// exporting the Express app object) guarantees the platform invokes it.
export default function handler(req, res) {
    return app(req, res);
}