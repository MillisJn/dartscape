# SpatchKit

The reusable UI foundation: theming, an overlay/modal system, keyboard-aware forms, motion,
~58 primitives, and settings chrome. **132 files.** It knows nothing about any app's domain, and
that's enforced by a test that ships inside this folder — not by convention.

---

## Read this first: what this folder actually is

**This is a copy, not a dependency.** SpatchKit is deliberately *not* an npm package yet. It lives as
a plain folder inside each app that uses it, and those copies **will diverge**. That's the plan, not
a failure.

**Why:** as of writing, the kit is still being actively designed — its paths are ~26% of all commits
in the origin app with a ~3:1 feat:fix ratio. A shared package's whole value is that changes
propagate; its whole cost is that every change must be coordinated. At two apps, with the design
still moving, that trade is bad: you'd pay a cross-repo tax on ~1 in 4 commits to propagate changes
the other app mostly wouldn't want (one app's *"go list-only"* redesign is not another app's).

**So the strategy is:** copy it, let the copies diverge, and **let the divergence tell you what the
kit really is.** Whatever stays identical across two real apps is genuinely shared. Whatever drifts
was never shared — and you'd have guessed wrong about it on day one. When the signal fires (see
[When to extract](#when-to-extract)), the diff between the copies *is* the design document for the
package.

**Which means the two rules below aren't housekeeping — they're the whole mechanism.**

---

## The two rules that keep this working

### 1. Never reorganize this folder

Don't rename files, don't restructure directories, don't "tidy" it. The moment the layout diverges,
`git diff --no-index` stops being mechanical and you lose the ability to see drift at all. Add files,
edit files — but keep the shape.

### 2. Copy the formatting config with it

Bring the origin app's prettier / eslint / editorconfig settings across. **This is the one that
silently kills the whole plan:** if your app formats even slightly differently, the first save
rewrites whitespace across 132 files and every future diff is 100% noise. You won't notice until the
day you need the diff, and by then it's unrecoverable.

---

## Setting it up in a new app

### 1. Copy the folder

```bash
cp -r <origin>/app/src/spatch-kit  <new-app>/src/spatch-kit
```

### 2. tsconfig

```jsonc
{
  "compilerOptions": {
    "moduleSuffixes": [".native", ".web", ""],   // MANDATORY — see below
    "paths": { "@spatch-kit/*": ["./src/spatch-kit/*"] }
  }
}
```

**`moduleSuffixes` is not optional.** The overlay system resolves through `.native.tsx` / `.web.tsx`
pairs (`OverlayPortal`, `OverlayHost`, `OverlayPlaneProvider`, `cropImage`, `TimeInput`). Omit it and
**web silently renders the native implementation** — it presents as a styling bug, not a resolution
bug, and costs a day. If your test runner has its own tsconfig, repeat the path there: `paths`
**replaces**, it does not merge.

### 3. Dependencies

The manifest is `ALLOWED_PACKAGES` in [`kitBoundary.test.ts`](./kitBoundary.test.ts) — that list *is*
the contract:

`react` · `react-dom` · `react-native` · `nativewind` · `react-native-reanimated` ·
`react-native-safe-area-context` · `react-native-gesture-handler` (cropper only) · `react-native-svg` ·
`@gorhom/portal` · `@react-native-async-storage/async-storage` (keyboard memory) ·
`lucide-react-native` · `expo-linear-gradient` (Skeleton) · `expo-image-manipulator` (cropper) ·
`expo-router/react-navigation` (navigation utils)

### 4. Wire up the boundary test — do this on day one

```ts
import "@spatch-kit/kitBoundary.test";     // from your runner
// or standalone, before you have one:
// npx tsx src/spatch-kit/kitBoundary.test.ts
```

It's self-contained and locates itself from `__dirname`, so it needs no configuration. **An unwired
test is the same as no test**, and without it the kit erodes in a week — the first `@/data` import
from a primitive compiles fine and nobody notices until the next copy fails.

Then open it and check two constants:
- `ALLOWED_ALIAS_PREFIXES` — it permits `@/core/utils/` for the origin app's platform-neutral helper
  package. **If you didn't take that package, delete that entry** and vendor the two helpers instead
  (`ui/primitives/TextField` and `ui/time/*` are the only consumers).
- `ALLOWED_PACKAGES` — trim anything you didn't install (drop `react-native-gesture-handler` and
  `expo-image-manipulator` if you skip the cropper).

