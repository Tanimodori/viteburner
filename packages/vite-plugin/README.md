# @viteburner/vite-plugin

The vite plugin behind [viteburner](https://www.npmjs.com/package/viteburner): it watches your scripts, transforms them with vite, and syncs them to Bitburner over the game's Remote API. It also loads and resolves the `viteburner` config, so the plugin works on its own, with no CLI.

Requires Node.js `>=20.19.0` and Vite 7 (`vite@^7`).

```bash
npm i -D @viteburner/vite-plugin vite@^7
```

Add it to any vite config:

```ts
import { viteburnerPlugin } from '@viteburner/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [viteburnerPlugin({})],
  viteburner: {
    watch: [{ pattern: 'src/**/*.{js,ts}', transform: true }],
  },
});
```

`viteburnerPlugin(inlineConfig)` returns a vite plugin. Its `api` answers the resolved config and the running session:

- `plugin.api.getPluginConfig()` — the resolved `viteburner` config, the same object as `resolvedConfig.viteburner`.
- `plugin.api.getSession()` — the services of the dev server that is up now, or `undefined`. Ask the session for its status (`getStatus()`), its services (`sync`, `ws`, `watch`, `vite`), or dispose it.

`findViteBurnerPlugin(resolvedConfig)` finds the plugin in a config, for a caller that only holds the resolved config.

This package also carries the Bitburner Remote API transport — `WsManager`, the protocol message types and their zod validators — bundled in rather than depended on, and re-exported here so `import { WsManager } from 'viteburner'` resolves to the same copy the plugin itself runs.

The config can be written under `viteburner` in `vite.config.*` or in a standalone `viteburner.config.ts`/`.js`/`.json` file. A standalone file exports the config object or a function that receives vite's `ConfigEnv`; see the [viteburner docs](https://github.com/Tanimodori/viteburner/blob/main/packages/viteburner/docs/index.md).

The `viteburner` package is the CLI built on this plugin and re-exports all of the above.

## License

[MIT License](LICENSE) © 2022-present Tanimodori
