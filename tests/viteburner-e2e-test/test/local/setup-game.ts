import { PINNED_GAME, ensureGame } from './ensure-game';

/** Manual entry point: `rushx setup:game` downloads and caches the pinned build without running a spec. */
ensureGame()
  .then((dir) => {
    console.log(`Bitburner ${PINNED_GAME.version} (${PINNED_GAME.commit.slice(0, 8)}) ready at ${dir}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
