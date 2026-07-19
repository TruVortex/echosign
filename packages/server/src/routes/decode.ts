import { Router } from 'express';
import { decodeMessage } from '@cyren/core';

const router = Router();

router.post('/decode', async (req, res) => {
  try {
    const { hex, verified, skipCrc } = req.body;
    if (!hex || typeof hex !== 'string') {
      res.status(400).json({ error: 'Missing "hex" field' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      return;
    }

    const result = await decodeMessage(hex, apiKey, verified ?? null, !!skipCrc);
    res.json({
      text: result.text,
      fields: result.fields,
      crcValid: result.crcValid,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
