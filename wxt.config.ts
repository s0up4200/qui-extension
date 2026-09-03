import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'qui',
    description: 'Add torrents to qBittorrent instances managed by qui — right-click any magnet or torrent link to send it directly.',
    permissions: ['storage', 'contextMenus', 'notifications', 'alarms', 'activeTab', 'scripting'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    browser_specific_settings: {
      gecko: {
        id: 'qui@s0up4200',
        // optional_host_permissions needs Firefox 128.
        strict_min_version: '128.0',
        data_collection_permissions: {
          required: ['none'],
          optional: [],
        },
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
