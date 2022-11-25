// @ts-expect-error no types
import lodash from 'https://unpkg.com/lodash@4.17.21/lodash.min.js';
import { NS } from '@ns';

export async function main(ns: NS) {
  console.log(lodash);
}
