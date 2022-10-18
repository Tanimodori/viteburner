import pc from 'picocolors';

export function formatRaw(msg: string) {
  return `${pc.cyan('[bitburner-vite]')} ${msg}`;
}

export function formatNormal(first = '', second = '') {
  const firstPart = first ? pc.green(first) : '';
  const middlePart = first && second ? ' ' : '';
  const secondPart = second ? pc.dim(second) : '';
  return formatRaw(firstPart + middlePart + secondPart);
}
