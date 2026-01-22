import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'qui',
    description: 'Add torrents to qBittorrent instances managed by qui — right-click any magnet or torrent link to send it directly.',
    permissions: ['storage', 'contextMenus', 'notifications', 'alarms'],
    optional_host_permissions: ['*://*/*'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
