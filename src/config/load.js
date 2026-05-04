import { loadConfig as loadConfigRaw } from 'unconfig';
import { resolveConfig } from './resolve';
/** TypeScript helper to define your config */
export function defineConfig(config) {
    return config;
}
export async function loadConfig(inlineConfig) {
    const { config } = await loadConfigRaw({
        sources: [
            // load from `viteburner.config.xx`
            {
                files: 'viteburner.config',
                extensions: ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', ''],
            },
            // load inline config from `vite.config`
            {
                files: 'vite.config',
                async rewrite(config) {
                    const resolvedConfig = await (typeof config === 'function' ? config() : config);
                    const sourcemap = resolvedConfig?.build?.sourcemap;
                    return {
                        ...(sourcemap && { sourcemap }),
                        ...resolvedConfig?.viteburner,
                    };
                },
            },
        ],
        cwd: inlineConfig.cwd ?? process.cwd(),
        merge: true,
    });
    return resolveConfig({
        ...config,
        ...inlineConfig,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9hZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvYWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsSUFBSSxhQUFhLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHdkQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUUxQyw4Q0FBOEM7QUFDOUMsTUFBTSxVQUFVLFlBQVksQ0FBQyxNQUE0QjtJQUN2RCxPQUFPLE1BQU0sQ0FBQztBQUNoQixDQUFDO0FBTUQsTUFBTSxDQUFDLEtBQUssVUFBVSxVQUFVLENBQUMsWUFBb0M7SUFDbkUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sYUFBYSxDQUFhO1FBQ2pELE9BQU8sRUFBRTtZQUNQLG1DQUFtQztZQUNuQztnQkFDRSxLQUFLLEVBQUUsbUJBQW1CO2dCQUMxQixVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDO2FBQ2pFO1lBQ0Qsd0NBQXdDO1lBQ3hDO2dCQUNFLEtBQUssRUFBRSxhQUFhO2dCQUNwQixLQUFLLENBQUMsT0FBTyxDQUE0QixNQUFpQztvQkFDeEUsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLE9BQU8sTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNoRixNQUFNLFNBQVMsR0FBRyxjQUFjLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQztvQkFDbkQsT0FBTzt3QkFDTCxHQUFHLENBQUMsU0FBUyxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7d0JBQy9CLEdBQUcsY0FBYyxFQUFFLFVBQVU7cUJBQzlCLENBQUM7Z0JBQ0osQ0FBQzthQUNGO1NBQ0Y7UUFDRCxHQUFHLEVBQUUsWUFBWSxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQ3RDLEtBQUssRUFBRSxJQUFJO0tBQ1osQ0FBQyxDQUFDO0lBQ0gsT0FBTyxhQUFhLENBQUM7UUFDbkIsR0FBRyxNQUFNO1FBQ1QsR0FBRyxZQUFZO0tBQ2hCLENBQUMsQ0FBQztBQUNMLENBQUMifQ==