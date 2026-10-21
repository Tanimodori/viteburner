import { posix } from 'path';
import { parse } from 'acorn';
import micromatch from 'micromatch';
import { transformWithEsbuild } from 'vite';

// Vite's esbuild step runs before its import-glob plugin, so for the extensions it transforms the
// tokens, comments and type arguments have already been normalized. This gate allows that trivia so
// those calls are not missed; the per-call check below then matches Vite's own importGlobRE against
// the code Vite actually sees.
const TRIVIA = String.raw`(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*`;
const GLOB_CALL = new RegExp(`\\bimport${TRIVIA}\\.${TRIVIA}meta${TRIVIA}\\.${TRIVIA}glob`);
const VITE_GLOB_CALL = /\bimport\.meta\.glob(?:<\w+>)?\s*\(/;

// The AST is walked generically, so the node shape is intentionally open.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstNode = { type: string; [key: string]: any };

/**
 * The patterns passed to `import.meta.glob()` in a module.
 *
 * Vite expands these calls during transform, so the patterns are gone from the transformed code.
 * Reading the original TypeScript with acorn would fail on type syntax, and Vite no longer exposes
 * its own glob map, so the source is first stripped with the esbuild transform Vite already ships
 * and then parsed. Vite itself only accepts literal patterns, so a static AST walk is sufficient.
 */
export async function importGlobPatterns(code: string, filename: string): Promise<string[]> {
  if (!GLOB_CALL.test(code)) {
    return [];
  }

  // Parse the same code Vite's import-glob plugin sees: its esbuild step transforms TypeScript and
  // JSX, and leaves plain JavaScript untouched.
  let js = code;
  if (isTransformedByVite(filename)) {
    try {
      js = (await transformWithEsbuild(code, filename, { loader: loaderFor(filename) })).code;
    } catch {
      return [];
    }
  }

  let ast: AstNode;
  try {
    ast = parse(js, { ecmaVersion: 'latest', sourceType: 'module' }) as unknown as AstNode;
  } catch {
    return [];
  }

  const patterns: string[] = [];
  walk(ast, (node) => {
    patterns.push(...globCallPatterns(node, js));
  });
  return patterns;
}

/**
 * Whether a root-relative file matches one importer's `import.meta.glob` patterns.
 *
 * Patterns are relative to the importing module (or root-relative when they start with `/`), which
 * is the same resolution Vite applies when it expands the call.
 */
export function matchesImportGlob(importer: string, patterns: string[], file: string): boolean {
  const importerDir = posix.dirname(importer);
  const resolved = patterns.map((pattern) => {
    const negated = pattern.startsWith('!');
    const body = negated ? pattern.slice(1) : pattern;
    const absolute = body.startsWith('/') ? body.slice(1) : posix.join(importerDir, body);
    return negated ? `!${absolute}` : absolute;
  });
  return micromatch([file], resolved).length > 0;
}

/** Vite's default `vite:esbuild` filter; plain `.js` is deliberately excluded there. */
function isTransformedByVite(filename: string) {
  return /\.(m?ts|[jt]sx)$/.test(filename);
}

function loaderFor(filename: string): 'ts' | 'tsx' | 'jsx' | 'js' {
  const ext = posix.extname(filename).toLowerCase();
  if (ext === '.tsx') {
    return 'tsx';
  }
  if (ext === '.jsx') {
    return 'jsx';
  }
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
    return 'ts';
  }
  return 'js';
}

function walk(node: unknown, visit: (node: AstNode) => void) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  if (typeof record.type === 'string') {
    visit(record as unknown as AstNode);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') {
      continue;
    }
    walk(value, visit);
  }
}

function globCallPatterns(node: AstNode, code: string): string[] {
  if (node.type !== 'CallExpression') {
    return [];
  }
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression' || callee.computed) {
    return [];
  }
  if (callee.property?.type !== 'Identifier' || callee.property.name !== 'glob') {
    return [];
  }
  const object = callee.object;
  if (object?.type !== 'MetaProperty' || object.meta?.name !== 'import' || object.property?.name !== 'meta') {
    return [];
  }
  // Match Vite's importGlobRE against the code it sees. For a transformed file esbuild has already
  // removed comments/whitespace; for plain JavaScript this rejects shapes Vite would not expand.
  let paren = callee.end;
  while (paren < code.length && /\s/.test(code[paren])) {
    paren++;
  }
  if (code[paren] !== '(' || !VITE_GLOB_CALL.test(code.slice(node.start, paren + 1))) {
    return [];
  }
  if (!Array.isArray(node.arguments) || node.arguments.length < 1 || node.arguments.length > 2) {
    return [];
  }
  const options = node.arguments[1];
  if (options && options.type !== 'ObjectExpression') {
    return [];
  }
  return staticPatterns(node.arguments[0]);
}

function staticPatterns(node: AstNode | undefined): string[] {
  if (!node) {
    return [];
  }
  if (node.type === 'ArrayExpression' && Array.isArray(node.elements)) {
    const patterns: string[] = [];
    for (const element of node.elements) {
      // Vite skips array holes, but rejects any non-literal element.
      if (!element) {
        continue;
      }
      const pattern = staticPattern(element);
      if (pattern === undefined) {
        return [];
      }
      patterns.push(pattern);
    }
    return patterns;
  }
  const pattern = staticPattern(node);
  return pattern === undefined ? [] : [pattern];
}

function staticPattern(node: AstNode | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    // Vite uses the raw text, which is what matters for glob escapes.
    return node.quasis[0]?.value.raw;
  }
  return undefined;
}
