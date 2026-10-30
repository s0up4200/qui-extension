import { describe, expect, test } from 'bun:test';
import type { AssembleResult, CrossSeedProposals } from '../lib/api';
import type { CrossSeedPending } from '../lib/storage';
import { createPendingCrossSeed, STALE_PICKER, type QuiCrossSeed } from '../lib/pending-cross-seed';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (err: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets every queued promise job and storage step run.
const flush = () => new Promise((r) => setTimeout(r, 0));

const match = (target?: string): CrossSeedProposals => ({
  pack_mode: false,
  assembly_unavailable_reason: '',
  source_name: 'src',
  source_size: 1,
  source_file_count: 1,
  default_tags: [],
  pinned_category: '',
  proposals: [{
    hash: target ?? 'aa', name: target ?? 'aa', size: 1, category: 'tv', overlap_fraction: 1,
  }],
});

const assembleResult = (over: Partial<AssembleResult> = {}): AssembleResult => ({
  ready: true, applied: false, reason: '', message: '', matched_episodes: 2, total_episodes: 2,
  coverage: 1, missing_bytes: 0, default_category: 'tv', targets: [], ...over,
});

/**
 * Session storage stand-in. holdRead pauses the next read after it took its snapshot.
 * failWrite makes the next write reject, as a full or closed storage area does.
 */
function fakeStore() {
  let value: CrossSeedPending | null = null;
  let gate: Promise<void> | null = null;
  let failing = false;
  function write() {
    if (!failing) return;
    failing = false;
    throw new Error('storage write failed');
  }
  return {
    get value() {
      return value;
    },
    holdRead() {
      const d = deferred<void>();
      gate = d.promise;
      return () => d.resolve();
    },
    failWrite() {
      failing = true;
    },
    async getValue() {
      const snapshot = value;
      const g = gate;
      gate = null;
      if (g) await g;
      return snapshot;
    },
    async setValue(v: CrossSeedPending) {
      write();
      value = v;
    },
    async removeValue() {
      write();
      value = null;
    },
  };
}

type Op = keyof QuiCrossSeed;

/** qui stand-in. hold(op) makes the next call of op wait for the test to settle it. */
function fakeQui() {
  const calls: Op[] = [];
  const held: Partial<Record<Op, Deferred<unknown>>> = {};
  function reply<T>(op: Op, value: T): Promise<T> {
    calls.push(op);
    const d = held[op];
    delete held[op];
    return d ? (d.promise as Promise<T>) : Promise.resolve(value);
  }
  const qui: QuiCrossSeed = {
    proposals: (_id, _file, target) => reply('proposals', match(target)),
    apply: () => reply('apply', undefined),
    check: () => reply('check', assembleResult()),
    assemble: () => reply('assemble', assembleResult({ applied: true })),
  };
  return {
    qui,
    calls,
    hold<T>(op: Op) {
      const d = deferred<T>();
      held[op] = d as Deferred<unknown>;
      return d;
    },
  };
}

const source = (name: string) => async () => ({
  instanceId: '1',
  instanceName: 'qbt',
  file: { base64: name, contentType: 'application/x-bittorrent' },
});

function setup() {
  const store = fakeStore();
  const q = fakeQui();
  return { store, q, pending: createPendingCrossSeed(store, q.qui) };
}

const fileOf = (p: CrossSeedPending | null) => p?.file.base64;

describe('pin', () => {
  test('a late pin for A keeps B and reports a stale picker', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<CrossSeedProposals>('proposals');
    const pin = pending.pin(a.id, 'hh');
    await flush();
    await pending.prepare(source('B'));
    reply.resolve(match('hh'));
    await expect(pin).rejects.toThrow(STALE_PICKER);
    expect(fileOf(store.value)).toBe('B');
  });

  test('a current pin stores the new proposals', async () => {
    const { store, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const result = await pending.pin(a.id, 'hh');
    expect(result.proposals[0]?.hash).toBe('hh');
    expect(store.value?.match.proposals[0]?.hash).toBe('hh');
  });

  test('a stale pin sends no request to qui', async () => {
    const { q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    await pending.prepare(source('B'));
    q.calls.length = 0;
    await expect(pending.pin(a.id, 'hh')).rejects.toThrow(STALE_PICKER);
    expect(q.calls).toEqual([]);
  });
});

describe('apply', () => {
  test('a late single-target apply for A reports success and keeps B', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<void>('apply');
    const apply = pending.apply(a.id, { targetHashes: ['aa'], tags: [] });
    await flush();
    await pending.prepare(source('B'));
    reply.resolve();
    expect(await apply).toEqual({ summary: 'Added to qbt as cross-seed of aa' });
    expect(fileOf(store.value)).toBe('B');
  });

  test('a late assemble for A reports success and keeps B', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<AssembleResult>('assemble');
    const apply = pending.apply(a.id, { targetHashes: ['aa', 'bb'], tags: [] });
    await flush();
    await pending.prepare(source('B'));
    reply.resolve(assembleResult({ applied: true }));
    expect(await apply).toEqual({ summary: 'Assembled 2 of 2 episodes in qbt' });
    expect(fileOf(store.value)).toBe('B');
  });

  test('a current apply clears the slot', async () => {
    const { store, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    await pending.apply(a.id, { targetHashes: ['aa'], tags: [] });
    expect(store.value).toBeNull();
  });

  test('a stale apply sends no request to qui', async () => {
    const { q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    await pending.prepare(source('B'));
    q.calls.length = 0;
    await expect(pending.apply(a.id, { targetHashes: ['aa'], tags: [] })).rejects.toThrow(STALE_PICKER);
    await expect(pending.apply(a.id, { targetHashes: ['aa', 'bb'], tags: [] })).rejects.toThrow(STALE_PICKER);
    expect(q.calls).toEqual([]);
  });

  test('a failed apply keeps its own payload when it is still current', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    q.hold<void>('apply').reject(new Error('qui said no'));
    await expect(pending.apply(a.id, { targetHashes: ['aa'], tags: [] })).rejects.toThrow('qui said no');
    expect(store.value?.id).toBe(a.id);
  });

  test('a failed apply for A keeps B', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<void>('apply');
    const apply = pending.apply(a.id, { targetHashes: ['aa'], tags: [] });
    await flush();
    await pending.prepare(source('B'));
    reply.reject(new Error('qui said no'));
    await expect(apply).rejects.toThrow('qui said no');
    expect(fileOf(store.value)).toBe('B');
  });
});

