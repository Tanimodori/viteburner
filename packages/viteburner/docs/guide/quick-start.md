# Quick start

Requires Node.js `>=20.19.0`.

## Using [viteburner-template](https://github.com/Tanimodori/viteburner-template)

Prerequisites: [Node.js](https://nodejs.org/en/download/)

```bash
git clone https://github.com/Tanimodori/viteburner-template.git
cd viteburner-template
npm i
npm run dev
```

In bitburner, select "Options > Remote API", enter the port of viteburner displays (default: `12525`) and click "Connect".

## Migrate your existing project to viteburner

1. Install devDependencies

```bash
npm i -D viteburner vite@^7
```

viteburner 0.6 requires Vite 7. Installing the latest Vite (8.x) currently fails peer resolution; pin Vite 7 until Vite 8 support ships.

2. (a) Sync-only setup

In `vite.config.js`

```ts
import { resolve } from 'path';
import { defineConfig } from 'viteburner';
export default defineConfig({
  /** basic vite configs */
  resolve: {
    alias: {
      /** path to your source code */
      '@': resolve(__dirname, 'src'),
      '/src': resolve(__dirname, 'src'),
    },
  },
  build: { minify: false },
  /** viteburner configs */
  viteburner: {
    watch: [{ pattern: 'src/**/*.{js,script,txt}' }],
  },
});
```

> Note: The config shown above includes basic vite configs. If your project doesn't have an existing `vite.config.js`/`vite.config.ts`, you may add them into the config. Otherwise you can just add viteburner-specific configs only. You can find more configs in [vite docs](https://vitejs.dev/config/).

2.  (b) TS or mixed TS+JS setup

In `vite.config.ts`

```ts
import { resolve } from 'path';
import { defineConfig } from 'viteburner';
export default defineConfig({
  /** basic vite configs */
  resolve: {
    alias: {
      /** path to your source code */
      '@': resolve(__dirname, 'src'),
      '/src': resolve(__dirname, 'src'),
    },
  },
  build: { minify: false },
  /** viteburner configs */
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

3. configure `package.json`

```json
{
  "scripts": {
    "dev": "viteburner"
  }
}
```

4. `npm run dev` in your terminal to start viteburner.
