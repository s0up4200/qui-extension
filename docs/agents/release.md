# Release

`bun run zip` and `bun run zip:firefox` write `qui-<version>-chrome.zip`, `qui-<version>-firefox.zip`, and `qui-<version>-sources.zip` to `.output/`.

## Steps

1. Date the `Unreleased` heading in `CHANGELOG.md` and set `version` in `package.json`. Commit as `chore: bump version to X.Y.Z` on `main`.
2. Tag and push:
   ```bash
   git tag -s vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
   ```
   CI builds the zips and attaches them to the GitHub release. Done when `gh release view vX.Y.Z --json assets` lists all three zips.
3. Upload to the stores:
   ```bash
   bun run submit
   ```
   Done when the output shows a green check for both `Chrome Web Store` and `Firefox Addon Store`.

## `.env.submit`

`wxt submit` is an alias for `publish-browser-extension`. It reads `.env.submit` in the repo root. Git ignores that file. `wxt submit init` fails with a `chrome.clientId` validation error before it asks a question, so write the file by hand:

```
CHROME_API_VERSION=v2
CHROME_EXTENSION_ID=kbjnjgihepmcoilegnghgpmijbecoili
CHROME_PUBLISHER_ID=bcd35b14-3115-4018-9df4-797a980244ac
CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL=<client_email from the service account JSON key>
CHROME_SERVICE_ACCOUNT_PRIVATE_KEY="<private_key from the JSON key, one line, \n escapes>"
FIREFOX_EXTENSION_ID=qui@s0up4200
FIREFOX_JWT_ISSUER=user:<digits>:<digits>
FIREFOX_JWT_SECRET=<secret>
```

Chrome uses API v2. The service account lives in a Google Cloud project with the Chrome Web Store API enabled, and its email is listed in the Developer Dashboard under Publisher, Settings, Service account. The publisher ID is on the same page.

Firefox keys come from https://addons.mozilla.org/developers/addon/api/key/. Generating a new key replaces the old one, so update `.env.submit` at the same time.

## Store errors

- Chrome `INVALID_ITEM_METADATA` at "Submitting for review": the zip is uploaded as a draft, and the store listing is incomplete. Complete the listing in the Developer Dashboard (permission justifications, publisher address) and submit for review there.
- Firefox `Unknown JWT iss (issuer)`: the issuer value is malformed. The format is `user:<digits>:<digits>`.
