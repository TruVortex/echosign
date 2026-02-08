import { Router } from 'express';
import { incidentStore } from '../services/incidentStore';

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


const router = Router();

// GET /api/incidents - Get all incidents
router.get('/incidents', (_req, res) => {
    try {
        const incidents = incidentStore.getAll();
        res.json({ incidents });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// GET /api/incidents/:id - Get single incident
router.get('/incidents/:id', (req, res) => {
    try {
        const incident = incidentStore.getById(req.params.id);
        if (!incident) {
            res.status(404).json({ error: 'Incident not found' });
            return;
        }
        res.json({ incident });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// POST /api/incidents - Create new incident
router.post('/incidents', (req, res) => {
    try {
        const { incident } = req.body;

        if (!incident) {
            res.status(400).json({ error: 'Missing "incident" field' });
            return;
        }

        const created = incidentStore.create(incident as Incident);
        res.json({ success: true, incident: created });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// PATCH /api/incidents/:id/status - Update incident status
router.patch('/incidents/:id/status', (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['pending', 'verified', 'synced'].includes(status)) {
            res.status(400).json({ error: 'Invalid status. Must be: pending, verified, or synced' });
            return;
        }

        const updated = incidentStore.updateStatus(req.params.id, status);
        if (!updated) {
            res.status(404).json({ error: 'Incident not found' });
            return;
        }

        res.json({ success: true, incident: updated });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// PATCH /api/incidents/:id - Update incident fields
router.patch('/incidents/:id', (req, res) => {
    try {
        const updates = req.body;
        const updated = incidentStore.update(req.params.id, updates);
        if (!updated) {
            res.status(404).json({ error: 'Incident not found' });
            return;
        }
        res.json({ success: true, incident: updated });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// DELETE /api/incidents/:id - Delete incident
router.delete('/incidents/:id', (req, res) => {
    try {
        const deleted = incidentStore.delete(req.params.id);
        if (!deleted) {
            res.status(404).json({ error: 'Incident not found' });
            return;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

export default router;
