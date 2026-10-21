import fs from 'fs';
import { resolve } from 'path';
import { FSWatcher } from 'chokidar';
import type { ChokidarOptions } from 'chokidar';
import fg from 'fast-glob';
import micromatch from 'micromatch';
import { logger } from '@/console';
import { ResolvedWatchItem } from '@/types';
import { EventBus } from '@/utils/bus';
import { removeStartingSlash, slash } from '@/utils/path';

/**
 * The deepest directory a pattern can match under, so the watcher can watch that directory rather
 * than a glob. chokidar 4 dropped glob support and silently watches nothing when given one.
 */
function watchRoot(pattern: string) {
  const parts = slash(pattern).split('/');
  const firstGlob = parts.findIndex((part) => /[*?[\]{}()!+@]/.test(part));
  const staticParts = firstGlob === -1 ? parts.slice(0, -1) : parts.slice(0, firstGlob);
  return staticParts.join('/') || '.';
}

/**
 * The file watcher, and the source of the `fs:changed` event.
 *
 * It knows which pattern matched (and so where a file uploads), but nothing about the game: it turns
 * a chokidar event into one `fs:changed` payload on the session's bus.
 */
export class WatchService {
  items: ResolvedWatchItem[];
  options: ChokidarOptions;
  watcher?: FSWatcher;
  initial: boolean;
  enabled: boolean;
  enabledTimeStamp: number;

  constructor(
    items: ResolvedWatchItem[],
    options: ChokidarOptions,
    private readonly events: EventBus,
  ) {
    this.items = items;
    this.options = options;
    this.initial = true;
    this.enabled = true;
    this.enabledTimeStamp = 0;
  }

  get patterns() {
    return this.items.map((item) => item.pattern);
  }

  findItem(file: string) {
    return this.items.find((item) => micromatch.isMatch(file, item.pattern));
  }

  start() {
    const roots = this.patterns.filter((pattern) => !pattern.startsWith('!')).map(watchRoot);
    // chokidar's `watch(paths, options)` is only `new FSWatcher(options).add(paths)`. Using the
    // class directly avoids the default-export shape difference between its CJS and ESM builds.
    this.watcher = new FSWatcher({
      ...this.options,
      ignored: (file: string) => /(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(file),
    });
    this.watcher.add(roots.length ? [...new Set(roots)] : ['.']);
    // add watcher to ready watchers when ready
    this.watcher.on('ready', () => {
      this.initial = false;
    });

    // for each event, create a handler
    const events = ['add', 'unlink', 'change'] as const;
    for (const event of events) {
      this.watcher.on(event, (file: string) => {
        const normalized = slash(file);
        // Watching a directory rather than a glob means events for files no pattern covers arrive
        // here too; only the matching ones are ours.
        if (!this.findItem(normalized)) {
          return;
        }
        this.triggerHmr(normalized, event);
      });
    }
  }

  triggerHmr(file: string, event: string) {
    // not enabled
    if (!this.enabled) {
      return;
    }
    // This file is modified during hmr disabled
    const root = this.options.cwd ?? process.cwd();
    if (event !== 'unlink' && fs.statSync(resolve(root, file)).mtimeMs <= this.enabledTimeStamp) {
      return;
    }
    // emit the event
    const item = this.findItem(file);
    if (!item) {
      // chokidar only reports files one of these patterns matched, and `fullReload` globs the same
      // patterns, so this is a pattern-set bug rather than anything the player did. Report it and
      // keep watching: throwing here would surface as an uncaught exception in a chokidar callback
      // and take the daemon down.
      logger.warn('watch', `${file} does not match any patterns`);
      return;
    }
    this.events.emit('fs:changed', {
      ...item,
      file: slash(file),
      event,
      initial: this.initial,
      timestamp: Date.now(),
    });
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    if (value) {
      this.enabledTimeStamp = Date.now();
    }
  }

  async fullReload() {
    // skip timestamp check
    this.enabledTimeStamp = 0;
    const stream = fg.stream(this.patterns, { cwd: this.options.cwd ?? process.cwd() });
    for await (const file of stream) {
      this.triggerHmr(file as string, 'change');
    }
  }

  /** Get all possible filenames to upload */
  getUploadFilenames(filename: string) {
    // fix starting slash
    filename = removeStartingSlash(slash(filename));

    // find item
    const item = this.findItem(filename);
    if (!item) {
      return [];
    }

    return item.location(filename);
  }

  /** Shortcut of `getUploadFilenames(filename).find((item) => item.server === server)` */
  getUploadFilenamesByServer(filename: string, server: string) {
    const filenames = this.getUploadFilenames(filename);
    return filenames.find((item) => item.server === server)?.filename;
  }

  stop() {
    // chokidar 4's close() is async and terminal; the session has already unsubscribed its handlers.
    void this.watcher?.close();
  }
}
