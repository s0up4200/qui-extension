import { describe, expect, test } from 'bun:test';
import type { AddTorrentOptions } from '../lib/api';
import type { TorrentFileData } from '../lib/messaging';
import type { OneTimePathPending } from '../lib/storage';
import { createPendingOneTimePath, STALE_WINDOW, type OneTimePathSource } from '../lib/pending-one-time-path';

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

function fakeStore() {
  let value: OneTimePathPending | null = null;
  return {
    get value() {
      return value;
    },
    async getValue() {
      return value;
    },
    async setValue(v: OneTimePathPending) {
      value = v;
    },
    async removeValue() {
      value = null;
    },
  };
}

type Call = { kind: 'magnet' | 'file'; instanceId: string; torrent: string | TorrentFileData; category: string; options?: AddTorrentOptions };

/** qui stand-in. hold() makes the next add wait for the test to settle it. */
function fakeQui(settings = { paused: false, skipChecking: false }) {
  const calls: Call[] = [];
  let held: Deferred<unknown> | null = null;
  function add(call: Call) {
    calls.push(call);
    const d = held;
    held = null;
    return d ? d.promise : Promise.resolve({});
  }
  return {
    calls,
    hold() {
      held = deferred<unknown>();
      return held;
    },
    qui: {
      addMagnet: async (instanceId: string, torrent: string, category: string, options?: AddTorrentOptions) =>
        add({ kind: 'magnet', instanceId, torrent, category, options }),
      addFile: async (instanceId: string, torrent: TorrentFileData, category: string, options?: AddTorrentOptions) =>
        add({ kind: 'file', instanceId, torrent, category, options }),
      settings: async () => settings,
    },
  };
}

const magnet = (name: string) => async (): Promise<OneTimePathSource> => ({
  instanceId: '1', instanceName: 'qbt', torrentName: name, torrent: `magnet:?dn=${name}`,
});

function setup(settings?: { paused: boolean; skipChecking: boolean }) {
  const store = fakeStore();
  const q = fakeQui(settings);
  return { store, q, pending: createPendingOneTimePath(store, q.qui) };
}

describe('prepare', () => {
  test('a newer right-click makes the older window stale', async () => {
    const { pending } = setup();
    const a = (await pending.prepare(magnet('A')))!;
    const b = (await pending.prepare(magnet('B')))!;
    await expect(pending.read(a.id)).rejects.toThrow(STALE_WINDOW);
    expect((await pending.read(b.id)).torrentName).toBe('B');
  });

  test('a late load for A does not overwrite B', async () => {
    const { store, pending } = setup();
    const load = deferred<OneTimePathSource>();
    const a = pending.prepare(() => load.promise);
    await flush();
    await pending.prepare(magnet('B'));
    load.resolve(await magnet('A')());
    expect(await a).toBeNull();
    expect(store.value?.torrentName).toBe('B');
  });

  test('a late failed load for A does not remove B', async () => {
    const { store, pending } = setup();
    const load = deferred<OneTimePathSource>();
    const a = pending.prepare(() => load.promise);
    await flush();
    await pending.prepare(magnet('B'));
    load.reject(new Error('cannot read page'));
    expect(await a).toBeNull();
    expect(store.value?.torrentName).toBe('B');
  });
});

describe('apply', () => {
  test('sends the category, the path, and the paused and recheck settings', async () => {
    const { q, pending } = setup({ paused: true, skipChecking: true });
    const a = (await pending.prepare(magnet('A')))!;
    expect(await pending.apply(a.id, { category: 'films', savePath: ' D:\\Old films ' })).toEqual({
      summary: 'Added to qbt / D:\\Old films',
    });
    expect(q.calls).toEqual([{
      kind: 'magnet', instanceId: '1', torrent: 'magnet:?dn=A', category: 'films',
      options: { paused: true, skipChecking: true, savePath: 'D:\\Old films' },
    }]);
  });

  test('a .torrent file goes to the file upload', async () => {
    const { q, pending } = setup();
    const file = { base64: 'ZA==', contentType: 'application/x-bittorrent' };
    const a = (await pending.prepare(async () => ({ instanceId: '2', instanceName: 'qbt', torrentName: 'F', torrent: file })))!;
    await pending.apply(a.id, { category: '', savePath: '/data' });
    expect(q.calls).toEqual([{
      kind: 'file', instanceId: '2', torrent: file, category: '',
      options: { paused: false, skipChecking: false, savePath: '/data' },
    }]);
  });

  test('a successful apply clears the slot', async () => {
    const { store, pending } = setup();
    const a = (await pending.prepare(magnet('A')))!;
    await pending.apply(a.id, { category: '', savePath: '/data' });
    expect(store.value).toBeNull();
  });

  test('a failed apply keeps the slot, and a retry succeeds', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(magnet('A')))!;
    q.hold().reject(new Error('qui said no'));
    await expect(pending.apply(a.id, { category: '', savePath: '/nope' })).rejects.toThrow('qui said no');
    expect(store.value?.id).toBe(a.id);
    await pending.apply(a.id, { category: '', savePath: '/data' });
    expect(store.value).toBeNull();
    expect(q.calls.map((c) => c.options?.savePath)).toEqual(['/nope', '/data']);
  });

  test('a stale window adds nothing', async () => {
    const { q, pending } = setup();
    const a = (await pending.prepare(magnet('A')))!;
    await pending.prepare(magnet('B'));
    await expect(pending.apply(a.id, { category: '', savePath: '/data' })).rejects.toThrow(STALE_WINDOW);
    expect(q.calls).toEqual([]);
  });

  test('a late apply for A reports success and keeps B', async () => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(magnet('A')))!;
    const reply = q.hold();
    const apply = pending.apply(a.id, { category: '', savePath: '/data' });
    await flush();
    await pending.prepare(magnet('B'));
    reply.resolve({});
    expect(await apply).toEqual({ summary: 'Added to qbt / /data' });
    expect(store.value?.torrentName).toBe('B');
  });

  test.each(['old-films', '   '])('a path that is not full (%p) adds nothing', async (savePath) => {
    const { store, q, pending } = setup();
    const a = (await pending.prepare(magnet('A')))!;
    await expect(pending.apply(a.id, { category: '', savePath })).rejects.toThrow('full path');
    expect(q.calls).toEqual([]);
    expect(store.value?.id).toBe(a.id);
  });
});
