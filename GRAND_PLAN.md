Dartscape 2 — Phase 2: The App
Goal: a complete MVP foundation, executed in one take. Set up a game, add players, play any of the eight games, take turns, see a win screen with stats, save and browse stats, change settings. No help screen (deferred).

Read this first
You are executing this plan end to end, in one pass, without checking back. Whoever wrote it is gone; everything you need is in this document or in the files it names. Where it says "verified", it was verified against the repo on 2026-07-16 — re-check anything that looks stale rather than trusting it.

What already exists
c:\Users\jaymi\Projects\Dartscape\ is the repo. Two apps live in it:

Path What Your relationship to it
app/ Dartscape 1 — the shipping Android app, Java, ~14k lines Reference only. Never modify. It's the design source.
dartscape2/ Dartscape 2 — the rebuild. Expo + React Native. This is the one you're building.
Verify the branch and HEAD yourself before you start — this moved once already while the plan was being written. As of 2026-07-16 it was main @ db92d2d "Dartscape 2", with Phase 1 and all 134 kit files committed.

Never git add -A. Uncommitted work you didn't do is normal in this repo — stage explicit paths only.

⚠ The test suite is RED right now. Fix it first.
FAIL src/spatch-kit/kitBoundary.test.ts
Error: No test suite found in file
Test Files 1 failed | 14 passed (15)
Tests 450 passed (450)
Nothing is broken. All 450 core tests pass. The kit's boundary script is a script, not a Vitest suite, and the src/\*_/_.test.ts glob picks it up and fails the file for having no it() in it. This is trap 3 below, and it is the very first thing Step 1 fixes — a red gate on day one means you can't tell your own breakage from inherited breakage.

Phase 1 is done — do not rebuild it
dartscape2/src/core/ is finished, committed, and covered by 450 passing tests. Pure TypeScript: no React, no react-native, no native modules. It runs in node.

It gives you four things and nothing else:

reduce(config, players, log) // → { state, events, trace } the whole read path
view(state) // → GameView everything a screen needs
GameEvent[] // ← from reduce the effects channel
repo + computeStats(games,id) // → persistence + ~30 stats
Eight games work: x01, cricket, shanghai, baseball, killer, aroundTheClock, halveIt, bobs27. A bot plays all of them. cd dartscape2 && npx vite-node scripts/sim.ts plays a full 501 match bot-vs-bot in your terminal, right now, with no device. Try it first — it's the fastest way to understand what you're building a UI for.

Phase 2 must not change a single file under src/core/. A test enforces it.

SpatchKit has landed
dartscape2/src/spatch-kit/ — 134 files: theming, an overlay/modal system, ~58 primitives, settings chrome, motion. It is a copy, not an npm dependency, and it has two absolute rules (its README explains why at length):

Never reorganize it. No renames, no restructuring, no tidying.
Never let a formatter rewrite it. See trap 1.
How to read this document
It is long. Read it in this order — not top to bottom:

