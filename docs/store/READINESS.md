# v0.7.66 beta readiness

Prepared October 18, 2026. This is a submission candidate, not Store approval or funded-execution certification.

Verified:

- 367 automated tests and production build.
- A fresh-profile real-extension test: explicit checkbox/acknowledgement, no pre-agreement native entry or ticket preparation, exact native Close still available during setup, one simulated entry and one simulated close.
- Plaintext legacy records migrate to AES-256-GCM; actual IndexedDB key and encrypted records survive two complete test-browser restarts in the same profile. No saved-entry replay; acknowledgement survives.
- Missing key, tampering, wrong record category, oversized records and failed migration/save regressions preserve records and fail closed.
- Actual two-copy extension test: one entry owner, standby blocked, final entry check after native preparation, and exact simulated Close preserved.
- Source component layout regression at 220px, 340px and 700px; long messages remain scrollable.
- Signed-out public-page captures provided at 1280×800. No signed-in account screenshot is part of the listing assets.

Packaged icons: 16/32/48/128 PNG. Listing assets: store icon, two signed-out screenshots, and 440×280 small promotional tile. Source SVG is in extension/icons.

Outstanding owner/reviewer steps:

- Confirm public publisher contact details and the account's legal trader declaration in Google's dashboard.
- Review data-use and permission declarations against the current privacy policy; review the unlisted/restricted distribution choice.
- Complete owner-operated funded validation in VALIDATION.md before wider distribution. Automated and simulated tests do not verify real wallet prompts, relayer fills, settlement, or profitability.
- Submit only after reviewing the upload and final Google certifications. Paying the developer fee does not establish approval.

The local upload ZIP is generated with `npm run release`; confirm its SHA256 against the release report. Installing it as a new Store identity does not migrate storage from an unpacked copy.
