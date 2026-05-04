import { logger, setHandler } from '@/console';
import { WsManager, WsAdapter } from '@/ws';
import { resolve } from 'pathe';
import { slash, normalizeRequestId } from 'vite-node/utils';
import { handleKeyInput, loadConfig } from '..';
import { WatchManager } from './watch';
export const hmrPluginName = 'viteburner:hmr';
export const virtualModuleId = 'virtual:viteburner-entry';
export function getDefaultConfig() {
    return {
        mode: 'development',
        optimizeDeps: { disabled: true },
        clearScreen: false,
        build: {
            lib: {
                /**
                 * Meaningless for Vite<3.2.0
                 * @see {@link https://github.com/vitejs/vite/discussions/1736}
                 */
                entry: virtualModuleId,
                formats: ['es'],
            },
        },
        server: { middlewareMode: true },
    };
}
export function viteburnerPlugin(inlineConfig) {
    const resolvedVirtualModuleId = '\0' + virtualModuleId;
    let server;
    let wsAdapter;
    return {
        name: 'viteburner',
        apply: 'serve',
        // Load viteburner.config.xx, merge with config, and resolve
        async config(config) {
            logger.info('config', 'resolving user config...');
            config.viteburner = await loadConfig(inlineConfig);
            return getDefaultConfig();
        },
        configResolved() {
            logger.info('config', 'config resolved');
        },
        // save server instance
        configureServer(_server) {
            server = {
                ..._server,
                pathToId(file) {
                    const id = `/@fs/${slash(resolve(server.config.root, file))}`;
                    return normalizeRequestId(id, server.config.base);
                },
                async invalidateFile(file) {
                    const id = server.pathToId(file);
                    const module = await server.moduleGraph.getModuleByUrl(id);
                    if (module) {
                        server.moduleGraph.invalidateModule(module);
                    }
                },
                async fetchModule(file) {
                    const id = server.pathToId(file);
                    return server.transformRequest(id);
                },
                onHmrMessage(handler) {
                    server.watchManager.emitter.on(hmrPluginName, (data) => handler(data, server));
                },
                async buildStart() {
                    return server.pluginContainer.buildStart({});
                },
            };
        },
        // main entry
        buildStart() {
            // create watch
            logger.info('watch', 'creating a watcher...');
            const { root, viteburner } = server.config;
            const { watch, ignoreInitial, port, timeout, tls, usePolling, pollingOptions } = viteburner;
            server.watchManager = new WatchManager(watch, {
                cwd: root,
                persistent: true,
                ignoreInitial,
                usePolling: !!usePolling,
                ...pollingOptions,
            });
            // create ws server
            logger.info('ws', 'creating ws server...');
            const wsManager = new WsManager({ port, timeout, tls });
            wsAdapter = new WsAdapter(wsManager, server);
            // handle hmr
            server.onHmrMessage((data) => wsAdapter.handleHmrMessage(data));
            server.watchManager.init();
            // create key handler
            setHandler(handleKeyInput(wsAdapter));
        },
        // virtual entry
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `export {}`;
            }
        },
        // exit
        buildEnd() {
            server.watchManager.close();
            wsAdapter.manager.close();
            setHandler();
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZWJ1cm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpdGVidXJuZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDL0MsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDNUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUNoQyxPQUFPLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDNUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDaEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFNBQVMsQ0FBQztBQVF2QyxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsZ0JBQWdCLENBQUM7QUFDOUMsTUFBTSxDQUFDLE1BQU0sZUFBZSxHQUFHLDBCQUEwQixDQUFDO0FBRTFELE1BQU0sVUFBVSxnQkFBZ0I7SUFDOUIsT0FBTztRQUNMLElBQUksRUFBRSxhQUFhO1FBQ25CLFlBQVksRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUU7UUFDaEMsV0FBVyxFQUFFLEtBQUs7UUFDbEIsS0FBSyxFQUFFO1lBQ0wsR0FBRyxFQUFFO2dCQUNIOzs7bUJBR0c7Z0JBQ0gsS0FBSyxFQUFFLGVBQWU7Z0JBQ3RCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQzthQUNoQjtTQUNGO1FBQ0QsTUFBTSxFQUFFLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRTtLQUNqQyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxZQUFvQztJQUNuRSxNQUFNLHVCQUF1QixHQUFHLElBQUksR0FBRyxlQUFlLENBQUM7SUFDdkQsSUFBSSxNQUF3QixDQUFDO0lBQzdCLElBQUksU0FBb0IsQ0FBQztJQUV6QixPQUFPO1FBQ0ws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