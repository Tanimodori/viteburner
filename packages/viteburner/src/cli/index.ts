import cac from 'cac';
import { createServer } from 'vite';
import { logger, viteburnerPlugin } from 'vite-plugin-viteburner';
import type { ViteBurnerInlineConfig } from 'vite-plugin-viteburner';
import pkg from '../../package.json';
import { createCliApi } from './api';
import { displayWatchAndHelp, startCliKeys } from './keys';

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

/**
 * The CLI's composition root: one dev server, and the two control planes on either side of it.
 *
 * The CLI is not a plugin. It creates the daemon plugin, keeps the instance, and reaches the session
 * through it — `createServer` reuses that same instance across a config-change restart, and the
 * plugin's `getSession` re-reads the session it is holding, so the api follows the replacement
 * without any lookup in the resolved config. The keys are the CLI's own reader, composed here from
 * `keys.ts` — the daemon plugin never learns what a keystroke or a CLI command is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startDev(options: any) {
  const cwd = options.cwd;
  const port = options.port;
  const resolveInlineConfig: ViteBurnerInlineConfig = {
    ...(cwd && { cwd }),
    ...(port && { port }),
  };

  logger.info('version', pkg.version);

  logger.info('vite', 'creating dev server...');
  const daemon = viteburnerPlugin(resolveInlineConfig);
  const api = createCliApi(() => daemon.api.getSession());
  // Started before the server exists, so a key pressed during startup reaches an api with no session
  // and is ignored — the same window a plain vite startup gives every other hook.
  startCliKeys(api);

  await createServer({
    ...(cwd && { root: cwd }),
    viteburner: resolveInlineConfig,
    plugins: [daemon],
  });

  // Startup banner: the daemon's state, then the hint for the keys above.
  api.displayStatus();
  displayWatchAndHelp();
}

export async function main() {
  cli.parse();
}
