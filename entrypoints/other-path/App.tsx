import { useEffect, useState, type FormEvent } from 'react';
import { Box, Button, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { browser } from 'wxt/browser';
import { listDirectories, supportsPathAutocomplete } from '@/lib/api';
import { sendToBackground } from '@/lib/messaging';
import { isFullPath, matchingFolders, suggestStep } from '@/lib/one-time-path';
import { cachedData, type OneTimePathPending } from '@/lib/storage';

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export default function App() {
  const [pending, setPending] = useState<OneTimePathPending | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [path, setPath] = useState('');
  const [autocomplete, setAutocomplete] = useState(false);
  // The last folder listed and its subfolders, so typing inside one folder sends no new request.
  const [listed, setListed] = useState<{ dir: string; paths: string[] }>({ dir: '', paths: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      // The id in the URL binds this window to the right-click that opened it.
      const pendingId = new URLSearchParams(location.search).get('id') ?? '';
      try {
        const [p, cache] = await Promise.all([
          sendToBackground<OneTimePathPending>({ type: 'read-one-time-path', pendingId }),
          cachedData.getValue(),
        ]);
        setCategories((cache.categoriesByInstance[p.instanceId] ?? []).map((c) => c.name));
        setPending(p);
        // qBittorrent 4.x cannot list folders. Then the field stays a plain text field.
        supportsPathAutocomplete(p.instanceId).then(setAutocomplete, () => {});
      } catch (err) {
        setError(errorText(err));
      }
      setLoading(false);
    }
    load();
  }, []);

  const step = suggestStep(path.trim());
  const dir = step && isFullPath(step.dir) ? step.dir : '';

  // Debounced folder listing. A failure leaves the field without suggestions and never blocks Add.
  useEffect(() => {
    if (!pending || !autocomplete || !dir || dir === listed.dir) return;
    let stale = false;
    const timer = setTimeout(() => {
      listDirectories(pending.instanceId, dir)
        .then((paths) => !stale && setListed({ dir, paths }))
        .catch(() => {});
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [pending, autocomplete, dir, listed.dir]);

  const suggestions = step && dir === listed.dir ? matchingFolders(listed.paths, step.prefix) : [];
  const full = isFullPath(path);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!pending || !full) return;
    setBusy(true);
    setError('');
    try {
      await sendToBackground({ type: 'apply-one-time-path', pendingId: pending.id, category, savePath: path });
      const tab = await browser.tabs.getCurrent();
      if (tab?.id) await browser.tabs.remove(tab.id);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (loading) {
    return <Text size="2" style={{ color: 'var(--color-muted)', padding: 24, display: 'block' }}>Loading...</Text>;
  }

  if (!pending) {
    return (
      <Box p="6">
        <Text size="2" style={{ color: 'var(--color-muted)' }}>
          {error || 'Nothing to add. Right-click a torrent link and pick Other path….'}
        </Text>
      </Box>
    );
  }

  return (
    <Box p="6" style={{ color: 'var(--color-text)' }}>
      <Heading size="5" mb="1">Add to {pending.instanceName}</Heading>
      <Text size="2" style={{ color: 'var(--color-muted)', wordBreak: 'break-all' }}>
        {pending.torrentName || 'Unnamed torrent'}
      </Text>

      <form onSubmit={add}>
        <Flex direction="column" gap="4" mt="6">
          <label>
            <Text as="div" size="2" weight="medium" mb="1">Save path</Text>
            <TextField.Root
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/data/films or D:\Films"
              list="folders"
              autoFocus
              spellCheck={false}
            />
            <datalist id="folders">
              {suggestions.map((p) => <option key={p} value={p} />)}
            </datalist>
            {path && !full && (
              <Text as="div" size="1" mt="1" style={{ color: 'var(--color-muted)' }}>
                Type a full path, for example /data/films or D:\Films.
              </Text>
            )}
          </label>
          <label>
            <Text as="div" size="2" weight="medium" mb="1">Category</Text>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
              }}
            >
              <option value="">(No category)</option>
              {categories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </Flex>

        <Flex justify="end" mt="6">
          <Button type="submit" disabled={busy || !full} loading={busy}>Add</Button>
        </Flex>
      </form>

      {error && (
        <Text as="p" size="2" color="red" mt="3">{error}</Text>
      )}
    </Box>
  );
}
