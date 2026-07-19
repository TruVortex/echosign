import { Router } from 'express';
import { encodeMessage, signCode, generateKeypair } from '@cyren/core';

const router = Router();

// Server-held signing keypair (generated once per process)
let signingKeyPromise: Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> | null = null;
function getSigningKey() {
  if (!signingKeyPromise) {
    signingKeyPromise = generateKeypair();
  }
  return signingKeyPromise;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    // Sign the encoded bytes with Ed25519
    const { privateKey, publicKey } = await getSigningKey();
    const codeBytes = new Uint8Array(result.hex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const signature = await signCode(codeBytes, privateKey);

    res.json({
      code: result.hex,
      hex: result.hex,
      signature: toHex(signature),
      pubkey: toHex(publicKey),
      fields: result.fields,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
