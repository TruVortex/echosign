import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { PublicKey } from '@solana/web3.js';
import { getConnection, loadOrCreateKeypair, ensureFunded, logToChain, queryAuditLog } from '@cyren/solana';
import type { AuditEntry } from '@cyren/core';

export const auditCmd = new Command('audit')
  .description('Solana audit log operations');

auditCmd
  .command('submit')
  .description('Submit an audit entry to Solana devnet')
  .requiredOption('--code <hex>', 'Semantic code hex')
  .requiredOption('--alert-type <type>', 'Alert type name')
  .option('--signature <base58>', 'Ed25519 signature')
  .option('--pubkey <base58>', 'Ed25519 public key')
  .action(async (opts) => {
    const spinner = ora('Connecting to Solana devnet...').start();

    const connection = getConnection();
    const keypair = loadOrCreateKeypair();

    spinner.text = 'Ensuring wallet is funded...';
    await ensureFunded(connection, keypair);

    const entry: AuditEntry = {
      code: opts.code,
      signature: opts.signature ?? '',
      pubkey: opts.pubkey ?? '',
      timestamp: Math.floor(Date.now() / 1000),
      alertType: opts.alertType,
    };

    spinner.text = 'Submitting to Solana...';
    const result = await logToChain(entry, connection, keypair);
    spinner.succeed('Audit entry submitted');

    console.log(chalk.bold('\nTransaction:'));
    console.log(chalk.cyan(result.explorerUrl));
  });

auditCmd
  .command('query')
  .description('Query audit log history')
  .option('--pubkey <base58>', 'Public key to query (default: local keypair)')
  .option('--limit <n>', 'Max entries', '50')
  .action(async (opts) => {
    const spinner = ora('Querying Solana devnet...').start();

    const connection = getConnection();
    const pubkey = opts.pubkey
      ? new PublicKey(opts.pubkey)
      : loadOrCreateKeypair().publicKey;

    const result = await queryAuditLog(pubkey, connection, parseInt(opts.limit));
    spinner.succeed(`Found ${result.entries.length} entries`);

    for (let i = 0; i < result.entries.length; i++) {
      const entry = result.entries[i];
      const sig = result.txSignatures[i];
      console.log(chalk.bold(`\n#${i + 1} [${entry.alertType}]`));
      console.log(chalk.gray(`  Code: ${entry.code}`));
      console.log(chalk.gray(`  Time: ${new Date(entry.timestamp * 1000).toISOString()}`));
      console.log(chalk.cyan(`  TX: https://explorer.solana.com/tx/${sig}?cluster=devnet`));
    }
  });
