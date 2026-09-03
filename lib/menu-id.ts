// Pure menu id helpers. No wxt imports so tests can load this file directly.

export type MenuAction = 'add' | 'cross-seed';

/** `savePath` is set only for `path|` items, which add with no category. */
export interface MenuTarget {
  action: MenuAction;
  instanceId: string;
  category: string;
  savePath?: string;
}

export function makeMenuId(instanceId: string, category: string): string {
  return `add|${instanceId}|${category}`;
}

export function makePathMenuId(instanceId: string, savePath: string): string {
  return `path|${instanceId}|${savePath}`;
}

export function makeCrossSeedMenuId(instanceId: string): string {
  return `cross-seed|${instanceId}|`;
}

/** Split `{prefix}|{instanceId}|{rest}` on the first two separators only; `rest` may contain `|`. */
export function parseMenuId(menuItemId: string): MenuTarget | null {
  const [prefix, instanceId, ...rest] = String(menuItemId).split('|');
  if (!rest.length) {
    return null;
  }
  const tail = rest.join('|');
  switch (prefix) {
    case 'add':
      return { action: 'add', instanceId, category: tail };
    case 'path':
      return { action: 'add', instanceId, category: '', savePath: tail };
    case 'cross-seed':
      return { action: 'cross-seed', instanceId, category: '' };
    default:
      return null;
  }
}
