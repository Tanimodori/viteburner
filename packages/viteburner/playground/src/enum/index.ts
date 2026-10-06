import { NS, type CrimeType } from '@ns';

export async function main(ns: NS) {
  const myCrimeType: `${CrimeType}` = 'Shoplift';
  ns.tprint(myCrimeType);
}
