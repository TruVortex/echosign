import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import encodeRouter from './routes/encode.js';
import decodeRouter from './routes/decode.js';
import sttRouter from './routes/stt.js';
import ttsRouter from './routes/tts.js';
import auditRouter from './routes/audit.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001');

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', encodeRouter);
app.use('/api', decodeRouter);
app.use('/api', sttRouter);
app.use('/api', ttsRouter);
app.use('/api', auditRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`EchoSign server running on http://localhost:${PORT}`);
});
