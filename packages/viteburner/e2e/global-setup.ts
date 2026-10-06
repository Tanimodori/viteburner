import path from 'node:path';
import { ensureGame, PINNED_GAME } from './helpers/ensure-game';

/** Runs once before the Playwright workers start; downloads/caches the pinned game build. */
export default async function globalSetup() {
  const packageRoot = path.resolve(__dirname, '..');
  const gameDir = await ensureGame(packageRoot);
  console.log(`[e2e] Bitburner ${PINNED_GAME.version} (${PINNED_GAME.commit.slice(0, 8)}) ready at ${gameDir}`);
}
