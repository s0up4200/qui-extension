import { storage } from 'wxt/utils/storage';
import type { RefreshResult } from './cache';
import { hasHostPermission, MISSING_HOST_PERMISSION } from './permissions';
import { cachedData } from './storage';

/** The qui server address, the API key, and the optional Basic Auth login. */
export interface Connection {
  url: string;
  apiKey: string;
  authUsername: string;
  authPassword: string;
}

export type ConnectionState = 'not-configured' | 'no-access' | 'ready';

// Only this module reads or writes these four items. The keys stay as they are, so an update keeps them.
const serverUrl = storage.defineItem<string>('local:serverUrl', { fallback: '' });
const apiKey = storage.defineItem<string>('local:apiKey', { fallback: '' });
const basicAuthUsername = storage.defineItem<string>('local:basicAuthUsername', { fallback: '' });
const basicAuthPassword = storage.defineItem<string>('local:basicAuthPassword', { fallback: '' });

export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/** The saved connection, to fill the form of the options page. */
export async function loadConnection(): Promise<Connection> {
  const [url, key, authUsername, authPassword] = await Promise.all([
    serverUrl.getValue(),
    apiKey.getValue(),
    basicAuthUsername.getValue(),
    basicAuthPassword.getValue(),
  ]);
  return { url, apiKey: key, authUsername, authPassword };
}

async function stateOf(connection: Connection): Promise<ConnectionState> {
  if (!connection.url || !connection.apiKey) return 'not-configured';
  return (await hasHostPermission(connection.url)) ? 'ready' : 'no-access';
}

/** Does not call qui. Test Connection is the check that qui answers. */
export async function connectionState(): Promise<ConnectionState> {
  return stateOf(await loadConnection());
}

/** The connection for a qui call. Throws when it is not configured or has no server access. */
export async function readyConnection(): Promise<Connection> {
  const connection = await loadConnection();
  const state = await stateOf(connection);
  if (state === 'not-configured') throw new Error('qui server not configured');
  if (state === 'no-access') throw new Error(MISSING_HOST_PERMISSION);
  return connection;
}

/**
 * Saves the connection and refreshes the cache. Runs in the background, for the "save connection" request.
 * The page asks for server access first, because only its click handler can show the prompt.
 * When the refresh fails, the settings stay saved and the error goes to the caller.
 */
export async function saveConnection(input: Connection, refresh: () => Promise<RefreshResult>): Promise<RefreshResult> {
  const url = normalizeUrl(input.url);
  // Instance ids repeat across qui servers, so the old server's menus must
  // not survive a failed first refresh. Clear before the address changes.
  if (url !== normalizeUrl(await serverUrl.getValue())) {
    await cachedData.removeValue();
  }
  await serverUrl.setValue(url);
  await apiKey.setValue(input.apiKey);
  await basicAuthUsername.setValue(input.authUsername);
  await basicAuthPassword.setValue(input.authPassword);
  return refresh();
}
