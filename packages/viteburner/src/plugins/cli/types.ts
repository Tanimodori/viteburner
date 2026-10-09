import type { Plugin } from 'vite';
import type { Session } from 'vite-plugin-viteburner';

/** The name this plugin registers under, so vite can tell it apart from the daemon plugin. */
export const cliPluginName = 'viteburner:cli';

/**
 * What the CLI plugin can be asked to do: the CLI's commands, bound to whichever session of the
 * daemon is live.
 *
 * The plugin owns no reader and no key map — it never sees a keystroke. Each method reads the session
 * that is up now and runs the operation on it, or does nothing while none is (before the first dev
 * server, or between the two servers of a config-change restart). Which key asks for which method,
 * and letting go of the terminal for one that needs it, is the CLI's own business — see `keys.ts` and
 * `cli.ts`.
 */
export interface CliPluginApi {
  /** The services of the daemon's dev server currently running, or `undefined` while none is. */
  getSession(): Session | undefined;
  /** Render the daemon's state as the status block. */
  displayStatus(): void;
  /** Print the commands this CLI answers. */
  displayHelp(): void;
  /** Leave: stop the daemon's services, then end the process. */
  quit(): void;
  /** Re-send every watched file. */
  fullUpload(): Promise<void>;
  /** Pull the game's files back. */
  fullDownload(): Promise<void>;
  /** Ask which RAM scope to report, then report it. */
  displayRamUsage(): Promise<void>;
}

export interface CliPlugin extends Plugin {
  name: typeof cliPluginName;
  api: CliPluginApi;
}
