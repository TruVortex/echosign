import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { hexToBytes } from '@cyren/core';
import { encodeToTones, tonesToPCM } from '@cyren/acoustic';
import fs from 'fs';

export const transmitCmd = new Command('transmit')
  .description('Encode hex data to FSK audio and save as raw PCM file')
  .argument('<hex>', 'Hex string to transmit')
  .option('-o, --output <path>', 'Output PCM file path', 'output.pcm')
  .option('-r, --sample-rate <rate>', 'Sample rate', '44100')
  .action(async (hex: string, opts: { output: string; sampleRate: string }) => {
    const data = hexToBytes(hex);
    const sampleRate = parseInt(opts.sampleRate);

    const spinner = ora('Generating FSK audio...').start();
    const tones = encodeToTones(data);
    const pcm = tonesToPCM(tones, sampleRate);

    // Write raw PCM as 32-bit float
    const buffer = Buffer.from(pcm.buffer);
    fs.writeFileSync(opts.output, buffer);

    spinner.succeed(`FSK audio saved to ${chalk.cyan(opts.output)}`);
    console.log(chalk.gray(`  ${tones.length} tones, ${pcm.length} samples @ ${sampleRate}Hz`));
    console.log(chalk.gray(`  Duration: ${(pcm.length / sampleRate).toFixed(2)}s`));
  });
