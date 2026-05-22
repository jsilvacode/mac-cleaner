# macOS Signing and Notarization Checklist

## 1) Apple Prerequisites

- Active Apple Developer Program membership.
- Developer ID Application certificate available in Keychain.
- Team ID documented and accessible to the release owner.
- Production bundle identifier confirmed.

## 2) Release Readiness

- App name and version aligned across project metadata.
- Public release notes prepared.
- Release validation summary completed.
- No development-only credentials or secrets included in the repository.

## 3) Build And Sign

- Create the production macOS build.
- Sign the app with the Developer ID certificate.
- Verify the app signature.
- Archive signing output for the release record.

## 4) Notarization

- Submit the signed artifact to Apple notarization.
- Wait for notarization success.
- Archive notarization output for the release record.

## 5) Stapling And Gatekeeper

- Staple the notarization ticket to the app.
- Validate the stapled artifact.
- Run Gatekeeper assessment.

## 6) Release Verification

- Install on a clean supported macOS environment.
- Launch the app without developer overrides.
- Review the core product flows:
  - guided cleanup review
  - space review
  - activity history
  - preferences
  - guided app removal
- Capture final release notes and validation summary.

## 7) Operational Safeguards

- Keep signing credentials outside the repository.
- Restrict release credentials to approved maintainers.
- Require explicit approval before public distribution.
- Track certificate expiration dates.

## 8) Post-Release

- Publish artifact metadata and checksum.
- Monitor support feedback and crash reports.
- Schedule follow-up validation for the next release.
