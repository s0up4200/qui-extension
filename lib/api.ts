import ky, { HTTPError } from 'ky';
import { blobFromTorrentFile } from './torrent-file';
import { hasHostPermission, MISSING_HOST_PERMISSION } from './permissions';
import { serverUrl, apiKey, basicAuthUsername, basicAuthPassword } from './storage';
import type { TorrentFileData } from './messaging';

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
  if (!(await hasHostPermission(url))) {
    throw new Error(MISSING_HOST_PERMISSION);
  }

  return ky.extend({
    prefix: url.replace(/\/+$/, ''),
    timeout: 10_000,
    retry: {
      limit: 2,
      methods: ['get'],
      statusCodes: [408, 500, 502, 503, 504],
    },
    hooks: {
      beforeError: [
        ({ error }) => {
          // qui answers errors with {"error": "..."}; surface that text and
          // keep the status so formatConnectionError can still match on it.
          // ky 2 has already consumed the body into error.data.
          if (!(error instanceof HTTPError)) {
            return error;
          }
          const body = error.data as { error?: string } | undefined;
          if (body?.error) {
            error.message = `HTTP ${error.response.status}: ${body.error}`;
          }
          return error;
        },
      ],
      beforeRequest: [
        ({ request }) => {
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
  /** Absolute path on the qBittorrent host. qui disables autoTMM when set. */
  savePath?: string;
}

function buildTorrentForm(category: string, options?: AddTorrentOptions): FormData {
  const form = new FormData();
  if (category) {
    form.append('category', category);
  }
  if (options?.savePath) {
    form.append('savepath', options.savePath);
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
 * Add a torrent file (raw bytes + content type) to an instance.
 * Used for .torrent files fetched from private trackers.
 */
export async function addTorrentFile(
  instanceId: string,
  fileData: TorrentFileData,
  category: string,
  options?: AddTorrentOptions,
): Promise<unknown> {
  const client = await getClient();
  const form = buildTorrentForm(category, options);
  form.append('torrent', blobFromTorrentFile(fileData), 'file.torrent');

  return client.post(`api/instances/${instanceId}/torrents`, { body: form }).json();
}

export interface CrossSeedProposal {
  hash: string;
  name: string;
  size: number;
  category: string;
  effective_save_path: string;
  overlap_bytes: number;
  overlap_fraction: number;
}

export interface CrossSeedProposals {
  /** The upload is a TV season pack; several episode torrents can be assembled into it. */
  pack_mode: boolean;
  /** Set when the instance cannot link files, so a pack falls back to a single target. */
  assembly_unavailable_reason: string;
  source_name: string;
  source_size: number;
  source_file_count: number;
  default_tags: string[];
  pinned_category: string;
  proposals: CrossSeedProposal[];
}

interface CrossSeedResponse {
  success: boolean;
  results?: { status: string; message?: string }[];
}

export interface TorrentSummary {
  hash: string;
  name: string;
  size: number;
  category: string;
}

/** Search torrents on an instance by name. Used to pick a cross-seed target by hand. */
export async function searchTorrents(instanceId: string, query: string): Promise<TorrentSummary[]> {
  const client = await getClient();
  const raw = await client
    .get(`api/instances/${instanceId}/torrents`, { searchParams: { search: query, limit: 20 } })
    .json<{ torrents: TorrentSummary[] | null }>();
  return (raw.torrents ?? []).map(({ hash, name, size, category }) => ({ hash, name, size, category }));
}

/**
 * Rank torrents on the instance by file-size overlap with the given .torrent.
 * targetHash, when set, is always included in the proposals, even at zero overlap.
 */
export async function getCrossSeedProposals(
  instanceId: string,
  fileData: TorrentFileData,
  targetHash?: string,
): Promise<CrossSeedProposals> {
  const client = await getClient();
  const raw = await client
    .post('api/cross-seed/manual/proposals', {
      json: { instance_id: Number(instanceId), torrent_data: fileData.base64, target_hash: targetHash },
    })
    .json<CrossSeedProposals>();
  // Go serializes nil slices as null.
  return {
    ...raw,
    assembly_unavailable_reason: raw.assembly_unavailable_reason ?? '',
    default_tags: raw.default_tags ?? [],
    proposals: raw.proposals ?? [],
  };
}

export interface AssembleTarget {
  hash: string;
  name: string;
  /** Empty when the target contributes an episode; otherwise a qui reason code. */
  reason: string;
}

export interface AssembleResult {
  ready: boolean;
  applied: boolean;
  reason: string;
  message: string;
  targets: AssembleTarget[];
  matched_episodes: number;
  total_episodes: number;
  coverage: number;
  missing_bytes: number;
  default_category: string;
}

async function manualAssemble(
  endpoint: string,
  instanceId: string,
  fileData: TorrentFileData,
  targetHashes: string[],
  category?: string,
  tags?: string[],
): Promise<AssembleResult> {
  const client = await getClient();
  const raw = await client
    .post(endpoint, {
      json: {
        instance_id: Number(instanceId),
        torrent_data: fileData.base64,
        target_hashes: targetHashes,
        category: category || undefined,
        tags: tags?.length ? tags : undefined,
      },
    })
    .json<AssembleResult>();
  return { ...raw, targets: raw.targets ?? [] };
}

/**
 * Preview a season pack built from the selected episode torrents.
 * An empty targetHashes asks qui to suggest targets.
 */
export function checkAssemble(instanceId: string, fileData: TorrentFileData, targetHashes: string[]) {
  return manualAssemble('api/cross-seed/manual/assemble/check', instanceId, fileData, targetHashes);
}

/** Link the selected episodes into a pack tree and add the pack paused with a recheck. Needs 2+ hashes. */
export function applyAssemble(
  instanceId: string,
  fileData: TorrentFileData,
  targetHashes: string[],
  category: string | undefined,
  tags: string[],
) {
  return manualAssemble('api/cross-seed/manual/assemble', instanceId, fileData, targetHashes, category, tags);
}

/** Add the .torrent pinned to targetHash. qui always runs a full recheck. */
export async function applyCrossSeed(
  instanceId: string,
  fileData: TorrentFileData,
  targetHash: string,
  category: string | undefined,
  tags: string[],
): Promise<void> {
  const client = await getClient();
  const result = await client
    .post('api/cross-seed/manual/apply', {
      json: {
        instance_id: Number(instanceId),
        torrent_data: fileData.base64,
        target_hash: targetHash,
        category: category || undefined,
        tags: tags.length ? tags : undefined,
      },
    })
    .json<CrossSeedResponse>();
  if (!result.success) {
    const first = result.results?.[0];
    throw new Error(first?.message || first?.status || 'Cross-seed was not added');
  }
}
