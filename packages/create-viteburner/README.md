# create-viteburner

Scaffold a [viteburner](https://github.com/Tanimodori/viteburner) project.

## Usage

```bash
npm create viteburner@latest
npm create viteburner@latest my-project
pnpm create viteburner my-project
```

The positional argument is the target directory; it defaults to `viteburner-project`. The CLI does not prompt and does not install dependencies. It copies the template, sets the package name, and prints the install and dev commands.

```text
Usage: create-viteburner [options] [dir]

Options:
  -h, --help        Show this help.
  -v, --version     Show the create-viteburner version.
      --force       Write into a non-empty directory.
      --no-install  Do not install dependencies (the default).
```

`--force` overwrites files that the template provides, but leaves unrelated files in the target directory alone. `--no-install` is accepted for compatibility with `create-*` conventions; this CLI never installs dependencies.

## Template and version sync

The template source is `templates/viteburner-template/` in this repository. It is a real Rush project, so its `"viteburner": "workspace:*"` dependency resolves to the local package during development.

The build generates `template/` from that source:

```bash
npm run build
```

`build` runs `vite build` and then `scripts/build-template.mjs`. The exporter:

- replaces every `workspace:*` with `^<packages/viteburner/package.json version>`;
- turns the template's no-op Rush build script into `tsc --noEmit`;
- drops development-only files (`README.mirror.md`, lockfiles, a downloaded `NetscriptDefinitions.d.ts`);
- fails if an unknown workspace dependency or a leftover `workspace:` reference is found.

`template/` is generated and gitignored. `prepack` runs the same build, so publishing the package always bundles the template that matches the version being published.

`create-viteburner` is part of the `viteburner` lockstep version policy: `create-viteburner@0.6.0` scaffolds a project that pins `viteburner@^0.6.0`.

## Standalone template repository

The generated version without the create scaffolding is also mirrored to [`Tanimodori/viteburner-template`](https://github.com/Tanimodori/viteburner-template). Export it from the repository root after a release:

```bash
rush build --to create-viteburner
node packages/create-viteburner/scripts/export-template.mjs \
  --dest ../viteburner-template --prune
```

`--prune` removes everything in the destination except `.git` (and any `--keep` paths) before writing, so the mirror does not retain files the template no longer ships. Use `--check` to compare a checkout with a fresh export without writing; it exits non-zero when the mirror is behind. The script never commits or pushes.
