# macOS Signing and Notarization Checklist

## 1) Apple prerequisites

- Active Apple Developer Program membership.
- `Developer ID Application` certificate available in Keychain.
- Team ID documented and accessible.
- App bundle identifier fixed and unique.

## 2) Project readiness

- `tauri.conf.json` identifier verified for production.
- App name and version aligned across package metadata.
- No debug-only permissions shipped in release artifacts.
- Public release notes prepared.

## 3) Build and sign

- Build production app using `npm run tauri:build`.
- Ensure artifacts are signed with Developer ID certificate.
- Verify signature with `codesign --verify --deep --strict --verbose=2 <AppPath>`.
- Inspect signing details with `codesign -dv --verbose=4 <AppPath>`.

## 4) Notarization submission

- Create App Store Connect API key or app-specific notarization credentials.
- Submit artifact with `xcrun notarytool submit`.
- Wait for notarization success status.
- Keep notarization log output archived.

## 5) Stapling

- Staple notarization ticket to app with `xcrun stapler staple <AppPath>`.
- Validate staple with `xcrun stapler validate <AppPath>`.
- Perform Gatekeeper assessment: `spctl --assess --type execute --verbose <AppPath>`.

## 6) Release verification

- Clean-machine install test on supported macOS version.
- First-launch test without developer overrides.
- Core actions smoke test:
  - scan
  - dry-run
  - clean confirmation flow
  - large files
  - top dirs
  - activity filters
  - settings persistence
  - safe app uninstall review flow
  - dummy app uninstall to Trash
- Capture release QA report.
- Capture product screenshots for `Inicio`, `Actividad`, `Ajustes` and `Desinstalar`.

## 7) Operational safeguards

- Keep signing credentials outside repository.
- Rotate notarization secrets periodically.
- Restrict CI secret access to protected branches.
- Require release approval before production distribution.

## 8) Post-release

- Publish checksum and artifact metadata.
- Monitor user crash reports and execution logs.
- Schedule periodic certificate expiration checks.
