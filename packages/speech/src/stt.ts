import speech from '@google-cloud/speech';
import { DEFAULT_STT_CONFIG, type STTConfig } from './config.js';

const client = new speech.SpeechClient();

export async function recognizeBatch(
  audioBuffer: Buffer,
  config?: Partial<STTConfig>,
): Promise<{ transcript: string; confidence: number }> {
  const mergedConfig = { ...DEFAULT_STT_CONFIG, ...config };

  const [response] = await client.recognize({
    config: {
      encoding: mergedConfig.encoding as 'WEBM_OPUS',
      sampleRateHertz: mergedConfig.sampleRateHertz,
      languageCode: mergedConfig.languageCode,
      model: mergedConfig.model,
      useEnhanced: mergedConfig.useEnhanced,
      enableAutomaticPunctuation: mergedConfig.enableAutomaticPunctuation,
      speechContexts: mergedConfig.speechContexts,
    },
    audio: {
      content: audioBuffer.toString('base64'),
    },
  });

  const results = response.results ?? [];
  if (results.length === 0) {
    return { transcript: '', confidence: 0 };
  }

  const best = results[0].alternatives?.[0];
  return {
    transcript: best?.transcript ?? '',
    confidence: best?.confidence ?? 0,
  };
}
