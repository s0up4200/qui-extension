// Pure menu id helpers. No wxt imports so tests can load this file directly.
export type MenuAction = 'add' | 'cross-seed';

export function makeMenuId(instanceId: string, category: string): string {
  return `add|${instanceId}|${category}`;
}

export function makeCrossSeedMenuId(instanceId: string): string {
  return `cross-seed|${instanceId}|`;
}

export function parseMenuId(
  menuItemId: string,
): { action: MenuAction; instanceId: string; category: string } | null {
  const [action, instanceId, ...rest] = String(menuItemId).split('|');
  if ((action !== 'add' && action !== 'cross-seed') || !rest.length) {
    return null;
  }
  return { action, instanceId, category: rest.join('|') };
}
