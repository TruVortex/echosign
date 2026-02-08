const BASE = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

export interface EncodeResult {
  code: string;
  hex: string;
  fields: {
    type: string;
    severity: number;
    lat: number;
    lon: number;
    pop: number;
    msg: string;
  };
}

export interface DecodeResult {
  text: string;
  fields: {
    type: string;
    severity: number;
    lat: number;
    lon: number;
    pop: number;
    msg: string;
  };
  crcValid?: boolean;
}

export interface STTResult {
  transcript: string;
  confidence: number;
}

export const api = {
  encode: (text: string) => post<EncodeResult>('/encode', { text }),
  decode: (hex: string, verified?: boolean, skipCrc?: boolean) => post<DecodeResult>('/decode', { hex, verified, skipCrc }),
  stt: (audioBlob: Blob) => {
    const fd = new FormData();
    fd.append('audio', audioBlob, 'recording.webm');
    return postFormData<STTResult>('/stt', fd);
  },
  tts: async (text: string): Promise<ArrayBuffer> => {
    const res = await fetch(`${BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('TTS request failed');
    return res.arrayBuffer();
  },
  auditSubmit: (entries: unknown[]) => post<{ results: { txSignature: string; explorerUrl: string }[] }>('/audit/submit', { entries }),
  auditQuery: async (pubkey?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (pubkey) params.set('pubkey', pubkey);
    const res = await fetch(`${BASE}/audit/query?${params}`);
    if (!res.ok) throw new Error('Audit query failed');
    return res.json() as Promise<{ entries: unknown[]; txSignatures: string[] }>;
  },
};
