# FAQ

## How can I use viteburner?

Please checkout the [Quick Start](quick-start.md) guide.

## I don't know what vite is and just want to sync my files

Please checkout the [Quick Start](quick-start.md) guide for a sync-only setup.

## File sync is not working

1. Press `s` to print the status (or the in-game "Options > Remote API" menu) to check if it is connected to the game and if any pending files exist.
2. Press `u` to perform a full sync to see if manual sync works.
3. If you are using [Windows fs on WSL2](https://github.com/microsoft/WSL/issues/4739) or a network fs, set [`usePolling`](../config/upload-options.md#usepolling) to `true` in your config file.
4. Inspect the console output of viteburner to see if there are any errors preventing from compliling or uploading files (e.g. Syntax errors, invalid filenames etc.).
5. Inspect the console output of viteburner to see if there are any `hmr` events. If there are none, check if the `watch` option is set correctly in your config file.
6. Add `dumpFiles` settings to your config file to dump the compiled files to a local directory (e.g. `dumpFiles: 'dist'`). If file in the `dist` is updated but not in the game, it means watch works but there is a problem with the upload process.
7. Try upgrading to the latest version of viteburner (and viteburner-template if you are using it).
8. Open an issue on Github. Please attach output of `npx envinfo --system --binaries --npmPackages` and viteburner output for triage and decribe you issue.

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

## Error: Failed to import "_importee_" from "_importer_", does the file exist?

This is an import error when vite cannot find the file. Please check if the file exists and the import path is correct.

Checkout the ["How can I import scripts?"](faq.md#how-can-i-import-scripts) section for how to import script.

## How can I change the `NetscriptDefinitions.d.ts` path?

1. Change the `dts` option in config, see [Server Options](../config/server-options.md).
2. Change the `@ns` alias in `tsconfig.json`.
3. Delete the exisiting dts file in disk.
4. Modify `.gitignore` to ignore the new dts file.
5. Rerun viteburner.

## Watch mode doesn't work

If your terminal is a non-tty terminal (like Git Bash on Windows), keypress control may not work in watch mode. But the basic watch and other functionalities are working.

## Can I use local NPM dependencies with viteburner?

Currently viteburner does not support local NPM dependencies at the moment but maybe implemented in the future.

Vite and its plugins work at two different modes. In `dev` mode, vite will keep the source file structure and transpile them one by one, which is known as the "bundleless" mode. In `build` mode, vite will bundle all the files into one file.

Viteburner works in `dev` mode because:

- We need to keep the source file structure to sync the files to the game. So the RAM calculation and `scp` files will be correct. There is a way to tell rollup to keep the file structure when bundling but it is more tricky and hacky.
- Allow us to do HMR and don't need to bundle the files again when we change the files. When we run vite in `build` mode with `--watch`, it will bundle the files again when we change the files. This is not efficient.

Using local NPM dependencies in `build` mode is trivial since `esbuild` will bundle them together. But in `dev` mode, the client needs to track into NPM dependencies and request them from the vite dev server. If the client is a normal browser, it will be able to request them because vite have injected HMR code when starting the dev server. But in `viteburner` or similarly `vite-node` we need to manually track dependencies and send them to the client so it will found them.

So theoretically it is possible to implement local NPM dependencies in viteburner. Since it is not a frequently request feature, it is not implemented yet but maybe implemented in the future.

## Which License is viteburner under?

viteburner and viteburner-template is licensed under the [MIT License](../../LICENSE).

## I have a question that is not listed here

Please open an issue on [GitHub](https://github.com/Tanimodori/viteburner/issues).
