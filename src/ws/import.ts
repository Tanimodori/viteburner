import { parse as acornParse } from 'acorn';
import MagicString from 'magic-string';
import { forceStartingSlash, logger, WatchManager } from '..';

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

function getFilename(options: FixImportPathOptions, imports?: string) {
  const realImports = imports ?? options.filename;
  const importPath = options.manager.getUploadFilenamesByServer(realImports, options.server);
  if (!importPath) {
    // warn user if upload filename is not found on server
    const warnInfo = imports
      ? `Path "${imports}" imported by "${options.filename}" not found on server "${options.server}"`
      : `File "${imports}" not found on server "${options.server}"`;
    logger.warn(`import`, warnInfo);
    logger.warn(`import`, `This may be a problem when the script is running on the server.`);
    return realImports;
  } else {
    return importPath;
  }
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
  const magicString = new MagicString(options.content);
  const estree = parse(options.content);

  for (const statement of estree.body) {
    if (statement.type === 'ImportDeclaration') {
      const source = statement.source;
      const raw = source.raw as string;
      const value = source.value as string;
      // get the import path on the server
      const importPath = forceStartingSlash(getFilename(options, value));
      // get the relative path
      const quote = raw[0];
      magicString.overwrite(source.start, source.end, quote + importPath + quote);
    }
  }

  // TODO: return sourcemap
  return magicString.toString();
}
