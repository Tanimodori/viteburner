import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PINNED_GAME, ensureGame } from '../helpers/ensure-game';

/** Manual entry point: `rushx setup:game` downloads and caches the pinned build without running a spec. */
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

ensureGame(packageRoot)
  .then((dir) => {
    console.log(`Bitburner ${PINNED_GAME.version} (${PINNED_GAME.commit.slice(0, 8)}) ready at ${dir}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
