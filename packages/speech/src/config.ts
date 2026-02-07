export interface STTConfig {
  encoding: string;
  sampleRateHertz: number;
  languageCode: string;
  model: string;
  useEnhanced: boolean;
  enableAutomaticPunctuation: boolean;
  speechContexts: Array<{
    phrases: string[];
    boost: number;
  }>;
}

export interface TTSConfig {
  voiceName: string;
  speakingRate: number;
  pitch: number;
  languageCode: string;
  audioEncoding: string;
}

export const EMERGENCY_PHRASES = [
  'earthquake', 'tsunami', 'flood', 'fire', 'evacuation', 'shelter',
  'casualties', 'magnitude', 'aftershock', 'medical', 'supplies',
  'rescue', 'SOS', 'mayday', 'collapse', 'trapped', 'injured',
  'missing', 'hazmat', 'radiation',
];

export const DEFAULT_STT_CONFIG: STTConfig = {
  encoding: 'WEBM_OPUS',
  sampleRateHertz: 16000,
  languageCode: 'en-US',
  model: 'latest_long',
  useEnhanced: true,
  enableAutomaticPunctuation: true,
  speechContexts: [
    {
      phrases: EMERGENCY_PHRASES,
      boost: 15.0,
    },
  ],
};

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  voiceName: 'en-US-Neural2-D',
  speakingRate: 0.85,
  pitch: -2.0,
  languageCode: 'en-US',
  audioEncoding: 'MP3',
};
