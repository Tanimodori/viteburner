import { watch } from './watcher';
import cac from 'cac';
import { loadConfig } from './config';
import { logger } from './console';
import pkg from '../package.json';
import { ViteBurnerInlineConfig } from './types';

const cli = cac('viteburner');

cli
  .command('', 'start dev server')
  .alias('serve')
  .alias('dev')
  .option('--cwd <cwd>', 'Working directory')
  .option('--port <port>', 'Port to listen on')
  .action(startDev);

cli.help();

cli.version(pkg.version);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startDev(options: any) {
  const cwd = options.cwd;
  const port = options.port;
  const resolveInlineConfig: ViteBurnerInlineConfig = {
    ...(cwd && { cwd }),
    ...(port && { port }),
  };

  logger.info('version', pkg.version);

  // resolve config
  logger.info('config', 'resolving user config...');
  const config = await loadConfig(resolveInlineConfig);
  logger.info('config', 'config resolved');

  watch(config);
}

export async function main() {
  cli.parse();
}
