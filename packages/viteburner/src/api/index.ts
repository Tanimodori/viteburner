import type { Session } from '@viteburner/vite-plugin';
import { displayRamUsage, displayStatus, quit } from './operation';

/**
 * The CLI's api: the operations it performs against the daemon, bound to whichever session is live.
 *
 * The CLI is not a plugin, so nothing publishes this — `cli.ts` builds one over the daemon plugin it
 * holds, and `key/` calls it. Each operation reads the session that is up now and runs against it, or
 * does nothing while none is (before the first dev server, or between the two servers of a
 * config-change restart), the way an unanswerable key did before the api existed.
 *
 * The operations themselves are in `./operation`; this module is only the binding. The help is not
 * here either — it needs no session and belongs to the keyboard, see `key/mapping.ts`.
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
 * Bind the operations to the live session.
 *
 * The getter is read per call rather than captured once, because a config-change restart replaces the
 * session while the daemon plugin the caller holds stays the same instance. The two full transfers
 * are single `session.sync` calls, so they delegate straight through; the rest live in `./operation`.
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
