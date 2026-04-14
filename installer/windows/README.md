# Windows 11 Native Installer Prep (Do Not Compile Yet)

This folder contains the prepared scaffold for a custom NSIS-based Windows installer wizard for **KDP E-Book Generator**.

## Current Status

Prepared:
- Custom wizard script: `KDPEBookGeneratorInstaller.nsi`
- Real release payload wiring for `src-tauri/target/release` output
- All-users desktop/start-menu shortcut creation
- Shared custom icon path for installed shortcuts
- Legal/TOS pages:
  - `legal/EULA_MAIN_TOS.txt`
  - `legal/BETA_HOLD_HARMLESS_ADDENDUM.txt`
  - `legal/THIRD_PARTY_AND_AI_USE_NOTICE.txt`
- Prerequisite bootstrap simulation script:
  - `scripts/preinstall-check-and-bootstrap.ps1`
- Latest release metadata helper:
  - `scripts/check-latest-release.ps1`
- Branding generation pipeline:
  - `../../scripts/generate-branding-assets.mjs`
  - source assets in `../../assets/branding/`

Not yet executed by design:
- Installer compilation (`makensis`) — deferred until explicit approval/order.

## Wizard Flow Implemented

1. Welcome
2. Main EULA/TOS acceptance
3. Beta hold-harmless acceptance
4. Third-party + AI responsibility notice acceptance
5. Component selection:
   - Core files
  - Desktop shortcut
  - Start menu shortcut
   - Runtime prerequisite bootstrap (optional)
6. Install directory selection (defaults to Program Files)
7. Simulated resource check page (prep behavior)
8. Install files page
9. Completion page with optional Name/Email capture and official links:
   - GitHub: https://github.com/Blacklisted-Binary
   - Website: https://www.blacklistedbinary.com
   - Credit: Rob Branting, BBLabs Founding Member

## Update Hook Plan

Use `scripts/check-latest-release.ps1` to query:
- https://github.com/crazyrob425/KDP-E-Book-Generator/releases/latest

This script is intended for installer and app-update plumbing so future versions can check and pull latest release metadata from the official GitHub release endpoint.

## To Use the Official Logo Provided by User

Because direct `github.com/user-attachments/assets/...` links are returning 404 from this runtime, place the official logo file manually at:

- `../../assets/branding/logo_source.png`

Then run:

```bash
node ../../scripts/generate-branding-assets.mjs
```

This regenerates:
- `../../src-tauri/icons/icon.ico`
- `../../src-tauri/icons/icon.png`
- `../../installer/windows/assets/installer-icon.ico`
- `../../installer/windows/assets/installer-splash.png`
- `../../assets/branding/official-logo.png`

## Compile Later (When Ordered)

Do **not** run this yet. When approved:

```powershell
cd installer/windows
makensis KDPEBookGeneratorInstaller.nsi
```

Before compile, make sure the Tauri release output exists at `src-tauri/target/release/` so the installer can package the real app payload.
