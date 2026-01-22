# Privacy Policy — qui

**Last updated:** January 23, 2026

## Overview

qui is a browser extension that adds torrents to qBittorrent instances via a user-configured qui server. This policy describes how the extension handles your data.

## Data Storage

All data is stored locally on your device using the browser's local storage API. This includes:

- Your qui server URL and API key
- Cached instance and category data from your qui server
- Your favorites and preferences

No data is synced to the cloud or stored on any external server controlled by us.

## Network Communication

The extension communicates exclusively with the qui server URL you configure. No data is sent to the extension developer or any third party.

When you add a torrent, the magnet link or torrent URL is sent to your configured qui server along with your API key for authentication. This only happens when you explicitly choose to add a torrent via the context menu or popup.

## Data Collection

This extension does **not**:

- Collect or transmit browsing history
- Use analytics, telemetry, or tracking of any kind
- Send error reports or crash data to external services
- Collect personal information
- Share any data with third parties

## Permissions

- **Storage**: Save your configuration and cached data locally
- **Context Menus**: Provide right-click menu for adding torrents
- **Notifications**: Display success/error feedback after adding a torrent
- **Alarms**: Periodically refresh cached instance data
- **Host Permissions** (optional): Communicate with your qui server at the URL you specify

## Your Responsibility

You are responsible for keeping your qui server URL and API key confidential. The extension stores these locally and transmits the API key only to the server you configure.

## Changes

If this policy changes, the updated version will be published with the extension update.

## Contact

If you have questions about this policy, open an issue at [github.com/soup/qui-extension](https://github.com/soup/qui-extension).
