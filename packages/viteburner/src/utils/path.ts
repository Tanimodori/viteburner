import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { SourceMap } from 'rollup';

export function getSourceMapString(map?: SourceMap | null): string {
  if (!map) return '';
  const mapDataString = JSON.stringify(map);
  return `//# sourceMappingURL=data:application/json;base64,${Buffer.from(mapDataString).toString('base64')}`;
}

export async function writeFile(file: string, content: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  return fs.promises.writeFile(file, content, {
    flag: 'w',
    encoding: 'utf8',
  });
}

export function isScriptFile(filename: string) {
  return filename.endsWith('.js') || filename.endsWith('.script');
}

/** Enforce starting slash */
export const forceStartingSlash = (s: string) => {
  return s.startsWith('/') ? s : '/' + s;
};

/** Enforce starting slash if file is not in root dir */
export const fixStartingSlash = (s: string) => {
  const index = s.lastIndexOf('/');
  if (index === 0) {
    // if file is in root dir with starting slash, remove it
    return s.substring(1);
  } else if (index !== -1) {
    // if file is not in root dir, add starting slash
    return forceStartingSlash(s);
  } else {
    // if file is in root dir without starting slash, keep it as-is
    return s;
  }
};

/** Remove starting slash on download */
export const removeStartingSlash = (s: string) => {
  return s.startsWith('/') ? s.substring(1) : s;
};

export const defaultUploadLocation = (file: string) => {
  return file.replace(/^src\//, '').replace(/\.ts$/, '.js');
};

export const defaultDownloadLocation = (file: string) => {
  return 'src/' + file;
};

/** Render an upload as a pair of lines: `styled` for the terminal, `raw` for a log or a test. */
export const formatUpload = (from: string, to: string, serverName: string) => {
  to = forceStartingSlash(to);
  const dest = `@${serverName}:${to}`;
  return {
    styled: `${pc.dim(from)} ${pc.reset('->')} ${pc.dim(dest)}`,
    raw: `${from} -> ${dest}`,
  };
};

/** Render a download as a pair of lines: `styled` for the terminal, `raw` for a log or a test. */
export const formatDownload = (from: string, to: string, serverName: string) => {
  to = removeStartingSlash(to);
  const src = `@${serverName}:/${from}`;
  return {
    styled: `${pc.dim(src)} ${pc.reset('->')} ${pc.dim(to)}`,
    raw: `${src} -> ${to}`,
  };
};

// from vite packages\vite\src\node\utils.ts
export const externalRE = /^(https?:)?\/\//;
export const isExternalUrl = (url: string): boolean => externalRE.test(url);

// Ported from vite-node 0.34.6's `utils` (MIT, https://github.com/vitest-dev/vitest, packages/vite-node/src/utils.ts).
// Inlined so viteburner does not depend on an internal subpath of vite-node at runtime.
export const slash = (str: string) => str.replace(/\\/g, '/');

const isWindows = process.platform === 'win32';
// Drive letter of the current working directory; used to normalize ids whose drive casing differs
// from `process.cwd()` (Windows only). `null` elsewhere so the checks are skipped entirely.
const drive = isWindows ? process.cwd()[0] : null;
const driveOpposite = drive ? (drive === drive.toUpperCase() ? drive.toLowerCase() : drive.toUpperCase()) : null;
const driveRegexp = drive ? new RegExp(`(?:^|/@fs/)${drive}(:[\\/])`) : null;
const driveOppositeRegexp = driveOpposite ? new RegExp(`(?:^|/@fs/)${driveOpposite}(:[\\/])`) : null;

const withTrailingSlash = (p: string) => (p.endsWith('/') ? p : `${p}/`);

export function normalizeRequestId(id: string, base?: string): string {
  if (base && id.startsWith(withTrailingSlash(base))) {
    id = `/${id.slice(base.length)}`;
  }
  if (driveRegexp && !driveRegexp.test(id) && driveOppositeRegexp?.test(id)) {
    id = id.replace(driveOppositeRegexp, `${drive}$1`);
  }
  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^file:/, '')
    .replace(/^\/+/, '/')
    .replace(/\?v=\w+/, '?')
    .replace(/&v=\w+/, '')
    .replace(/\?t=\w+/, '?')
    .replace(/&t=\w+/, '')
    .replace(/\?import/, '?')
    .replace(/&import/, '')
    .replace(/\?&/, '?')
    .replace(/\?+$/, '');
}
