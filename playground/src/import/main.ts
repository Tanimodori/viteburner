import { absoluteSrc } from '/src/import/absolute';
import { NS } from '@ns';
import { absolute } from '@/import/absolute';
import { relative } from './relative';

export async function main(ns: NS) {
  relative(ns);
  absolute(ns);
  absoluteSrc(ns);
}
