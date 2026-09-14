// Transfo transfer engine — honest-status ledger (voiceforge-project.md rule).
// The real engine now lives in ./transfer.js (chunked, offset-resumable, REST API in
// ../api/transfer). This file is the compatibility/orchestration surface used by the
// renderer, and records truthfully what is IMPLEMENTED vs LIVE-VERIFIED.
import { chunkedSend, createSession } from './transfer.js';

export const status = {
  chunkedHttpStreaming: 'VERIFIED 2026-09-14 — session create -> chunk base64 HELLO -> pull returned exact 5B "HELLO"',
  retryResume: 'IMPLEMENTED',                         // offset-aligned append rejects/re-aligns
  udpDiscoveryServer: 'IMPLEMENTED, NOT VERIFIED',    // lan.js listener exists
  udpDiscoveryClient: 'IMPLEMENTED, NOT VERIFIED',    // lan.js announce exists
  pairingWebSocket: 'NOT IMPLEMENTED',                // no ws/socket.io dependency installed
  authJwtVerified: true,  // 2026-09-14: router.use(requireAuth)+verifyToken; 401 confirmed on /pull (no token / bad token)
};

export { chunkedSend, createSession };
export { appendChunk, assembleFile, listSessions, getSession } from './transfer.js';