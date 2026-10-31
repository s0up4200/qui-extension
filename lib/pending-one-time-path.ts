import type { addTorrent, addTorrentFile } from './api';
import type { OneTimePathPending } from './storage';
import { isFullPath } from './one-time-path';
import { RequestError } from './requests';

export const STALE_WINDOW = 'This window is out of date. Right-click the torrent link again.';

export type OneTimePathSource = Omit<OneTimePathPending, 'id'>;

export interface PendingStore {
  getValue(): Promise<OneTimePathPending | null>;
  setValue(value: OneTimePathPending): Promise<void>;
  removeValue(): Promise<void>;
}

export interface QuiAdd {
  addMagnet: typeof addTorrent;
  addFile: typeof addTorrentFile;
  /** The "Add paused" and "Skip recheck" settings from options. */
  settings(): Promise<{ paused: boolean; skipChecking: boolean }>;
}

export interface PendingOneTimePath {
  prepare(loadSource: () => Promise<OneTimePathSource>): Promise<OneTimePathPending | null>;
  read(pendingId: string): Promise<OneTimePathPending>;
  apply(pendingId: string, choice: { category: string; savePath: string }): Promise<{ summary: string }>;
}

/**
 * Owns the one pending slot of the "Other path…" window. Same rules as the
 * cross-seed slot: the newest right-click wins, and late work for an older
 * request never overwrites or removes the newer one.
 */
export function createPendingOneTimePath(store: PendingStore, qui: QuiAdd): PendingOneTimePath {
  // Id of the newest prepare. It dies with the worker, and then the stored id alone decides.
  let latest: string | null = null;
  // Every storage step runs in call order, so a check and the write after it see the same slot.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(step: () => Promise<T>): Promise<T> {
    const run = queue.then(step);
    queue = run.catch(() => {});
    return run;
  }

  function current(pendingId: string): Promise<OneTimePathPending> {
    return serial(async () => {
      const pending = await store.getValue();
      if (pending?.id !== pendingId) throw new RequestError('stale', STALE_WINDOW);
      return pending;
    });
  }

  return {
    async prepare(loadSource) {
      const id = crypto.randomUUID();
      latest = id;
      const cleared = serial(() => store.removeValue());
      try {
        const [source] = await Promise.all([loadSource(), cleared]);
        const pending = { ...source, id };
        return await serial(async () => {
          if (latest !== id) return null;
          await store.setValue(pending);
          return pending;
        });
      } catch (err) {
        if (latest !== id) return null;
        throw err;
      }
    },

    read: current,

    async apply(pendingId, { category, savePath }) {
      const path = savePath.trim();
      if (!isFullPath(path)) throw new Error('Type a full path, for example /data/films or D:\\Films');
      const pending = await current(pendingId);
      const { paused, skipChecking } = await qui.settings();
      const options = { paused, skipChecking, savePath: path };
      if (typeof pending.torrent === 'string') {
        await qui.addMagnet(pending.instanceId, pending.torrent, category, options);
      } else {
        await qui.addFile(pending.instanceId, pending.torrent, category, options);
      }
      // qui added the torrent, so report success even if a newer click replaced the slot.
      await serial(async () => {
        if ((await store.getValue())?.id === pendingId) await store.removeValue();
      });
      return { summary: `Added to ${pending.instanceName} / ${path}` };
    },
  };
}
