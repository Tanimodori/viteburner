import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

/**
 * Bitburner web build pinned for deterministic E2E runs.
 *
 * The tarball is the content of https://github.com/bitburner-official/bitburner-official.github.io at the commit
 * below (the deployed v3.0.1 release build). It is downloaded once, verified against the SHA-256 hash and cached
 * under `e2e/.cache/` (gitignored).
 *
 * To upgrade the pinned build: fetch the commit SHA of bitburner-official.github.io, download
 * `https://codeload.github.com/bitburner-official/bitburner-official.github.io/tar.gz/<commit>`, update
 * `commit`/`version` here and set `tarballSha256` to the new hash.
 */
export const PINNED_GAME = {
  repo: 'bitburner-official/bitburner-official.github.io',
  commit: '1540b4d555508cef735e1b8f6efda2e6cb014af7',
  version: 'v3.0.1',
  tarballSha256: '2e301387aed87e54b97cea614f2207b98a22285357b5a4b10f7c7b129c4da0fd',
} as const;

export function getCacheRoot(repoRoot: string) {
  return path.join(repoRoot, 'e2e', '.cache');
}

export function getGameDir(repoRoot: string) {
  return path.join(getCacheRoot(repoRoot), 'bitburner', PINNED_GAME.commit.slice(0, 8));
}

function sha256File(file: string) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function download(url: string, dest: string, redirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) {
            reject(new Error(`too many redirects while downloading ${url}`));
            return;
          }
          download(new URL(res.headers.location, url).href, dest, redirects - 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`failed to download ${url}: HTTP ${status}`));
          return;
        }
        fs.promises
          .mkdir(path.dirname(dest), { recursive: true })
          .then(() => {
            const file = fs.createWriteStream(dest);
            file.on('error', reject);
            file.on('finish', () => resolve());
            res.pipe(file);
          })
          .catch(reject);
      })
      .on('error', reject);
  });
}

function extract(tarball: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Pass a path relative to the destination: GNU tar on Windows treats "C:\..." as a remote
    // "host:path" reference and would try to connect over the network.
    const relative = path.relative(dest, tarball).split(path.sep).join('/');
    const child = spawn('tar', ['-xzf', relative, '--strip-components=1'], { cwd: dest, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code}`));
      }
    });
  });
}

/**
 * Ensure the pinned Bitburner web build is available locally.
 *
 * Set `E2E_GAME_DIR` to serve an existing build instead of downloading (it must contain `index.html`).
 * Returns the directory that contains `index.html`.
 */
export async function ensureGame(repoRoot: string): Promise<string> {
  const override = process.env.E2E_GAME_DIR;
  if (override) {
    const dir = path.resolve(override);
    if (!fs.existsSync(path.join(dir, 'index.html'))) {
      throw new Error(`E2E_GAME_DIR does not contain index.html: ${dir}`);
    }
    return dir;
  }

  const gameDir = getGameDir(repoRoot);
  const marker = path.join(gameDir, '.sha256');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim() === PINNED_GAME.tarballSha256) {
    if (fs.existsSync(path.join(gameDir, 'index.html'))) {
      return gameDir;
    }
  }

  const tarball = path.join(getCacheRoot(repoRoot), `game-${PINNED_GAME.commit.slice(0, 8)}.tar.gz`);
  if (!fs.existsSync(tarball) || sha256File(tarball) !== PINNED_GAME.tarballSha256) {
    const url = `https://codeload.github.com/${PINNED_GAME.repo}/tar.gz/${PINNED_GAME.commit}`;
    await download(url, tarball);
  }
  const actual = sha256File(tarball);
  if (actual !== PINNED_GAME.tarballSha256) {
    throw new Error(
      `SHA-256 mismatch for ${tarball}:\n  expected ${PINNED_GAME.tarballSha256}\n  actual   ${actual}\n` +
        'Delete the file and retry, or check whether the pinned commit was moved.',
    );
  }

  // Extract into a partial directory, then swap it in, so an interrupted run never leaves a broken cache behind.
  const partial = gameDir + '.partial';
  await fs.promises.rm(partial, { recursive: true, force: true });
  await fs.promises.mkdir(partial, { recursive: true });
  await extract(tarball, partial);
  if (!fs.existsSync(path.join(partial, 'index.html'))) {
    throw new Error(`extraction did not produce index.html in ${partial}`);
  }
  await fs.promises.rm(gameDir, { recursive: true, force: true });
  await fs.promises.rename(partial, gameDir);
  await fs.promises.writeFile(marker, PINNED_GAME.tarballSha256);
  return gameDir;
}
