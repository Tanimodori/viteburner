/** basic-hack.js — hack / grow / weaken loop on a target
 *  Usage: run basic-hack.js <hostname>
 */
export async function main(ns) {
  const target = ns.args[0] || "n00dles";
  ns.disableLog("sleep");
  ns.disableLog("hack");
  ns.disableLog("grow");
  ns.disableLog("weaken");
  ns.disableLog("getServerSecurityLevel");
  ns.disableLog("getServerMoneyAvailable");

  ns.tprint(`=== Targeting ${target} ===`);

  while (true) {
    const money = ns.getServerMoneyAvailable(target);
    const security = ns.getServerSecurityLevel(target);
    const maxMoney = ns.getServerMaxMoney(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);

    // If security is above minimum, weaken first
    if (security > minSecurity + 5) {
      const weakenThreads = Math.ceil((security - minSecurity) / 0.05);
      await ns.weaken(target, { threads: weakenThreads });
      ns.tprint(`[${target}] weakened ${security.toFixed(1)} → ${ns.getServerSecurityLevel(target).toFixed(1)}`);
    }
    // If money is below max, grow
    else if (money < maxMoney * 0.9) {
      const growThreads = Math.ceil(await ns.grow(target));
      ns.tprint(`[${target}] grew x${ns.getServerMoneyAvailable(target) / money.toFixed(2)}`);
    }
    // Otherwise hack
    else {
      const hackThreads = Math.max(1, Math.floor(ns.getServerMaxMoney(target) * 0.001 / ns.hackAnalyze(target)));
      const stolen = await ns.hack(target, { threads: hackThreads });
      ns.tprint(`[${target}] hacked $${ns.formatNumber(stolen, 2)}`);
    }
  }
}
