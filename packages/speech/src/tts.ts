import tts from '@google-cloud/text-to-speech';
import { DEFAULT_TTS_CONFIG, type TTSConfig } from './config.js';

const client = new tts.TextToSpeechClient();

function wrapSSML(text: string, rate: number, pitch: number): string {
  return `<speak>
  <prosody rate="${rate}" pitch="${pitch}st">
    <emphasis level="strong">Emergency Alert.</emphasis>
    <break time="300ms"/>
    ${text}
  </prosody>
</speak>`;
}

export async function synthesize(
  text: string,
  profile?: Partial<TTSConfig>,
): Promise<{ audioContent: Buffer; format: string }> {
  const config = { ...DEFAULT_TTS_CONFIG, ...profile };
  const ssml = wrapSSML(text, config.speakingRate, config.pitch);

  const [response] = await client.synthesizeSpeech({
    input: { ssml },
    voice: {
      languageCode: config.languageCode,
      name: config.voiceName,
    },
    audioConfig: {
      audioEncoding: config.audioEncoding as 'MP3',
      speakingRate: config.speakingRate,
      pitch: config.pitch,
    },
  });

  return {
    audioContent: Buffer.from(response.audioContent as Uint8Array),
    format: config.audioEncoding.toLowerCase(),
  };
}
