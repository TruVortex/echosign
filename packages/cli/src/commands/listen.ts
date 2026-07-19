import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { decodePCM } from '@cyren/acoustic';
import { bytesToHex } from '@cyren/core';
import fs from 'fs';

export const listenCmd = new Command('listen')
  .description('Decode FSK audio from a raw PCM file')
  .argument('<file>', 'Path to raw PCM file (32-bit float)')
  .option('-r, --sample-rate <rate>', 'Sample rate', '44100')
  .option('-b, --bytes <count>', 'Expected byte count', '24')
  .action(async (file: string, opts: { sampleRate: string; bytes: string }) => {
    const sampleRate = parseInt(opts.sampleRate);
    const expectedBytes = parseInt(opts.bytes);

    const spinner = ora('Decoding FSK audio...').start();

    const buffer = fs.readFileSync(file);
    const pcm = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

    const result = decodePCM(pcm, sampleRate, expectedBytes);
    spinner.succeed('Decoded FSK audio');

    console.log(chalk.bold('\nDecoded Data:'));
    console.log(chalk.cyan(bytesToHex(result.data)));
    console.log(chalk.bold('Confidence:'), chalk.yellow(`${(result.confidence * 100).toFixed(1)}%`));

    if (result.errorPositions.length > 0) {
      console.log(chalk.red(`Errors at byte positions: ${result.errorPositions.join(', ')}`));
    }
  });
