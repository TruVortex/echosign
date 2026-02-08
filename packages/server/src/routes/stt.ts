import { Router } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429') && i < retries - 1) {
        const wait = 4000 * (i + 1);
        console.warn(`Rate limited, retrying in ${wait / 1000}s... (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

router.post('/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Missing audio file' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const audioBase64 = req.file.buffer.toString('base64');

    // Determine MIME type from the uploaded file
    const mimeType = req.file.mimetype || 'audio/webm';

    const result = await withRetry(() => model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: 'Transcribe this audio exactly. Output ONLY the transcription text, nothing else. If the audio is empty or inaudible, output an empty string.',
          },
        ],
      }],
    }));

    const transcript = result.response.text().trim();
    res.json({
      transcript,
      confidence: transcript.length > 0 ? 0.9 : 0,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
