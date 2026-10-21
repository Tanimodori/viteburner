import { posix } from 'path';
import micromatch from 'micromatch';

const GLOB_TOKEN = 'import.meta.glob';

/**
 * The patterns passed to `import.meta.glob()` in a module.
 *
 * Vite expands these calls during transform, so the patterns are gone from the transformed code.
 * They are read from the source with a small scanner rather than acorn because the source is
 * TypeScript, and acorn cannot parse the type arguments Vite allows on `glob<T>(...)`.
 */
export function importGlobPatterns(code: string): string[] {
  const patterns: string[] = [];
  let i = 0;
  while (i < code.length) {
    const char = code[i];
    if (char === '/' && (code[i + 1] === '/' || code[i + 1] === '*')) {
      i = skipComment(code, i);
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      i = skipString(code, i);
      continue;
    }
    if (
      code.startsWith(GLOB_TOKEN, i) &&
      !isIdentifierPart(code[i - 1]) &&
      !isIdentifierPart(code[i + GLOB_TOKEN.length])
    ) {
      let cursor = skipSpaceAndComments(code, i + GLOB_TOKEN.length);
      if (code[cursor] === '<') {
        cursor = skipTypeArguments(code, cursor);
        cursor = skipSpaceAndComments(code, cursor);
      }
      if (code[cursor] === '(') {
        patterns.push(...readFirstArgument(code, cursor + 1));
      }
      i = cursor + 1;
      continue;
    }
    i++;
  }
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

function isIdentifierPart(char: string | undefined) {
  return !!char && /[\w$]/.test(char);
}

function skipLineComment(code: string, start: number) {
  const end = code.indexOf('\n', start + 2);
  return end === -1 ? code.length : end + 1;
}

function skipBlockComment(code: string, start: number) {
  const end = code.indexOf('*/', start + 2);
  return end === -1 ? code.length : end + 2;
}

function skipComment(code: string, start: number) {
  return code[start + 1] === '/' ? skipLineComment(code, start) : skipBlockComment(code, start);
}

function skipString(code: string, start: number) {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2;
    } else if (code[i] === quote) {
      return i + 1;
    } else {
      i++;
    }
  }
  return code.length;
}

function skipSpaceAndComments(code: string, start: number) {
  let i = start;
  while (i < code.length) {
    if (/\s/.test(code[i])) {
      i++;
    } else if (code[i] === '/' && (code[i + 1] === '/' || code[i + 1] === '*')) {
      i = skipComment(code, i);
    } else {
      break;
    }
  }
  return i;
}

function skipTypeArguments(code: string, start: number) {
  let depth = 0;
  let i = start;
  while (i < code.length) {
    const char = code[i];
    if (char === '"' || char === "'" || char === '`') {
      i = skipString(code, i);
      continue;
    }
    if (char === '/' && (code[i + 1] === '/' || code[i + 1] === '*')) {
      i = skipComment(code, i);
      continue;
    }
    if (char === '<') {
      depth++;
    } else if (char === '>' && code[i - 1] !== '=') {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
    i++;
  }
  return code.length;
}

function readString(code: string, start: number): { value?: string; end: number } {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2;
    } else if (code[i] === quote) {
      const value = code.slice(start + 1, i);
      // An interpolated template literal is not a static glob pattern.
      return quote === '`' && value.includes('${') ? { end: i + 1 } : { value, end: i + 1 };
    } else {
      i++;
    }
  }
  return { end: code.length };
}

function readFirstArgument(code: string, start: number): string[] {
  const i = skipSpaceAndComments(code, start);
  if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
    const { value } = readString(code, i);
    return value === undefined ? [] : [value];
  }
  if (code[i] !== '[') {
    return [];
  }

  const patterns: string[] = [];
  let cursor = i + 1;
  while (cursor < code.length) {
    cursor = skipSpaceAndComments(code, cursor);
    if (code[cursor] === ']') {
      break;
    }
    if (code[cursor] === '"' || code[cursor] === "'" || code[cursor] === '`') {
      const { value, end } = readString(code, cursor);
      if (value !== undefined) {
        patterns.push(value);
      }
      cursor = end;
      continue;
    }
    cursor++;
  }
  return patterns;
}
