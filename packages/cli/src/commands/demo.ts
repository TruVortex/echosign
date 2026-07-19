import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  encodeMessage,
  decodeMessage,
  signCode,
  verifySignature,
  generateKeypair,
  bytesToHex,
  packFields,
  unpackFields,
} from '@cyren/core';
import { encodeToTones, tonesToPCM, decodePCM } from '@cyren/acoustic';

export const demoCmd = new Command('demo')
  .description('Run a full encode → sign → acoustic → decode → verify demo')
  .option('-k, --api-key <key>', 'Gemini API key (or set GEMINI_API_KEY)')
  .option('-m, --message <text>', 'Emergency message', 'Major earthquake magnitude 7.1 near downtown Los Angeles. Multiple buildings collapsed. Estimated 5000 people affected. Roads blocked. Need immediate rescue teams and medical supplies.')
  .action(async (opts: { apiKey?: string; message?: string }) => {
    const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: GEMINI_API_KEY required'));
      process.exit(1);
    }

    console.log(chalk.bold.cyan('\n=== Cyren Full Demo ===\n'));
    console.log(chalk.gray(`Input: "${opts.message}"\n`));

    // Step 1: Encode
    const encSpinner = ora('Step 1: Encoding with Gemini...').start();
    const encoded = await encodeMessage(opts.message!, apiKey);
    encSpinner.succeed(`Encoded → ${chalk.cyan(encoded.hex)}`);
    console.log(chalk.gray(`  Fields: ${JSON.stringify(encoded.fields)}\n`));

    // Step 2: Sign
    const signSpinner = ora('Step 2: Signing with Ed25519...').start();
    const { privateKey, publicKey } = await generateKeypair();
    const signature = await signCode(encoded.bytes, privateKey);
    signSpinner.succeed(`Signed → ${chalk.yellow(bytesToHex(signature).slice(0, 32))}...`);

    // Step 3: Acoustic encode → decode
    const acSpinner = ora('Step 3: Acoustic FSK round-trip...').start();
    const tones = encodeToTones(encoded.bytes);
    const pcm = tonesToPCM(tones, 44100);
    const decoded = decodePCM(pcm, 44100, 24);
    acSpinner.succeed(`Acoustic round-trip confidence: ${chalk.green(`${(decoded.confidence * 100).toFixed(1)}%`)}`);

    const match = bytesToHex(decoded.data) === encoded.hex;
    if (match) {
      console.log(chalk.green('  Data integrity: PERFECT MATCH'));
    } else {
      console.log(chalk.red('  Data integrity: MISMATCH'));
      console.log(chalk.red(`  Got: ${bytesToHex(decoded.data)}`));
    }

    // Step 4: Verify signature
    const verSpinner = ora('Step 4: Verifying signature...').start();
    const valid = await verifySignature(decoded.data, signature, publicKey);
    if (valid) {
      verSpinner.succeed(chalk.green('Signature VERIFIED'));
    } else {
      verSpinner.fail(chalk.red('Signature FAILED'));
    }

    // Step 5: Decode
    const decSpinner = ora('Step 5: Decoding with Gemini...').start();
    const alert = await decodeMessage(decoded.data, apiKey, valid);
    decSpinner.succeed('Decoded alert:');
    console.log(chalk.bold('\n' + alert.text));

    console.log(chalk.bold.cyan('\n=== Demo Complete ===\n'));
  });
