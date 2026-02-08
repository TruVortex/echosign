import { api } from './api';
import { Incident } from '../types';

interface ClassificationResult {
    type: string;
    code: string;
    priority: string;
    confidence: number;
}

interface TranscriptionResult {
    transcript: string;
    confidence: number;
}

// Speech-to-text
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    return api.upload<TranscriptionResult>('/api/stt', formData);
}

// Classify incident from transcription
export async function classifyIncident(transcription: string): Promise<ClassificationResult> {
    return api.post<ClassificationResult>('/api/classify', { transcription });
}

// Get all incidents
export async function getAllIncidents(): Promise<Incident[]> {
    const response = await api.get<{ incidents: Incident[] }>('/api/incidents');
    return response.incidents;
}

// Create new incident
export async function createIncident(incident: Incident): Promise<Incident> {
    const response = await api.post<{ success: boolean; incident: Incident }>('/api/incidents', { incident });
    return response.incident;
}

// Update incident status
export async function updateIncidentStatus(
    id: string,
    status: 'pending' | 'verified' | 'synced'
): Promise<Incident> {
    const response = await api.patch<{ success: boolean; incident: Incident }>(
        `/api/incidents/${id}/status`,
        { status }
    );
    return response.incident;
}

// Update incident fields
export async function updateIncident(
    id: string,
    updates: Partial<Incident>
): Promise<Incident> {
    const response = await api.patch<{ success: boolean; incident: Incident }>(
        `/api/incidents/${id}`,
        updates
    );
    return response.incident;
}

// Delete incident
export async function deleteIncident(id: string): Promise<void> {
    await api.delete(`/api/incidents/${id}`);
}

// Encode text to hex + signature
export async function encodeText(text: string): Promise<{
    code: string;
    hex: string;
    signature: string;
    pubkey: string;
    fields: Record<string, unknown>;
}> {
    return api.post('/api/encode', { text });
}

// Submit audit entries to Solana
export async function auditSubmit(entries: {
    code: string;
    signature: string;
    pubkey: string;
    timestamp: number;
    alertType: string;
}[]): Promise<{ results: { txSignature: string; explorerUrl: string }[] }> {
    return api.post('/api/audit/submit', { entries });
}

// Decode hex back to text
export async function decodeHex(hex: string, verified?: boolean | null, skipCrc?: boolean): Promise<{
    text: string;
    fields: Record<string, unknown>;
    crcValid: boolean;
}> {
    return api.post('/api/decode', { hex, verified, skipCrc });
}
