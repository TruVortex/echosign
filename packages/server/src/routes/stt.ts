import { Router } from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

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

    const result = await model.generateContent({
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
    });

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
