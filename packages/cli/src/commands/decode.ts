import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { decodeMessage, hexToBytes, verifySignature } from '@cyren/core';

export const decodeCmd = new Command('decode')
  .description('Decode a 24-byte semantic code back into an alert')
  .argument('<hex>', '48-character hex string of the semantic code')
  .option('-k, --api-key <key>', 'Gemini API key (or set GEMINI_API_KEY)')
  .option('--signature <hex>', 'Ed25519 signature (128 hex chars) to verify')
  .option('--pubkey <hex>', 'Ed25519 public key (64 hex chars) for verification')
  .action(async (hex: string, opts: { apiKey?: string; signature?: string; pubkey?: string }) => {
    const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: GEMINI_API_KEY required'));
      process.exit(1);
    }

    let verified: boolean | null = null;

    if (opts.signature && opts.pubkey) {
      const code = hexToBytes(hex);
      const sig = hexToBytes(opts.signature);
      const pubkey = hexToBytes(opts.pubkey);
      verified = await verifySignature(code, sig, pubkey);
    }

    const spinner = ora('Decoding with Gemini...').start();
    try {
      const result = await decodeMessage(hex, apiKey, verified);
      spinner.succeed('Decoded successfully');

      console.log(chalk.bold('\nReconstructed Alert:'));
      console.log(result.text);

      if (verified === true) {
        console.log(chalk.green('\n[VERIFIED] Signature valid'));
      } else if (verified === false) {
        console.log(chalk.red('\n[FAILED] Signature invalid'));
      }
    } catch (err) {
      spinner.fail('Decoding failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });
