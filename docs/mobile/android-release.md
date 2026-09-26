# Android release

Issue: [#498](https://github.com/Ikey168/Modulo/issues/498). Workflow:
`.github/workflows/android-release.yml`. Architecture: [ADR 0009](../architecture/adr-0009-android-shared-frontend.md).

## Supported devices and servers

| | Requirement |
| --- | --- |
| Android | 8.0 (API 26) or newer; built for API 36 |
| Android System WebView / Chrome | 120 or newer (older WebViews are refused at start with an update prompt) |
| Screen | Phones and tablets, portrait and landscape; system font scaling up to 200% |
| Modulo server | HTTPS origin with the plugin-state API (storage generation), `/api/remote` for server-side services, and the Keycloak client registered with `com.modulo:/oauth2redirect` and `com.modulo:/logout` (`deploy/oci/render-realm.sh`) |

## One-time setup: the signing key

The release key is Modulo's identity on every device: Android only installs an
update signed with the same key. Losing it means users must uninstall (and lose
unsynchronized edits) to move to a new key.

1. Generate it once on a trusted machine, never on a CI runner:
   `keytool -genkeypair -v -keystore modulo-release.jks -alias modulo -keyalg RSA -keysize 4096 -validity 10000`.
2. Keep two offline, encrypted copies of the keystore and its passwords.
3. In GitHub, create the environment `android-release` with required reviewers,
   and add its secrets: `MODULO_ANDROID_KEYSTORE_BASE64` (`base64 -w0 modulo-release.jks`),
   `MODULO_ANDROID_KEYSTORE_PASSWORD`, `MODULO_ANDROID_KEY_ALIAS`, `MODULO_ANDROID_KEY_PASSWORD`.

The keystore is decoded into the runner's temporary directory for the build
step only and deleted afterwards (also on failure). Gradle reads it from
environment variables; nothing is echoed, and without the keystore the release
build stays unsigned rather than falling back to a debug key.

If the app is published on Google Play with Play App Signing, the key above
becomes the upload key; register it in Play Console before the first upload.

## Cutting a release

1. Make sure `main` is green, including the `frontend` phone gates and the
   `android-emulator` journeys.
2. Run **Android release** from the Actions tab with a semantic `version_name`,
   a `version_code` higher than every published build, and the previous
   release tag (blank for the first release).
3. The workflow runs the frontend checks, builds the signed APK and AAB,
   verifies the APK signature (v2/v3), writes `SHA256SUMS`, `provenance.json`
   (commit, run, versions, checksums) and a build provenance attestation, then
   on an emulator installs the previous release, leaves a pending offline edit,
   the replica identity and a Keystore credential, upgrades to the new build
   and checks that all three survived, followed by the packaged-app journeys.
4. It creates a **draft** GitHub release with the artifacts and the test
   evidence (screenshots, step report, logcat). Review, complete the
   real-device checklist below, and publish the draft manually. Uploading the
   AAB to a store is a separate, explicit action.

Verify a download with `sha256sum -c SHA256SUMS` and
`gh attestation verify modulo-<version>.apk --repo Ikey168/Modulo`.

## Real-device checklist (before publishing)

Record the device model, Android version, WebView version and build in the
release notes.

- [ ] Fresh install: server onboarding, sign-in through the browser, sign-out.
- [ ] Upgrade over the previous release with a pending offline edit; the edit
      synchronizes afterwards.
- [ ] TalkBack: navigate the drawer, a hub picker, a note and a record form;
      every control is announced with a name.
- [ ] Largest font and display size: no clipped controls on the dashboard,
      notes, a collection view and settings.
- [ ] Share a link, an image and a PDF into Modulo; the files open on desktop.
- [ ] A reminder fires with the app closed and opens its record; after a
      reboot it still fires.
- [ ] Cold start under 3 s on a mid-range phone; scroll a 2,000-note list and
      the graph without visible stalls.

## Installing and upgrading

Download the APK from the release, allow installation from the browser or file
manager when asked, and open it. On first start enter the Modulo server
address. Upgrades install over the existing app and keep everything: the
offline queue, drafts, the server choice and the saved sign-in.

## Recovery

- Everything acknowledged by the server can be recovered by signing in on a new
  device.
- Edits that were still queued on a lost phone are lost with it; keep the phone
  online now and then.
- **Recovery → Full workspace backup** exports all plugin records to a file
  that can be restored on any device.
- Uninstalling the app deletes its queue; synchronize first.

## Compatibility policy

- The app talks to the server's versioned REST and state APIs. A server change
  that removes or changes an endpoint the app uses must keep the old behaviour
  for at least one app release, since users update at different times.
- The state API's storage generation protects queued edits across server
  restores; the app never replays them onto a restored database without review.
- Capacitor, the Android Gradle Plugin, Gradle and the SDK levels are upgraded
  together (ADR 0009) in a change that runs the emulator journeys and the
  upgrade test.
- `versionCode` only ever increases; a lower code cannot be installed over a
  higher one.

## The old Kotlin app

`mobile/android` shares the `com.modulo` application id but was never
buildable or distributed, so there is no signed installation to upgrade from.
It is removed once the first signed release has passed the upgrade test from a
previous signed release.
