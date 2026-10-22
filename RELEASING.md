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
rush format-changelog
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

Because the policy is lockstep and `nextBump` is set, `rush version --bump` consumes the change files, writes the changelogs, and deletes the change files. That is why publishing uses `--include-all`: a later `rush publish --apply --publish` would have no change files left to publish. `--tag next` keeps `latest` on the stable release.

Add `--target-branch <branch>` to `rush publish` if you also want Rush to push the git version tags; the release commit must already be on that branch.

Beta install commands:

```bash
npm create viteburner@next
npm i -D viteburner@next
npm i -D @viteburner/vite-plugin@next vite@^7
```

## Final release

Add a change file for the final changelog entry, because the beta already consumed the original change files:

```bash
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
