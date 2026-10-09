# Transform

| Transform          | Dest                    |
| ------------------ | ----------------------- |
| ![](transform.png) | ![](transform-dest.png) |

When a file changes or a manual upload is triggered, viteburner will first get all destinations of the changed file, load the file content, transform it if the related `WatchItem.transform` is set, dump it if `dumpFiles` is set, and finally send it to the server.

## Import path

The following import methods are supported:

```ts
import { foo } from '/src/foo';
// absolute import, need to configure vite.config and tsconfig.json
import { foo } from '@/foo';
// relative import
import { foo } from './foo';
```

### Import fix

Say you have the following file structure:

```
src/
  import/
    main.ts
    absolute.ts
    relative.ts
```

`main.ts`

```ts
import { NS } from '@ns';
import { absolute } from '@/import/absolute';
import { relative } from './relative';

export async function main(ns: NS) {
  relative(ns);
  absolute(ns);
}
```

`absolute.ts`

```ts
import { NS } from '@ns';

export function absolute(ns: NS) {
  ns.tprint('Hello, absolute!');
}
```

`relative.ts`

```ts
import { NS } from '@ns';

export function relative(ns: NS) {
  ns.tprint('Hello, relative!');
}
```

This works fine for a normal vite and ts project. During dev mode, vite will resolve `import` path to the correct file, which is the absolute path to the package root so the vite server can serve it from the file system and transform it.

Transformed `main.ts`

```ts
import { absolute } from '/src/import/absolute.js';
import { relative } from '/src/import/relative.js';
export async function main(ns) {
  relative(ns);
  absolute(ns);
}
```

However, this is not the exact file path we want to upload to the server. We want to upload the file to the server as `/import/relative.js` instead of `/src/import/relative.js`. So the `import` path needs to be transformed in the same way as the file path for each uploaded file.

Also, bitburner only supports absolute path for import, so you can use vite to transform the relative path to absolute path.

If you are disabling the `transform` option for a file, you need to make sure the import path is correct manually.

```js
import { absolute } from '/import/absolute.js';
import { relative } from '/import/relative.js';
export async function main(ns) {
  relative(ns);
  absolute(ns);
}
```

The absolute import pattern `@/*` can be configured in `vite.config.ts` and `tsconfig.json`. Make sure you are using the same pattern in both files. See [vite docs#resolve-alias](https://vitejs.dev/config/#resolve-alias) and [ts docs#paths](https://www.typescriptlang.org/tsconfig#paths) for more details.
