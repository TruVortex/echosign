import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

interface ClassificationResult {
    type: string;
    code: string;
    priority: string;
    confidence: number;
}

router.post('/classify', async (req, res) => {
    try {
        const { transcription } = req.body;

        if (!transcription || typeof transcription !== 'string') {
            res.status(400).json({ error: 'Missing "transcription" field' });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object' as const,
                    properties: {
                        type: { type: 'string' as const, description: 'Type of incident (e.g., MEDICAL EMERGENCY, FIRE - STRUCTURAL)' },
                        code: { type: 'string' as const, description: 'Tactical code (e.g., MED-ALPHA, 10-70)' },
                        priority: { type: 'string' as const, description: 'Priority level (e.g., ALPHA, 01, CRITICAL)' },
                        confidence: { type: 'number' as const, description: 'Match confidence percentage 0-100' }
                    },
                    required: ['type', 'code', 'priority', 'confidence']
                }
            }
        });

        const prompt = `You are a tactical emergency classification AI. Classify this voice report into an incident type.

Voice Report: "${transcription}"

Provide:
- type: The incident category (e.g., "MEDICAL EMERGENCY", "FIRE - STRUCTURAL", "EVACUATION REQUEST", "SUPPLY REQUEST")
- code: Standard tactical code (e.g., "MED-ALPHA", "FIRE-10-70", "EVAC-URGENT", "SUP-CRITICAL")
- priority: Priority level (e.g., "ALPHA", "01", "CRITICAL", "HIGH")
- confidence: Your confidence in this classification (0-100)`;

        const result = await model.generateContent(prompt);
        const classification: ClassificationResult = JSON.parse(result.response.text());

        res.json(classification);
    } catch (err) {
        console.error('Classification error:', err);
        // Return fallback classification so the frontend can still create an incident
        res.json({
            type: 'UNCATEGORIZED EVENT',
            code: 'UNKNOWN',
            priority: 'LOW',
            confidence: 0
        });
    }
});

export default router;
