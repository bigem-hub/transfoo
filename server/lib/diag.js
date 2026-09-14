export const log = (...args) => console.log('[TRANSPF-DIAG]', new Date().toISOString(), ...args);
export const error = (...args) => console.error('[TRANSPF-ERR]', new Date().toISOString(), ...args);
