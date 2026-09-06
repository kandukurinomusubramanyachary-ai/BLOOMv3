# Bloom V3 UI Audit

> Started: 2026-09-06 · Branch: `main` @ `aa5dfe2` · Method: source inspection + live Playwright capture (Chromium, 430×900 @2x, zero console errors).
>
> This is an **inspection + architecture** artifact. It catalogues what exists, what is strong, what is weak, and the plan to converge onto one Bloom V3 system. It does not replace doing the work.

---

## 1. Current architecture

- **Runtime:** Expo 51 / React Native 0.74, `react-native-web` 0.19.10. Web + native from one codebase.
- **Entry:** `App.js` → `DeviceFrame`/`SafeAreaShim` → `AuthProvider` → `BloomEntry` → `AuthScreen` / `Splash` / `RootNavigator` (inside `AppProvider`).
- **Navigation:** `src/navigation/RootNavigator.js` (stack: `Main`, `DayDetail`, `LogPeriod`, `PrivacySettings`, `Reminders`, `ExportData`, `Preferences`, `DailyCheckIn`, `Food`, `Movement`, `DoctorReport`, `Profile`) — `MainTabNavigator.js` (bottom tabs: **Today · Timeline · Meg · Diet**, + Strength when `EXPO_PUBLIC_BLOOM_STRENGTH`).
- **State/storage:** `AppContext` (device-first persistence via `src/services/storage.js`, AsyncStorage) + `AuthContext` (Firebase). Firestore is *optional* — the app fully renders on local storage. Dev-auth bypass: `EXPO_PUBLIC_BLOOM_DEV_AUTH=1`.
- **Services:** `meg.js`, `cyclePrediction.js`, `dailyPlan.js`, `doctorReport.js`, `dietData.js`, `notifications.js`, storage, etc.
- **Backend:** `server/index.js` → `megV2Bridge.js` → `meg-engine-v2/`. Meg V3 branches exist in the remote but are **not** on `main` and are out of the active surface.

## 2. Existing design system (this is NOT a blank slate)

The repo already ships a real token layer and a Koboyo icon system. This is important: V3 should **evolve and complete** these, not replace them wholesale.

### Color tokens — `src/utils/constants.js`
`LIGHT_COLORS` / `DARK_COLORS` (frozen), a **Proxy `COLORS`** that returns the active theme's value, and
**`createThemedStyles(definitions)`** which auto-derives light+dark styles from one definition via a color-equivalent map (`DARK_COLOR_BY_LIGHT`). Already present: `canvas`, `surfaceSoft/Strong/Warm`, `brand`, `brandSoft`, `cycle`, `sage`, `ink`, `body`, `muted`, `hairline`, `terracotta`, `cream`, `ivory`, `success`, `warning`, `error`, `scrim`, `onBrand`. Brand is a rose/terracotta (`#B52F50`), not the clichéd pink.

- **Strong:** real semantic tokens, both themes, no hardcoded *colors* scattered in most places.
- **Weak:** the palette has a lot of near-duplicates (`brand`≈`terracotta`, `charcoal`≈`ink`, `cream`≈`surfaceSoft`, `gray`≈`muted`, `lightGray`≈`hairline`) which invites drift; there is no `accent`, `inverse`, `success-soft`, `warning-soft`, `error-soft`, `focus-ring` token.
- **Weak:** legacy aliases (`logo`, `logoInk`, `logoSoft`) and the `HARD_CODED_DARK_EQUIVALENTS` string map is a maintenance smell.
- **Flat design:** one elevation tier. Good; V3 should keep it mostly flat with restrained, purposeful shadow.

### Typography — `TYPOGRAPHY` + `FONTS`
`TYPOGRAPHY` defines 7 tiers (`screenTitle 28/34 700`, `sectionTitle 20/26 600`, `componentTitle 16/22 600`, `body 15/22 400`, `supporting 14/20 400`, `caption 12/16 500`, `button 16/20 600`). `FONTS.display`/`body`.

- **Strong:** intentional scale, defined line-heights, single family (Avenir Next on iOS / Inter web).
- **Weak:** no `display`, `title`, `eyebrow`, `microcopy` tiers; no `letterSpacing` guidance; sizes are raw numbers (fine) but `screenTitle` at `28` can collide with a `display` need on the hero screens; no responsive/fluid sizing.

