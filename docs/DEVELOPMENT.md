# Developer notes

For installing and using the extension, start with the [README](../README.md).

## Develop

Requires Node.js 22 or newer and npm. From this repository:

```sh
git clone https://github.com/maxlongartist/papertrade-extension.git
cd papertrade-extension
npm ci
npm test
npm run build
```

Load the generated `dist/` folder in Chrome using the installation guide. `extension/` contains source modules; it is not the unpacked build. The build requires no wallet credentials.

For later source updates, run `git pull --ff-only`, `npm ci`, and `npm run build` from the same clone, then Reload the existing Chrome extension and refresh Papertrade. Keep the same installed folder/identity.

For the local simulated UI:

```sh
npm run preview
```

Open `http://127.0.0.1:4320/trade/btc?scenario=pair`. This fixture uses simulated native positions/actions. Some public market/queue reads may use the network.

Optional browser checks require a local Playwright installation and Chrome for Testing:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE=/absolute/path/to/chrome \
npm run verify:layout-stability
```

Other `verify:*` commands are listed in `package.json`. Some inspect public signed-out venue pages in temporary profiles; these are not funded execution certification. Historical implementation and verification details are in [development history](https://github.com/maxlongartist/papertrade-extension/blob/main/docs/DEVELOPMENT-HISTORY.md).

`npm run release` builds, runs the suite, and creates a ZIP with `manifest.json` at its root. It writes versioned packages beside the repository and in `~/Downloads`, plus a ZIP-only latest alias. Existing versioned packages are immutable; increment the version in `package.json`, `package-lock.json`, and `extension/manifest.json` before changing a released payload. It does not overwrite installed extension folders or read bot credentials.

## GitHub username changes

This repository uses `maxlongartist/papertrade-extension`. For an existing clone with an outdated URL:

```sh
git remote -v
git remote set-url origin https://github.com/maxlongartist/papertrade-extension.git
git remote -v
```

Changing a remote URL does not rewrite commit history. See [GitHub's remote-management guide](https://docs.github.com/en/get-started/git-basics/managing-remote-repositories).
