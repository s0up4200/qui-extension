# Modifier-key actions in the context menu

The extension does not change what a context-menu item does when the user
holds a modifier key (Shift, Ctrl, Alt) while they click it.

## Why this is out of scope

The extension ships to Chrome and Firefox from one code base, and every
feature must work the same in both.

Chrome does not tell an extension which modifier keys were held when a
context-menu item was clicked. `chrome.contextMenus.OnClickData` carries
`menuItemId`, `linkUrl`, `frameId`, `checked` and similar fields, but no
modifier or mouse-button field. Firefox does expose `modifiers` on its
`menus.OnClickData`, so a Firefox-only version is a few lines. A feature
that works in one browser and silently does nothing in the other is not
acceptable.

The only way to get modifier state in Chrome is a content script on every
page that records `event.shiftKey` from the `contextmenu` event. That needs
the `<all_urls>` host permission. The extension deliberately asks only for
the qui server origin through `optional_host_permissions` and uses
`activeTab` for the clicked tab. A blanket host permission is a large
install warning and a real privacy cost, for a shortcut. It also changes
the meaning of the shortcut: the browser reads the key at right-click
time, not when the user clicks the item.

```ts
// entrypoints/background.ts: every option comes from storage, not from the click.
async function getTorrentOptions(): Promise<AddTorrentOptions> {
  const [paused, skipChecking] = await Promise.all([
    addPaused.getValue(),
    skipRecheck.getValue(),
  ]);
  return { paused, skipChecking };
}
```

The supported way to add a torrent paused is the "Add as paused" switch on
the options page (`addPaused` in `lib/storage.ts`). It applies to every add
until it is turned off.

## Prior requests

- #37: "Feature: Add option to start torrents paused when modifier key is held"
