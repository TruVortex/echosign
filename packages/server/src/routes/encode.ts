import { Router } from 'express';
import { encodeMessage } from '@echosign/core';

const router = Router();

router.post('/encode', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing "text" field' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      return;
    }

    const result = await encodeMessage(text, apiKey);
    res.json({
      code: result.hex,
      hex: result.hex,
      fields: result.fields,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
