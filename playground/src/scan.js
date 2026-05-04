/** scan.js — list all reachable servers and their stats */
export async function main(ns) {
  ns.disableLog("scan");
  ns.disableLog("getServer");

  const visited = new Set(["home"]);
  const queue = ["home"];
  const targets = [];

  ns.tprint("=== Network Scan ===");

  while (queue.length > 0) {
    const host = queue.shift();
    const neighbors = ns.scan(host);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);

        const info = ns.getServer(neighbor);
        const hasRoot = info.hasAdminRights;
        const ports = info.openPortCount;
        const requiredPorts = info.numOpenPortsRequired;
        const hackLevel = info.requiredHackingSkill;
        const money = info.moneyAvailable;
        const maxMoney = info.moneyMax;
        const difficulty = info.hackDifficulty;
        const minDiff = info.minDifficulty;
        const growth = info.serverGrowth;

        targets.push({ hostname: neighbor, hasRoot, ports, requiredPorts, hackLevel, money, maxMoney, difficulty, minDiff, growth, info });

        const root = hasRoot ? "[ROOT]" : "[   ]";
        const ports2 = `${ports}/${requiredPorts} ports`;
        const moneyStr = ns.format.number(money, 2);
        const maxStr = ns.format.number(maxMoney, 2);
        const diffStr = `${difficulty?.toFixed(1)}/${minDiff?.toFixed(1)}`;
        const hp = ns.getHackingLevel();
        const canHack = hp >= hackLevel ? "✓" : "✗";

        ns.tprint(`${root} ${neighbor.padEnd(22)} lvl=${String(hackLevel).padStart(3)} ${ports2.padEnd(12)} money=$${moneyStr.padStart(12)}/${maxStr.padStart(12)} diff=${diffStr} growth=${growth} ${canHack}`);
      }
    }
  }

  ns.tprint(`\n=== Hackable Targets (have root + meet level req) ===`);
  const playerLevel = ns.getHackingLevel();
  for (const t of targets) {
    if (t.hasRoot && playerLevel >= t.hackLevel && t.money > 0) {
      ns.tprint(`  ${t.hostname.padEnd(22)} $${ns.format.number(t.money, 2).padStart(12)} diff=${t.difficulty?.toFixed(1)} growth=${t.growth}`);
    }
  }
}
