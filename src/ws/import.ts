import { parse as acornParse } from 'acorn';
import { WatchManager } from '..';

export interface FixImportPathOptions {
  filename: string;
  content: string;
  server: string;
  manager: WatchManager;
}

function parse(code: string) {
  return acornParse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  });
}

/**
 * Converts absolute path to relative path by the watch options.
 * Vite resolves import path to absolute path to source file.
 * We need to convert it back to relative so the bitburner will like it.
 *
 * Vite add a trailing slash to the path, we need to remove it before converting.
 * We also need to returns a sourcemap.
 */
export function fixImportPath(options: FixImportPathOptions) {
  const estree = parse(options.content);

  for (const statement of estree.body) {
    if (statement.type === 'ImportDeclaration') {
      const source = statement.source;
      const value = source.value as string;
      console.log(source);
    }
  }

  // TODO: return sourcemap
  return options.content;
}
