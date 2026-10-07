import pc from 'picocolors';
import { KeypressHandler, logger } from './console';
import { ViteBurnerPluginApi } from './plugins/api';

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

/** The keys this CLI answers, and what each one does. The plugin knows none of them. */
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
  run(api: ViteBurnerPluginApi): void | Promise<unknown>;
  /**
   * The action keeps the terminal for itself — it opens a prompt that reads stdin — so the key reader
   * has to let go of it first.
   */
  interactive?: boolean;
}

/** The keys the CLI answers, and the plugin api command each one calls. */
export const keyActions: Record<string, KeyAction> = {
  q: { run: (api) => api.quit() },
  s: { run: (api) => api.displayStatus() },
  h: { run: displayHelp },
  u: { run: (api) => api.fullUpload() },
  d: { run: (api) => api.fullDownload() },
  r: { run: (api) => api.showRamUsage(), interactive: true },
};

/** Forward keypresses to the plugin: run the key's command, then print the hint that ends the turn. */
export function createKeyHandler(api: ViteBurnerPluginApi): KeypressHandler {
  return async (ctx) => {
    const action = keyActions[ctx.key.name];
    if (!action) {
      return;
    }
    if (action.interactive) {
      ctx.off();
    }
    try {
      await action.run(api);
    } finally {
      if (action.interactive) {
        ctx.on();
      }
    }
    displayWatchAndHelp();
  };
}
