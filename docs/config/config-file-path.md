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

The `defineConfig` is a TypeScript helper function to provide type support for your config. It is not required, but recommended.

You can also write your config in `viteburner.config.ts`, which will be merged with `vite.config.ts` if both exist.

```ts
import { ViteBurnerUserConfig } from 'viteburner';
const config: ViteBurnerUserConfig = {
  // viteburner config here
};
export defauilt config;
```

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
