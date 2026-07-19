import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { encodeMessage, signCode, generateKeypair, bytesToHex } from '@cyren/core';

export const encodeCmd = new Command('encode')
  .description('Encode an emergency message into a 24-byte semantic code')
  .argument('<message>', 'Emergency message text (up to 200 words)')
  .option('-k, --api-key <key>', 'Gemini API key (or set GEMINI_API_KEY)')
  .option('-s, --sign', 'Sign the code with Ed25519')
  .action(async (message: string, opts: { apiKey?: string; sign?: boolean }) => {
    const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: GEMINI_API_KEY required'));
      process.exit(1);
    }

    const spinner = ora('Encoding message with Gemini...').start();
    try {
      const result = await encodeMessage(message, apiKey);
      spinner.succeed('Encoded successfully');

      console.log(chalk.bold('\nSemantic Code:'));
      console.log(chalk.cyan(result.hex));
      console.log(chalk.bold('\nFields:'));
      console.log(chalk.gray(JSON.stringify(result.fields, null, 2)));

      if (opts.sign) {
        const { privateKey, publicKey } = await generateKeypair();
        const signature = await signCode(result.bytes, privateKey);
        console.log(chalk.bold('\nEd25519 Signature:'));
        console.log(chalk.yellow(bytesToHex(signature)));
        console.log(chalk.bold('Public Key:'));
        console.log(chalk.yellow(bytesToHex(publicKey)));
      }
    } catch (err) {
      spinner.fail('Encoding failed');
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });
