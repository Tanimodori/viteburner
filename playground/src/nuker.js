/** nuker.js — auto-open ports and nuke all hackable servers
 *  Usage: run nuker.js
 */
export async function main(ns) {
  ns.disableLog("scan");
  ns.disableLog("sleep");

  const visited = new Set(["home"]);
  const queue = ["home"];

  const portPrograms = {
    "BruteSSH.exe":   ns.brutessh,
    "FTPCrack.exe":   ns.ftpcrack,
    "SMTPcrack.exe":  ns.relaysmtp,
    "SQLInject.exe":  ns.sqlinject,
    "HTTPWorm.exe":   ns.httpworm,
    "RelaySMTP.exe":  ns.relaysmtp,
  };

  function openPorts(server) {
    let count = 0;
    for (const [name, fn] of Object.entries(portPrograms)) {
      if (ns.fileExists(name, "home")) {
        try { fn(server); count++; } catch {}
      }
    }
    return count;
  }

  ns.tprint("=== Nuking reachable servers ===");

  while (queue.length > 0) {
    const host = queue.shift();
    const neighbors = ns.scan(host);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);

        const info = ns.getServer(neighbor);

        if (info.hasAdminRights) {
          continue;
        }

        const opened = openPorts(neighbor);
        const required = info.numOpenPortsRequired;

        if (opened >= required) {
          try {
            ns.nuke(neighbor);
            ns.tprint(`  NUKE OK  ${neighbor.padEnd(22)} ports=${opened}/${required} lvl=${info.requiredHackingSkill} money=$${ns.formatNumber(info.moneyAvailable, 2)}`);
          } catch (e) {
            ns.tprint(`  NUKE FAIL ${neighbor}: ${e}`);
          }
        } else {
          ns.tprint(`  SKIP      ${neighbor.padEnd(22)} ports=${opened}/${required} — need ${required - opened} more port opener(s)`);
        }
      }
    }
  }
}