### Spacing — `SIZES` + `LAYOUT`
`SIZES {xs4 sm8 compact12 md16 gutter20 lg24 xl32 xxl48}`, `LAYOUT {screenPadding20, maxContentWidth720, phoneMaxWidth430, cardRadius16, controlRadius12, touchTarget48, tabBarHeight58}`.

- **Strong:** a real 4pt-ish scale, a max content width (720) for desktop, a phone max (430), touch target 48.
- **Weak:** scale isn't a single named module (it's split between `SIZES` and `LAYOUT`); no `radius` token family (`small/medium/large`); no consistent import so screens do use ad-hoc values sometimes.

### Motion — `MOTION`
`duration {press120 release150 entrance220 reveal200}`, `distance {entrance8 reveal10 parallax12}`, `easing {out [0.23,1,0.32,1], inOut [0.77,0,0.175,1]}`.

- **Strong:** named durations, real easing curves, `useReducedMotion` in `Motion.js`.
- **Weak:** small; no named `fast/normal/slow`; no state-motion mapping (enter/submit/success/loading).

### Radius / shadow
Radius is hardcoded as `cardRadius16` / `controlRadius12` in `LAYOUT`. No `sm/md/lg` families.

## 3. Koboyo icon system — `src/components/{Icon.js,koboyoIcons.js}`

- `koboyoIcons.js` (67 KB) is an auto-generated single-keyed object of **hand-drawn fill line glyphs** with `viewBox` + `paths`.
- `Icon.js` is a wrapper that maps **Ionicons names** (what screens use) to Koboyo glyphs via `IONICON_TO_KOBOYO`, and **falls back to Ionicons** if no map exists — so nothing ever breaks. It also recomputes a **square viewBox with uniform padding** so the irregular glyph aspect ratios render at consistent optical size. This is genuinely good engineering.
- **Assessment:** the system is strong and already coherent. V3 should (a) reuse it, (b) expand the Ionicons→Koboyo map so fewer screens fall back to the template-ish Ionicons look, (c) not introduce another icon library.

## 4. Existing components (`src/components/`)

Already present and used: `BrandMark` (`LotusMark`), `Icon`, `Button`, `Card`, `ScreenHeader`, `ScreenScaffold`, `DeviceFrame`(+`.web`), `Motion` (`Entrance`, `useReducedMotion`), `CalendarDatePicker`, `AppLockModal`, `StartupDiagnosticScreen`, `StartupErrorBoundary`.

- **Strong:** there is already a `Button`, `Card`, header/scaffold, and a real `DeviceFrame`/`SafeAreaShim`. Layout is largely componentised.
- **Weak:** `Button.js` — need to verify it has full states (hover/pressed/focus-visible/disabled/loading) and consistent variants; no unified `IconButton`, `StateChip`, `EmptyState`, `LoadingState`, `ErrorState`, `BottomSheet`, `SegmentedControl`, `CheckInControl`, `ContextPill`, `ActionRow` (many of these exist ad-hoc per screen).

## 5. Screen inventory & per-screen notes (live-verified where noted)

| Screen | File | State | Notes |
|---|---|---|---|
| Splash | `SplashScreen.js` | present | Entry; ready→app shell. Not yet audited live. |
| Auth/onboarding | `AuthScreen.js` | present | Skipped under dev-auth. Brand-chipped. Not audited live. |
| **Today** | `TodayScreen.js` | ✅ live | Warm editorial hero, "Good morning, Dev", greeting + date eyebrow, check-in CTA card, current phase w/ 4-phase bar, insight card + supporting action. **Strong.** Reads like a companion, not a dashboard. |
| Check-in | `DailyCheckInScreen.js` | present | Flow "How is your body feeling today? A 30-second check-in…". Not yet live-scripted fully. |
| **Timeline** | `TimelineScreen.js` | ✅ live | Month/Year toggle, calendar with rich markers (logged / estimated / PMS / today), "Confidence is still building…" probabilistic disclaimer, phase legend, day-detail row, "Log period dates" CTA. **Excellent** — handles uncertainty well. |
| Day Detail | `DayDetailScreen.js` | present | stack screen. |
| Log Period | `LogPeriodScreen.js` | present | stack screen. |
| **Meg** | `MegScreen.js` | ✅ live | "What's on your mind?" hero, composer, "Period days support" context card, "Start with" grid (My cycle / Food & cravings / Energy / Mood). Modes (listen/understand/plan/conversation/doctor) are in the source. **Coherent but can be more Bloom-distinct.** |
| Strength | `strength/` | present | Feature-flagged (`EXPO_PUBLIC_BLOOM_STRENGTH`). Large subsystem. |
| Movement | `MovementScreen.js` | present | |
| Diet | `DietScreen.js` + `FoodScreen.js` | ✅ live | "Food that fits today", doable-chips grid, "Suggested for you" (Moong dal soup, Banana peanut bowl with cost detail), Today summary + context note. **Coherent, region-aware.** |
| Doctor Report | `DoctorReportScreen.js` | present | |
| Profile | `ProfileScreen.js` | present | Reachable via top-right avatar. |
| Preferences | `PreferencesScreen.js` | present | |
| Privacy | `PrivacySettingsScreen.js` | present | |
| Reminders | `RemindersScreen.js` | present | |
| Export Data | `ExportDataScreen.js` | present | |
| Startup diagnostic/error | `StartupDiagnosticScreen.js`, `StartupErrorBoundary.js` | present | |

