import { NS } from '@ns';

export interface MyModule {
  default: (ns: NS) => void | Promise<void>;
}

const modules = import.meta.glob<MyModule>('./modules/*.ts', { eager: true });

export async function main(ns: NS) {
  for (const module of Object.values(modules)) {
    await module.default(ns);
  }
}
