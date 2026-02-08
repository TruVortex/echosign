import { Router } from 'express';

const router = Router();

router.post('/tts', async (req, res) => {
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

    // Use Gemini's TTS endpoint via REST API
    const ttsRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `Read the following emergency alert aloud in a calm, authoritative voice:\n\n${text}` }],
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        }),
      },
    );

    if (!ttsRes.ok) {
      // Fallback: TTS is optional, return a simple error
      res.status(500).json({ error: 'TTS generation failed' });
      return;
    }

    const json = await ttsRes.json() as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
    };
    const audioPart = json.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { mimeType: string } }) => p.inlineData?.mimeType?.startsWith('audio/'),
    );

    if (!audioPart?.inlineData) {
      res.status(500).json({ error: 'No audio in TTS response' });
      return;
    }

    const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    const mimeType = audioPart.inlineData.mimeType;
    const format = mimeType.split('/')[1] || 'wav';

    res.set('Content-Type', mimeType);
    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
