# Quick start

## Using [viteburner-template](https://github.com/Tanimodori/viteburner-template)

Prerequisites: [Node.js](https://nodejs.org/en/download/)

```bash
git clone https://github.com/Tanimodori/viteburner-template.git
cd viteburner-template
npm i
npm run dev
```

In bitburner, select "Options > Remote API", enter the port of viteburner displays (default: `12525`) and click "Connect".

## Install viteburner to your existing project

1. Install devDependencies

```bash
npm i -D viteburner vite
```

2. (a) Sync-only setup

In `vite.config.ts`

```ts
import { defineConfig } from 'viteburner';
export default defineConfig({
  viteburner: {
    watch: [{ pattern: 'src/**/*.{js,script,txt}' }],
  },
});
```

2.  (b) TS or mixed TS+JS setup

In `vite.config.ts`

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

3. configure `package.json`

```json
{
  "scripts": {
    "dev": "viteburner"
  }
}
```

4. `npm run dev` in your terminal to start viteburner.
