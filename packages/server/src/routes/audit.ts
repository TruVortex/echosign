import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import type { AuditEntry } from '@cyren/core';
import {
  getConnection,
  loadOrCreateKeypair,
  ensureFunded,
  batchSubmit,
  queryAuditLog,
} from '@cyren/solana';

const router = Router();

router.post('/audit/submit', async (req, res) => {
  try {
    const { entries } = req.body as { entries: AuditEntry[] };
    if (!entries || !Array.isArray(entries)) {
      res.status(400).json({ error: 'Missing "entries" array' });
      return;
    }

    const connection = getConnection();
    const keypair = loadOrCreateKeypair();
    await ensureFunded(connection, keypair);

    const results = await batchSubmit(entries, connection, keypair);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/audit/query', async (req, res) => {
  try {
    const pubkeyStr = req.query.pubkey as string | undefined;
    const limit = parseInt((req.query.limit as string) ?? '50');

    const connection = getConnection();
    const pubkey = pubkeyStr
      ? new PublicKey(pubkeyStr)
      : loadOrCreateKeypair().publicKey;

    const result = await queryAuditLog(pubkey, connection, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
