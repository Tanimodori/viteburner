import cac from 'cac';
import { createServer } from 'vite';
import { logger, viteburnerPlugin } from 'vite-plugin-viteburner';
import type { ViteBurnerInlineConfig } from 'vite-plugin-viteburner';
import pkg from '../package.json';
import { cliPlugin } from './plugins/cli';
import { displayWatchAndHelp, startCliKeys } from './plugins/cli/keys';

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

  logger.info('vite', 'creating dev server...');
  // Two plugins, two control planes: the daemon's, and the CLI's own commands published as an api.
  // Only the CLI adds the second, which is why the daemon plugin never learns what a CLI command is.
  const plugin = cliPlugin();
  // The keys are the CLI's own reader, started before the server exists — a key pressed during
  // startup reaches an api with no session and is ignored. Neither plugin ever sees a keystroke.
  startCliKeys(plugin.api);

  await createServer({
    ...(cwd && { root: cwd }),
    viteburner: resolveInlineConfig,
    plugins: [viteburnerPlugin(resolveInlineConfig), plugin],
  });

  // Startup banner: the daemon's state, then the hint for the keys above.
  plugin.api.displayStatus();
  displayWatchAndHelp();
}

export async function main() {
  cli.parse();
}
