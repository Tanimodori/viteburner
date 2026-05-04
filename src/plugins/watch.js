import { isMatch } from 'micromatch';
import { removeStartingSlash } from '..';
import chokidar from 'chokidar';
import EventEmitter from 'events';
import fs from 'fs';
import { resolve } from 'path';
import { slash } from 'vite-node/utils';
import fg from 'fast-glob';
import { hmrPluginName } from './viteburner';
export class WatchManager {
    items;
    options;
    watcher;
    initial;
    enabled;
    enabledTimeStamp;
    emitter;
    constructor(items, options = {}) {
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
    findItem(file) {
        return this.items.find((item) => isMatch(file, item.pattern));
    }
    init() {
        this.watcher = chokidar.watch(this.patterns, this.options);
        // add watcher to ready watchers when ready
        this.watcher.on('ready', () => {
            this.initial = false;
        });
        // for each event, create a handler
        const events = ['add', 'unlink', 'change'];
        for (const event of events) {
            this.watcher.on(event, (file) => {
                this.triggerHmr(file, event);
            });
        }
    }
    triggerHmr(file, event) {
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
        }
        else {
            throw new Error(`File ${file} does not match any patterns`);
        }
    }
    setEnabled(value) {
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
            this.triggerHmr(file, 'change');
        }
    }
    /** Get all possible filenames to upload */
    getUploadFilenames(filename) {
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
    getUploadFilenamesByServer(filename, server) {
        const filenames = this.getUploadFilenames(filename);
        return filenames.find((item) => item.server === server)?.filename;
    }
    close() {
        this.watcher?.close();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2F0Y2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3YXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLElBQUksQ0FBQztBQUN6QyxPQUFPLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFDaEMsT0FBTyxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxNQUFNLElBQUksQ0FBQztBQUNwQixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQy9CLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN4QyxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDM0IsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUc3QyxNQUFNLE9BQU8sWUFBWTtJQUN2QixLQUFLLENBQXNCO0lBQzNCLE9BQU8sQ0FBZTtJQUN0QixPQUFPLENBQWE7SUFDcEIsT0FBTyxDQUFVO0lBQ2pCLE9BQU8sQ0FBVTtJQUNqQixnQkFBZ0IsQ0FBUztJQUN6QixPQUFPLENBQWU7SUFDdEIsWUFBWSxLQUEwQixFQUFFLFVBQXdCLEVBQUU7UUFDaEUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDcEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDcEIsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7SUFDcEMsQ0FBQztJQUNELElBQUksUUFBUTtRQUNWLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVB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