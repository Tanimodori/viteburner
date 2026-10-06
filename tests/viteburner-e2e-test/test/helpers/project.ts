import fs from 'node:fs';
import path from 'node:path';

export interface E2eProject {
  /** Absolute path of the temp project root (contains vite.config.ts and src/). */
  root: string;
  /** Absolute path of the source directory inside the project. */
  srcDir: string;
  /** Create (or overwrite) a source file with the given content. */
  writeSource(relative: string, content: string): void;
  /** Remove a source file if present. */
  removeSource(relative: string): void;
}

/**
 * Copy `playground/` into the given destination so E2E runs never touch the actual fixture
 * directory (watch events + server-side uploads write into `dist/`).
 *
 * The playground stays in the `viteburner` package; this suite only ever reads from it.
 */
export function createProject(playgroundDir: string, destDir: string): E2eProject {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(playgroundDir)) {
    if (entry === 'dist') {
      continue;
    }
    fs.cpSync(path.join(playgroundDir, entry), path.join(destDir, entry), { recursive: true });
  }
  const srcDir = path.join(destDir, 'src');
  return {
    root: destDir,
    srcDir,
    writeSource(relative: string, content: string) {
      const file = path.join(srcDir, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, 'utf8');
    },
    removeSource(relative: string) {
      fs.rmSync(path.join(srcDir, relative), { force: true });
    },
  };
}
