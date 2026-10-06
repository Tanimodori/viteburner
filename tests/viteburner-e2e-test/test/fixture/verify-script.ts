/** The marker the live-added script prints, so the terminal check can look for it verbatim. */
export const VERIFY_MARKER = 'E2E_VERIFY_OK';

/**
 * Source of the file written into the fixture project during the run — the "new file" half of the
 * live-sync step. It is not part of the manifest (it does not exist at start-up); it is created,
 * uploaded, run, then removed to prove add and unlink both reach the game.
 */
export const VERIFY_SCRIPT = [
  "import { NS } from '@ns';",
  '',
  'export async function main(ns: NS) {',
  `  ns.tprint('${VERIFY_MARKER}');`,
  '}',
  '',
].join('\n');

/** The source path the script is written to, and the upload path it must appear at on the game. */
export const VERIFY_SOURCE = 'e2e-verify.ts';
export const VERIFY_UPLOAD = 'e2e-verify.js';
