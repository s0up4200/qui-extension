import { browser } from 'wxt/browser';

export const MISSING_HOST_PERMISSION =
  'qui has no permission to reach the server. Open the extension options and click Grant access.';

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

/**
 * Asks the browser for host permission on the URL's origin.
 * Call it as the first await in a click handler, or the user gesture is lost
 * and the browser rejects the request without a prompt.
 */
export function requestHostPermission(url: string): Promise<boolean> {
  const origin = urlToOrigin(url);
  if (!origin) {
    return Promise.resolve(false);
  }
  return browser.permissions.request({ origins: [origin] });
}
