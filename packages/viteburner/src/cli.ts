import cac from 'cac';
import { createServer } from 'vite';
import pkg from '../package.json';
import { logger } from './console';
import { dispatchKey, displayWatchAndHelp } from './keys';
import { findViteBurnerPlugin } from './plugins/api';
import { viteburnerPlugin } from './plugins/viteburner';
import { EventBus } from './services/bus';
import { InputService } from './services/input';
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

  // The bus and the key reader are the CLI's, not a dev server's: vite builds a fresh server on a
  // config change, and neither the events nor stdin are replaced with it.
  const bus = new EventBus();
  const input = new InputService(bus);

  // create server
  logger.info('vite', 'creating dev server...');
  const server = await createServer({
    ...(cwd && { root: cwd }),
    viteburner: resolveInlineConfig,
    plugins: [viteburnerPlugin(resolveInlineConfig, bus)],
  });

  // Keypresses are the CLI's input and the plugin's api is the only way in, so the CLI keeps the key
  // map and the help that documents it, and calls the matching api command for each key it answers.
  // Starting the reader is this call, explicitly: nothing else attaches one, and a reader that is
  // never started leaves every key unanswered.
  const plugin = findViteBurnerPlugin(server.config);
  if (!plugin) {
    throw new Error('the viteburner plugin is not part of this config');
  }
  bus.on('input:key', ({ key }) => dispatchKey(key, plugin.api, input));
  input.start();

  // Startup banner: the daemon's state, then the hint for the keys above.
  plugin.api.displayStatus();
  displayWatchAndHelp();
}

export async function main() {
  cli.parse();
}
