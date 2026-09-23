import { log, error } from "./lib/diag.js"; log("Server boot");
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './api/auth/index.js';
import userRoutes from './api/user/index.js';
import deviceRoutes from './api/devices/index.js';
import pairingRoutes from './api/pairing/index.js';
import transferRoutes from './api/transfer/index.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'website', 'dist');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.use(express.static(distPath, { index: 'app.html' }));
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/pairing', pairingRoutes);
app.use('/api/transfer', transferRoutes);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Transfo server running on port ${PORT}`));
server.on('error', (err) => {
  console.error(`Transfo server failed to listen on port ${PORT}: ${err.message}`);
  process.exit(1);
});
