import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from '@solana/web3.js';
import fs from 'fs';

const DEFAULT_RPC = clusterApiUrl('devnet');

export function getConnection(url?: string): Connection {
  return new Connection(url ?? process.env.SOLANA_RPC_URL ?? DEFAULT_RPC, 'confirmed');
}

export function loadOrCreateKeypair(path?: string): Keypair {
  const keypairPath = path ?? process.env.SOLANA_KEYPAIR_PATH ?? './cyren-keypair.json';

  try {
    const data = fs.readFileSync(keypairPath, 'utf-8');
    const secretKey = Uint8Array.from(JSON.parse(data));
    return Keypair.fromSecretKey(secretKey);
  } catch {
    const keypair = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
    return keypair;
  }
}

export async function ensureFunded(
  connection: Connection,
  keypair: Keypair,
  minBalance: number = 0.1 * LAMPORTS_PER_SOL,
): Promise<void> {
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance < minBalance) {
    try {
      const sig = await connection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig);
    } catch {
      throw new Error(
        `Wallet balance too low (${balance / LAMPORTS_PER_SOL} SOL). ` +
        `Fund ${keypair.publicKey.toBase58()} at https://faucet.solana.com`
      );
    }
  }
}
