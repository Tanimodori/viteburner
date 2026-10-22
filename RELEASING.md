# Releasing

Three packages are published: `viteburner`, `@viteburner/vite-plugin`, and `create-viteburner`. They share the `viteburner` lockstep version policy. `@viteburner/bb-ws-server` is internal and is bundled into the plugin.

Publishing is manual. CI runs checks only and never publishes or stores npm credentials. Run the commands below in a local checkout that is authenticated with npm.

## Before any release

```bash
rush install
rush check
rush check-release
rush rebuild
```

`rush check-release` validates the metadata that only fails at pack/publish time: `prepack`/`prepublishOnly`, the scoped package's public access, `create-viteburner`'s `files` allowlist (including `template/.gitignore`), and LF shebangs.

Rush's publish action does not run a build. `viteburner` and `@viteburner/vite-plugin` have `prepack` hooks as a second line of defense, but never skip `rush rebuild`: it builds the packages in dependency order and validates the cross-package declarations together.

Do not use `npm publish`. `npm pack` keeps `workspace:*` in `viteburner`'s dependencies; `rush publish` uses pnpm, which rewrites it to the lockstep version. The packages' `prepublishOnly` guard rejects npm and yarn publishers.

## Pre-release

The policy is currently `0.5.3` with `nextBump: patch`, so a plain bump would produce `0.5.4`. Use the override for the first beta (`0.6.0-beta.0`):

```bash
rush version --bump --version-policy viteburner \
  --override-bump preminor --override-prerelease-id beta
rush rebuild
git add -A
git commit -m "release: 0.6.0-beta.0"
rush publish --include-all --version-policy viteburner \
  --publish --tag next --set-access-level public
```

For a later beta from `0.6.0-beta.0`:

```bash
rush version --bump --version-policy viteburner \
  --override-bump prerelease --override-prerelease-id beta
```

A prerelease version is handled specially: `rush version --bump` updates the policy and package versions, but Rush deliberately leaves the change files in place and does not write a `0.6.0-beta.0` changelog entry. The entries are saved for the final release. Publishing therefore uses `--include-all`: the normal `--apply` publish path only publishes non-`none` changes and would publish nothing, and the change files are still there. `--tag next` keeps `latest` on the stable release.

The beta tarballs consequently have no beta changelog entry. `create-viteburner`'s `CHANGELOG.md` does not exist yet and is simply omitted from the pack; the final `0.6.0` release creates it.

Add `--target-branch <branch>` to `rush publish` if you also want Rush to push the git version tags; the release commit must already be on that branch.

Beta install commands:

```bash
npm create viteburner@next
npm i -D viteburner@next
npm i -D @viteburner/vite-plugin@next vite@^7
```

## Final release

The beta leaves the original change files in place. Bumping to the final `0.6.0` consumes them, writes the full `0.6.0` changelog, and deletes the change files. Run `rush change` only if you want an additional release note on top of the existing changes:

```bash
# optional
rush change
```

Then finalize (`0.6.0-beta.0` to `0.6.0`):

```bash
rush version --bump --version-policy viteburner
rush format-changelog
rush rebuild
git add -A
git commit -m "release: 0.6.0"
rush publish --include-all --version-policy viteburner \
  --publish --tag latest --set-access-level public
```

From a prerelease, `nextBump: patch` produces the final version (`0.6.0`). If the policy is not on a prerelease, use `--override-bump minor` instead.

## After publishing

1. Check the published dependency metadata:

   ```bash
   npm view viteburner@0.6.0-beta.0 dependencies --json
   ```

   The `@viteburner/vite-plugin` entry must be a concrete version, never `workspace:*`.

2. Test the public path from a temporary directory:

   ```bash
   npm create viteburner@next
   cd viteburner-project
   npm install
   npm run dev
   ```

   The generated project must contain `.gitignore` and the package must install.

3. Export the standalone template mirror:

   ```bash
   node packages/create-viteburner/scripts/export-template.mjs \
     --dest ../viteburner-template --prune
   ```

   Review the diff, commit, and push the mirror only after the npm release is live.

## CI

CI runs on pushes and pull requests to `main`: `rush check`, `rush check-release`, the full build, unit tests, and the E2E suites. It has no publish step and no registry credentials. Release from a commit that passed CI.
