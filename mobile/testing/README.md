# Mobile testing

The Detox/Appium scaffold that lived here targeted the retired Kotlin app in
`mobile/android` and never ran against the packaged Capacitor app. It was
replaced (#497) by checks that run against the real app:

| Check | Where | Runs in CI |
| --- | --- | --- |
| Emulator journeys: cold launch, force-stop recovery, Keystore store, Share-to-Modulo across process death, reminder alarms, 200% system font | `mobile/app/scripts/smoke-android.mjs` | `android-emulator` (screenshots, report, logcat as artifacts) |
| Every plugin view at phone size, rendered and interactive, with create persistence | `frontend/scripts/phoneParity.mjs` (`npm run phone:parity`) | `frontend` |
| The same with browser Storage throwing | `npm run phone:parity:no-storage` | `frontend` |
| Overflow and page errors at default and doubled text size | `npm run phone:audit` | `frontend` |
| WCAG 2.1 A/AA (axe) at phone and tablet size | `npm run phone:a11y` | `frontend` |
| Large-workspace performance budget | `npm run phone:perf` | `frontend` (report-only until calibrated) |
| Cross-device sync and backup journeys | `frontend/src/__tests__/acceptance/` | `frontend` (unit tests) |
| No browser Storage in plugins, coverage of storage ownership, capabilities and parity evidence | ESLint rules, `npm run inventory:android:check` | `frontend` |

Real-device checks (TalkBack walk-through, cold start and memory on a
physical phone) are part of the release checklist in
[docs/mobile/android-release.md](../../docs/mobile/android-release.md).
