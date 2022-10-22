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