If your app ranks folders in a layer DAG, also give the kit the **lowest rank** — a Leaf that imports
nothing above itself. That catches app-alias imports structurally; `kitBoundary` then adds what rank
can't see (npm packages, and same-rank Leaf siblings that don't travel).

### 5. nativewind + the CSS variables

`theme/nativewind.ts` emits `--fp-*` CSS variables that your `global.css` must declare in an
`@theme inline` block, and your metro nativewind `content` glob must cover the kit.

**The `inline` keyword is load-bearing.** Without it Tailwind emits `--color-x: var(--fp-x)` on
`:root`, where the `--fp-*` vars don't exist (they're set on a nested wrapper) — every themed token
computes to an invalid value and **the app renders unstyled**. Same class of trap: import Tailwind's
utilities **unlayered**, because react-native-web injects its base styles unlayered and any unlayered
rule beats any layered one — so `bg-*` / `p-*` silently no-op.

### 6. Root layout

```tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <AppThemeProvider>
      <OverlayPlaneProvider>
        <YourApp />
        <OverlayHost />   {/* EXACTLY ONE */}
      </OverlayPlaneProvider>
    </AppThemeProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Exactly **one** `OverlayHost` — it owns the app's single `BackHandler`, and a dev-only invariant
throws if two mount. On web it also re-injects the `--fp-*` vars onto the overlay root, because
portalled content lives outside the app's wrapper div.

### 7. Register nothing (until you want to)

Every seam has an **inert default**. A new app that registers nothing still works:

| Seam | Inert default | Register it when… |
|---|---|---|
| `setThemeStorageSeam` | theme doesn't persist | you want it to survive a restart |
| `setLoggerSeam` | `console.error` | you have a telemetry sink |
| `setAvatarPathResolverSeam` | avatars show initials | you store avatar files |
| `registerBaseCalendar` | `DateTimePicker` has no calendar | you supply a month grid |
| `registerIcons` | your icon names show a fallback | you have app-specific nouns |

Wire them from one composition root at **module load**, not lazily — several are reachable on first
paint. (Origin app: `startup/registerKitSeams.ts`, a static import from the root layout.)

### 8. Smoke it

Static checks can't see any of this. On device **and web**: open a modal with a text field (the sheet
seats flush above the keyboard), toggle accent + dark mode **with an overlay open** (the `--fp-*`
vars resolve inside the portal), and check your icons render (the registration path).

---

## What's in it

| Area | Files | What |
|---|---|---|
| `theme/` | 8 | `createAppTheme`, palettes/scales, `AppThemeProvider`, `useTheme` |
| `ui/primitives/` | 58 | Buttons, fields, pickers, calendar, surfaces, `AppIcon`, `Skeleton` |
| `ui/overlays/` | 35 | The portal/modal system: `AppModal`, tiers, presence, tooltips, alerts, cropper |
| `settings/` | 9 | Settings rows + `ThemeControls` (a complete appearance screen) |
| `ui/utils/` | 7 | `deferPastCommit`, navigation helpers, relative time |
| `ui/animated/` | 4 | Motion drivers: crossfade, collapse, popover, sheet |
| `hooks/` | 3 | Keyboard height, keyboard memory, inset collapse |
| `ui/time/` | 3 | Time-range draft model |
| `ui/responsive/` `ui/layout/` `ui/forms/` | 5 | `useLayoutMode`, `DataTable`, field-value helpers |

---

## Why it's shaped this way

When the kit needs something from the app, it **never imports up**. It declares a seam with an inert
default and the app injects the real thing at a composition root. That is the only sanctioned
direction of travel, and it's the entire reason this folder is copyable at all.

### The rule

> **Package the behavior. Let the app own the look.**

If an app needs a different look: reach for **theme tokens** first, then a **prop**. If it needs
something genuinely different, **write your own component and import the kit's hooks** (`useTheme`,
`animatePressProgress`, `useOverlayPresence`, `deferPastCommit`). That's ~40 lines and you still get
reduce-motion, focus rings, and correct web behavior.

The failure mode to avoid is the opposite: keeping the kit's component but editing the kit to fit one
app. That's how a kit becomes a liability. Writing your own component should feel **normal**, not like
defeat.

---

## The two extension points you'll actually use

### Icons — the kit owns affordances, you own nouns

`KitIconName` is UI vocabulary: `create`, `edit`, `close`, `chevronDown`, `checkbox`, `clock`,
`phone`… It deliberately does **not** know what a "job" or an "invoice" is. Your nouns are yours:

```ts
// types/appIconNames.ts — a Leaf, so any tier can type an `icon` field against it
export type AppIconName = KitIconName | "jobs" | "invoice";

