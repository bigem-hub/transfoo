import { log, error } from "./diag.js"; log("Server boot");
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './api/auth/index.js';
import userRoutes from './api/user/index.js';
import deviceRoutes from './api/devices/index.js';
import pairingRoutes from './api/pairing/index.js';
import transferRoutes from './api/transfer/index.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/pairing', pairingRoutes);
app.use('/api/transfer', transferRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Transfo server running on port ${PORT}`));
