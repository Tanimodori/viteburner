import fs from 'fs';
import { resolve } from 'path';
import chokidar, { FSWatcher, WatchOptions } from 'chokidar';
import fg from 'fast-glob';
import micromatch from 'micromatch';
import { logger } from '@/console';
import { ResolvedWatchItem } from '@/types';
import { EventBus } from '@/utils/bus';
import { removeStartingSlash, slash } from '@/utils/path';

/**
 * The file watcher, and the source of the `fs:changed` event.
 *
 * It knows which pattern matched (and so where a file uploads), but nothing about the game: it turns
 * a chokidar event into one `fs:changed` payload on the session's bus.
 */
export class WatchService {
  items: ResolvedWatchItem[];
  options: WatchOptions;
  watcher?: FSWatcher;
  initial: boolean;
  enabled: boolean;
  enabledTimeStamp: number;

  constructor(
    items: ResolvedWatchItem[],
    options: WatchOptions,
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
    this.watcher = chokidar.watch(this.patterns, this.options);
    // add watcher to ready watchers when ready
    this.watcher.on('ready', () => {
      this.initial = false;
    });

    // for each event, create a handler
    const events = ['add', 'unlink', 'change'] as const;
    for (const event of events) {
      this.watcher.on(event, (file: string) => {
        this.triggerHmr(file, event);
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

  /** Shoutcut of `getUploadFilenames(filename).find(server) */
  getUploadFilenamesByServer(filename: string, server: string) {
    const filenames = this.getUploadFilenames(filename);
    return filenames.find((item) => item.server === server)?.filename;
  }

  stop() {
    this.watcher?.close();
  }
}
