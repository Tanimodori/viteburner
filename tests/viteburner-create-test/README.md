# viteburner-create-test

End-to-end suite for `create-viteburner`. The installed CLI is spawned as a real child process, so the test exercises the package as consumers receive it rather than importing its source.

## What it checks

1. The CLI scaffolds `my-project` from the built `template/`.
2. The child's `package.json` names the project and pins `viteburner` to `^<current version>`.
3. No copied file contains a `workspace:` reference.
4. `fixtures/ns-definitions.d.ts` is copied into the child as `NetscriptDefinitions.d.ts`, then `tsc --noEmit` checks the child with its own `tsconfig.json`. Dependencies resolve from this package's `node_modules` by walking up from the child.
5. `vite.loadConfigFromFile` loads the child's `vite.config.ts`.
6. `fixtures/tsconfig.check.json` type-checks `templates/viteburner-template` in place, with `@ns` pointing at the fixture.
7. A non-empty target is refused without `--force`; `--force` preserves unrelated files.
8. The default target is `viteburner-project`.
9. The CLI entry uses an LF shebang, so npm/pnpm can link it on POSIX.
10. `npm pack --dry-run` includes `bin/`, `LICENSE`, the generated `template/`, and `template/.gitignore`, and leaves the mirror README out.

## Running

The suite needs the built packages, because it spawns the installed CLI and loads its declarations:

```bash
rush build --to viteburner-create-test
cd tests/viteburner-create-test
node ../../common/scripts/install-run-rushx.js test
```

The fixtures under `fixtures/` are test-only. Nothing under `templates/` is modified.
