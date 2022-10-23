import { NS } from '@ns';
import { relative } from './relative';
import { absolute } from '@/import/absolute';

export async function main(ns: NS) {
  relative(ns);
  absolute(ns);
}