// startup/registerAppIcons.ts — Exclude<> makes this map exhaustive: a name
// without a glyph fails to COMPILE rather than silently rendering a fallback.
registerIcons({ jobs: Hammer, invoice: ReceiptText });
```

Kit props take `IconName` (`KitIconName | (string & {})`) — permissive, because the kit can't know
your names, with the kit's names still autocompleting. Keep strictness where it matters by typing
your own `icon` **fields** against your own closed union. An unmapped non-empty name renders a
neutral glyph and warns once in dev.

### Settings — the kit owns the mechanism, you own the keys

```ts
type MySettingsKey = "account" | "appearance" | "billing";

const MY_GROUPS: SettingsGroup<MySettingsKey>[] = [
  { title: "GENERAL", items: [{ icon: "settings", key: "account", title: "Account" }] },
];
```

`ThemeControls` is a complete appearance screen (light/dark, accent, text scale, density, corners,
motion, date format) and needs nothing wired — it works in memory on day one.

---

## Theming

`createAppTheme(selection)` is a **pure function** of 8 knobs: `appearance`, `primaryColor`,
`textScale`, `density`, `cornerStyle`, `motion`, `dateFormat`, `showTooltips`.

Base palettes are **neutral grey** with no hue baked in. The whole accent family is derived at runtime
from one hex (`getAccentFamily`), and `tintTowardAccent` leans every surface/border toward that hue at
a capped saturation — so any accent works, and a hot yellow tints no harder than a soft blue.
`accentContrast` picks black/white by YIQ perceived brightness.

**Reach for theme tokens before writing a component.** `theme.motion.duration`, `theme.space`,
`theme.radius` mean most "make it look different in my app" requests are a *config* change, not a
fork. `theme.motion.*` is zeroed under reduce-motion, so honoring the preference is free.

---

## Working across two copies

### Seeing drift — git already tracks it, don't do it by hand

```bash
# What differs between the copies, right now (no shared history needed)
git diff --no-index ../<origin>/app/src/spatch-kit  ./src/spatch-kit

