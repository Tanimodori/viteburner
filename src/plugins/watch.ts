import { FSWatcher, WatchOptions } from 'chokidar';
import { isMatch } from 'micromatch';
import { WatchItem } from '..';
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
}
