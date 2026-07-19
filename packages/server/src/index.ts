/**
 * Cyren API Server
 *
 * Express backend that proxies Gemini calls for encode/decode/classify,
 * handles speech-to-text/text-to-speech, and manages an in-memory incident store.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import encodeRouter from './routes/encode.js';
import decodeRouter from './routes/decode.js';
import sttRouter from './routes/stt.js';
import ttsRouter from './routes/tts.js';
import classifyRouter from './routes/classify.js';
import incidentsRouter from './routes/incidents.js';
import auditRouter from './routes/audit.js';

// Load .env from project root (two directories up from this file)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001');

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', encodeRouter);
app.use('/api', decodeRouter);
app.use('/api', sttRouter);
app.use('/api', ttsRouter);
app.use('/api', classifyRouter);
app.use('/api', incidentsRouter);
app.use('/api', auditRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cyren server running on http://0.0.0.0:${PORT}`);
});
