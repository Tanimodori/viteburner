import pc from 'picocolors';
import prompt from 'prompts';
import { logger } from '@/console';
import type { ViteBurnerPluginApi } from '@/plugins/viteburner/api';
import { isScriptFile } from '@/utils/path';

/**
 * The commands the CLI runs on the player's behalf: everything the plugin refuses to know about.
 *
 * The daemon answers questions and runs operations; choosing what to ask, rendering the answer, and
 * ending the process are here, next to the keys that ask for them.
 */

const padding = 18;

function printStatus(tag: string, msg: string) {
  logger.info('status', pc.reset(tag.padStart(padding)), msg);
}

/** Render the daemon's state as the status block. */
export function displayStatus(api: ViteBurnerPluginApi) {
  const status = api.getStatus();
  if (!status) {
    return;
  }
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
export function quit(api: ViteBurnerPluginApi) {
  logger.info('bye');
  api.dispose();
  process.exit(0);
}

/**
 * Ask which RAM scope to report, then report it.
 *
 * The questioning is the CLI's: the plugin is asked only for the data a choice needs, and told which
 * report to run once the player has chosen.
 */
export async function displayRamUsage(api: ViteBurnerPluginApi) {
  const reported = await askRamScope(api);
  logger.info('ram', reported ? 'done' : 'cancelled');
}

async function askRamScope(api: ViteBurnerPluginApi): Promise<boolean> {
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
    await api.showRamUsageAll();
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
    await api.showRamUsageGlob(pattern);
    return true;
  }

  if (filter === 'local') {
    const files = await api.getRamUsageLocalFiles();
    const { file } = await prompt({
      type: 'autocomplete',
      name: 'file',
      message: 'Enter a filename',
      choices: files.map((title) => ({ title })),
    });
    if (!file) {
      return false;
    }
    await api.showRamUsageLocal(file);
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
    const filenames = await api.getFileNames(server);
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
    await api.showRamUsageRemote(server, filename);
    return true;
  }

  return false;
}
