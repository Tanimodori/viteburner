# Upload Options

## `watch`

Watch options tell viteburner what files to watch, should they be transformed, and where to upload them.

The `watch` option is an array of `WatchItem` objects. Each `WatchItem` object has the following properties:

- `pattern` - A glob pattern to match files to watch.
- `transform` - A boolean indicating whether the file should be transformed. (Optional)
- `location` - Indicating where to upload the file. (Optional)

```ts
export interface WatchItem {
  pattern: string;
  transform?: boolean;
  location?: RenameOutput | ((file: string) => RenameOutput);
}
```

### `pattern`

For example, the following pattern will watch all files in `src` folder with `.js`, `.ts`, `.script` and `.txt` extensions.

```
src/**/*.{js,ts,script,txt}
```

- `src` - Watch any file in `src` folder.
- `**` - Watch any file in any subfolder.
- `*` - Watch any file with any name.
- `.{js,ts,script,txt}` - Watch any file with `.js`, `.ts`, `.script` or `.txt` extensions.

See [micromatch](https://github.com/micromatch/micromatch) for more details.

### `transform`

If `transform` is `true`, viteburner will use `vite` to transform the file before uploading it. If `transform` is `false` (by default), viteburner will upload the file as-is.

See [Guide/Transform](../guide/transform.md) for more details.

### `location`

The `location` option tells viteburner which server to upload the file to, and where to put the file on the server.

| typeof location        | servers      | filenames               |
| ---------------------- | ------------ | ----------------------- |
| `null` or `undefined`  | `["home"]`   | `defaultUploadLocation` |
| `string`               | `[location]` | `defaultUploadLocation` |
| `string[]`             | `location`   | `defaultUploadLocation` |
| `{server}[]`           | `[server]`   | `defaultUploadLocation` |
| `{filename}[]`         | `["home"]`   | `filename`              |
| `{server, filename}[]` | `[server]`   | `filename`              |
| `function`             | result-based | result-based            |

### Basic examples

Here are some basic examples:

```ts
const watchItem = {
  pattern: 'src/**/*.js',
};
```

In this example, each file matched by the glob pattern `'src/**/*.js'` will be uploaded to the server named `home` with the default upload location.

The default upload location is a fallback function that transform the filename as follows:

```ts
export const defaultUploadLocation = (file: string) => {
  return file.replace(/^src\//, '').replace(/\.ts$/, '.js');
};
```

It will remove the `src/` prefix in each filename and replace the `.ts` extension with `.js` extension, which works for most cases.

So `src/foo/bar.ts` will be uploaded to `foo/bar.js` on the server `home`.

```ts
const watchItem = {
  pattern: 'src/**/*.js',
  location: 'n00dles',
  // or location: [{ server: 'n00dles' }],
};
```

In this example, files will be uploaded to `n00dles` instead of `home`. The filename will be transformed in the same way as the previous example.

```ts
const watchItem = {
  pattern: 'src/**/*.js',
  location: ['home', 'n00dles'],
  // or location: [{ server: 'home' }, { server: 'n00dles' }],
};
```

In this example, files will be uploaded to _both_ `home` and `n00dles`.

```ts
const watchItem = {
  pattern: 'src/data/foo.txt',
  location: [{ server: 'home', filename: 'bar.txt' }],
};
```

In this example, `src/data/foo.txt` will be uploaded to `bar.txt` on the server `home`.

### Advanced examples

```ts
const watchItem = {
  pattern: 'src/**/*.js',
  // `file` is the relative path to the project root
  // without a starting slash
  location: (file) => {
    const match = file.match(/^src\/([^\/]+)\/(.*)$/);
    if (match) {
      return [
        { server: match[1], filename: match[2] },
        { server: match[1], filename: match[2] + '.backup' },
      ];
    }
    return null;
  },
};
```

In this example, the `location` is a function, so each file will be passed to the function, and the function will return the server and filename to upload the file to.

If the function returns nullish values, the file will not be uploaded. You can use this feature to filter out some files. Otherwise the result will be treated as a non-function `location` values.

So in this case, `src/home/foo/bar.js` will be uploaded to `foo/bar.js` and `foo/bar.js.backup` on the server `home`, and `src/n00dles/foo/bar.js` will be uploaded to `foo/bar.js` and `foo/bar.js.backup` on the server `n00dles`.

When using functions, mind that the default rename behavior will not be applied. You need to implement it yourself especially when you're working with TypeScript files. The default `defaultUploadLocation` function can be imported from `viteburner`.

```ts
import { defaultUploadLocation } from 'viteburner';
const watchItem = {
  pattern: 'src/**/*',
  location: (file) => {
    if (file.startsWith('src/secret/')) {
      return null;
    }
    return { filename: defaultUploadLocation(file) };
  },
};
```

## `ignoreInitial`

If the `ignoreInitial` is set to `true`, viteburner will not upload files when the watcher starts. This is useful when you want to upload files only when they are changed. The default value is `false`.

Note that even if `ignoreInitial` is set to `false`, viteburner will _not_ all upload files when the server reconnects.
