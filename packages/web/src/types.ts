export type Screen = 'report' | 'alerts' | 'logs' | 'map';

export interface Incident {
    id: string;
    type: string;
    code: string;
    priority: string;
    match: number;
    timestamp: string;
    signer: string;
    status: 'pending' | 'verified' | 'synced';
    description: string;
    hexCode?: string;
    signature?: string;
    pubkey?: string;
    explorerUrl?: string;
}

export interface Coordinates {
    lat: number;
    lng: number;
}
