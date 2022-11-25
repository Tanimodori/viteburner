import { SourceMap } from 'rollup';
import fs from 'fs';
import path from 'path';

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

// from vite packages\vite\src\node\utils.ts
export const externalRE = /^(https?:)?\/\//;
export const isExternalUrl = (url: string): boolean => externalRE.test(url);
