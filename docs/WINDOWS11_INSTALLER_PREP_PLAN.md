# Windows 11 Installer Prep Plan (Prepared, Not Compiled)

## Objective
Prepare a custom Windows 11 native install wizard flow with legal gating, optional shortcuts, prerequisite checks, update readiness, and post-install user opt-in details.

## Completed Prep Items

- Added legal agreement set for install-time acceptance:
  - Main EULA/TOS
  - Beta hold-harmless addendum
  - Third-party terms + AI output responsibility notice
- Added installer scaffold script (`installer/windows/KDPEBookGeneratorInstaller.nsi`) including:
  - Program Files default install path
  - Optional install directory change
  - Required legal acceptance pages
  - Optional desktop/start-menu shortcut components
  - Simulated compatibility checks
  - Optional final Name/Email capture
  - Official links and credits
- Added update metadata helper script against official latest release endpoint.
- Added branding generation pipeline for app icon/logo/splash assets.

## Deferred Until Explicit Compile Order

- Final installer payload wiring (real app binaries)
- NSIS compile command execution
- Signing and release packaging

## Requirement Installer Coverage Matrix

| Requirement | Status |
|---|---|
| TOS acceptance required to continue | Implemented in scripted license pages |
| Separate Beta hold harmless notice | Implemented |
| Third-party TOS responsibility disclosure | Implemented |
| AI can make mistakes warning | Implemented |
| Program Files default + optional custom dir | Implemented |
| Desktop/start-menu toggles | Implemented as optional sections |
| Resource check simulation | Implemented (pass-profile simulation) |
| Final page Name/Email + links + credits | Implemented |
| Official GitHub update source prep | Implemented helper script |
| Compile deferred until explicit order | Enforced by process/doc |

## Logo Asset Constraint

The runtime cannot directly fetch `github.com/user-attachments/assets/...` URLs (404 from this environment).
To finalize the official user-provided logo, place the file at:

`assets/branding/logo_source.png`

Then regenerate assets:

`node scripts/generate-branding-assets.mjs`
