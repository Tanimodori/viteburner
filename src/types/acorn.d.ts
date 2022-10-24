import * as ESTree from 'estree';

declare module 'acorn' {
  export function parse(s: string, o: Options): ESTree.Program;
}

declare module 'estree' {
  interface BaseNodeWithoutComments {
    start: number;
    end: number;
  }
}
