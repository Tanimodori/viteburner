# FAQ

## How can I use viteburner?

Please checkout the [Quick Start](quick-start.md) guide.

## I don't know what vite is and just want to sync my files.

Please checkout the [Quick Start](quick-start.md) guide for a sync-only setup.

## What's the advantage and disadvantage of using vite's transform?

Advantage:

- Transpile TypeScript to JavaScript.
- Handle import alias, relative and absolute import paths.
- You can use vite's plugin system to write you own transforms.

Disadvantage:

- Modify the content of file. If you want to download transformed code from server it will mess up the git history. In a TS-JS mixed project, you can use `download.ignoreTs` and `download.ignoreSourcemap` to ignore the transformed files.

Note that you need to use vite's transform to write TypeScript scripts that run on server, but you can write vite/viteburner configs in TypeScript without turning on the transform.

## How can I import scripts?

The following import methods are supported by default in viteburner-template:

```ts
// relative import
import { foo } from './foo';
// absolute import, need to configure vite.config and tsconfig.json
import { foo } from '@/foo';
import { foo } from '/src/foo';
```

You need to turn on vite's transform to use relative import and import alias (`@/` in this case).

If you want to turn off vite's transform, you need to import the actual file path on the server and configure tsconfig to let the TypeScript compiler know the actual file path.

```js
import { foo } from '/foo';
```

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "/*": ["./src/*"],
      "@ns": ["./NetscriptDefinitions.d.ts"]
    }
  }
}
```

You can use other import alias by configuring vite.config and tsconfig.json like `/@/*`.

Unfortunately, you can't use bare `/` as an import alias for vite since vite internally use `/@fs/` and other alias so it will conflict. The `/src` is actually a alias.

## Watch mode doesn't work

If your terminal is a non-tty terminal (like Git Bash on Windows), keypress control may not work in watch mode. But the basic watch and other functionalities are working.

## Which License is viteburner under?

viteburner and viteburner-template is licensed under the [MIT License](../../LICENSE).
