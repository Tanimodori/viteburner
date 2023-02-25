import { NS, type CrimeType } from '@ns';

function printCrimeType(ns: NS, crimeType: `${CrimeType}`) {
  ns.tprint(crimeType);
}

export async function main(ns: NS) {
  printCrimeType(ns, 'Shoplift');
}
