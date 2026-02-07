import { Router } from 'express';
import multer from 'multer';
import { recognizeBatch } from '@echosign/speech';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Missing audio file' });
      return;
    }

    const result = await recognizeBatch(req.file.buffer);
    res.json({
      transcript: result.transcript,
      confidence: result.confidence,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
