import { SourceMap } from 'rollup';

export function getSourceMapString(map?: SourceMap | null): string {
  if (!map) return '';
  const mapDataString = JSON.stringify(map);
  return `//# sourceMappingURL=data:application/json;base64,${Buffer.from(mapDataString).toString('base64')}`;
}
