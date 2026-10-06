# Download Options

Download options tell Viteburner from which server and where to download files.

## `download.server`

- **Type:** `string | string[]`
- **Default:** `"home"`

The servers to download files from. Multiple servers can be specified as an array.

## `download.location`

- **Type:** `(file: string, server: string) => string | null | undefined`
- **Default:** `(file) => 'src/' + file`

The location to save the downloaded files. If `null` or `undefined` is returned, the file will be ignored.

```ts
const downloadOptions = {
  server: ['home', 'n00dles'],
  // `file` is the file path on the server without a starting slash.
  location: (file, server) => {
    // save only .txt files to e.g. txt/home/foo.txt
    if (file.endsWith('.txt')) {
      return `txt/${server}/${file}`;
    }
    return null;
  },
};
```

## `download.ignoreTs`

- **Type:** `boolean`
- **Default:** `true`

If set to `true`, check if the destination contains a `.ts` file with the same basename. If so, skip downloading the file.

For example. If the destination contains a file named `template.ts`, the file `template.js` will not be downloaded.

This may help if you are using viteburner to sync a TypeScript project.

## `download.ignoreSourcemap`

- **Type:** `boolean`
- **Default:** `true`

If set to `true`, skip downloading files that have a tailing inline sourcemap.

This may help if you are using viteburner to transform source code.
