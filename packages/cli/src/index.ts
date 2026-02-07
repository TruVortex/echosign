import { Command } from 'commander';
import dotenv from 'dotenv';
import { encodeCmd } from './commands/encode.js';
import { decodeCmd } from './commands/decode.js';
import { transmitCmd } from './commands/transmit.js';
import { listenCmd } from './commands/listen.js';
import { auditCmd } from './commands/audit.js';
import { demoCmd } from './commands/demo.js';

dotenv.config();

const program = new Command()
  .name('echosign')
  .description('EchoSign — Emergency Semantic Codec CLI')
  .version('0.1.0');

program.addCommand(encodeCmd);
program.addCommand(decodeCmd);
program.addCommand(transmitCmd);
program.addCommand(listenCmd);
program.addCommand(auditCmd);
program.addCommand(demoCmd);

program.parse();
