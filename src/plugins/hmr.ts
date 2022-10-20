import { HmrContext, Plugin } from 'vite';
import { isMatch } from 'micromatch';
import chokidar from 'chokidar';
import { relative } from 'path';
import EventEmitter from 'events';
import { slash } from 'vite-node/utils';

declare module 'vite' {
  interface ViteDevServer {
    emitter: EventEmitter;
  }
}

export interface HmrOptions {
  watch?: {
    [key: string]: {
      pattern: string;
      transform: boolean;
    };
  };
}

export interface HmrData {
  file: string;
  event: string;
  type: string;
  transform: boolean;
  initial: boolean;
  timestamp: number;
}

const parseOptions = (options: HmrOptions = {}) => {
  const watch = options.watch || {};
  return {
    watch,
  };
};

export const hmrPluginName = 'viteburner:hmr';

export function hmrPlugin(): Plugin {
  let options: HmrOptions = {};
  const findMatchedType = (file: string) => {
    const watch = options?.watch ?? {};
    for (const type in watch) {
      if (isMatch(file, watch[type].pattern)) {
        return type;
      }
    }
    return undefined;
  };

  return {
    name: hmrPluginName,
    configResolved(config) {
      options = parseOptions(config.viteburner);
    },
    configureServer(server) {
      const watch = options?.watch ?? {};

      // emitter
      server.emitter = new EventEmitter();
      // events for watching
      const events = ['add', 'unlink', 'change'] as const;

      // watchers that are ready
      let initial = true;

      const patterns = Object.values(watch).map((item) => item.pattern);
      // create watcher
      const watcher = chokidar.watch(patterns, {
        cwd: server.config.root,
        ignoreInitial: false,
        persistent: true,
      });

      // add watcher to ready watchers when ready
      watcher.on('ready', () => {
        initial = false;
      });

      // for each event, create a handler
      for (const event of events) {
        watcher.on(event, (file: string) => {
          // emit the event
          const type = findMatchedType(file);
          if (type) {
            server.emitter.emit(hmrPluginName, {
              file: slash(file),
              event,
              type,
              transform: watch[type].transform,
              initial,
              timestamp: Date.now(),
            });
          } else {
            throw new Error(`File ${file} does not match any patterns`);
          }
        });
      }
    },
    handleHotUpdate(context: HmrContext) {
      const file = relative(context.server.config.root, context.file);
      // using micromatch to test if the file matches any of the patterns
      const matched = findMatchedType(file);
      // if matched, ignore hmr and return
      if (matched) {
        return [];
      }
      // trigger hmr otherwise
      return;
    },
  };
}

export default hmrPlugin;
