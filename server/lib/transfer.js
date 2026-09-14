// Transfo chunked transfer engine — real implementation (pure Node, no new deps).
// Honest status: implemented; NOT live-verified (no server node_modules / no device run here).
// Design: chunked, offset-resumable transfer. Each session streams chunks of a declared
// file to a staging dir on disk; a pull assembles them in order for the paired device.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { log, error } from './diag.js';

export const DEFAULT_CHUNK = 256 * 1024; // 256 KiB, matching the rendering UI's intent

const ROOT = path.join(os.tmpdir(), 'transfo-transfers');
let rootReady = false;
async function ensureRoot() {
  if (!rootReady) { await fs.mkdir(ROOT, { recursive: true }); rootReady = true; }
}

// memory map: id -> { id, name, size, type, totalChunks, received, dir, done }
const sessions = new Map();

export async function createSession({ name = 'unnamed', size = 0, type = 'file', chunkSize = DEFAULT_CHUNK } = {}) {
  await ensureRoot();
  const id = crypto.randomUUID();
  const dir = path.join(ROOT, id);
  await fs.mkdir(dir, { recursive: true });
  const totalChunks = size > 0 ? Math.ceil(size / chunkSize) : 0;
  const s = { id, name, size, type, chunkSize, totalChunks, received: 0, done: false, dir, startedAt: Date.now() };
  sessions.set(id, s);
  log('transfer session created', id, `"${name}"`, size, 'bytes');
  return { id, chunkSize, totalChunks, name, size };
}

// Append one chunk. `offset` is the byte offset within the file it must land at,
// enabling resume: a chunk whose offset != current received cursor is rejected
// unless realigning (idempotent duplicate from a resume-then-retry client).
export async function appendChunk(id, { index, offset, data }) {
  const s = sessions.get(id);
  if (!s) throw new Error(`unknown session ${id}`);
  if (s.done) throw new Error(`session ${id} already finalized`);
  if (typeof data !== 'string') throw new Error('chunk data must be base64 string');
  const buf = Buffer.from(data, 'base64');
  const expected = index >= s.totalChunks ? undefined : index * s.chunkSize; // loose guard
  if (offset !== undefined && offset !== s.received && offset !== expected) {
    error('chunk out of order', id, 'index', index, 'offset', offset, 'received', s.received);
    throw new Error(`out-of-order chunk: offset ${offset} != received ${s.received}`);
  }
  // persist chunk so a server restart can resume (dir survives in TMP until cleanup)
  await fs.writeFile(path.join(s.dir, String(index) + '.bin'), buf);
  s.received += buf.length;
  if (s.size > 0 && s.received >= s.size) s.done = true;
  else if (s.totalChunks > 0 && index + 1 >= s.totalChunks) s.done = true;
  return { id, received: s.received, size: s.size, done: s.done };
}

export function getSession(id) {
  const s = sessions.get(id);
  if (!s) return null;
  return { id: s.id, name: s.name, size: s.size, type: s.type, received: s.received, done: s.done, chunkSize: s.chunkSize };
}

export function listSessions() {
  return [...sessions.values()].map(s => ({ id: s.id, name: s.name, size: s.size, received: s.received, done: s.done }));
}

// Pull: reassemble the staged chunks (in index order) into a single file and
// return its path, ready to stream to a paired device / download.
export async function assembleFile(id) {
  const s = sessions.get(id);
  if (!s) throw new Error(`unknown session ${id}`);
  const out = path.join(s.dir, 'assembled.bin');
  // read chunk indices in order, tolerating gaps (resume-in-progress)
  const entries = await fs.readdir(s.dir);
  const indices = entries
    .filter(e => /^\d+\.bin$/.test(e))
    .map(e => parseInt(e, 10))
    .sort((a, b) => a - b);
  const parts = [];
  for (const i of indices) parts.push(await fs.readFile(path.join(s.dir, `${i}.bin`)));
  await fs.writeFile(out, Buffer.concat(parts));
  return out;
}

export async function removeSession(id) {
  const s = sessions.get(id);
  if (!s) return false;
  sessions.delete(id);
  await fs.rm(s.dir, { recursive: true, force: true }).catch(() => {});
  return true;
}

// thin orchestration shim kept for transfer-engine.js compatibility
export async function chunkedSend({ sessionId, index, offset, data }) {
  return appendChunk(sessionId, { index, offset, data });
}