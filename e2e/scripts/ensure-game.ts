import { ensureGame, PINNED_GAME } from '../helpers/ensure-game';

ensureGame(process.cwd())
  .then((dir) => {
    console.log(`Bitburner ${PINNED_GAME.version} (${PINNED_GAME.commit.slice(0, 8)}) ready at ${dir}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
