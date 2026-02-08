import { Router } from 'express';

const router = Router();

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429 && i < retries - 1) {
      const wait = 4000 * (i + 1);
      console.warn(`TTS rate limited, retrying in ${wait / 1000}s... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  return fetch(url, options); // final attempt
}

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

    // Use the dedicated Gemini 2.5 Flash TTS model (separate quota from text model)
    const ttsRes = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
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

    res.set('Content-Type', mimeType);
    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
