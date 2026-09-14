import express from 'express';
import { signToken } from '../../lib/auth.js';
const router = express.Router();
router.post('/register', (req, res) => { res.json({ token: signToken({ id: 'u1', email: req.body.email }) }); });
router.post('/login', (req, res) => { res.json({ token: signToken({ id: 'u1', email: req.body.email }) }); });
export default router;