Read this first (you're here) — orientation, repo state, the red suite.
The traps — six landmines, each costing about a day. All are in Step 1.
→ Architecture (near the end) — read this before you write anything. The layer DAG, the folder structure, the seams. It's at the end because it's reference material, not because it's optional. Building before you've read it is how the refactor you're trying to avoid happens.
Execution protocol — the rules you work under.
Steps 1 → 7 — in order, in one pass.
Verification — the end state you're accountable for.
Required reading, in this order
Do not skip these. Each one is short and each one prevents a specific day-long mistake.

dartscape2/src/spatch-kit/README.md — the kit's contract, its traps, and its "things that look wrong and aren't" section. Non-negotiable.
dartscape2/PLAN.md — Phase 1's plan and decisions log. Explains why the core is shaped the way it is. Append to its decisions log as you go.
dartscape2/AGENTS.md — says: read the versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo-facing code. Step 1 is entirely Expo-facing (router, nativewind, metro, babel). Honour it.
dartscape2/src/core/game/registry.ts — the four exports, in ~120 lines. The whole surface you're building against.
dartscape2/src/core/game/view.ts — GameView and PanelView. This is your prop type for every screen.
The visual source
Dartscape 1's screenshots are in screenshots/ (Screenshot_1.jpg … Screenshot_8.jpg). Look at them. They are the design brief, and the ASCII drawings later in this plan are transcriptions of them, not inventions. Notably: Screenshot_4 (X01 grid), Screenshot_8 (cricket sheet), Screenshot_6 (the home screen this plan replaces), Screenshot_2 (the input gesture + the shanghai clock).

The look: dark theme, chunky circles, heavy white strokes, soft glow, bold rounded type, active player as a raised lighter panel. Keep that DNA.

Toolchain (verified 2026-07-16)
Thing Version
TypeScript 7.0.2 — the native Go compiler
Expo SDK 57 · React Native 0.86 · React 19.2
Tests Vitest 4.1.10
Lint + format Biome 2.5.4 — not typescript-eslint (it peer-caps at <6.1.0 and does not support TS 7)
Node 22.19 · npm 11.6
Android SDK **Corrected 2026-07-16, from the actual Phase 2 execution environment: NOT set, not present at all** — no ANDROID_HOME, no sdkmanager, nothing under any of the usual install locations. Java 21 on PATH; JAVA_HOME unset. `expo prebuild --platform android` still succeeds (it only generates the native project — no SDK needed for that step). `cd android && ./gradlew assembleDebug` cannot complete in that environment: the Gradle wrapper's distribution download and the AGP/plugin resolution both need network access this sandbox doesn't grant, before an actual missing-SDK error would even surface. `npm run apk`'s real APK is therefore something only an environment with the SDK installed can produce — see PLAN.md's Phase 2 decisions log.
Device NONE. See below.
Commands: npm run check (typecheck + lint + test) · npm run sim (headless core).

⚠ You will not have a device
No phone, no emulator. You cannot run the app, look at it, or press anything. Every "just try it" instinct is unavailable to you. This is the single biggest constraint on this job and it shapes what you build, not just how you check it.

What this does NOT mean
It does not mean "write it blind and hope". A great deal is still provable, and you are expected to prove it:

Gate Command Catches
Types npx tsc --noEmit everything the type system can see, and TS 7 is strict here
Lint npx biome check src —
Logic npx vitest run 450 core tests + everything new you write
JS bundle npx expo export --platform android the big one. Runs Metro over every file: a missing dep, a bad import, a broken babel/nativewind config, a module that doesn't resolve. Most Phase 2 breakage is exactly this.
Native build npx expo prebuild --platform android then cd android && ./gradlew assembleDebug produces a real APK with no device attached. Proves the native side links: Skia, Reanimated, gesture-handler, op-sqlite, the lot.
Core still works npm run sim the engines, headless
expo export and assembleDebug are your substitute for pressing the button. Run them at the end of every step. A step is not green until both pass.

What it does mean: build for testability, not for the debugger
Because you can't feel the gesture, the gesture must be a pure function you can test. This is not a workaround — it's better design, and the constraint is what forces it.

// ui/board/dartGesture.ts — PURE. No React, no timers, no Skia.
type Touch = { kind: "down" | "up"; cell: number; t: number };
export function reduceGesture(prev: GestureState, touch: Touch): {
state: GestureState;
emit?: { dart: Dart; replacesPrevious: boolean };
}
Then useDartGesture.ts is a thin React wrapper that feeds it real touches and a real clock. The state machine gets unit-tested with synthetic timings — tap at t=0, up at t=40 → single; second down at t=180 → double, replacesPrevious: true; hold to t=300 → treble. You can prove the input model is correct without ever touching glass.

Same rule everywhere: hitTest.ts is pure (point → cell). Selectors are pure. The event switch is exhaustive at compile time. ui/ takes props and no store (architecture rule 5) — so a panel's correctness is a function of its input, and its input is a plain GameView you can write by hand in a test.

What only Jason can check — hand these off honestly
These are not your failure; they're the part of the job a device is required for. List them in your final report as explicitly unverified:

Does it look right against screenshots/.
Does the gesture feel right — the 250ms hold, the upgrade roll.
The kit smoke test its README demands: open a modal with a text field (does the sheet seat above the keyboard?), toggle accent + dark mode with an overlay open (do the --fp-\* vars resolve inside the portal?), check icons render.
Sound, haptics, animation timing.
Do not claim any of these work. Say what you built and that it is unverified on glass.

Decisions already made — do not relitigate
Instant single + upgrade input model (Step 2). The centrepiece.
Same DNA, rebuilt sharper. Keep Dartscape 1's iconography and gesture.
Checkout hints on by default, via bestCheckout() which the core already has.
No legacy data import. Dartscape 2 starts fresh.
No help screen in the MVP.
What SpatchKit gives you for free
Do not hand-roll any of these. They exist and they are better than a first attempt.

Need Use Where
Game option chips SegmentedButtons / SegmentedField ui/primitives/
Theming createAppTheme — 8 knobs, any accent hex derived at runtime theme/
A settings screen ThemeControls — complete, works with nothing wired settings/
The win modal AppModal + the overlay tier system ui/primitives/, ui/overlays/
The stats table DataTable ui/layout/
Player rows / remove / avatars SettingsRow, RemoveIconButton, Avatar, EditableAvatar ui/primitives/, settings/
App shell Screen, BottomNavBar, BottomActionBar ui/primitives/
Motion MotionView, CrossfadeSwap, SlideSwap, ui/animated/ —
The 13 fixed themes from Dartscape 1 are dropped, and that's an upgrade. createAppTheme derives a whole accent family from one hex at runtime; tintTowardAccent leans every surface toward it at capped saturation; accentContrast picks black/white by perceived brightness. Any colour works. That is strictly more than 13 presets, for free. The kit's DEFAULT_PRIMARY_COLOR is #2f8f4e — a dart-mat green. Use it as the default.

What you still hand-roll: the game panels. Score grid, cricket sheet, diamond, clock. The kit's README explicitly sanctions this — "if it needs something genuinely different, write your own component and import the kit's hooks". A 40-cell animated score grid is genuinely different. Those get Skia (already installed) + useTheme().

The split: the kit owns the app, Skia owns the board.

The traps (from the kit's README — each one costs a day)
These are not optional and they are not obvious. Handle them in Step 1, before any screen.

1. Align Biome to the kit's format — do this before the first --write
   dartscape2/biome.json currently sets quoteStyle: "single" and lineWidth: 90. Both were arbitrary choices made when src/core/ was the only code in the repo and nothing else had an opinion — biome init had generated "double" (Biome's default, matching Prettier's) and it was overridden for no reason. Change it.

The kit is Prettier-formatted. Measured from it: 2-space indent, semicolons, trailing commas, double quotes, comments running to ~100 chars (printWidth: 100). Everything except quotes and width already matches.

// dartscape2/biome.json
"formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
"javascript": { "formatter": { "quoteStyle": "double", "semicolons": "always",
"trailingCommas": "all" } }
Why it matters: the kit's entire reason for existing as a copy is that git diff --no-index against the origin stays mechanical. If Biome reformats 134 files, that diff is 100% noise, permanently, and you won't notice until the day you need it. Jason is migrating the kit to Biome — aligning now makes that a near-noop instead of a rewrite.

Do each reformat as its own commit, touching nothing else:

src/core/\*\* flips single → double. Noise once. The 450 tests prove nothing broke.
The kit, if/when it gets formatted at all.
Never mix a reformat with a real change. One noisy diff each, never again.

If the origin repo's actual .prettierrc is available, take printWidth from there. There is no config file inside the kit folder — 100 is inferred from comment lengths.

2. moduleSuffixes is mandatory
   // dartscape2/tsconfig.json — keep the existing strict flags, add these
   "moduleSuffixes": [".native", ".web", ""],
   "paths": { "@spatch-kit/_": ["./src/spatch-kit/_"] }
   85 kit files self-import via @spatch-kit/\* — without paths, nothing compiles at all. Without moduleSuffixes, the kit's .native.tsx / .web.tsx pairs (OverlayPortal, OverlayHost, OverlayPlaneProvider, cropImage, TimeInput) mis-resolve and web silently renders the native implementation — it presents as a styling bug, not a resolution bug, and costs a day. paths replaces, it does not merge: repeat it in any test tsconfig.

3. kitBoundary.test.ts is a script, not a suite — CONFIRMED, currently failing
   This is not a prediction. Run npm test right now and you get:

FAIL src/spatch-kit/kitBoundary.test.ts
Error: No test suite found in file
src/spatch-kit/kitBoundary.test.ts calls main() at module scope and asserts via node:assert. The Vitest glob src/\*_/_.test.ts matches it, executes it (which works — it throws on a real violation), then fails the file for containing no it(). Red even though the kit is perfectly clean and all 450 core tests pass.

Fix this before anything else in Step 1.

Fix it from outside, because kit rule 1 forbids touching the file:

// dartscape2/vitest.config.ts
include: ["src/**/*.test.ts"],
exclude: ["src/spatch-kit/**"],
// dartscape2/src/kit-boundary.test.ts ← OUTSIDE the kit
import { describe, expect, it } from "vitest";

describe("spatch-kit", () => {
it("stays liftable into another app", async () => {
// The kit's own boundary script. It throws on violation at import time.
await expect(import("./spatch-kit/kitBoundary.test")).resolves.toBeDefined();
});
});
Then open kitBoundary.test.ts and check ALLOWED_ALIAS_PREFIXES — the kit's README says it permits @/core/utils/ for the origin app's helper package, which we did not take. If that entry is present, delete it and vendor the two helpers instead (ui/primitives/TextField and ui/time/\* are the only consumers). Leaving it is a hole in the boundary.

4. nativewind's runtime CSS vars are load-bearing
   theme/nativewind.ts emits --fp-* vars from createAppTheme() at runtime. **Corrected 2026-07-16, verified against the actually-installed toolchain:** with nativewind@4.2.6 on tailwindcss@3.4.19 (what `npx expo install` resolves for Expo SDK 57 today), there is no Tailwind v4 `@theme inline` CSS at-rule available at all — that's a different Tailwind major. The mechanism that actually ships the vars is nativewind's `vars()` runtime helper: wrap the app in a component that calls `vars(buildNativeWindThemeVars(theme))` and puts it on a wrapping View's `style` (see src/ui/ThemeVarsRoot.tsx), and map tailwind.config.js's `theme.extend.colors/spacing/borderRadius` to `var(--fp-*)` there instead of in CSS. global.css stays a plain `@tailwind base/components/utilities`. If a future nativewind/tailwindcss upgrade moves this app onto Tailwind v4, re-check whether `@theme inline` becomes the right mechanism again.

5. nativewind@4 has no `styled()` export (discovered 2026-07-16 — a 7th trap, not in the original six)
   Six kit files (Screen, MotionView, Surface, AppText, FloatingFieldShell, Button) import `styled` from "nativewind" and wrap their base component with it. That API is NativeWind v2; v4 dropped it because host components accept `className` natively via the babel/JSX transform. It fails at `tsc`, not at runtime resolution, so it doesn't show up until typecheck. Fix: export the `...Base` component directly (no wrapper) — every one of the six already forwards `className`/`style` (and Button's `textClassName`/`textStyle`) straight through to an inner host element, so the wrapper was a no-op under v4. Confirm by grepping the installed `node_modules/nativewind/dist` for `styled` before assuming this still applies to whatever version resolves in the future.

6. Exactly one OverlayHost
   It owns the app's single BackHandler. A dev invariant throws if two mount.

7. Never autoFocus
   Use deferPastCommit + .focus(). Native autoFocus SIGABRTs on Android release.

Step 1 — Foundation
Order matters here. Get to green before anything else, then never leave it.

Fix the red suite (trap 3) — the Vitest exclude + the wrapper test. npm test green.
Align Biome (trap 1) — config, then reformat src/core/\*\* as its own commit.
tsconfig (trap 2) — moduleSuffixes + paths. npx tsc --noEmit green.
Dependencies, then the nativewind/metro/babel configs (trap 4).
Router + root layout (trap 5: exactly one OverlayHost).
Seams + the composition root.
The three boundary tests.
Dependencies
Install all of ALLOWED_PACKAGES — including expo-image-manipulator. Trimming it would mean deleting ui/overlays/crop, which violates rule 1 (never reorganize). It's small, and it buys player-photo avatars for free via EditableAvatar.

npx expo install nativewind tailwindcss react-native-svg @gorhom/portal \
 @react-native-async-storage/async-storage lucide-react-native \
 expo-linear-gradient expo-image-manipulator expo-router \
 react-native-screens expo-linking expo-constants react-dom react-native-web
Already present: react, react-native, react-native-reanimated, react-native-safe-area-context, react-native-gesture-handler, zustand, @shopify/react-native-skia.

Skia is not on ALLOWED_PACKAGES and must not be — that list is what the kit may import. Skia is an app dependency, used only under src/ui/board/.

Config files (none of these exist yet — verified)
tsconfig.json — add moduleSuffixes + paths (keep existing strict flags)
biome.json — align quotes/width to the kit (trap 1); reformat in its own commit
vitest.config.ts — exclude src/spatch-kit/\*\* (trap 3 — the boundary test is a script)
tailwind.config.js — content glob must cover the kit
global.css — @theme inline block, unlayered utilities
metro.config.js — withNativeWind
babel.config.js — nativewind/babel + react-native-reanimated/plugin last
app.json — add the expo-router plugin, set scheme
Routing
⚠ app/ means two different things in this repo
Path What Rule
Dartscape/app/ Dartscape 1's Java. com.gworks.dartscape, gradle, the shipping app. NEVER TOUCH
Dartscape/dartscape2/app/ The expo-router screens you are creating. Does not exist yet. This one
Every unqualified app/ in this plan means dartscape2/app/. Every reference to Dartscape 1 is written as app/src/main/java/... and is read-only. If you are ever about to write into a path containing com/gworks/dartscape, stop — you are in the wrong app.

Move to expo-router (the kit imports expo-router/react-navigation for useIsFocused). In dartscape2/package.json, main becomes expo-router/entry; the scaffold's App.tsx and index.ts are deleted.

dartscape2/app/
\_layout.tsx provider stack + <OverlayHost/> (EXACTLY ONE)
index.tsx Setup
game.tsx the game shell
players.tsx roster
stats.tsx stats
settings.tsx settings
Root layout
<GestureHandlerRootView style={{ flex: 1 }}>
<SafeAreaProvider>
<AppThemeProvider>
<OverlayPlaneProvider>
<Stack screenOptions={{ headerShown: false }} />
<OverlayHost />
</OverlayPlaneProvider>
</AppThemeProvider>
</SafeAreaProvider>
</GestureHandlerRootView>
Seams — register at module load, from one root
src/startup/registerKitSeams.ts, statically imported by \_layout.tsx:

setThemeStorageSeam → AsyncStorage (so the theme survives a restart)
registerIcons → our nouns: dart, bullseye, trophy, bot, x01, cricket, shanghai, baseball, killer, clock, halveIt, bobs27
setLoggerSeam → console for now
setAvatarPathResolverSeam → the avatar dir (initials until then)
// src/types/appIconNames.ts — a Leaf
export type AppIconName = KitIconName | 'dart' | 'bullseye' | 'trophy' | 'bot' | …;
Exclude<> on the register map makes it exhaustive — a missing glyph fails to compile rather than silently rendering a fallback.

The boundary tests — write them in Step 1, not later
All three, before the first screen. A boundary added after the fact is archaeology; a boundary added first is just a rule.

src/core/core-isolation.test.ts — exists, 450 tests behind it. Untouched.
src/kit-boundary.test.ts — the wrapper (trap 3). Wire it day one; the kit's README is blunt that "an unwired test is the same as no test" and that the kit erodes in a week without it.
src/layerBoundary.test.ts — new. The rank DAG. Write it while the DAG has three folders in it and passing is trivial — not once there are forty and it's a weekend.
Gate
npm run check green — typecheck + Biome + 450 core tests + all three boundary tests.
npx expo export --platform android succeeds. Metro resolves every module. This is what proves the nativewind/babel/metro/router wiring is actually right — types can't see any of it.
npx expo prebuild --platform android && cd android && ./gradlew assembleDebug produces an APK. Proves the native side links.
Add these to package.json now, and run them at the end of every step from here on:

"bundle": "expo export --platform android --output-dir .expo-export",
"apk": "expo prebuild --platform android && cd android && gradlew assembleDebug",
"verify": "npm run check && npm run bundle"
/android is already gitignored (the scaffold's .gitignore lists /ios and /android under "generated native folders"). Add .expo-export/ to it too.

Step 2 — The input model
The centrepiece, and it only works because of Phase 1.

The gesture, from Dartscape 1 (app/src/main/java/com/gworks/dartscape/ui/ScoreButton.java, the mScoreTouchListener at ~line 665):

tap = SINGLE double-tap = DOUBLE hold = TREBLE
Effort maps to the multiplier. It is genuinely intuitive, users already know it, and Screenshot_2.jpg shows the app teaching it. Keep it exactly.

The problem. ScoreButton.java:739 schedules mTapAction 250ms out, because it has to wait and see whether a second tap is coming. So every single — the most common throw in darts — sits a quarter second before anything happens. (LONG_PRESS_DURATION is 150ms, MAX_DOUBLE_TAP_DURATION is 250ms; both are at ~line 671.)

The fix. The log is the truth; undo is log.slice(0, -1). Don't wait. Land the single instantly, and if a second tap or a hold arrives, pop it and push the upgrade.

                    ┌──────────────┐
     press ────────▶│  S20 LANDS   │  instantly: sound, pop, 181 → 161
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │

release, no tap again keep holding
second tap <250ms >250ms
│ │ │
▼ ▼ ▼
SINGLE DOUBLE TREBLE
(nothing pop S20, push pop S20, push
to do) D20 → 141 T20 → 101
Same gesture your users know. Zero lag on the common case.

The cost is the feature. The score visibly changes on an upgrade (20→40). Make it deliberate: the number rolls and the visit chip recolours green→blue→orange over ~120ms. The upgrade becomes something you watch land, and it confirms the gesture took.

Rules:

The upgrade window is per-button. Tapping a different number commits the first instantly.
Hold is 250ms, not the old 150ms — short enough that a slow tap became an accidental treble.
BUST / miss / HR / OUT are single-action: no upgrade path, fire on release.
Implemented once in useDartGesture() over the whole Skia canvas, hit-testing cell bounds.
Step 3 — Screen: Setup (app/index.tsx)
┌────────────────────────────────────────┐
│ DARTSCAPE (◎) │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ╭────╮ │ │ CardSurface, tap → picker
│ │ │ 20 │ X01 › │ │ (the game's own icon)
│ │ ╰────╯ 501 · straight · double│ │
│ └──────────────────────────────────┘ │
│ │
│ START │ ← SectionHeader
│ ╭─────╮╭─────╮╭─────╮╭─────╮╭─────╮ │
│ │ 301 ││ 501 ││ 701 ││ 901 ││1001 │⟩ │ ← SegmentedButtons
│ ╰─────╯╰━━━━━╯╰─────╯╰─────╯╰─────╯ │ one tap, all options visible
│ │
│ IN OUT │
│ ╭────╮╭────╮╭────╮ ╭────╮╭────╮╭────╮│
│ │STR ││DBL ││TRP │ │STR ││DBL ││TRP ││
│ ╰━━━━╯╰────╯╰────╯ ╰────╯╰━━━━╯╰────╯│
│ │
│ MATCH │
│ ╭────────╮╭──────────╮╭─────────────╮ │
│ │ SINGLE ││ RACE TO 3││ BEST OF 5/3 │ │
│ ╰━━━━━━━━╯╰──────────╯╰─────────────╯ │
├────────────────────────────────────────┤
│ PLAYERS 2/4 │ ← ListSectionShell
│ ┌──────────────────────────────────┐ │
│ │ ⠿ (AB) AVA ✕ │ │ ⠿ drag to reorder
│ ├──────────────────────────────────┤ │ (AB) Avatar → tap = human/bot
│ │ ⠿ (🤖) HARD BOT ✕ │ │ ✕ RemoveIconButton
│ │ ╭──╮╭──╮╭━━╮╭──╮╭──╮ │ │ difficulty appears
│ │ │EZ││NM││HD││EX││MA│ │ │ only when it's a bot
│ ├──────────────────────────────────┤ │
│ │ ＋ ADD PLAYER │ │ → SelectPopup of saved players
│ └──────────────────────────────────┘ │ + "new player…"
├────────────────────────────────────────┤
│ ┏━━━━━━━━━━━━━━━━━━┓ │ ← BottomActionBar
│ ┃ START MATCH ┃ │
│ ┗━━━━━━━━━━━━━━━━━━┛ │
├────────────────────────────────────────┤
│ 👥 📊 ⚙ │ ← BottomNavBar
│ PLAYERS STATS SETTINGS │
└────────────────────────────────────────┘
The option rows are generated from GameConfig. Pick cricket and START/IN/OUT are replaced by POINTS | CUT-THROAT | NO POINTS, because that's what ConfigOf<'cricket'> says exists. Illegal combinations can't be rendered, let alone selected — the union already guarantees it. That's GameFlags.getGameVariants(flag, statsFlags, secondary) replaced by a type.

Improvements over Dartscape 1's home screen: options are one tap not two (and you can see the alternatives); bot difficulty is set where you set the player up, not hidden; drag handles set throwing order directly; 2/4 shows the seats left; the player list gets room instead of 2.5 cramped rows.

Game picker (AppModal)
Eight games in a 2×4 grid, each with its icon and a one-line hook:

┌────────────────────────────────────────┐
│ ✕ PICK A GAME │
├────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ │
│ │ (20) │ │ ╲ ✕ ⊗ │ │
│ │ X01 │ │ CRICKET │ │
│ │301 to 1501 │ │15-20 + bull│ │
│ └────────────┘ └────────────┘ │
│ ┌────────────┐ ┌────────────┐ │
│ │ ⏱ │ │ ◇ │ │
│ │ SHANGHAI │ │ BASEBALL │ │
│ │ S+D+T wins │ │ 9 innings │ │
│ └────────────┘ └────────────┘ │
│ ┌────────────┐ ┌────────────┐ │
│ │ KILLER │ │AROUND CLOCK│ │
│ │ 3 lives │ │ 1 → 20 │ │
│ └────────────┘ └────────────┘ │
│ ┌────────────┐ ┌────────────┐ │
│ │ HALVE IT │ │ BOB'S 27 │ │
│ │ blank = ½ │ │ doubles │ │
│ └────────────┘ └────────────┘ │
└────────────────────────────────────────┘
Step 4 — Screen: the game shell (app/game.tsx)
One shell, eight panels. view(state) returns a discriminated panel, so the shell owns players/visit/actions and switches only the middle.

┌────────────────────────────────────────┐
│ ← 501 · DOUBLE OUT (◎) │
├────────────────────────────────────────┤
│ ┏━━━━━━━━━━━━┓ │
│ ┃ AVA ┃ HARD BOT │ active = raised, tinted
│ ┃ 161 ┃ 284 │ score, big
│ ┃ T20 D20 ┃ │ ← checkout hint (NEW)
│ ┃ 87.24 ┃ 54.10 │ 3-dart average
│ ┗━━━━━━━━━━━━┛ │
├────────────────────────────────────────┤
│ ╭─────╮ ╭─────╮ ╭─────╮ │
│ │ T20 │ │ 20 │ │ · │ = 80 │ ← visit strip (NEW)
│ ╰─────╯ ╰─────╯ ╰─────╯ │ coloured by multiplier
├────────────────────────────────────────┤
│ │
│ [ PANEL ] │ ← one Skia canvas
│ │
├────────────────────────────────────────┤
│ ← UNDO END TURN → │ ← BottomActionBar
└────────────────────────────────────────┘
Two additions to a layout that already works:

Visit strip. Today the three darts are inferred from colour-coded grid numbers. A strip says T20 · 20 · — = 80 outright, and it's where the upgrade animation happens.
Checkout hint. bestCheckout(161,'double') → T20 D20, live. The core has had this all along; only the bot could see it.
The eight panels — reference drawings
Build only X01 in Step 2 (it's the risk slice). The rest are Step 7; their drawings live here so all eight sit together for comparison.

Every one is a Skia component taking a PanelView from core/game/view.ts — the type already exists and already has a case for each game. Read it before drawing anything.

X01 — your grid, kept.

╭─────╮ ╭───╮ ╭───╮ ╭───╮
│BUST │ │ 1 │ │ 2 │ │ 3 │
╰─────╯ ╰───╯ ╰───╯ ╰───╯ tap / double-tap / hold
… through 20 … on any circle
╭───╮ ╭──────╮
│ 20│ │ BULL │
╰───╯ ╰──────╯
Cricket — your sheet, verbatim. The notation is already right.

┃ AVA ┃ BEN CY DEE
┃ 0 ┃ 0 ● 51 60
┃1.67 ┃ 2.00 MPR 2.67 2.33
─────────────────────────────────
┃ ⊗ ┃ ✕ 20 ╲ ⊗ ⊗ closed
┃ — ┃ — 19 ╲ — ✕ 2 marks
┃ ✕ ┃ — 18 — — ╲ 1 mark
┃ — ┃ ⊗ 17 ⊗ — — none
┃ — ┃ — 16 — —
┃ — ┃ ╲ 15 — ╲
┃ — ┃ — BULL — —
Baseball — the diamond, runners animating base to base (200ms a base, your timing).

        RUNS              OUTS
         5      ╱◆╲        0
              ╱     ╲
        ⊗   ╱    2    ╲   ⊗        ⊗ runner
          ◆   GRAND      ◆         ghosted inning number
            ╲  SLAM!   ╱           behind
        ⊗     ╲     ╱
               ╲◆╱
     BASE HITS         ON BASE
         8                 0

Shanghai — the clock face from your help screen, promoted to the game screen.

          ╭─ 20 ─ 1 ─ 18 ─╮
        5                  4
       12        ╱          13     hand sweeps to the round's number
      9      ╭──╯   7        6
     14      │  7           10     S/D/T pips light as you collect
      8      ╰──╮           15
       16          ╲        2
        7  19 ─ 3 ─ 17 ─╯
              ○ S  ● D  ○ T

Killer — claim phase is the grid; kill phase shows lives as pips.

┃ AVA ┃ BEN CY
┃ 20 ┃ 19 18 claimed number
┃ ●●● ┃ ●●○ ●○○ lives
┃ ☠ ┃ killer marker
Around the Clock — a track; everyone's token on the number they're chasing.

1 2 3 4 5 6 7 8 9 10 … 20
─────●─────────────────────────── AVA
───────────────●───────────────── BEN
Halve It — seven rounds as a row, current one lit, the threat visible.

20 19 18 D 17 T B
● ● ◐ ○ ○ ○ ○
↑ round 4 — ANY DOUBLE
AT RISK ← pulses red once 2 darts are gone with nothing hit
Bob's 27 — one big double, the score, and the cliff edge.

             ╭────────╮
             │  D 7   │      the round's double, huge
             ╰────────╯
              ● ● ○           hits this visit
                27            score
             +14 / -14        what's at stake

Step 5 — Screen: Results (AppModal over the game)
Fires on the won event. Uses computeStats([game], playerId) — the whole reason the win screen is nearly free.

┌────────────────────────────────────────┐
│ 🏆 │
│ AVA WINS THE LEG │
│ 501 · DOUBLE OUT │
├────────────────────────────────────────┤
│ AVA BEN │
│ 87.24 3-DART AVG 54.10 │ ← stat name centred,
│ 102.22 FIRST 9 58.30 │ your results-screen layout
│ 33.3% CHECKOUT % 0.0% │
│ 17 BEST LEG — │
│ 1 180s 0 │
│ 32 HIGH OUT 0 │
├────────────────────────────────────────┤
│ ╭──────────╮ ╭──────────────╮ │
│ │ RESULTS │ │ NEXT LEG → │ │
│ ╰──────────╯ ╰──────────────╯ │
└────────────────────────────────────────┘
Match state comes from matchState(format, ids, results). When the match is over the title says so and NEXT LEG becomes DONE. Saving happens here: repo.saveGame().

Step 6 — Screens: Players, Stats, Settings
Players (app/players.tsx) — SettingsRow list + EditableAvatar. Create, rename, delete (with an appAlert confirm), photo via the kit's cropper. Tap a player → their stats.

Stats (app/stats.tsx) — a player picker + a game filter (SegmentedTabs), then DataTable fed by computeStats(games, playerId). stats/catalog.ts already says which stats belong to which game and how to format them, so this screen is a projection, not logic.

┌────────────────────────────────────────┐
│ ← AVA'S STATS │
│ ╭─────╮╭─────╮╭───────╮╭────────╮ │
│ │ ALL ││ X01 ││CRICKET││BASEBALL│ ⟩ │
│ ╰━━━━━╯╰─────╯╰───────╯╰────────╯ │
├────────────────────────────────────────┤
│ RATING 64.0 │ ← (MPR×10)+PPD, the league number
│ GAMES 12 │
│ WINS 8 │
│ WIN % 66.67 │
│ 3-DART AVG 87.24 │
│ FIRST 9 AVG 102.22 │
│ CHECKOUT % 33.90 │
│ BEST LEG 17 │
│ 180s 3 │
│ HIGH CHECKOUT 121 │
│ MPR 2.67 │
│ … │
└────────────────────────────────────────┘
Settings (app/settings.tsx) — ThemeControls gives appearance, accent, text scale, density, corners, motion for free. Add a Dartscape section: bot speed, sounds, checkout hints on/off, and a destructive "clear all stats" behind an appAlert.

Dropping the 13 fixed themes is an upgrade: any accent hex works, tintTowardAccent leans every surface toward it at a capped saturation, and accentContrast picks black/white by perceived brightness. That's strictly more than 13 presets, for free.

Step 7 — The remaining seven panels
X01 shipped in Step 2. Now: cricket, shanghai, baseball, killer, aroundTheClock, halveIt, bobs27 — drawings are in The eight panels above.

By this point the shell, the gesture, the store, the event pipe and the results modal all work. Each panel is now a contained job:

Read its case in core/game/view.ts → PanelView. The data is already shaped for you.
Draw it in src/ui/board/, Skia, props only, no store (rule 5).
Add its hit-test cases to hitTest.ts (pure — test it with no render).
Wire its PanelView case into features/game/Panel.tsx. The compiler will list what's missing — that's the discriminated union doing the work.
Add a matchStore test that plays it to a winner through the store. No device needed — the core already proves every game terminates; this proves the store drives it.
npm run verify.
Order: cricket → baseball → shanghai → killer → aroundTheClock → halveIt → bobs27. Cricket first because it's the most complex sheet and the most-played game after X01; baseball second because the animated runners are the only genuinely new motion problem left.

Cricket and baseball are the two that must feel like Dartscape 1 — check Screenshot_8.jpg and Screenshot_1.jpg against what you build. The ╲ ✕ ⊗ notation and the diamond are the things Jason explicitly asked to keep.

Architecture
The thing that has to be right, because it's the thing you can't fix later. Everything below is enforced by a test, not by convention — a boundary nobody checks is a boundary that's already gone.

The one idea
Two bodies of code in this app refuse to know about their surroundings, for the same reason and by the same mechanism:

core/ doesn't know a UI exists. It returns GameEvent[] as data and declares Repo as an interface. It never calls you; you call it.
spatch-kit/ doesn't know a domain exists. It declares seams with inert defaults and the app injects the real thing.
Both invert upward dependencies into downward injections, and startup/ is the one place either gets wired. That symmetry is the architecture. Everything else is bookkeeping.

The kit's README puts it best and it applies verbatim to our core: "When the kit needs something from the app, it never imports up."

The layer DAG
Every folder under src/ has a rank. A file may import from a strictly lower rank, or from its own folder. Never upward, never sideways between Leaves.

rank 6 app/ expo-router files. Thin. Route → feature.
↓
rank 5 features/ startup/ screen compositions; the composition root
↓
rank 4 ui/ effects/ our components; event → effect
↓
rank 3 state/ zustand stores
↓
rank 2 data/ the SQLite driver — implements core's Repo
↓
rank 1 types/ app-wide type leaves (AppIconName)
↓
rank 0 core/ spatch-kit/ ← LEAVES. Mutually blind.
(imports (imports only
NOTHING) ALLOWED_PACKAGES)
The rules
Rank N imports rank < N only. Enforced.
core/ imports nothing at all — not the kit, not npm, not React. It runs in node with zero mocks. Already enforced by core-isolation.test.ts.
spatch-kit/ imports only ALLOWED_PACKAGES and its own relatives. Already enforced by kitBoundary.test.ts.
The two Leaves are mutually blind. core must never import spatch-kit; spatch-kit must never import core. They're siblings at rank 0 and neither travels with the other. This is the rule that rots first and is invisible when it does.
ui/ may not import state/ — despite the ranks allowing it. See below.
app/ holds no logic. A route file is a <Screen> and a feature. If you're tempted to put a hook in app/, it belongs in features/.
Rule 5, because it's the one that'll get argued about
Ranks would let ui/ read the store. It mustn't.

// ui/board/ScoreGrid.tsx — dumb, testable, reusable
export function ScoreGrid({ view, onDart }: { view: GameView; onDart: (d: Dart) => void })

// features/game/GameScreen.tsx — the wiring lives here
const view = useMatchStore(selectView);
<ScoreGrid view={view} onDart={(d) => useMatchStore.getState().throwDart(d)} />
The payoff is concrete: ScoreGrid can be tested with a literal GameView and no store, no provider, no mocks. The moment it reaches into zustand it's welded to one app shape and you're mounting a store to test a circle. features/ is where wiring is allowed to happen — that's its whole job.

Enforcement: src/layerBoundary.test.ts
Generalises the existing src/core/core-isolation.test.ts — read that first and copy its shape. Walk the files, parse the import specifiers, assert. ~60 lines, no dependencies.

const RANK: Record<string, number> = {
core: 0, "spatch-kit": 0, types: 1, data: 2, state: 3,
ui: 4, effects: 4, features: 5, startup: 5, app: 6,
};

// for each file: rank(importer) > rank(imported), or same folder
// plus: rank-0 siblings may not import each other
// plus: ui/** may not import state/**
The kit's README asks for exactly this — "If your app ranks folders in a layer DAG, give the kit the lowest rank." Done: rank 0. kitBoundary then catches what rank can't see (npm packages, and Leaf siblings that don't travel).

Three boundary tests, three different jobs, and none of them subsumes another:

Test Guards Catches
core-isolation core/ imports nothing a stray import { useTheme } in an engine
kitBoundary the kit stays liftable a primitive importing @/state
layerBoundary the whole DAG ui/ reaching into state/, data/ importing features/
Folder structure
All paths below are under Dartscape/dartscape2/. (Dartscape/app/ — no dartscape2/ — is the old Java app. Never touch it.)

dartscape2/
app/ rank 6 — expo-router. Thin. NOT the Java app.
\_layout.tsx provider stack + <OverlayHost/> (EXACTLY ONE)
index.tsx → features/setup
game.tsx → features/game
players.tsx stats.tsx settings.tsx

src/
core/ rank 0 — Phase 1. UNTOUCHED by Phase 2.
board.ts game/ match/ bot/ stats/ store/repo.ts ← Repo is an INTERFACE

    spatch-kit/                     rank 0 — never reorganized (kit rule 1)

    types/                          rank 1 — pure type leaves
      appIconNames.ts                 AppIconName = KitIconName | our nouns

    data/                           rank 2 — implements core's seams
      sqliteRepo.ts                   op-sqlite → core's Repo interface
      migrations.ts

    state/                          rank 3 — zustand
      matchStore.ts                   { config, players, log, results } + actions
      settingsStore.ts                bot speed, sounds, hints
      selectors.ts                    memoised view/stats derivation

    ui/                             rank 4 — dumb, prop-driven, no store
      board/                          Skia. The genuinely-different bits.
        ScoreGrid.tsx  CricketSheet.tsx  Diamond.tsx  ClockFace.tsx
        Track.tsx  RoundsRow.tsx  BigDouble.tsx
        hitTest.ts                    pure: point → cell. Testable with no render.
        useDartGesture.ts             tap / double-tap / hold → Dart
      parts/                          kit-composed
        PlayerStrip.tsx  VisitStrip.tsx  GameCard.tsx  PlayerRow.tsx
        StatTable.tsx  CheckoutHint.tsx

    effects/                        rank 4 — GameEvent[] → the world
      useGameEvents.ts                the exhaustive switch
      sound.ts                        OUR seam: playSound, inert by default

    features/                       rank 5 — composition. Wiring lives here.
      setup/    SetupScreen.tsx  GamePicker.tsx  OptionRows.tsx  PlayerList.tsx
      game/     GameScreen.tsx  Panel.tsx  useBotTurn.ts
      results/  ResultsModal.tsx
      players/  PlayersScreen.tsx
      stats/    StatsScreen.tsx
      settings/ SettingsScreen.tsx

    startup/                        rank 5 — THE composition root
      registerKitSeams.ts             theme storage, icons, logger, avatars
      registerAppSeams.ts             repo, sound, clock
      index.ts                        both, at module load

scripts/sim.ts Phase 1's headless sim. Still runs.
Seams — ours, mirroring the kit's
The kit taught the pattern; the core already uses it (Repo is an interface with a memoryRepo reference impl). Formalise the rest the same way: declare the seam where it's needed, ship an inert default, inject from startup/.

Seam Declared in Inert default Real impl
Repo core/store/repo.ts memoryRepo() — in-memory, already written data/sqliteRepo.ts
playSound effects/sound.ts no-op expo-audio, wired in startup
now() core (already a param) Date.now —
newId() core crypto.randomUUID —
Why this matters beyond tidiness: the inert defaults are what let Phase 1's 450 tests run in node with zero mocks, and they're why npm run sim still works with no device. That property is worth protecting — every seam we add keeps it.

The composition root
// src/startup/index.ts — a static import from app/\_layout.tsx. Module load, not lazy.
import "./registerKitSeams";
import "./registerAppSeams";
Module load, not lazy: several seams are reachable on first paint (the theme storage seam runs before the first frame). The kit's README is explicit about this and it's a real bug if you get it wrong.

// registerKitSeams.ts
setThemeStorageSeam({ get, set }); // AsyncStorage → theme survives restart
setLoggerSeam({ error: console.error });
setAvatarPathResolverSeam(resolveAvatarPath);
registerIcons({ dart: Target, bullseye: CircleDot, trophy: Trophy, bot: Bot, … });

// registerAppSeams.ts
setRepo(sqliteRepo(openDatabase("dartscape.db")));
setSoundPlayer(expoSoundPlayer());
registerIcons is typed against AppIconName with Exclude<>, so a noun without a glyph fails to compile rather than silently rendering a fallback at 9pm in a pub.

State
matchStore holds { config, players, log, results } and nothing else. Everything is derived on read.

// state/selectors.ts
export const selectView = (s: MatchState) =>
view(reduce(s.config, s.players, s.log).state);
Operation Implementation
throw a dart log.push(dart)
undo log.pop()
upgrade single→double log.pop(); log.push(D20)
crash recovery serialise three fields
bot turn setTimeout → aim() → throwAt() → log.push(dart)
A bot dart and a human dart are indistinguishable to the core. That is what stops the bot metastasising the way GameLogic → owns GameBot → owns Handler → calls back into GameLogic.doScore did.

reduce re-folds the whole log on every read. Do not optimise this. A game is ~60 darts; it's free, and it's the reason undo can't be wrong. If it ever does show up in a profile, memoise the selector, not the fold.

Effects
GameEvent[] comes back from reduce. useGameEvents is an exhaustive switch over the union — a new event type fails to compile until it's handled.

switch (e.type) {
case "bust": shake(); popup("BUST!", danger); play("bust"); break;
case "grandSlam": confetti(); play("slam"); break;
case "won": openResults(e.seat); break;
…
default: assertNever(e); // ← the new-event tripwire
}
Effects subscribe; they are not callbacks. The old app's 12-method GameLogicListener is how UI concerns ended up living inside GameLogic. Nothing in core/ will ever import this file, and core-isolation.test.ts makes sure of it.

Data flow, end to end
One direction. Every arrow crosses a rank boundary downward.

      finger                                                    bot timer
        │                                                           │
        ▼                                                           ▼

useDartGesture (ui/board) ── tap/double-tap/hold ──▶ aim() ─▶ throwAt()
│ │
└──────────────────────▶ Dart ◀───────────────────────────┘
│
features/game ▼ matchStore.throwDart(dart)
│
state ▼ log.push(dart) ← the ONLY mutation
│
core ▼ reduce(config, players, log)
│
┌──────────────┴──────────────┐
▼ ▼
{ state, events } trace (per-dart)
│ │
┌─────────┴────────┐ ▼
▼ ▼ computeStats
view(state) GameEvent[] │
│ │ ▼
ui/parts + board effects/useGameEvents ResultsModal
(props only) sound · popup · anim
Reading it back: the log is the only thing that ever changes. reduce is pure and runs on every read. view is a projection. Events are data. Nothing above rank 0 is ever called by the core.

Undo is the proof. log.pop() and every box downstream is correct again — view, stats, events, the lot — with no undo code anywhere. If that ever stops being true, the architecture has been breached.

When things get saved
Moment What happens
every dart nothing touches disk — the log lives in the store
won event repo.saveGame({ config, players, log, winner, playedAt })
app backgrounded mid-game serialise { config, players, log } to AsyncStorage
app reopened rehydrate those three fields; reduce reconstructs everything else
stats screen computeStats(await repo.gamesFor(id), id)
Crash recovery is three fields because state is derived. The old app's UserPrefs.backupGameData(new Gson().toJson(data)) serialised a whole mutable GameData god-object, and a schema change broke every saved game.

What this buys — the refactors that can't happen now
Change Blast radius
Swap SQLite for something else data/ only. Repo is the seam.
Add a ninth game core/game/ + one ui/board/ panel + a PanelView case. Compiler lists the switches.
Redesign a screen features/ only. ui/ is prop-driven; core/ never notices.
Kit upgrade from the origin git diff --no-index, port, done. Nothing else imports into it.
A new stat core/stats/ + catalog.ts. Re-derived from the log for all history — no migration.
Drop React entirely core/ and scripts/sim.ts still run. That's the test of whether the layering is real.
Motion
Reanimated for transforms, Skia for what's drawn, theme.motion.\* for durations (zeroed under reduce-motion, so honouring the preference is free).

Event Motion
dartScored Button flashes its multiplier colour; score rolls; chip drops into the visit strip.
upgrade Chip recolours green→blue→orange, score rolls 20→40. ~120ms. This is the feedback.
bust Shake, red BUST! popup, score snaps back to the visit start.
won Trophy + confetti, then the results modal.
targetClosed Mark strikes through to ⊗, scratch sound.
homeRun/grandSlam Runners sweep the diamond, 200ms a base.
visitEnded Active panel slides to the next player.
The old app's BlurMaskFilter + LAYER_TYPE_SOFTWARE dance disappears — Skia blurs on the GPU. So do the drawable-v21/ duplicates and the VERSION_CODES.LOLLIPOP branches.

Do not port the view-per-button design. GameFragment.java:199 allocates ScoreButton[MAX_PLAYERS][NUMBER_COUNT] — dozens of Views each with its own onDraw and touch listener. One Skia canvas per panel, hit-test against cell bounds. One render pass, and the gesture state machine lives in one place instead of forty.

Execution protocol
Execute Steps 1 → 7 in one pass. Do not stop for approval between steps. Jason will review at the end, not during.

Step order: 1 Foundation → 2 Input model + X01 panel → 3 Setup → 4 Game shell → 5 Results → 6 Players/Stats/Settings → 7 the other seven panels.

Steps 2 and 4 come early on purpose: they are the risk. Skia, Reanimated, the gesture and the store all have to work together for X01 before anything else is worth building. Without a device you prove that with npm run verify (types + bundle) plus the pure dartGesture and hitTest tests — not by looking at it. If the bundle won't build with Skia and Reanimated in it, you want to know on day one, not in step seven.

The rules
Every step ends green. npm run check passes before the next step starts. Never carry a red gate forward — you will not find the cause three steps later.
When something breaks, fix it and keep going. Do not stop and report. Do not leave a TODO. Do not comment out a failing test.
Tests ship in the same step as the code, not batched at the end.
A decision that's genuinely Jason's: pick the most reversible option, write it in dartscape2/PLAN.md's decisions log with the reason, and continue. Do not block.
Read the Expo v57 docs before Expo-facing code — dartscape2/AGENTS.md requires it and Step 1 is entirely Expo-facing.
Never git add -A. Stage explicit paths. Uncommitted work you didn't do is normal in this repo (app/version.properties is already dirty and is not yours).
Never modify app/ (Dartscape 1) or src/core/ (Phase 1) or reorganize src/spatch-kit/. Three tests enforce the last two; nothing enforces the first, so it's on you.
Report once, at the end — what works, what doesn't, what you decided and why. Be honest about anything you skipped or couldn't verify.
When you get stuck
In rough order of usefulness:

spatch-kit/README.md → "Things that look wrong and aren't" — a list of hard-won non-obvious behaviours that look like bugs. Check it before "fixing" anything in the kit.
npm run sim — the core, headless. If the UI is confusing you, the sim shows what the data actually does.
Dartscape 1's Java in app/src/main/java/com/gworks/dartscape/ — the reference for what the product is. Never for how to build it.
The screenshots in screenshots/ — the design brief.
Anti-goals
Things that will look like progress and aren't:

Do not optimise reduce. It re-folds the whole log on every read. That is deliberate, it is free at ~60 darts, and it is why undo cannot be wrong.
Do not port the view-per-button design. One Skia canvas per panel. See Motion.
Do not "tidy" the kit. Its layout is what makes it diffable against the origin.
Do not add a state library, a nav library, or an animation library. Zustand, expo-router and Reanimated are already chosen and already installed.
Do not weaken a boundary test to make something pass. The test is right; the import is wrong.
Verification
Phase 1 was provable in node. Phase 2 is mostly provable without a device — and the part that isn't, you hand to Jason honestly rather than guessing.

What you must prove
npm run check — typecheck, Biome, 450 core tests still green, and all three boundary tests: core-isolation (Phase 2 never touched src/core/\*\*), kitBoundary (the kit is still liftable), layerBoundary (the DAG holds).
npm run bundle — expo export resolves every module through Metro. Catches the whole class of "it compiles but won't run": a missing dep, a bad path, the reanimated plugin in the wrong order, nativewind not seeing the kit.
npm run apk — gradlew assembleDebug produces an APK with no device attached. Proves Skia, Reanimated, gesture-handler and op-sqlite all link.
npm run sim — the core still plays headless. If this breaks, you touched core/.
git diff --stat -- dartscape2/src/core is empty.
git diff --no-index against the kit origin shows only the one deliberate reformat commit — no whitespace bleeding into anything else.
The headless "play the game" test
You can't play it, but the store can. This is the closest thing to step 3 of the old plan, and it's a real test:

// state/matchStore.test.ts — no device, no render, no React
it("plays a full 501 leg through the store", () => {
useMatchStore.getState().start(X01_501, [human, hardBot]);
while (!selectView(useMatchStore.getState()).winner) {
const v = selectView(useMatchStore.getState());
useMatchStore.getState().throwDart(botDartFor(v)); // same path a finger takes
}
expect(selectView(useMatchStore.getState()).winner).not.toBeNull();
});
If a leg plays to a winner through the real store with the real reducer, the only thing left unproven is pixels.

New tests to write — all pure, all device-free
ui/board/dartGesture.test.ts — the input model. Synthetic timings: up at t=40 → single; second down at t=180 → double with replacesPrevious; hold to t=300 → treble; a different cell commits the first. This is how you prove Step 2 without a finger.
ui/board/hitTest.test.ts — point → cell, for all eight panels. Pure geometry, same shape as the existing core/board.test.ts.
state/matchStore.test.ts — undo pops one dart; upgrade pops-and-pushes; a bot dart and a human dart take the same path; a full leg plays (above).
state/selectors.test.ts — selectView over a hand-written log.
effects/useGameEvents.test.ts — every GameEvent maps to an effect, via assertNever so a new event fails to compile.
src/layerBoundary.test.ts — the rank DAG.
What you cannot prove — say so
Put this list in your final report, marked unverified:

It looks right against screenshots/.
The gesture feels right on glass.
The kit's own smoke test (modal + keyboard; dark mode toggled with an overlay open; icons rendering). Its README is explicit that static checks cannot see these.
Sound, haptics, animation timing.
Open items — already decided. Do not stop to ask.
Icons for Halve It / Bob's 27 / Around the Clock. The other five have one in Dartscape 1. Design them from the existing visual language (chunky, single-glyph, readable at 40px), register them via registerIcons, note them in the decisions log.
END TURN with instant singles. Keep the button. Baseball needs it (a visit runs to three outs, not three darts) and so does any short visit.
Teams. core's Player has no teammate concept; Dartscape 1 has getTeamName() and isTeammateTurn(). Out of MVP scope. It's a small core change later — don't start it.
Halve It starts on 40. Arbitrary; it just gives the halving something to bite on in round one. Leave it.
Baseball at-bats are unbounded — three outs end them, not three darts, so a 9-inning game can run ~138 darts. That's faithful to Dartscape 1 (getThrowsInRound() returns 9999 for baseball). Leave it; flag it in the final report.
Definition of done
You are finished when all of these are true:

[ ] npm run check green — typecheck, Biome, 450 core tests, three boundary tests.
[ ] npm run bundle green — Metro resolves everything.
[ ] npm run apk green — a real APK exists at android/app/build/outputs/apk/debug/app-debug.apk.
[ ] A full 501 leg plays to a winner through the store, in a test, no device.
[ ] All eight games have a panel, a hit-test, and a store test that plays them to a win.
[ ] dartGesture is a pure state machine with tests covering single / double / treble / cross-cell commit.
[ ] Every screen exists and routes: Setup, Game, Results, Players, Stats, Settings.
[ ] src/core/** has zero changes from Phase 2. git diff --stat proves it.
[ ] src/spatch-kit/** has zero changes, or exactly one deliberate reformat commit.
[ ] dartscape2/PLAN.md's decisions log records every call you made.
[ ] The APK path and the unverified-on-device list are in your final report.
The handoff
Jason has the phone; you don't. End with a short list he can work through in ten minutes:

BUILT, UNVERIFIED ON DEVICE — please check:

1. Install: adb install android/app/build/outputs/apk/debug/app-debug.apk
2. Setup screen matches screenshots/Screenshot_6.jpg in spirit
3. Gesture: tap = single (instant?), double-tap = double (does the roll read?),
   hold = treble (does 250ms feel right, or does a slow tap misfire?)
4. Kit smoke: open the game picker, toggle dark mode WITH IT OPEN, check icons
5. Play a 501 leg vs a bot
   Be honest. "Built but never run" is the true and useful thing to say. "Done" when nothing has been on glass costs more than the whole plan saved.

Where this document lives
The canonical copy is committed at Dartscape/PHASE2_PLAN.md (repo root). Read it from there. If you find a copy elsewhere and they disagree, the repo one wins.

Keep it current: when reality contradicts the plan, edit the plan and note it in dartscape2/PLAN.md's decisions log. A plan that lies is worse than no plan — the next person believes it.
