import { Router } from 'express';
import { synthesize } from '@echosign/speech';

const router = Router();

router.post('/tts', async (req, res) => {
  try {
    const { text, profile } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing "text" field' });
      return;
    }

    const result = await synthesize(text, profile);
    res.set('Content-Type', `audio/${result.format}`);
    res.send(result.audioContent);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