## 6. Problems / opportunities

### Consistency
- near-duplicate colour tokens invite drift; no unified `accent/success-soft` etc.
- no unified type scale export used consistently; `screenTitle(28)` vs `sectionTitle(20)` gap limits hierarchy.
- button/state-chips/empty-states/loading/error are per-screen.

### Accessibility
- Tab bar and major controls carry `aria-label`s (verified live: "Open calendar timeline", "Open Meg menu", "Open your profile", day buttons with spoken summaries). Good baseline.
- Nothing live-verified for **focus-visible / keyboard order / reduced-motion / screen-reader live-region** for check-in and composer. Need a pass.

### Responsive
- `maxContentWidth: 720`, `phoneMaxWidth: 430` exist. Desktop behaviour not yet audited (1280/1440). No evidence of views designed for 2-col above 720 — need to check and make desktop intentional rather than a stretched phone.

### Motion
- Good `Entrance`/`useReducedMotion`. No state-animation vocabulary (enter/submit/success/loading/Meg listening→thinking→answering). Meg and Strength could use purposeful state motion.

### Dead / left-over
- Legacy aliases in the palette; `HARD_CODED_DARK_EQUIVALENTS` string map; the giant auto-generated `koboyoIcons.js` (fine, it's a build artifact); need to confirm whether `FoodScreen` is reachable separately from `DietScreen` or is a leftover carve-out.

### Performance
- Singular Metro bundle, no screen-level code-splitting (native RN — acceptable). Meg/Strength heavy modules load eagerly. R3F/WebGL **not present** — so any 3D/liquid would be net-new and must be lazy + reduced-motion aware.

## 7. V3 design direction (decision)

Keep Bloom's identity: warm neutral surfaces + terracotta/rose accent + rich charcoal type + restrained borders + soft organic geometry. **Evolve, don't replace.** Specifically:

1. **Tokens:** add a unified `tokens` module (colors/type/spacing/radius/shadow/motion) that *re-exports* the existing `COLORS`/`TYPOGRAPHY`/`SIZES`/`LAYOUT`/`MOTION` so nothing breaks, and adds `accent`, tinted feedback colors, a `radius` family, and a fuller type scale. No behaviour change.
2. **Components:** a single `BloomButton` (variants primary/secondary/quiet/text/danger/icon/icon+label) with hover/pressed/focus-visible/disabled/loading/success, plus `IconButton`, and consolidated `EmptyState`/`Loading`/`Error`/`StateChip`. Back-compat: keep `Button` as an alias so existing screens keep working during the migration.
3. **Meg:** make it uniquely Bloom — progressive privacy-presence + modest context hint, modes revealed as needed, then composer; calm state-motion (idle→listening→thinking→respond). R3F **only** for an ambient, lazy, reduced-motion-aware presence if it earns its cost; otherwise rely on the existing Koboyo/motion system.
4. **Strength:** re-skin to Bloom; focus UI during active sets.
5. **Typography/hierarchy:** tighten scale; add display/eyebrow where the product deserves it; fix the gaps.
6. **Responsive:** make ≥768px and ≥1280px intentional (two-column where it helps, never a stretched phone).
7. **Motion:** map to state; honour reduced motion + no active WebGL loops when idle.

## 8. Playwright loop (already bootstrapped)
`scripts/uiAuditScreen.js` + `uiAuditCapture.js` exist; Chromium installed with system libs. Loop: **BUILD → RUN → OPEN → INTERACT → SCREENSHOT → CRITIQUE → FIX → REPEAT** at 430/375/768/1280/1440.

## 9. Remaining work (batches)
- [x] **B1:** token consolidation (non-breaking) — added `RADIUS`, `SPACING`, `FOCUS_RING`, `display/title/eyebrow/microcopy/metricValue` type tiers, and `accent/focus/successSoft/warningSoft/errorSoft/danger(+Soft)` color tokens to both palettes. `COLORS`/`SIZES`/`LAYOUT`/`TYPOGRAPHY`/`MOTION`/`WEB_FOCUS` all preserved.
- [x] **B2:** primitives — `src/components/` gained **`IconButton`** (unified 48pt tap target, quiet/outline/filled, hover/pressed/focus/disabled), **`StateChip`** (tone tags), and **`FeedbackStates.js`** (`EmptyState`/`LoadingState`/`ErrorState`). `Button` upgraded in place: real spinner + `success` state. All additive/back-compatible.
- [x] **B3:** apply typography scale — normalized the **settings family** (`Profile`, `Preferences`, `PrivacySettings`, `Reminders`, `ExportData`) off ad-hoc `fontSize` values and onto `TYPOGRAPHY` tiers. Result: Preferences/Export → **0 hardcoded sizes**; Profile → 6 (intentional display values); Privacy/Reminders → 1 each (the PIN/time displays). Settings family now reads as one coherent system with Today.
- [x] **B4 (partial):** Meg distinctness — added a calm **presence** to Meg's empty home (soft lotus `LotusMark` in a warm circle + a mode-aware "Ready when you are. I'll follow your lead." caption). Meg's existing state motion (animated lotus avatar, staged waiting copy "I'm here"→"Still with you", reduced-motion-aware) was already strong and preserved. No Meg V3 built; Meg V2 engine intact.
- [x] **B5:** Strength in-language — confirmed `GuidedStrengthScreen` + components already use `COLORS`/`TYPOGRAPHY`/`SIZES`/`Icon`/`Motion` (Bod icons, brand pills, surface cards, "Your strength" stats, filter chips, streak bars). Normalized out-of-scale type in `StrengthSummary` (`TYPOGRAPHY.supporting`/`eyebrow`/`microcopy`) and swapped the one off-system destructive hex in `SessionControls` for the token value. Active-session dark overlay intentionally preserved (§14 reduce-UI). Enabled via `EXPO_PUBLIC_BLOOM_STRENGTH=1`. Verified: renders in Bloom's language, not a separate "fitness app".
- [x] **B6:** responsive desktop/tablet — confirmed web fills browser + centers on 720/430 maxWidth (Never stretched). Playwright measured **no horizontal overflow and 0 console errors at 375 / 768 / 1280 / 1440**, across Today/Strength/Timeline. Contents sit in a comfortable column on the warm canvas; 5-tab bar renders correctly.
- [x] **B7:** a11y pass — verified all interactive controls have accessible names (`unnamedInteractiveCount: 0`), keyboard focus moves cleanly (Tab walk confirmed), `prefers-reduced-motion` honored via emulation (web `matchMedia` + native `AccessibilityInfo`, mutes Entrance/ScrollReveal/Parallax — `Motion.js` already thorough). Fixed 3 `useNativeDriver: true` sites (`Button` spinner, `ProgressRing`, `SplashScreen`) to `Platform.OS !== 'web'`, and migrated the `pointerEvents` attribute usages in `MegScreen`/`ProgressRing` to `style.pointerEvents`. Residual console warnings (`shadow*` deprecation, `useNativeDriver`, `pointerEvents`) originate from third-party RN-web internals (react-navigation/safe-area-context), not Bloom's code — zero console errors remain.
- [x] **B8:** perf/lazy-load — no active WebGL/render loops introduced (no R3F; liquid effects intentionally deferred/omitted as they'd add GPU cost for no product value here). Animation drivers are native where supported, `isInteraction: false` on splashes, reduced-motion cuts loops. Bundle compiles to HTTP 200 ~8.8 MB dev (unminified).
- [x] **B9:** cleanup + console sweep — verified every component under `src/components/` is imported/used (DeviceFrame, Startup screens wired via App.js/index.js; no dead components). The new primitives (`IconButton`, `StateChip`, `FeedbackStates`, `Icon`/`Button`/`Card`/`ScreenHeader`/`ScreenScaffold`/`BrandMark`/`Motion`) form the consolidated library — none unused, none duplicate existing. Documented leftover root artifacts (`.new-bloom-patch`, `.strength-import`, `.strength-v2-source`, `backup/*`, `staging/*`) and Meg V3 branches as **out-of-scope remnants** — not cleaned/deleted per the no-destructive rule.

## 10. Verification log (Playwright, Chromium 430×900 @2x)
- Baseline (pre-change): zero console errors; Today/Timeline/Meg/Diet render as one coherent system.
- After B1+B2: bundle 8.8 MB, HTTP 200, **0 console errors**, all four tabs render, 60 interactive controls present.
- After B3+B4: Meg presence renders, composer focus+send enabled, Profile opens and renders with normalized scale, Preferences nav reached. **0 console errors** across Meg, Profile, Preferences flows.
- After B5+B6: **no overflow (scrollW==clientW) at 375/768/1280/1440; 0 console errors**; Strength renders in-language; desktop Timeline centers on a comfortable column.
- After B7–B9: **0 console errors**, all interactive controls named, keyboard Tab-walk works, `prefers-reduced-motion: reduce` emulation renders with **0 errors**, cross-tab sweep (Today/Timeline/Meg/Diet) clean.

---

## 11. Senior review pass (determinism / native / validation)

### Critical finding — camera stack is unreachable dead code
The live Strength feature runs **`useGuidedSession`** (camera-free, self-counted timing engine). The entire **camera/pose/rep-detection stack — `useStrengthSession.web.js`, `PoseDetector.web.js`, `CameraStage.web.js`, `PoseOverlay.web.js`, and the `engine/*` (repStateMachine, cueScheduler, jointAngles, poseTransform, landmarkSmoothing, positioningCoach, strengthSummary) — forms a closed cluster imported by nothing from any live entry point.** Verified: the only in/out imports are among those four `.web.js` files. `StrengthScreen.js`/`StrengthScreen.web.js` both re-export `GuidedStrengthScreen`.

Consequences:
- **`@mediapipe/tasks-vision` is web-only WASM and never bundled on native** — it's only referenced inside `PoseDetector.web.js`. **No native compile risk from MediaPipe.** Confirmed there is **no `expo-camera`/vision-camera/CameraX** dependency — the only camera "code" is web getUserMedia, unreachable.
- **The committed `strengthEngine.test.js` verifies unreachable code** (it imports `engine/*`), while the **live `useGuidedSession` had zero coverage.** This was the biggest test gap.

### Fixes made
1. **Extracted the live session state machine** into `src/features/strength/guidedSessionEngine.js` (framework-free CommonJS, pure reducer) and made `useGuidedSession.js` a thin React/interval wrapper. Behavior-preserving; now directly unit-testable.
2. **Added `server/guidedSessionEngine.test.js` — 13 tests** covering: initial state per exercise/set plan, hold mode, START→countdown, countdown→active, deterministic rep advancement by tempo (no double count), set-complete→rest→set 2, skip-rest, 2-set workout completing with exactly the planned total reps, hold-mode completion (0 reps), pause freezing elapsed time + resume to typed phase, countdown pause/resume, RESET re-init, skip-rest no-op outside rest, and single-set direct completion.
3. **Fixed 2 failing regression tests** that asserted the obsolete camera contract: `iosCompatibility.test.js` and `uiHardening.test.js` now assert the camera-free `GuidedStrengthScreen` path and that the live engine never acquires a camera.
4. **Fixed a genuine minor defect** in `SessionPlayer.js`: removed an always-`true` ternary (`? true : true`).
5. **Reconciled `node_modules`** — `dotenv` was declared in `package.json` but missing, which made `npm test` fail at load (MODULE_NOT_FOUND). `npm install` restored it.

### Validation run
- `npm test` (node server/all.test.js) → **133 pass / 0 fail** (was 118 pass / 2 fail).
- `npm run typecheck` (tsc --noEmit) → **clean**.
- Web bundle → **HTTP 200**, `guidedSessionEngine` present ×8 (ESM↔CJS interop resolves), **0 console errors**.
- Playwright live smoke (Strength → Bodyweight squat → Start → guided session): session renders "Set 1 of 3", countdown/begin state, **0 console errors**.

### NOT validated (must be done on real hardware)
- **No native build was compiled** (working tree is a managed Expo app with **no `android/`/`ios/`** dirs and no custom Expo native module). There is **no device/simulator validation**.
- `@mediapipe`/pose/camera behavior is untested on a real device because the path is web-only and unreachable in the current product.
