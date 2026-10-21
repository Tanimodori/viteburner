import { describe, expect, it } from 'vitest';
import { importGlobPatterns, matchesImportGlob } from '../src/services/sync/glob';

describe('importGlobPatterns', () => {
  it('reads a literal pattern', async () => {
    expect(await importGlobPatterns(`const modules = import.meta.glob('./modules/*.ts');`, 'index.ts')).toEqual([
      './modules/*.ts',
    ]);
  });

  it('strips TypeScript before reading the call', async () => {
    const code = [
      `interface MyModule { default: () => void }`,
      `const modules: Record<string, MyModule> = import.meta.glob<MyModule>('./modules/*.ts', { eager: true });`,
    ].join('\n');
    expect(await importGlobPatterns(code, 'index.ts')).toEqual(['./modules/*.ts']);
  });

  it('reads arrays and negations', async () => {
    expect(await importGlobPatterns(`const modules = import.meta.glob(['./*.ts', '!./skip.ts']);`, 'index.ts')).toEqual(
      ['./*.ts', '!./skip.ts'],
    );
  });

  it('reads template literal patterns without interpolation', async () => {
    expect(await importGlobPatterns('const modules = import.meta.glob(`./modules/*.ts`);', 'index.ts')).toEqual([
      './modules/*.ts',
    ]);
  });

  it('reads every call', async () => {
    const code = `const a = import.meta.glob('./a/*.ts'); const b = import.meta.glob('./b/*.ts');`;
    expect(await importGlobPatterns(code, 'index.ts')).toEqual(['./a/*.ts', './b/*.ts']);
  });

  it('ignores the token in comments and strings', async () => {
    const code = [
      `// import.meta.glob('./a/*.ts')`,
      `const text = "import.meta.glob('./b/*.ts')";`,
      `/* import.meta.glob('./c/*.ts') */`,
    ].join('\n');
    expect(await importGlobPatterns(code, 'index.ts')).toEqual([]);
  });

  it('ignores dynamic template literals', async () => {
    expect(await importGlobPatterns('const modules = import.meta.glob(`./${name}/*.ts`);', 'index.ts')).toEqual([]);
  });

  it('ignores an array with a non-literal element', async () => {
    expect(await importGlobPatterns(`const modules = import.meta.glob(['./a.ts', pattern]);`, 'index.ts')).toEqual([]);
  });

  it('expands shapes Vite normalizes through its TypeScript transform', async () => {
    const normalized = [
      `import . meta . glob('./x.ts')`,
      `import/*x*/.meta.glob('./x.ts')`,
      `import.meta.glob/*x*/('./x.ts')`,
      `import.meta.glob<Foo<Bar>>('./x.ts')`,
    ];
    for (const call of normalized) {
      expect(await importGlobPatterns(`const modules = ${call};`, 'index.ts'), call).toEqual(['./x.ts']);
    }
  });

  it('ignores shapes Vite does not expand in plain JavaScript', async () => {
    const unexpanded = [
      `import . meta . glob('./x.ts')`,
      `import/*x*/.meta.glob('./x.ts')`,
      `import.meta.glob/*x*/('./x.ts')`,
      `import.meta.glob<Foo<Bar>>('./x.ts')`,
    ];
    for (const call of unexpanded) {
      expect(await importGlobPatterns(`const modules = ${call};`, 'index.js'), call).toEqual([]);
    }
  });

  it('uses the template text Vite sees after its TypeScript transform', async () => {
    expect(await importGlobPatterns('const modules = import.meta.glob(`./\\*.ts`);', 'index.ts')).toEqual(['./*.ts']);
  });

  it('keeps the raw template text in plain JavaScript', async () => {
    expect(await importGlobPatterns('const modules = import.meta.glob(`./\\*.ts`);', 'index.js')).toEqual(['./\\*.ts']);
  });

  it('uses the js loader for a JavaScript file', async () => {
    expect(await importGlobPatterns(`const modules = import.meta.glob('./*.js');`, 'index.js')).toEqual(['./*.js']);
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
