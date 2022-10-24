import { FSWatcher, WatchOptions } from 'chokidar';
import { isMatch } from 'micromatch';
import { defaultUploadLocation, fixStartingSlash, removeStartingSlash, WatchItem } from '..';
import chokidar from 'chokidar';
import EventEmitter from 'events';
import fs from 'fs';
import { resolve } from 'path';
import { slash } from 'vite-node/utils';
import fg from 'fast-glob';
import { hmrPluginName } from './hmr';

export class WatchManager {
  items: WatchItem[];
  options: WatchOptions;
  watcher?: FSWatcher;
  initial: boolean;
  enabled: boolean;
  enabledTimeStamp: number;
  emitter: EventEmitter;
  constructor(items: WatchItem[], options: WatchOptions = {}) {
    this.items = items;
    this.options = options;
    this.initial = true;
    this.enabled = true;
    this.enabledTimeStamp = 0;
    this.emitter = new EventEmitter();
  }
  get patterns() {
    return this.items.map((item) => item.pattern);
  }
  findItem(file: string) {
    return this.items.find((item) => isMatch(file, item.pattern));
  }
  init() {
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
    if (item) {
      this.emitter.emit(hmrPluginName, {
        ...item,
        file: slash(file),
        event,
        initial: this.initial,
        timestamp: Date.now(),
      });
    } else {
      throw new Error(`File ${file} does not match any patterns`);
    }
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

    // get all possible filenames
    const defaultFilename = defaultUploadLocation(filename);
    let result = item.location ?? 'home';
    if (typeof result === 'function') {
      const resolved = result(filename);
      if (!resolved) {
        return [];
      }
      result = resolved;
    }
    if (!Array.isArray(result)) {
      result = [result];
    }
    return result.map((r) => {
      const itemResult = {
        filename: defaultFilename,
        server: 'home',
        ...(typeof r === 'string' ? { server: r } : r),
      };
      itemResult.filename = fixStartingSlash(itemResult.filename);
      return itemResult;
    });
  }
  /** Shoutcut of `getUploadFilenames(filename).find(server) */
  getUploadFilenamesByServer(filename: string, server: string) {
    const filenames = this.getUploadFilenames(filename);
    return filenames.find((item) => item.server === server)?.filename;
  }
}
