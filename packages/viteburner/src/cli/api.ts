import type { Session } from 'vite-plugin-viteburner';
import { displayRamUsage, displayStatus, quit } from './operations';

/**
 * What the CLI can be asked to do: the operations that act on the daemon, bound to whichever session
 * is live.
 *
 * The CLI is not a plugin, so this is not published anywhere — `createCliApi` in this module builds
 * one over the daemon plugin `cli.ts` holds, and `keys.ts` calls it. Each operation reads the session
 * that is up now and runs against it, or does nothing while none is (before the first dev server, or
 * between the two servers of a config-change restart), the way an unanswerable key did before the api
 * existed. The help is not here: it needs no session and belongs to the keyboard — see `keys.ts`.
 */
export interface CliApi {
  /** The services of the daemon's dev server currently running, or `undefined` while none is. */
  getSession(): Session | undefined;
  /** Render the daemon's state as the status block. */
  displayStatus(): void;
  /** Leave: stop the daemon's services, then end the process. */
  quit(): void;
  /** Re-send every watched file. */
  fullUpload(): Promise<void>;
  /** Pull the game's files back. */
  fullDownload(): Promise<void>;
  /** Ask which RAM scope to report, then report it. */
  displayRamUsage(): Promise<void>;
}

/**
 * The CLI's commands, bound to the live session.
 *
 * The getter is read per call rather than captured once, because a config-change restart replaces the
 * session while the daemon plugin the caller holds stays the same instance.
 */
export function createCliApi(getSession: () => Session | undefined): CliApi {
  return {
    getSession,
    displayStatus: () => {
      const session = getSession();
      if (session) {
        displayStatus(session);
      }
    },
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
