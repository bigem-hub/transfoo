import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET || 'dev-change-me';
export const log = (...a)=>console.log("[TRANSPF-DIAG]", new Date().toISOString(), ...a); export function signToken(user) { return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' }); }
export function verifyToken(token) { return jwt.verify(token, SECRET); }
