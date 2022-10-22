import { HmrContext, Plugin, ViteDevServer } from 'vite';
import { isMatch } from 'micromatch';
import chokidar from 'chokidar';
import { relative, resolve } from 'path';
import EventEmitter from 'events';
import fg from 'fast-glob';
import { slash } from 'vite-node/utils';
import { ViteBurnerConfig } from '..';
import fs from 'fs';

declare module 'vite' {
  interface ViteDevServer {
    viteburnerEmitter: EventEmitter;
  }
}

export type RenameOutputObject = {
  filename?: string;
  server?: string;
};
export type RenameOutput = string | RenameOutputObject | Array<string | RenameOutputObject> | null | undefined;

export interface WatchItem {
  pattern: string;
  transform?: boolean;
  location?: RenameOutput | ((file: string) => RenameOutput);
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

export function findMatchedItem(watch: WatchItem[], file: string) {
  for (const item of watch) {
    if (isMatch(file, item.pattern)) {
      return item;
    }
  }
  return undefined;
}

export function hmrPlugin(): Plugin {
  let options = {} as ReturnType<typeof parseOptions>;
  let initial = true;
  let enabled = true;
  let enabledTimeStamp = 0;

  const findItem = (file: string) => findMatchedItem(options?.watch ?? [], file);

  const triggerHmr = (server: ViteDevServer, file: string, event: string) => {
    // not enabled
    if (!enabled) {
      return;
    }
    // This file is modified during hmr disabled
    if (event !== 'unlink' && fs.statSync(resolve(server.config.root, file)).mtimeMs <= enabledTimeStamp) {
      return;
    }
    // emit the event
    const item = findItem(file);
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
          triggerHmr(server, file, event);
        });
      }

      // full upload
      server.viteburnerEmitter.on('full-upload', async () => {
        // skip timestamp check
        enabledTimeStamp = 0;
        const stream = fg.stream(patterns, { cwd: server.config.root });
        for await (const file of stream) {
          triggerHmr(server, file as string, 'change');
        }
      });

      // enable watch
      server.viteburnerEmitter.on('enable-watch', (value: boolean) => {
        enabled = value;
        if (value) {
          enabledTimeStamp = Date.now();
        }
      });
    },
    handleHotUpdate(context: HmrContext) {
      const file = relative(context.server.config.root, context.file);
      // using micromatch to test if the file matches any of the patterns
      const matched = findItem(file);
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
