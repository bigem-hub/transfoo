import express from 'express';
const router = express.Router();
router.get('/', (_req, res) => res.json([{ id: 'd1', name: 'Windows PC', model: 'Acer Nitro', lastActive: 'Just now', status: 'connected' }, { id: 'd2', name: 'Android Phone', model: 'CMF Phone', lastActive: '2 minutes ago', status: 'connected' }]));
router.post('/', (_req, res) => res.json({ id: 'd3', name: 'New Device', status: 'pending' }));
router.delete('/:id', (req, res) => res.json({ revoked: req.params.id }));
export default router;
