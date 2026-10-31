import { describe, expect, test } from 'bun:test';
import type { CrossSeedProposals } from '../lib/api';
import type { CrossSeedPending, OneTimePathPending } from '../lib/storage';
import { createPendingCrossSeed, STALE_PICKER, type QuiCrossSeed } from '../lib/pending-cross-seed';
import { createPendingOneTimePath, STALE_WINDOW } from '../lib/pending-one-time-path';
import { createRequestHandlers, handleRequest, type RequestDeps } from '../lib/requests';

const match: CrossSeedProposals = {
  pack_mode: false,
  assembly_unavailable_reason: '',
  source_name: 'src',
  source_size: 1,
  source_file_count: 1,
  default_tags: [],
  pinned_category: '',
  proposals: [{ hash: 'aa', name: 'Target', size: 1, category: 'tv', overlap_fraction: 1 }],
};

function unused(): never {
  throw new Error('not used in this test');
}

function qui(over: Partial<RequestDeps['qui']> = {}): RequestDeps['qui'] {
  return {
    getInstances: unused,
    searchTorrents: unused,
    getTorrentsByHash: unused,
    supportsPathAutocomplete: unused,
    listDirectories: unused,
    ...over,
  };
}

/** Session storage stand-in for one pending slot. */
function memoryStore<T>() {
  let value: T | null = null;
  return {
    getValue: async () => value,
    setValue: async (next: T) => {
      value = next;
    },
    removeValue: async () => {
      value = null;
    },
  };
}

const file = { base64: '', contentType: 'application/x-bittorrent' };

/** A real cross-seed slot over fake qui calls, with one picker already open. */
async function openPicker(apply: QuiCrossSeed['apply']) {
  const crossSeed = createPendingCrossSeed(memoryStore<CrossSeedPending>(), {
    proposals: async () => match,
    apply,
    check: unused,
    assemble: unused,
  });
  const picker = await crossSeed.prepare(async () => ({ instanceId: '1', instanceName: 'First', file }));
  return { crossSeed, pendingId: picker!.id };
}

/** Fake qui and pending slots. Each test overrides the calls that it needs. */
function setup(over: Partial<RequestDeps> = {}) {
  const notices: [string, string][] = [];
  const deps: RequestDeps = {
    qui: qui(),
    crossSeed: { prepare: unused, read: unused, pin: unused, check: unused, apply: unused },
    oneTimePath: { prepare: unused, read: unused, apply: unused },
    refresh: unused,
    notify: (title, message) => notices.push([title, message]),
    ...over,
  };
  return { handlers: createRequestHandlers(deps), notices };
}

describe('handleRequest', () => {
  test('sends the folder request of the "Other path…" window to qui', async () => {
    const calls: [string, string][] = [];
    const { handlers } = setup({
      qui: qui({
        listDirectories: async (instanceId, dirPath) => {
          calls.push([instanceId, dirPath]);
          return ['/data/films', '/data/tv'];
        },
      }),
    });

    const response = await handleRequest(handlers, { type: 'list-directories', instanceId: '1', dirPath: '/data/' });

    expect(response).toEqual({ success: true, data: ['/data/films', '/data/tv'] });
    expect(calls).toEqual([['1', '/data/']]);
  });

  test('answers an unknown request with an error', async () => {
    const { handlers } = setup();

    for (const message of [{ type: 'get-cached-data' }, { type: 'toString' }, {}, null]) {
      expect(await handleRequest(handlers, message)).toEqual({
        success: false,
        error: { kind: 'other', message: 'Unknown message type' },
      });
    }
  });

  test('marks a stale picker as stale and shows no failure notice', async () => {
    const { crossSeed } = await openPicker(unused);
    const { handlers, notices } = setup({ crossSeed });

    const response = await handleRequest(handlers, {
      type: 'apply-cross-seed', pendingId: 'old-picker', targetHashes: ['aa'], tags: [],
    });

    expect(response).toEqual({ success: false, error: { kind: 'stale', message: STALE_PICKER } });
    expect(notices).toEqual([]);
  });

  test('reports a failed cross-seed apply in the picker and in a notice', async () => {
    const { crossSeed, pendingId } = await openPicker(async () => {
      throw new Error('qui says no');
    });
    const { handlers, notices } = setup({ crossSeed });

    const response = await handleRequest(handlers, {
      type: 'apply-cross-seed', pendingId, targetHashes: ['aa'], tags: [],
    });

    expect(response).toEqual({ success: false, error: { kind: 'other', message: 'qui says no' } });
    expect(notices).toEqual([['Failed to Add Cross-seed', 'qui says no']]);
  });

  test('marks an out-of-date "Other path…" window as stale', async () => {
    const oneTimePath = createPendingOneTimePath(memoryStore<OneTimePathPending>(), {
      addMagnet: unused,
      addFile: unused,
      settings: unused,
    });
    const { handlers } = setup({ oneTimePath });

    expect(await handleRequest(handlers, { type: 'read-one-time-path', pendingId: 'old-window' })).toEqual({
      success: false,
      error: { kind: 'stale', message: STALE_WINDOW },
    });
  });

  test('adds a torrent to a one-time path and shows a success notice', async () => {
    const store = memoryStore<OneTimePathPending>();
    const added: string[] = [];
    const oneTimePath = createPendingOneTimePath(store, {
      addMagnet: async (_instanceId, url, _category, options) => {
        added.push(`${url} -> ${options?.savePath}`);
      },
      addFile: unused,
      settings: async () => ({ paused: false, skipChecking: false }),
    });
    const window = await oneTimePath.prepare(async () => ({
      instanceId: '1', instanceName: 'First', torrentName: 'film', torrent: 'magnet:?xt=urn:btih:aa',
    }));
    const { handlers, notices } = setup({ oneTimePath });

    const response = await handleRequest(handlers, {
      type: 'apply-one-time-path', pendingId: window!.id, category: '', savePath: '/data/films',
    });

    expect(response).toEqual({ success: true, data: undefined });
    expect(added).toEqual(['magnet:?xt=urn:btih:aa -> /data/films']);
    expect(notices).toEqual([['Torrent Added', 'Added to First / /data/films']]);
  });
});

