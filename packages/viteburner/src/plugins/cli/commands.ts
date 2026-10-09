import pc from 'picocolors';
import prompt from 'prompts';
import { isScriptFile, logger } from 'vite-plugin-viteburner';
import type { Session } from 'vite-plugin-viteburner';

/**
 * The CLI's commands: the operations the plugin publishes on its api, and the rendering of their
 * answers.
 *
 * Each one is handed the session of the running dev server and reaches the service it needs itself —
 * `createCliApi` in `api.ts` is what binds them to the session that is live when they are called. The
 * keys that ask for them, and the terminal they are read from, are the CLI's — see `keys.ts`.
 */

const padding = 18;

function printStatus(tag: string, msg: string) {
  logger.info('status', pc.reset(tag.padStart(padding)), msg);
}

/** Render the daemon's state as the status block. */
export function displayStatus(session: Session) {
  const status = session.getStatus();
  logger.info('status');
  logger.info('status', ' '.repeat(padding - 4) + pc.reset(pc.bold(pc.inverse(pc.green(' STATUS ')))));
  printStatus('connection:', status.connected ? pc.green('connected') : pc.yellow('disconnected'));
  printStatus('port:', pc.magenta(status.port));
  const pending = status.pending;
  const pendingStr = `${pending} file${pending === 1 ? '' : 's'}`;
  printStatus('pending:', pending ? pc.yellow(pendingStr) : pc.dim(pendingStr));
  logger.info('status', pc.dim('')); // avoid (x2)
}

/** Leave: stop the daemon's services, then end the process. */
export function quit(session: Session) {
  logger.info('bye');
  session.dispose();
  process.exit(0);
}

/** Print the commands this CLI answers. The keys that reach them are the CLI's, not the plugin's. */
export function displayHelp() {
  logger.info('help');
  const commands = [
    ['u', 'upload all files'],
    ['d', 'download all files'],
    ['s', 'show status'],
    ['r', 'show RAM usage of scripts'],
    ['q', 'quit'],
  ];
  logger.info('help', pc.reset(pc.bold('Watch Usage')));
  for (const [key, desc] of commands) {
    logger.info('help', `press ${pc.reset(pc.bold(key))}${pc.dim(' to ')}${desc}`);
  }
  logger.info('help', pc.dim('')); // avoid (x2)
}

/**
 * Ask which RAM scope to report, then report it.
 *
 * The questioning is the CLI's: the session is asked only for the data a choice needs, and told which
 * report to run once the player has chosen.
 */
export async function displayRamUsage(session: Session) {
  const reported = await askRamScope(session);
  logger.info('ram', reported ? 'done' : 'cancelled');
}

async function askRamScope(session: Session): Promise<boolean> {
  const { filter } = await prompt({
    type: 'select',
    name: 'filter',
    message: 'Which script do you want to check?',
    initial: 0,
    choices: [
      { title: 'All local scripts', value: 'all' },
      { title: 'Filter local scripts by glob pattern', value: 'glob' },
      { title: 'Find a local script', value: 'local' },
      { title: 'Find a remote script', value: 'remote' },
    ],
  });

  if (filter === 'all') {
    await session.sync.getRamUsage();
    return true;
  }

  if (filter === 'glob') {
    const { pattern } = await prompt({
      type: 'text',
      name: 'pattern',
      message: 'Enter a glob pattern',
      initial: 'src/**/*.{ts,js}',
    });
    if (!pattern) {
      return false;
    }
    await session.sync.getRamUsage(pattern);
    return true;
  }

  if (filter === 'local') {
    const files = await session.sync.getRamUsageLocalFiles();
    const { file } = await prompt({
      type: 'autocomplete',
      name: 'file',
      message: 'Enter a filename',
      choices: files.map((title) => ({ title })),
    });
    if (!file) {
      return false;
    }
    await session.sync.getRamUsageLocal(file);
    return true;
  }

  if (filter === 'remote') {
    const { server } = await prompt({
      type: 'text',
      name: 'server',
      message: 'Enter a server name',
      initial: 'home',
    });
    if (!server) {
      return false;
    }
    const filenames = await session.sync.getFileNames(server);
    if (!filenames) {
      return false;
    }
    const { filename } = await prompt({
      type: 'autocomplete',
      name: 'filename',
      message: 'Enter a filename',
      choices: filenames.filter(isScriptFile).map((title) => ({ title })),
    });
    if (!filename) {
      return false;
    }
    await session.sync.getRamUsageRemote(server, filename);
    return true;
  }

  return false;
}
