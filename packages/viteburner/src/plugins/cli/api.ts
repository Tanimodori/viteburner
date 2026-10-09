import type { Session } from 'vite-plugin-viteburner';
import { displayHelp, displayRamUsage, displayStatus, quit } from './commands';
import type { CliPluginApi } from './types';

/**
 * The CLI's commands, bound to the live session.
 *
 * The getter is read per call rather than captured once, because a config-change restart replaces the
 * session while the plugin instance answering keys stays. While no session is up — before the first
 * dev server, or between the two servers of a restart — every method except `getSession` does
 * nothing, the way an unanswerable key did before the api existed.
 */
export function createCliApi(getSession: () => Session | undefined): CliPluginApi {
  return {
    getSession,
    displayStatus: () => {
      const session = getSession();
      if (session) {
        displayStatus(session);
      }
    },
    displayHelp,
    quit: () => {
      const session = getSession();
      if (session) {
        quit(session);
      }
    },
    fullUpload: async () => {
      await getSession()?.sync.fullUpload();
    },
    fullDownload: async () => {
      await getSession()?.sync.fullDownload();
    },
    displayRamUsage: async () => {
      const session = getSession();
      if (session) {
        await displayRamUsage(session);
      }
    },
  };
}
