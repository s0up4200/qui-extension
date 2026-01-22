import { browser } from 'wxt/browser';

/**
 * Converts a user-entered URL to a Chrome match pattern origin.
 * Returns null for invalid URLs or non-http(s) protocols.
 *
 * Chrome match patterns reject ports, so only protocol + hostname are used.
 */
export function urlToOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

/**
 * Checks if the extension already has host permission for the given URL's origin.
 */
export async function hasHostPermission(url: string): Promise<boolean> {
  const origin = urlToOrigin(url);
  if (!origin) {
    return false;
  }
  return browser.permissions.contains({ origins: [origin] });
}
