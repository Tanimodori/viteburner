# Change Log - viteburner

This log was last generated on Thu, 22 Oct 2026 16:47:06 GMT and should not be manually modified.

## 0.5.3 (2023.03.14)

### Updates

- Fixed the `defineConfig` type definitions.

## 0.5.2 (2023.02.25)

### Updates

- Fixed issue #16 by invalidating the changed file before calling `fetchModule`.
- Handled SSR and external modules when resolving imports.
- Switched to Node's `builtinModules` and dropped the `builtin-modules` dependency.
- Re-enabled type rollup for the published declarations.

## 0.5.1 (2023.01.30)

### Updates

- The peer dependency now accepts both Vite 3 and Vite 4.

## 0.5.0 (2023.01.30)

### Updates

- Added support for Vite 4 and raised the peer dependency accordingly.
- Fixed the exclusion of Node built-in modules from the uploaded bundle.

## 0.4.2 (2022.11.25)

### Updates

- External and URL imports are now ignored, and unknown import paths are left untouched (fixes #12).

## 0.4.1 (2022.11.07)

### Updates

- Added the `usePolling` option for chokidar-based file watching.

## 0.4.0 (2022.11.04)

### Updates

- Changes to files referenced by `import.meta.glob` now trigger HMR for the dependent modules.

## 0.3.3 (2022.10.29)

### Updates

- Fixed import resolution for request IDs that need normalization (fixes #8).

## 0.3.2 (2022.10.28)

### Updates

- The plugin is now applied only for the dev server (`serve`), never during `build`.

## 0.3.1 (2022.10.28)

### Updates

- The WebSocket server is reused across sessions instead of being recreated.

## 0.3.0 (2022.10.28)

### Updates

- Viteburner can now be used as a Vite plugin via `viteburnerPlugin()`.
- Fixed WebSocket client cleanup on reset and key handling after restarts.
- Fixed config loading, working-directory handling and plugin injection order.

## 0.2.6 (2022.10.28)

### Updates

- Fixed the merge of the `watch.location` config option.

## 0.2.5 (2022.10.27)

### Updates

- Absolute imports starting with `/src/...` are now supported.
- Warns when stdin is not a TTY, where interactive keys are unavailable.

## 0.2.4 (2022.10.26)

### Updates

- Exported public config and server types.
- Config resolution now uses `resolveConfig`.
- Fixed Vite cache invalidation after file changes, HMR updates, the `transform` default (now `false`) and CLI defaults.

## 0.2.3 (2022.10.25)

### Updates

- `dumpFiles` is now server-sensitive: dumps are written per server.
- Fixed `loadConfig` and the config type definitions.

## 0.2.2 (2022.10.24)

### Updates

- `fixImportPath` rewrites local imports to the filenames used inside the game, fixing `/root/path/file.js` output.
- Added docs for TypeScript setup and sync-only usage.

## 0.2.1 (2022.10.22)

### Updates

- Fixed: unhandled keys no longer trigger the tailing help message.
- Version bumps now build before publishing.

## 0.2.1-0 (2022.10.22)

### Updates

- Fixed the published `bin` entry so the `viteburner` command is installed.

## 0.2.0 (2022.10.22)

### Updates

- Added an interactive CLI with status output, help, manual full reload and keypress handling.
- Added remote file downloads, per-server file dumps, remote path autocomplete and selectable upload filters.
- Added RAM usage reporting, `defineConfig`, `ignoreSourcemap` and `EADDRINUSE` handling.
- Added local script discovery and enforced watch inclusion.
- Fixed upload filenames, repeated full uploads, console formatting and hint colors.

## 0.1.0 (2022.10.20)

### Updates

- Initial release: a Vite-powered daemon that watches local files, compiles TypeScript and syncs scripts to Bitburner through the Remote API WebSocket.
- Supports configuration through the `viteburner` key in `vite.config.*` or a standalone `viteburner.config.*` file.

