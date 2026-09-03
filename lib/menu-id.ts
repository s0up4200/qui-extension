// Pure menu id helpers. Kept free of browser imports so bun:test can load them.

/** `savePath` is set only for `path|` items. */
export interface MenuTarget {
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

/** Split `{prefix}|{instanceId}|{rest}` on the first two separators only; `rest` may contain `|`. */
export function parseMenuId(menuItemId: string): MenuTarget | null {
  if (typeof menuItemId !== 'string') {
    return null;
  }
  const firstSep = menuItemId.indexOf('|');
  const secondSep = menuItemId.indexOf('|', firstSep + 1);
  if (firstSep === -1 || secondSep === -1) {
    return null;
  }
  const prefix = menuItemId.slice(0, firstSep);
  const instanceId = menuItemId.slice(firstSep + 1, secondSep);
  const rest = menuItemId.slice(secondSep + 1);
  if (prefix === 'add') {
    return { instanceId, category: rest };
  }
  if (prefix === 'path') {
    return { instanceId, category: '', savePath: rest };
  }
  return null;
}
