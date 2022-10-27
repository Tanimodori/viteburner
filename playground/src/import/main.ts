import { NS } from '@ns';
import { relative } from './relative';
import { absolute } from '@/import/absolute';
import { absoluteSrc } from '/src/import/absolute';

export async function main(ns: NS) {
  relative(ns);
  absolute(ns);
  absoluteSrc(ns);
}
