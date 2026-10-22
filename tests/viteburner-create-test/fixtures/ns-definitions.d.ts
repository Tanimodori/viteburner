/**
 * The definitions viteburner downloads from the game on the first run.
 *
 * The e2e copies this file into the generated project as `NetscriptDefinitions.d.ts` so `tsc` can
 * check the project without a running game. It is deliberately named differently here: the
 * repository-wide `.gitignore` ignores the real file.
 */
export interface NS {
  tprint(message: string): void;
}
