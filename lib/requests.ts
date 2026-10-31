import type * as api from './api';
import type { RefreshResult } from './cache';
import type { CrossSeedSelection, PendingCrossSeed } from './pending-cross-seed';
import type { PendingOneTimePath } from './pending-one-time-path';

export interface RequestDeps {
  qui: Pick<typeof api, 'getInstances' | 'searchTorrents' | 'getTorrentsByHash' | 'supportsPathAutocomplete' | 'listDirectories'>;
  crossSeed: PendingCrossSeed;
  oneTimePath: PendingOneTimePath;
  refresh(): Promise<RefreshResult>;
  notify(title: string, message: string): void;
}

/** `stale`: a newer right-click replaced the torrent of the window. */
export type RequestErrorKind = 'stale' | 'other';

/** An error that keeps its kind when it crosses from the background to a page. */
export class RequestError extends Error {
  constructor(readonly kind: RequestErrorKind, message: string) {
    super(message);
  }
}

export type RequestResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: { kind: RequestErrorKind; message: string } };

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

/**
 * Every background request: a message from a page that asks the background to do one job.
 * The handler of a request is the only source of its parameters and its result type.
 */
export function createRequestHandlers({ qui, crossSeed, oneTimePath, refresh, notify }: RequestDeps) {
  return {
    'test-connection': () => qui.getInstances(),
    'refresh-cache': () => refresh(),
    'search-torrents': ({ instanceId, query }: { instanceId: string; query: string }) =>
      qui.searchTorrents(instanceId, query),
    'lookup-torrents': ({ instanceId, hashes }: { instanceId: string; hashes: string[] }) =>
      qui.getTorrentsByHash(instanceId, hashes),
    'read-cross-seed': ({ pendingId }: { pendingId: string }) => crossSeed.read(pendingId),
    'pin-cross-seed-target': ({ pendingId, targetHash }: { pendingId: string; targetHash: string }) =>
      crossSeed.pin(pendingId, targetHash),
    'check-cross-seed-assemble': ({ pendingId, targetHashes }: { pendingId: string; targetHashes: string[] }) =>
      crossSeed.check(pendingId, targetHashes),
    'apply-cross-seed': async ({ pendingId, ...selection }: { pendingId: string } & CrossSeedSelection) => {
      try {
        const { summary } = await crossSeed.apply(pendingId, selection);
        notify('Cross-seed Added', summary);
      } catch (err) {
        if (!(err instanceof RequestError && err.kind === 'stale')) notify('Failed to Add Cross-seed', errorMessage(err));
        throw err;
      }
    },
    'read-one-time-path': ({ pendingId }: { pendingId: string }) => oneTimePath.read(pendingId),
    'apply-one-time-path': async ({ pendingId, ...choice }: { pendingId: string; category: string; savePath: string }) => {
      // The window shows each error, so only success gets a notice.
      const { summary } = await oneTimePath.apply(pendingId, choice);
      notify('Torrent Added', summary);
    },
    'supports-path-autocomplete': ({ instanceId }: { instanceId: string }) => qui.supportsPathAutocomplete(instanceId),
    'list-directories': ({ instanceId, dirPath }: { instanceId: string; dirPath: string }) =>
      qui.listDirectories(instanceId, dirPath),
  };
}

export type RequestHandlers = ReturnType<typeof createRequestHandlers>;
export type RequestName = keyof RequestHandlers;
export type RequestParams<K extends RequestName> = Parameters<RequestHandlers[K]> extends [infer P] ? P : {};
export type RequestResult<K extends RequestName> = Awaited<ReturnType<RequestHandlers[K]>>;
export type BackgroundRequest<K extends RequestName> = { type: K } & RequestParams<K>;

/** Runs the handler that the message names. Never throws: a failure becomes an error response. */
export async function handleRequest(handlers: RequestHandlers, message: unknown): Promise<RequestResponse> {
  const { type, ...params } = (message ?? {}) as { type?: unknown };
  if (typeof type !== 'string' || !Object.hasOwn(handlers, type)) {
    return { success: false, error: { kind: 'other', message: 'Unknown message type' } };
  }
  const handler = handlers[type as RequestName] as (params: object) => Promise<unknown>;
  try {
    return { success: true, data: await handler(params) };
  } catch (err) {
    const kind = err instanceof RequestError ? err.kind : 'other';
    return { success: false, error: { kind, message: errorMessage(err) } };
  }
}
