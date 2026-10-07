import { resolveConfig, type Plugin } from 'vite';
import { findViteBurnerPlugin, viteburnerPlugin, type ResolvedViteBurnerConfig } from 'viteburner';

/** The config read back from one suite, by the two independent routes. */
export interface ResolvedBothWays {
  /** `resolvedConfig.viteburner`, as an outside plugin sees it. */
  fromResolvedConfig: ResolvedViteBurnerConfig | undefined;
  /** `plugin.api.getPluginConfig()`, the plugin reading its own resolved config. */
  fromApi: ResolvedViteBurnerConfig | undefined;
}

/**
 * A plugin that captures `resolvedConfig.viteburner` — a stand-in for any plugin that is not
 * viteburner and only holds the resolved config. It is registered after the viteburner plugin, so by
 * the time its `configResolved` runs the viteburner plugin's `config` hook has loaded, merged and
 * resolved the config on disk.
 */
function captureViteburnerConfig() {
  let captured: ResolvedViteBurnerConfig | undefined;
  const plugin: Plugin = {
    name: 'config-test:capture',
    configResolved(config) {
      captured = (config as unknown as { viteburner: ResolvedViteBurnerConfig }).viteburner;
    },
  };
  return { plugin, get: () => captured };
}

/**
 * Resolve one fixture project the way the CLI does — inline `cwd`, the viteburner plugin, the config
 * files on disk — and read the config back both ways.
 *
 * `resolveConfig` runs the whole config pipeline the CLI relies on (`config`, then `configResolved`)
 * but stops before anything is started: no dev server is created, so no watcher is spawned and no
 * websocket port is opened, and there is nothing to tear down between cases. That is also why it is
 * used instead of `createServer`, which initializes the server and runs the plugin's `buildStart`.
 * `logLevel: 'silent'` keeps vite's own output out of the report; the viteburner plugin logs its
 * `config` lines itself, which is the evidence the hook ran.
 */
export async function resolveSuite(dir: string): Promise<ResolvedBothWays> {
  const capture = captureViteburnerConfig();
  const plugin = viteburnerPlugin({ cwd: dir });
  const resolvedConfig = await resolveConfig(
    { root: dir, logLevel: 'silent', plugins: [plugin, capture.plugin] },
    'serve',
  );
  const found = findViteBurnerPlugin(resolvedConfig);
  if (!found) {
    throw new Error(`the viteburner plugin is missing from the resolved config of ${dir}`);
  }
  return { fromResolvedConfig: capture.get(), fromApi: found.api.getPluginConfig() };
}
