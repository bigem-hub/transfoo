// Transfo transfer engine — honest-status ledger (voiceforge-project.md rule).
// The real engine now lives in ./transfer.js (chunked, offset-resumable, REST API in
// ../api/transfer). This file is the compatibility/orchestration surface used by the
// renderer, and records truthfully what is IMPLEMENTED vs LIVE-VERIFIED.
import { chunkedSend, createSession } from './transfer.js';

export const status = {
  chunkedHttpStreaming: 'IMPLEMENTED, NOT VERIFIED', // routes exist; no server run here
  retryResume: 'IMPLEMENTED',                         // offset-aligned append rejects/re-aligns
  udpDiscoveryServer: 'IMPLEMENTED, NOT VERIFIED',    // lan.js listener exists
  udpDiscoveryClient: 'IMPLEMENTED, NOT VERIFIED',    // lan.js announce exists
  pairingWebSocket: 'NOT IMPLEMENTED',                // no ws/socket.io dependency installed
  authJwtVerified: false                              // endpoint exists; no live token exchange
};

export { chunkedSend, createSession };
export { appendChunk, assembleFile, listSessions, getSession } from './transfer.js';