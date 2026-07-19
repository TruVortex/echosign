/**
 * Solana On-Chain Audit Log
 *
 * Writes each emergency alert as a JSON memo transaction on Solana devnet
 * using the SPL Memo program. This creates an immutable, publicly verifiable
 * audit trail of all alerts — useful for post-disaster accountability.
 *
 * Includes an OfflineAuditQueue that buffers entries in localStorage when
 * offline and flushes them to the chain when connectivity is restored.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type { AuditEntry, LogResult, BatchProgress } from './types.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export async function logToChain(
  entry: AuditEntry,
  connection: Connection,
  payer: Keypair,
): Promise<LogResult> {
  const memoData = Buffer.from(JSON.stringify(entry), 'utf-8');

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: memoData,
  });

  const tx = new Transaction().add(instruction);
  const txSignature = await sendAndConfirmTransaction(connection, tx, [payer]);

  return {
    txSignature,
    explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
  };
}

export async function batchSubmit(
  entries: AuditEntry[],
  connection: Connection,
  payer: Keypair,
  onProgress?: (progress: BatchProgress) => void,
): Promise<LogResult[]> {
  const results: LogResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const result = await logToChain(entries[i], connection, payer);
    results.push(result);
    onProgress?.({ current: i + 1, total: entries.length, txSignature: result.txSignature });

    // 500ms delay between txs to avoid devnet rate limits
    if (i < entries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

export async function queryAuditLog(
  pubkey: PublicKey,
  connection: Connection,
  limit: number = 50,
): Promise<{ entries: AuditEntry[]; txSignatures: string[] }> {
  const signatures = await connection.getSignaturesForAddress(pubkey, { limit });
  const entries: AuditEntry[] = [];
  const txSignatures: string[] = [];

  for (const sigInfo of signatures) {
    try {
      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta?.logMessages) continue;

      for (const log of tx.meta.logMessages) {
        // SPL Memo logs appear as: "Program log: Memo (len N): <data>"
        const memoMatch = log.match(/^Program log: Memo \(len \d+\): (.+)$/);
        if (memoMatch) {
          try {
            const entry = JSON.parse(memoMatch[1]) as AuditEntry;
            entries.push(entry);
            txSignatures.push(sigInfo.signature);
          } catch {
            // Not valid JSON memo, skip
          }
        }
      }
    } catch {
      // Skip failed tx fetches
    }
  }

  return { entries, txSignatures };
}

/**
 * OfflineAuditQueue — buffers audit entries when offline, flushes when connected.
 */
export class OfflineAuditQueue {
  private queue: AuditEntry[] = [];
  private storageKey = 'cyren_audit_queue';

  constructor(initialEntries?: AuditEntry[]) {
    if (initialEntries) {
      this.queue = initialEntries;
    }
  }

  /** Load from localStorage (browser) */
  loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          this.queue = JSON.parse(data);
        }
      } catch {
        // ignore
      }
    }
  }

  /** Persist to localStorage (browser) */
  private persist(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    }
  }

  enqueue(entry: AuditEntry): void {
    this.queue.push(entry);
    this.persist();
  }

  async flush(
    connection: Connection,
    payer: Keypair,
    onProgress?: (progress: BatchProgress) => void,
  ): Promise<LogResult[]> {
    const entries = [...this.queue];
    const results = await batchSubmit(entries, connection, payer, onProgress);
    this.queue = [];
    this.persist();
    return results;
  }

  get pending(): number {
    return this.queue.length;
  }

  get entries(): AuditEntry[] {
    return [...this.queue];
  }
}
