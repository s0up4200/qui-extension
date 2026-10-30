import type {
  AssembleResult,
  CrossSeedProposals,
  applyAssemble,
  applyCrossSeed,
  checkAssemble,
  getCrossSeedProposals,
} from './api';
import type { CrossSeedPending } from './storage';
import { assembleReason } from './cross-seed-targets';

export const STALE_PICKER = 'This picker is stale. Right-click the torrent link again.';

export type CrossSeedSource = Pick<CrossSeedPending, 'instanceId' | 'instanceName' | 'file'>;

export type CrossSeedSelection = {
  targetHashes: string[];
  category?: string;
  tags: string[];
};

export interface PendingStore {
  getValue(): Promise<CrossSeedPending | null>;
  setValue(value: CrossSeedPending): Promise<void>;
  removeValue(): Promise<void>;
}

export interface QuiCrossSeed {
  proposals: typeof getCrossSeedProposals;
  apply: typeof applyCrossSeed;
  check: typeof checkAssemble;
  assemble: typeof applyAssemble;
}

export interface PendingCrossSeed {
  prepare(loadSource: () => Promise<CrossSeedSource>): Promise<CrossSeedPending | null>;
  read(pendingId: string): Promise<CrossSeedPending>;
  pin(pendingId: string, targetHash: string): Promise<CrossSeedProposals>;
  check(pendingId: string, targetHashes: string[]): Promise<AssembleResult>;
  apply(pendingId: string, selection: CrossSeedSelection): Promise<{ summary: string }>;
}

/**
 * Owns the one pending cross-seed slot. The newest right-click wins, and late
 * work for an older request never overwrites or removes the newer payload.
 * Only this module reads or writes the slot.
 */
export function createPendingCrossSeed(store: PendingStore, qui: QuiCrossSeed): PendingCrossSeed {
  // Id of the newest prepare. It dies with the worker, and then the stored id alone decides.
  let latest: string | null = null;
  // Every storage step runs in call order, so a check and the write after it see the same slot.
  // Network work stays outside the queue.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(step: () => Promise<T>): Promise<T> {
    const run = queue.then(step);
    queue = run.catch(() => {});
    return run;
  }

  function stale(): never {
    throw new Error(STALE_PICKER);
  }

  function current(pendingId: string): Promise<CrossSeedPending> {
    return serial(async () => {
      const pending = await store.getValue();
      return pending?.id === pendingId ? pending : stale();
    });
  }

  return {
    async prepare(loadSource) {
      const id = crypto.randomUUID();
      latest = id;
      const cleared = serial(() => store.removeValue());
      try {
        const [source] = await Promise.all([loadSource(), cleared]);
        if (latest !== id) return null;
        const match = await qui.proposals(source.instanceId, source.file);
        const pending = { ...source, id, match };
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

    async pin(pendingId, targetHash) {
      const pending = await current(pendingId);
      const match = await qui.proposals(pending.instanceId, pending.file, targetHash);
      await serial(async () => {
        const now = await store.getValue();
        if (now?.id !== pendingId) stale();
        await store.setValue({ ...now, match });
      });
      return match;
    },

    async check(pendingId, targetHashes) {
      const pending = await current(pendingId);
      const result = await qui.check(pending.instanceId, pending.file, targetHashes);
      await current(pendingId);
      return result;
    },

    async apply(pendingId, { targetHashes, category, tags }) {
      const pending = await current(pendingId);
      let summary: string;
      if (targetHashes.length > 1) {
        const result = await qui.assemble(pending.instanceId, pending.file, targetHashes, category, tags);
        if (!result.applied) {
          throw new Error(result.message || assembleReason(result.reason));
        }
        const dropped = result.targets.filter((t) => t.reason).map((t) => t.name || t.hash);
        summary = `Assembled ${result.matched_episodes} of ${result.total_episodes} episodes in ${pending.instanceName}`
          + (dropped.length ? `. Dropped: ${dropped.join(', ')}` : '');
      } else {
        const [targetHash] = targetHashes;
        if (!targetHash) throw new Error('Pick a target torrent first');
        const target = pending.match.proposals.find((p) => p.hash === targetHash);
        await qui.apply(pending.instanceId, pending.file, targetHash, category, tags);
        summary = `Added to ${pending.instanceName} as cross-seed of ${target?.name ?? targetHash}`;
      }
      // qui accepted the apply, so report success even if a newer click replaced the slot.
      await serial(async () => {
        if ((await store.getValue())?.id === pendingId) await store.removeValue();
      });
      return { summary };
    },
  };
}
