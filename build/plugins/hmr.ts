import { HmrContext, Plugin } from 'vite';
import { isMatch } from 'micromatch';
import chokidar from 'chokidar';

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
            server.ws.send({
              type: 'custom',
              event: `${hmrPluginName}`,
              data: { file, type, transform },
            });
          });
        }

        console.log(server.config.root, pattern, watcher.getWatched());
      }
    },
    handleHotUpdate(context: HmrContext) {
      const { file } = context;
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
