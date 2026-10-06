import { PINNED_GAME, ensureGame } from './ensure-game';

/**
 * Runs once before the workers start, but only in the offline leg (`vitest.config.ts` attaches it on
 * the same `mode === 'live'` condition as `mode.ts`). Downloads and caches the pinned build so a spec
 * failure never waits on the network, and so the offline and online legs can share one spec file.
 */
export default async function globalSetup() {
  const gameDir = await ensureGame();
  console.log(`[e2e] Bitburner ${PINNED_GAME.version} (${PINNED_GAME.commit.slice(0, 8)}) ready at ${gameDir}`);
}
