# Config File Path

## Package Root

During startup, viteburner searches in your package root for user config. The package root is where your `package.json` is located, by default it is `process.cwd()`. If you want to change the it, you can use the `--cwd` flag in cli:

```bash
npx viteburner --cwd /path/to/your/project
```

## Config File

You can write your config in `vite.config.ts` along with your vite config.

```ts
import { defineConfig } from 'viteburner';
export default defineConfig({
  // vite config here
  viteburner: {
    // viteburner config here
  },
});
```

Powered by [unconfig](https://github.com/antfu/unconfig), you can write your config in `.ts`, `.js`, `.json` and more. Config in `.ts` and `.js` allows you to write your own logic in it.

The `defineConfig` helper provides type support for a config written under the `viteburner` key of `vite.config.*`. It is not required, but recommended.

You can also write your config in a standalone `viteburner.config.ts` (or `.js`, `.json`, ...), which is merged with `vite.config.*` when both exist. The standalone file exports the viteburner config itself, not a `vite.config` object:

```ts
import type { ViteBurnerConfig } from 'viteburner';
const config: ViteBurnerConfig = {
  // viteburner config here
};
export default config;
```

The standalone file can also export a function. It receives vite's `ConfigEnv` — the same object vite passes to a function-form `vite.config.*` — and may be async:

```ts
import type { ViteBurnerConfigExport } from 'viteburner';

const config: ViteBurnerConfigExport = ({ mode }) => ({
  port: mode === 'development' ? 12525 : 12526,
  watch: [{ pattern: 'src/**/*.{js,ts}', transform: true }],
});

export default config;
```

`env.command` is `'serve'` (viteburner never runs for `build`), and `env.mode` is the mode vite was started with. Vite's optional `isSsrBuild` and `isPreview` fields are passed through as well. The function is called once per config resolution, with the same environment vite used to evaluate `vite.config.*`.

If a value appears in both `vite.config.*` and the standalone file, the standalone file wins. The `--port` and `--cwd` command-line options win over both.

## Example Configs

1. Sync-only setup `vite.config.ts`

```ts
import { defineConfig } from 'viteburner';
export default defineConfig({
  viteburner: {
    watch: [{ pattern: 'src/**/*.{js,script,txt}' }],
  },
});
```

2. TS or mixed TS+JS setup `vite.config.ts`

```ts
import { defineConfig } from 'viteburner';
export default defineConfig({
  viteburner: {
    watch: [
      {
        pattern: 'src/**/*.{js,ts}',
        transform: true,
      },
      { pattern: 'src/**/*.{script,txt}' },
    ],
  },
});
```