describe('prepare', () => {
  for (const order of ['A first', 'B first'] as const) {
    test(`only B publishes when A and B finish with ${order}`, async () => {
      const { store, q, pending } = setup();
      const replyA = q.hold<CrossSeedProposals>('proposals');
      const a = pending.prepare(source('A'));
      await flush();
      const replyB = q.hold<CrossSeedProposals>('proposals');
      const b = pending.prepare(source('B'));
      await flush();
      if (order === 'A first') {
        replyA.resolve(match());
        replyB.resolve(match());
      } else {
        replyB.resolve(match());
        replyA.resolve(match());
      }
      expect(await a).toBeNull();
      expect(fileOf(await b)).toBe('B');
      expect(fileOf(store.value)).toBe('B');
    });
  }

  test('a failed B leaves no payload, and A stays invalidated', async () => {
    const { store, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    await expect(pending.prepare(async () => {
      throw new Error('cannot read page');
    })).rejects.toThrow('cannot read page');
    expect(store.value).toBeNull();
    await expect(pending.read(a.id)).rejects.toThrow(STALE_PICKER);
  });

  test('a late A cannot publish after B failed', async () => {
    const { store, q, pending } = setup();
    const replyA = q.hold<CrossSeedProposals>('proposals');
    const a = pending.prepare(source('A'));
    await flush();
    await expect(pending.prepare(async () => {
      throw new Error('cannot read page');
    })).rejects.toThrow('cannot read page');
    replyA.resolve(match());
    expect(await a).toBeNull();
    expect(store.value).toBeNull();
  });

  test('a superseded prepare returns null when its proposals fail', async () => {
    const { q, pending } = setup();
    const replyA = q.hold<CrossSeedProposals>('proposals');
    const a = pending.prepare(source('A'));
    await flush();
    await pending.prepare(source('B'));
    replyA.reject(new Error('qui down'));
    expect(await a).toBeNull();
  });

  test('a superseded prepare returns null when its source load fails', async () => {
    const { pending } = setup();
    const load = deferred<never>();
    const a = pending.prepare(() => load.promise);
    await pending.prepare(source('B'));
    load.reject(new Error('cannot read page'));
    expect(await a).toBeNull();
  });
});

describe('storage failure', () => {
  test('a failed write reports its error, and later requests still run', async () => {
    const { store, pending } = setup();
    store.failWrite();
    await expect(pending.prepare(source('A'))).rejects.toThrow('storage write failed');
    const b = (await pending.prepare(source('B')))!;
    expect(fileOf(await pending.read(b.id))).toBe('B');
  });
});

describe('read', () => {
  test('a picker opened for A cannot adopt B', async () => {
    const { pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const b = (await pending.prepare(source('B')))!;
    await expect(pending.read(a.id)).rejects.toThrow(STALE_PICKER);
    expect(fileOf(await pending.read(b.id))).toBe('B');
  });
});

describe('check', () => {
  test('a late check for A reports a stale picker', async () => {
    const { q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<AssembleResult>('check');
    const check = pending.check(a.id, ['aa', 'bb']);
    await flush();
    await pending.prepare(source('B'));
    reply.resolve(assembleResult());
    await expect(check).rejects.toThrow(STALE_PICKER);
  });
});

describe('storage interleaving', () => {
  test('B published during the read of a pin commit survives', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<CrossSeedProposals>('proposals');
    const pin = pending.pin(a.id, 'hh');
    await flush();
    const release = store.holdRead();
    reply.resolve(match('hh'));
    await flush();
    const b = pending.prepare(source('B'));
    await flush();
    release();
    await Promise.allSettled([pin, b]);
    expect(fileOf(store.value)).toBe('B');
  });

  test('B published during the read of an apply commit survives', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(source('A')))!;
    const reply = q.hold<void>('apply');
    const apply = pending.apply(a.id, { targetHashes: ['aa'], tags: [] });
    await flush();
    const release = store.holdRead();
    reply.resolve();
    await flush();
    const b = pending.prepare(source('B'));
    await flush();
    release();
    await Promise.allSettled([apply, b]);
    expect(fileOf(store.value)).toBe('B');
  });
});
