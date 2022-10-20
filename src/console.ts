import pc from 'picocolors';

export function formatRaw(msg: string) {
  return `${pc.cyan('[viteburner]')} ${msg}`;
}

export function formatNormal(first = '', second = '', third = '') {
  const parts = [];
  first && parts.push(pc.green(first));
  second && parts.push(pc.dim(second));
  third && parts.push(third);
  return formatRaw(parts.join(' '));
}