# What changed in the kit and WHY, in either repo
git log --oneline -- src/spatch-kit
```

Path-based, so it works whether or not anyone remembered to scope a commit message.

### Committing changes to the kit

- **Scope kit commits to the kit.** Don't mix a kit change and an app change in one commit — the whole
  point is that a kit commit can be read, judged, and ported on its own.
- **Say which kind it is** in the message. A fix/perf/upgrade is a candidate to port; a fit ("this app
  wants it different") is not. Future-you cannot reconstruct that intent from a diff.
- **Port infra fixes the same day, never in batches.** While the context is hot it's a `git diff` and
  a paste. Three weeks later you have to re-derive *why*, which is exactly when people stop bothering
  — and batching, not laziness, is what actually kills this.

### The monthly review

Not "analyze the diff" — that produces prose you can't act on. Ask three questions per drifted hunk:

1. **Fix or fit?** Fix (bug, perf, RN upgrade) → port both ways. Fit → leave it.
2. **If it's a fit, why wasn't it a theme token or a prop?** That's the kit's API telling you what it's
   missing. Fixing *that* is worth more than porting the fit.
3. **Did the same fix land twice, independently?** That's the loudest extract signal there is.

The output is a decision per hunk.

### What will force the issue

**RN/Expo upgrades.** The first time one app jumps ahead, the kit has to work on two versions at once —
a real fork, not a tweak. Upgrade the apps close together, or treat that as the moment you either
extract or accept a permanent split.

### When to extract

```bash
# 1. feat:fix must INVERT (fix > feat) — design done, maintenance left
git log --format='%s' -- src/spatch-kit | sed -E 's/^([a-z]+)(\(.*\))?:.*/\1/' | sort | uniq -c | sort -rn

# 2. weekly share under ~10% of all commits, sustained ~1 month
git rev-list --count HEAD --since="4 weeks ago" -- src/spatch-kit
git rev-list --count HEAD --since="4 weeks ago"
```

…plus a **third app**. Two apps justify copying; three justify a library.

Then: add a `package.json`, move the 14 deps to peers, add a build (`"prepare": "tsc"` — Metro doesn't
reliably transpile TS inside `node_modules`), keep `moduleSuffixes`, and consume it as
`github:<user>/spatchkit#v1.0.0`. Pinning is what kills the update treadmill: publishing v1.3 reaches
**no** app until that app asks. Propagation is pull, not push.

---

## Things that look wrong and aren't

Hard-won, non-obvious, and easy to "fix" back into a bug:

- **Overlay shadows are `boxShadow`-only, never `elevation`.** Android elevation shadows don't fade
  with animated opacity and make maps flicker.
- **`OverlayPortal` keys every layer by a stable `layerId`.** gorhom's `PortalHost` renders
  `state.map(item => item.node)` **without keys**, so React reconciles by array index — closing an
  early layer would remount every later one.
- **The keyboard lift measures `screenY`, not `endCoordinates.height`.** The latter under-reports on
  edge-to-edge Android (it excludes the nav-bar inset), leaving the sheet slightly *under* the keyboard.
- **`AppModal` freezes the window height while the keyboard is down.** Overlays teleport into one
  in-tree host, so Android `adjustResize` shrinks the whole root; measuring against the frozen height
  is what lets non-lifting modals ignore the keyboard.
- **`keyboardHeightMemory` persists the last real height.** The OS *cannot* report keyboard height
  while hidden — Android's `getInsetsIgnoringVisibility(Type.ime())` throws by design, and iOS's
  keyboard is a separate process with no query API. Remembering is the only option.
- **Never use native `autoFocus`.** It triggers `findNextFocusableElement` on a tree that's still
  committing — a use-after-free that SIGABRTs on Android release ("Scudo ERROR: invalid chunk state").
  Use `deferPastCommit` + `.focus()`.
- **`useSurfaceEnter` before measuring inside a sheet.** A native-driver slide reports the surface at
  its pre-animation resting place *as a stable value*, so "has it stopped moving?" heuristics lie.
- **`useKeyboardHeight(enabled)`'s flag is load-bearing.** Non-lifting modals pass `false` so a
  keyboard event never re-renders an animating tree.
- **`SectionSurface` must tint on press.** Cards nested in a tappable section suppress their own
  feedback on the understanding that the section owns it.
- **`AppIcon` falls back to a neutral glyph rather than throwing.** `icon` fields are plain strings by
  the time they arrive; Lucide throws on an undefined component, which would take out the screen.
- **`inertExemptPresence` lives in the overlay core, not in a maps folder.** The inerting decision is
  the overlay system's, so the exemption register is too — the map is only a *reporter*. That's what
  lets an app with no maps register nothing and still be correct.
