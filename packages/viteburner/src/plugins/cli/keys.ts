import pc from 'picocolors';
import { logger } from '@/console';
import type { Session } from '@/plugins/viteburner';
import { displayRamUsage, displayStatus, quit } from './commands';
import { resumeKeypress, suspendKeypress } from './keypress';
import type { Keypress } from './keypress';

export function displayKeyHelpHint() {
  logger.info(
    'help',
    pc.dim('press ') +
      pc.reset(pc.bold('h')) +
      pc.dim(' to show help, press ') +
      pc.reset(pc.bold('q')) +
      pc.dim(' to exit'),
  );
}

export function displayWatchAndHelp() {
  logger.info('vite', pc.reset('watching for file changes...'));
  displayKeyHelpHint();
}

/** The keys this CLI answers, and what each one does. The daemon plugin knows none of them. */
function displayHelp() {
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

export interface KeyAction {
  run(session: Session): void | Promise<unknown>;
  /**
   * The action keeps the terminal for itself — it opens a prompt that reads stdin — so the key reader
   * has to let go of it first.
   */
  interactive?: boolean;
}

/** The keys the CLI answers, and the session operation each one runs. */
export const keyActions: Record<string, KeyAction> = {
  q: { run: quit },
  s: { run: displayStatus },
  h: { run: displayHelp },
  u: { run: (session) => session.sync.fullUpload() },
  d: { run: (session) => session.sync.fullDownload() },
  r: { run: displayRamUsage, interactive: true },
};

/** Answer one keypress: run the key's operation, then print the hint that ends the turn. */
export async function dispatchKey(key: string, session: Session, keypress: Keypress) {
  const action = keyActions[key];
  if (!action) {
    return;
  }
  if (action.interactive) {
    suspendKeypress(keypress);
  }
  try {
    await action.run(session);
  } finally {
    if (action.interactive) {
      resumeKeypress(keypress);
    }
  }
  displayWatchAndHelp();
}
