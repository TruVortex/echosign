export interface AuditEntry {
  code: string;
  signature: string;
  pubkey: string;
  timestamp: number;
  alertType: string;
  confidence?: number;
}

export interface LogResult {
  txSignature: string;
  explorerUrl: string;
}

export interface BatchProgress {
  current: number;
  total: number;
  txSignature?: string;
}
