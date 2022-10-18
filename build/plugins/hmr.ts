import { HmrContext, Plugin } from 'vite';
import { isMatch } from 'micromatch';
import chokidar from 'chokidar';
import { relative } from 'node:path';
import EventEmitter from 'node:events';

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
}

const parseOptions = (options: HmrOptions = {}) => {
  const watch = options.watch || {};
  return {
    watch,
  };
};

export const hmrPluginName = 'bitburner-vite:hmr';

export function hmrPlugin(options: HmrOptions = {}): Plugin {
  const { watch } = parseOptions(options);
  return {
    name: hmrPluginName,
    configureServer(server) {
      // emitter
      server.emitter = new EventEmitter();
      // events for watching
      const events = ['add', 'unlink', 'change'] as const;

      // for each pattern, create a watcher
      for (const [type, { pattern, transform }] of Object.entries(watch)) {
        const watcher = chokidar.watch(pattern, {
          cwd: server.config.root,
          ignoreInitial: false,
          persistent: true,
        });

        // for each event, create a handler
        for (const event of events) {
          watcher.on(event, (file) => {
            // emit the event
            server.emitter.emit(hmrPluginName, { file, event, type, transform });
            console.log(`${hmrPluginName}:${event} ${file}`);
          });
        }
      }
    },
    handleHotUpdate(context: HmrContext) {
      const file = relative(context.server.config.root, context.file);
      // using micromatch to test if the file matches any of the patterns
      const matched = Object.keys(watch).find((key) => isMatch(file, watch[key].pattern, {}));
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
