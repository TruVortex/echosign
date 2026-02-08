interface Incident {
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

// In-memory storage for incidents
class IncidentStore {
    private incidents: Map<string, Incident>;

    constructor() {
        this.incidents = new Map();
    }

    getAll(): Incident[] {
        return Array.from(this.incidents.values());
    }

    getById(id: string): Incident | undefined {
        return this.incidents.get(id);
    }

    create(incident: Incident): Incident {
        this.incidents.set(incident.id, incident);
        return incident;
    }

    update(id: string, updates: Partial<Incident>): Incident | undefined {
        const incident = this.incidents.get(id);
        if (!incident) return undefined;

        const updated = { ...incident, ...updates };
        this.incidents.set(id, updated);
        return updated;
    }

    delete(id: string): boolean {
        return this.incidents.delete(id);
    }

    updateStatus(id: string, status: 'pending' | 'verified' | 'synced'): Incident | undefined {
        return this.update(id, { status });
    }
}

// Singleton instance
export const incidentStore = new IncidentStore();
