# Dump options

Dump options allows you to dump files before uploading them to the server.

## `dumpFiles`

- **Type:** `string | null | undefined | ((file: string, server: string) => string | null | undefined)`
- **Default:** `undefined`

Specify the destination to dump files to.

- Set to `null` or `undefined` to disable dumping.
- Set to a string to dump to a specific directory. e.g. `dumpFiles: 'dump'` will dump `src/foo.js` to `dump/src/foo.js`.
- Set to a function that dynamically decides the destination filepath. If the function returns `null` or `undefined`, the file will not be dumped. The file path is relative to the project root and has no starting slash.

```ts
import { defaultUploadLocation } from 'viteburner';
const dumpOptions = {
  dumpFiles: (file, server) => {
    // dump only `.ts` files
    if (file.endsWith('.ts')) {
      // remove `src` and change `.ts` to `.js`
      return `dump/${server}/${defaultUploadLocation(file)}`;
    }
    return null;
  },
};
```
