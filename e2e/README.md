# viteburner E2E tests

End-to-end tests that exercise the real sync pipeline: a real Bitburner build in a real browser connects to the real viteburner CLI through the game's Remote API, and the test verifies that uploaded scripts appear in the game and can be executed by the game engine.

## What is covered

`e2e/specs/local.spec.ts` (default project `local`):

1. Loads the pinned Bitburner build in Chromium and reaches the terminal.
2. Opens `Options > Remote API`, points it at the viteburner CLI and clicks Connect.
3. Waits for the CLI to flush its initial sync and verifies `template.js` shows up in the in-game terminal (`ls`).
4. Writes a new source file, waits for the watch/transform/upload cycle, and verifies the file is present in the game.
5. Reads the synced file back in the game (`cat` dialog contains the marker) — proves the game can read what viteburner uploaded.
6. Runs the script (`run e2e-verify.js`) and verifies the marker appears in the terminal output — proves the transformed code executes without runtime errors.

`e2e/specs/live.spec.ts` (opt-in project `live`) runs the same flow against <https://bitburner-official.github.io/>. It can drift when the game is updated upstream, so it is not part of the default test command.

## Prerequisites

- Node.js and npm
- First-time setup downloads Chromium and the pinned Bitburner web build (about 150 MB + 33 MB):

```bash
npm run e2e:setup
```

The game build is fetched from the `bitburner-official.github.io` repository at a pinned commit, verified against a SHA-256 hash and cached in `e2e/.cache/` (gitignored).

## Running

```bash
# Build + run the deterministic local E2E (recommended)
npm run test:e2e

# Opt-in smoke test against the live game site
npm run test:e2e:live

# Interactive UI mode
npm run test:e2e:ui
```

`test:e2e` builds the package first, because the CLI under test is `bin/viteburner.js` which loads `dist/` — i.e. the same artifact that gets published to npm.

## How it works

- A minimal static server (`e2e/helpers/static-server.ts`) serves the cached game build over `http://127.0.0.1:<random port>` so the game runs from a trustworthy origin with no LNA issues.
- An isolated copy of `playground/` is created under `e2e/.tmp/project/` for every run, so test runs never modify the fixture sources.
- The real CLI is spawned as `node bin/viteburner.js --cwd <tmp project> --port <random free port>` and its (ANSI-stripped) output is used for synchronization assertions.
- Chromium is launched with `--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets` so the page can reach `ws://localhost:<port>` headlessly; the test also grants the `local-network-access` permission where supported.

## Troubleshooting

- `viteburner CLI exited ...` — the CLI log tail is printed and attached to the test result. A common cause is a stale `dist/`; re-run `npm run test:e2e` (it runs `npm run build` first).
- Game fails to load — check that `e2e/.cache/` contains the pinned build (`npm run e2e:setup`), and that no other process occupies the ports (both game server and WebSocket ports are picked randomly per run).
- Set `E2E_GAME_DIR=/path/to/build` to serve an existing Bitburner build instead of the pinned download.
- Set `E2E_KEEP=1` to keep `e2e/.tmp/project/` after a run for manual inspection (the directory is overwritten on the next run either way).
