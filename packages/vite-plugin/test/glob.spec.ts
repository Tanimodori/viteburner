import { describe, expect, it } from 'vitest';
import { importGlobPatterns, matchesImportGlob } from '../src/services/sync/glob';

describe('importGlobPatterns', () => {
  it('reads a literal pattern', () => {
    expect(importGlobPatterns(`const modules = import.meta.glob('./modules/*.ts');`)).toEqual(['./modules/*.ts']);
  });

  it('reads patterns after type arguments', () => {
    expect(
      importGlobPatterns(`const modules = import.meta.glob<MyModule>('./modules/*.ts', { eager: true });`),
    ).toEqual(['./modules/*.ts']);
  });

  it('reads arrays and negations', () => {
    expect(importGlobPatterns(`const modules = import.meta.glob(['./*.ts', '!./skip.ts']);`)).toEqual([
      './*.ts',
      '!./skip.ts',
    ]);
  });

  it('reads template literal patterns without interpolation', () => {
    expect(importGlobPatterns('const modules = import.meta.glob(`./modules/*.ts`);')).toEqual(['./modules/*.ts']);
  });

  it('reads every call', () => {
    const code = `const a = import.meta.glob('./a/*.ts'); const b = import.meta.glob('./b/*.ts');`;
    expect(importGlobPatterns(code)).toEqual(['./a/*.ts', './b/*.ts']);
  });

  it('ignores the token in comments and strings', () => {
    const code = [
      `// import.meta.glob('./a/*.ts')`,
      `const text = "import.meta.glob('./b/*.ts')";`,
      `/* import.meta.glob('./c/*.ts') */`,
    ].join('\n');
    expect(importGlobPatterns(code)).toEqual([]);
  });

  it('ignores dynamic template literals', () => {
    expect(importGlobPatterns('const modules = import.meta.glob(`./${name}/*.ts`);')).toEqual([]);
  });
});

describe('matchesImportGlob', () => {
  it('resolves patterns relative to the importer', () => {
    expect(matchesImportGlob('src/importGlob/index.ts', ['./modules/*.ts'], 'src/importGlob/modules/foo.ts')).toBe(
      true,
    );
    expect(matchesImportGlob('src/importGlob/index.ts', ['./modules/*.ts'], 'src/importGlob/other/foo.ts')).toBe(false);
  });

  it('handles root-relative patterns', () => {
    expect(matchesImportGlob('src/index.ts', ['/src/*.ts'], 'src/foo.ts')).toBe(true);
  });

  it('honors negation', () => {
    expect(matchesImportGlob('src/index.ts', ['./*.ts', '!./skip.ts'], 'src/skip.ts')).toBe(false);
  });

  it('does not match a file outside the importer directory', () => {
    expect(matchesImportGlob('src/importGlob/index.ts', ['./modules/*.ts'], 'src/modules/foo.ts')).toBe(false);
  });
});
