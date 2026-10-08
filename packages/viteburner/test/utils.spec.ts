import { describe, expect, it } from 'vitest';
import {
  defaultUploadLocation,
  fixStartingSlash,
  forceStartingSlash,
  getSourceMapString,
  isExternalUrl,
  isScriptFile,
  normalizeRequestId,
  removeStartingSlash,
  slash,
} from '@/utils/path';

/**
 * `getSourceMapString` emits an inline sourcemap comment. The literal below is safe to write
 * contiguously because vitest >= 0.34 bundles vite-node >= 0.34, which no longer strips
 * `sourceMappingURL` strings found in source text (vitest#2918, fixed by vite-node#3379).
 * Downgrading below that pair would corrupt this file while transforming it.
 */
describe('getSourceMapString', () => {
  const SOURCE_MAP_PREFIX = '//# sourceMappingURL=data:application/json;base64,';

  it('returns empty string when no map is given', () => {
    expect(getSourceMapString()).toBe('');
    expect(getSourceMapString(null)).toBe('');
  });

  it('produces a decodable inline sourcemap comment', () => {
    const map = { version: 3, sources: ['src/utils.ts'], mappings: 'AAAA' };
    const result = getSourceMapString(map as never);
    expect(result.startsWith(SOURCE_MAP_PREFIX)).toBe(true);
    const base64 = result.slice(SOURCE_MAP_PREFIX.length);
    expect(JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))).toEqual(map);
  });
});

// Expectations below were captured from vite-node 0.34.6's `utils` implementation.
describe('normalizeRequestId', () => {
  it('strips the base prefix', () => {
    expect(normalizeRequestId('/app/src/main.ts', '/app/')).toBe('/src/main.ts');
    expect(normalizeRequestId('/app/src/main.ts', '/app')).toBe('/src/main.ts');
  });

  it('only strips the base when it ends on a path segment boundary', () => {
    // `/application` must not lose the `app` prefix (upstream vite-node behavior).
    expect(normalizeRequestId('/application/x.ts', '/app')).toBe('/application/x.ts');
  });

  it('strips vite query params', () => {
    expect(normalizeRequestId('/src/main.ts?v=1234abcd')).toBe('/src/main.ts');
    expect(normalizeRequestId('/src/main.ts?t=1234&v=abcd')).toBe('/src/main.ts');
    expect(normalizeRequestId('/src/main.ts?import')).toBe('/src/main.ts');
  });

  it('unwraps virtual module ids', () => {
    expect(normalizeRequestId('/@id/__x00__virtual:foo')).toBe('\0virtual:foo');
    expect(normalizeRequestId('/@id/virtual:foo')).toBe('virtual:foo');
  });

  it('handles file: and browser-external ids', () => {
    expect(normalizeRequestId('file:/src/main.ts')).toBe('/src/main.ts');
    expect(normalizeRequestId('__vite-browser-external:fs')).toBe('fs');
  });

  it.runIf(process.platform === 'win32')('normalizes the drive letter case (Windows)', () => {
    const drive = process.cwd()[0];
    const opposite = drive === drive.toUpperCase() ? drive.toLowerCase() : drive.toUpperCase();
    // The leading `/@fs/` is consumed by the drive normalization replacement.
    expect(normalizeRequestId(`/@fs/${opposite}:/project/main.ts`)).toBe(`${drive}:/project/main.ts`);
    expect(normalizeRequestId(`/@fs/${drive}:/project/main.ts`)).toBe(`/@fs/${drive}:/project/main.ts`);
  });
});

describe('slash', () => {
  it('converts backslashes to forward slashes', () => {
    expect(slash('C:\\project\\src\\file.ts')).toBe('C:/project/src/file.ts');
    expect(slash('src/unchanged.ts')).toBe('src/unchanged.ts');
  });
});

describe('path helpers', () => {
  it('forceStartingSlash', () => {
    expect(forceStartingSlash('file.ts')).toBe('/file.ts');
    expect(forceStartingSlash('/file.ts')).toBe('/file.ts');
  });

  it('fixStartingSlash', () => {
    expect(fixStartingSlash('file.ts')).toBe('file.ts');
    expect(fixStartingSlash('/file.ts')).toBe('file.ts');
    expect(fixStartingSlash('src/file.ts')).toBe('/src/file.ts');
    expect(fixStartingSlash('/src/file.ts')).toBe('/src/file.ts');
  });

  it('removeStartingSlash', () => {
    expect(removeStartingSlash('/file.ts')).toBe('file.ts');
    expect(removeStartingSlash('file.ts')).toBe('file.ts');
  });

  it('defaultUploadLocation', () => {
    expect(defaultUploadLocation('src/deep/file.ts')).toBe('deep/file.js');
    expect(defaultUploadLocation('src/template.ts')).toBe('template.js');
  });

  it('isScriptFile', () => {
    expect(isScriptFile('foo.js')).toBe(true);
    expect(isScriptFile('foo.script')).toBe(true);
    expect(isScriptFile('foo.ts')).toBe(false);
  });

  it('isExternalUrl', () => {
    expect(isExternalUrl('https://example.com/lib.js')).toBe(true);
    expect(isExternalUrl('//example.com/lib.js')).toBe(true);
    expect(isExternalUrl('src/lib.ts')).toBe(false);
  });
});
