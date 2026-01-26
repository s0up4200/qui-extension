import ky from 'ky';
import { serverUrl, apiKey, basicAuthUsername, basicAuthPassword } from './storage';

export interface Instance {
  id: string;
  name: string;
  host: string;
}

export interface Category {
  name: string;
  savePath: string;
}

async function getClient() {
  const url = await serverUrl.getValue();
  const key = await apiKey.getValue();
  const authUsername = await basicAuthUsername.getValue();
  const authPassword = await basicAuthPassword.getValue();

  if (!url || !key) {
    throw new Error('qui server not configured');
  }

  return ky.extend({
    prefixUrl: url.replace(/\/+$/, ''),
    timeout: 10_000,
    retry: {
      limit: 2,
      methods: ['get'],
      statusCodes: [408, 500, 502, 503, 504],
    },
    hooks: {
      beforeRequest: [
        (request) => {
          request.headers.set('X-API-Key', key);
          if (authUsername && authPassword) {
            const credentials = btoa(`${authUsername}:${authPassword}`);
            request.headers.set('Authorization', `Basic ${credentials}`);
          }
        },
      ],
    },
  });
}

export async function getInstances(): Promise<Instance[]> {
  const client = await getClient();
  const raw = await client.get('api/instances').json<Instance[]>();
  return raw.map((i) => ({ ...i, id: String(i.id) }));
}

export async function getCategories(instanceId: string): Promise<Category[]> {
  const client = await getClient();
  const data = await client
    .get(`api/instances/${instanceId}/categories`)
    .json<Record<string, Category>>();
  return Object.values(data);
}

export interface AddTorrentOptions {
  paused?: boolean;
  skipChecking?: boolean;
}

function buildTorrentForm(category: string, options?: AddTorrentOptions): FormData {
  const form = new FormData();
  if (category) {
    form.append('category', category);
  }
  if (options?.paused) {
    form.append('paused', 'true');
  }
  if (options?.skipChecking) {
    form.append('skip_checking', 'true');
  }
  return form;
}

export async function addTorrent(
  instanceId: string,
  urls: string,
  category: string,
  options?: AddTorrentOptions,
): Promise<unknown> {
  const client = await getClient();
  const form = buildTorrentForm(category, options);
  form.append('urls', urls);
  return client.post(`api/instances/${instanceId}/torrents`, { body: form }).json();
}

/**
 * Add a torrent file (as base64 data URL) to an instance.
 * Used for .torrent files fetched from private trackers.
 */
export async function addTorrentFile(
  instanceId: string,
  fileData: string,
  category: string,
  options?: AddTorrentOptions,
): Promise<unknown> {
  const client = await getClient();
  const form = buildTorrentForm(category, options);

  // Convert base64 data URL to blob
  const response = await fetch(fileData);
  const blob = await response.blob();
  form.append('torrent', blob, 'file.torrent');

  return client.post(`api/instances/${instanceId}/torrents`, { body: form }).json();
}
