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

export interface WatchItem {
  pattern: string;
  transform?: boolean;
  rename?: (file: string) => string;
}

export interface HmrOptions {
  watch?: WatchItem[];
}

export interface HmrData extends WatchItem {
  file: string;
  event: string;
  initial: boolean;
  timestamp: number;
}

const parseOptions = (options: HmrOptions = {}) => {
  const watch = options.watch || [];
  return {
    watch,
  };
};

export const hmrPluginName = 'viteburner:hmr';

export function hmrPlugin(): Plugin {
  let options: HmrOptions = {};
  const findMatchedItem = (file: string) => {
    const watch = options?.watch ?? [];
    for (const item of watch) {
      if (isMatch(file, item.pattern)) {
        return item;
      }
    }
    return undefined;
  };

  let watch: WatchItem[] = [];

  return {
    name: hmrPluginName,
    configResolved(config) {
      options = parseOptions(config.viteburner);
      if (options.watch) {
        watch = options.watch;
      }
    },
    configureServer(server) {
      // emitter
      server.emitter = new EventEmitter();
      // events for watching
      const events = ['add', 'unlink', 'change'] as const;

      // watchers that are ready
      let initial = true;

      const patterns = watch.map((item) => item.pattern);
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
          const item = findMatchedItem(file);
          if (item) {
            server.emitter.emit(hmrPluginName, {
              ...item,
              file: slash(file),
              event,
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
      const matched = findMatchedItem(file);
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
