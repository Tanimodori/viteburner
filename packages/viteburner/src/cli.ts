import cac from 'cac';
import { createServer } from 'vite';
import { findViteBurnerPlugin, logger, viteburnerPlugin } from 'vite-plugin-viteburner';
import type { ViteBurnerInlineConfig } from 'vite-plugin-viteburner';
import pkg from '../package.json';
import { cliPlugin, displayStatus, displayWatchAndHelp } from './plugins/cli';

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
  // Two plugins, two control planes: the daemon's, and the CLI's own keys and help. Only the CLI adds
  // the second, which is why the daemon plugin never learns what a key is.
  const server = await createServer({
    ...(cwd && { root: cwd }),
    viteburner: resolveInlineConfig,
    plugins: [viteburnerPlugin(resolveInlineConfig), cliPlugin()],
  });

  // Startup banner: the daemon's state, then the hint for the keys above.
  const plugin = findViteBurnerPlugin(server.config);
  if (!plugin) {
    throw new Error('the viteburner plugin is not part of this config');
  }
  // `createServer` ran `configureServer`, so the session is already up; a missing one is a real bug.
  const session = plugin.api.getSession();
  if (!session) {
    throw new Error('the viteburner session was not started');
  }
  displayStatus(session);
  displayWatchAndHelp();
}

export async function main() {
  cli.parse();
}
