import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PINNED_GAME, ensureGame } from './helpers/ensure-game';

/**
 * Runs once before the workers start for the local leg (see `vitest.config.ts`); downloads and caches
 * the pinned game build so a spec failure never waits on the network.
 */
export default async function globalSetup() {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gameDir = await ensureGame(packageRoot);
  console.log(`[e2e] Bitburner ${PINNED_GAME.version} (${PINNED_GAME.commit.slice(0, 8)}) ready at ${gameDir}`);
}
