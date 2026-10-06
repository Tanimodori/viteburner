import { NS } from '@ns';
// @ts-expect-error no types
import lodash from 'https://unpkg.com/lodash@4.17.21/lodash.min.js';

export async function main(ns: NS) {
  ns.tprint(lodash);
}
