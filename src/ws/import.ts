import { parse as acornParse } from 'acorn';
import MagicString from 'magic-string';
import { dirname, relative } from 'path';
import { logger, WatchManager } from '..';

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
    const warnInfo = imports
      ? `Path "${imports}" imported by "${options.filename}" not found on server "${options.server}"`
      : `File "${imports}" not found on server "${options.server}"`;
    logger.warn(`import`, warnInfo);
    logger.warn(`import`, `This may be a problem when the script is running on the server.`);
    return {
      filename: realImports,
      server: options.server,
    };
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
  const rootPath = getFilename(options);

  for (const statement of estree.body) {
    if (statement.type === 'ImportDeclaration') {
      const source = statement.source;
      const value = source.value as string;
      console.log(source);
      // get the import path on the server
      const importPath = getFilename(options, value);
      // get the relative path
      let relativePath = relative(dirname(rootPath.filename), importPath.filename);
      if (!relativePath.startsWith('..')) {
        relativePath = './' + relativePath;
      }
      console.log(relativePath);
    }
  }

  // TODO: return sourcemap
  return options.content;
}
