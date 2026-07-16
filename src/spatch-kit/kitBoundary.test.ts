import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// ============================================================================
// KIT BOUNDARY — spatch-kit must stay liftable into another app as a pure move.
// ============================================================================
//
// THIS TEST LIVES INSIDE THE KIT ON PURPOSE. It is the kit's own contract, so it travels with
// `cp -r spatch-kit` — a copied kit arrives already defended instead of arriving naked and hoping
// someone writes a guard later. It is deliberately SELF-CONTAINED (no repo helpers) and locates the
// kit from __dirname, not process.cwd(), so it runs from any repo at any path with no configuration.
//
// WIRING IT UP IN A NEW APP: import this file from whatever your test runner runs. It throws on
// violation and logs one line on success. If your app has no runner yet, `npx tsx
// src/spatch-kit/kitBoundary.test.ts` works standalone — an unwired test is the same as no test.
//
// WHAT IT ENFORCES. The kit may import: relative paths (they travel with it), node: builtins, and
// the npm packages on ALLOWED_PACKAGES. Nothing else. In particular NOT your app's aliases — an
// import of @/data from a primitive compiles perfectly and only fails much later, as a mystery, when
// someone tries to reuse the folder. That silence is what this converts into a build failure.
//
// IF YOUR APP RANKS FOLDERS (this kit's origin app has a layerBoundary test with a rank DAG), give
// the kit the LOWEST rank — a Leaf that imports nothing above itself. That catches app-alias imports
// too, and this test then adds what rank cannot see: npm packages, and the fact that same-rank Leaf
// siblings (a `utils/` folder, say) still do not travel with the kit.

const KIT_DIR = __dirname;

// The kit's dependency manifest. Every app that takes the kit must install these, so ADDING ONE IS A
// REAL DECISION — that friction is the point, not an obstacle.
const ALLOWED_PACKAGES = new Set([
  "react",
  "react-dom",
  "react-native",
  "nativewind",
  "react-native-reanimated",
  "react-native-safe-area-context",
  "react-native-gesture-handler", // ui/overlays/crop only
  "react-native-svg",
  "@gorhom/portal", // the PRIVATE teleport behind OverlayPortal
  "@react-native-async-storage/async-storage", // backs hooks/keyboardHeightMemory
  "lucide-react-native", // AppIcon's glyph source
  "expo-linear-gradient", // ui/primitives/Skeleton
  "expo-image-manipulator", // ui/overlays/crop (dynamically imported)
  "expo-router/react-navigation", // useIsFocused, in ui/utils/navigation
]);

// Alias imports the kit is allowed to make. EMPTY BY DEFAULT — a portable kit reaches for nothing
// outside itself. The origin app permits exactly one narrow exception (see below); if you copy this
// kit and want a similar carve-out, add it here DELIBERATELY and keep it narrow. A prefix like
// "@/utils/" is not narrow: it is a door.
//
// This app did not take the origin's @/core/utils platform-neutral helper package, so the two
// helpers it provided (phone formatting, date math) are vendored locally under
// @spatch-kit/utils/ instead — see that folder's header comment.
const ALLOWED_ALIAS_PREFIXES = ["@spatch-kit/"];

// Matches the specifier of: from "x", import "x", import("x"), export * from "x", require("x").
const IMPORT_SPEC =
  /(?:from\s*|import\s*\(\s*|import\s+|export\s+\*\s+from\s*|require\s*\(\s*)["']([^"']+)["']/g;

const SKIP_DIRS = new Set(["node_modules", "dist"]);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      collectSourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

function isAllowed(spec: string): boolean {
  if (spec.startsWith(".")) return true; // relative — travels with the kit
  if (spec.startsWith("node:")) return true;
  if (ALLOWED_ALIAS_PREFIXES.some((prefix) => spec.startsWith(prefix))) {
    return true;
  }
  if (spec.startsWith("@/")) return false; // any other app alias — never travels
  if (ALLOWED_PACKAGES.has(spec)) return true;
  // Match the package root so subpath imports resolve (expo-router/react-navigation, …).
  const root = spec.startsWith("@")
    ? spec.split("/").slice(0, 2).join("/")
    : spec.split("/")[0];
  return ALLOWED_PACKAGES.has(root);
}

function main() {
  const files = collectSourceFiles(KIT_DIR);
  assert.ok(
    files.length > 0,
    `kit boundary: found NO source files under ${KIT_DIR} — this test must never pass by scanning nothing.`,
  );

  const violations: string[] = [];

  for (const file of files) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const match of src.matchAll(IMPORT_SPEC)) {
      const spec = match[1];
      if (!isAllowed(spec)) {
        violations.push(`${path.relative(KIT_DIR, file)} → ${spec}`);
      }
    }
  }

  assert.deepEqual(
    violations.sort(),
    [],
    "kit boundary: spatch-kit imported something that will NOT travel with it. The kit must stay " +
      "liftable into another app as a pure move.\n" +
      "  • an app alias (@/…) → invert it behind a seam with an inert default, wired from your app's " +
      "composition root (see ui/overlays/core/loggerSeam and ui/primitives/avatarPathSeam for the shape).\n" +
      "  • a domain/schema/engine type → declare the minimal shape the kit READS instead (see " +
      "KitFieldConfig in ui/forms/fieldValueUtils).\n" +
      "  • a new npm package → add it to ALLOWED_PACKAGES here, deliberately: every app that takes " +
      "the kit must install it.\n" +
      `  violations:\n${violations.map((v) => `    ${v}`).join("\n")}`,
  );

  console.log(
    `[kit-boundary] OK (scanned ${files.length} files; ${ALLOWED_PACKAGES.size} allowed packages)`,
  );
}

main();
