import { HmrContext, Plugin } from 'vite';
import { isMatch } from 'micromatch';
import chokidar from 'chokidar';
import { relative } from 'path';
import EventEmitter from 'events';
import { slash } from 'vite-node/utils';
import { ViteBurnerConfig } from '..';

declare module 'vite' {
  interface ViteDevServer {
    viteburnerEmitter: EventEmitter;
  }
}

export type RenameOutputObject = {
  filename: string;
  server: string;
};
export type RenameOutput = string | RenameOutputObject | Array<string | RenameOutputObject>;

export interface WatchItem {
  pattern: string;
  transform?: boolean;
  rename?: RenameOutput | ((file: string) => RenameOutput);
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

const parseOptions = (options?: ViteBurnerConfig) => {
  return {
    watch: [],
    ignoreInitial: false,
    ...options,
  };
};

export const hmrPluginName = 'viteburner:hmr';

export function hmrPlugin(): Plugin {
  let options = {} as ReturnType<typeof parseOptions>;
  const findMatchedItem = (file: string) => {
    const watch = options?.watch ?? [];
    for (const item of watch) {
      if (isMatch(file, item.pattern)) {
        return item;
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
      // viteburnerEmitter
      server.viteburnerEmitter = new EventEmitter();
      // events for watching
      const events = ['add', 'unlink', 'change'] as const;

      // watchers that are ready
      let initial = true;

      const patterns = options.watch.map((item) => item.pattern);
      // create watcher
      const watcher = chokidar.watch(patterns, {
        cwd: server.config.root,
        ignoreInitial: options.ignoreInitial,
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
            server.viteburnerEmitter.emit(hmrPluginName, {
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
