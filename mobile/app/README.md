# Android shell

This Capacitor project packages `frontend/dist` and uses the shared React plugin
catalog. It is separate from the older Notes-only `mobile/android` scaffold until
the release and upgrade path is verified.

From the repository root, run `npm --prefix frontend ci`,
`npm --prefix frontend run build`, `npm --prefix mobile/app ci`, then
`npm --prefix mobile/app run sync`. Open `mobile/app/android` in Android Studio.
For a command-line debug APK, use JDK 21 and Android SDK Platform 36, then run
`./gradlew assembleDebug` in `mobile/app/android`. The APK appears at
`app/build/outputs/apk/debug/app-debug.apk`.

With an Android device or emulator connected, install that APK with
`adb install -r app/build/outputs/apk/debug/app-debug.apk` from the Android
directory, then run `npm run smoke:android --prefix mobile/app` from the
repository root. The smoke check verifies packaged onboarding or login,
the native SQLite snapshot and replica round trip, rejection of an insecure
server origin, and recovery after force-stop.

## Phone presentation

The packaged app uses the shared React frontend's phone layer, not a narrowed
desktop layout: a top app bar, labelled bottom navigation, a drawer that also
opens by swiping in from the left edge, and a capture button. Anything sized for
touch keys off Tailwind's `coarse:` variant (`@media (pointer: coarse)`), so it
does **not** appear when you narrow a desktop browser window — use a device, an
emulator, or Chrome DevTools device emulation to see it.

That layer lives in `frontend/src/features/workspace/mobile` and covers:

| Piece | What it does |
|-------|--------------|
| `PhoneChrome.tsx` | App bar, bottom navigation, drawer, floating action button. The button publishes `--fab-inset` while mounted so no view ends underneath it. |
| `PhoneHome.tsx` | The phone home screen — greeting, stat tiles, quick actions, recent notes — in place of the desktop dashboard's terminal layout. Chosen at runtime by `usePhoneLayout`, so neither version fetches the other's data. |
| `phoneNav.ts` | Which destinations earn a bottom-bar slot. Content first; Recovery, Marketplace and the other utility views only fill slots content left empty. |
| `phoneScreen.ts` | Lets a view claim the whole screen (the open note does), folding away the app bar and the hub tab strip so a detail screen has one bar, not three. |
| `SystemBanner.tsx` | Portals session banners (settings sync, offline notes, device storage) into a slot **under** the app bar rather than above the shell. |
| `usePullToRefresh.ts` | Pull down at the top of a view to resynchronize, with `PullIndicator` drawing Material's puck. |
| `HubViewPicker.tsx` | A hub's view switcher: a combo box naming the open view, opening the full grouped list (with a filter past eight views). Replaces a scrolling tab strip that showed three views at a time and clipped the fourth. |
| `useEdgeSwipe.ts` | Left-edge drawer gesture. On a gesture-navigation device the system owns the outer edge, so the menu button is the reliable way in. |

Two shell-wide rules the rest of the app inherits: a labelled `Button` reaches
44px on a coarse pointer (an icon button keeps its drawn size and grows an
invisible target instead), and toasts dock to the bottom edge as snackbars,
clearing the navigation bar, the action button and the soft keyboard.

`frontend/scripts/phoneShots.mjs` screenshots the phone layer at Pixel
dimensions against a dev server and reports any horizontal overflow or target
under 44px:

```sh
npm --prefix frontend run dev            # or: VITE_API_PROXY_TARGET=https://… npm --prefix frontend run dev
node frontend/scripts/phoneShots.mjs http://127.0.0.1:5173 /tmp/shots \
  /app/dashboard:home /app/notes:notes '/app/notes!Reading list:detail'
```

The window is edge to edge. `MainActivity` sets that up and `ShellWindowPlugin`
owns the two things that cross the boundary: it insets the WebView for the soft
keyboard (edge-to-edge windows no longer resize themselves) and reports that
inset to the page, and it takes the theme's light/dark canvas from the page to
pick the system bar icon colour. The page side is
`frontend/src/services/shellWindow.ts` and `frontend/src/services/mobileViewport.ts`,
which publish `--app-viewport-height`, `--safe-*`, `--keyboard-inset` and
`html[data-keyboard]` for the stylesheet to react to.

The shell is an early integration artifact. On first launch, enter the HTTPS
origin used by the web app. Android verifies the Modulo health endpoint and
OIDC issuer, stores the selected origin in its private SQLite database, and
uses an isolated in-app WebView for OIDC sign-in. The shared state client selects a
native transactional SQLite queue on Android. SQLite also retains the queue
replica ID across process restarts, and Android system backup is disabled for
the private cache. Authentication, remote API URL resolution, native
capabilities, and catalog-wide Android verification are tracked in issues
#488–#498. Android 36 emulator smoke passes; authenticated journeys, plugin
data migrations, and real-device checks are still pending.
It must not be released before those gates pass.
