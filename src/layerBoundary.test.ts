import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The layer DAG (GRAND_PLAN.md's Architecture section). Generalises core-isolation.test.ts's shape
 * to every rank: a file may import from a strictly lower rank, or from its own folder. Never
 * upward, never sideways between the two rank-0 Leaves — and ui/** may not import state/** even
 * though rank alone would allow it (architecture rule 5: ui/ is prop-driven, wiring lives in
 * features/).
 */

const SRC_DIR = resolve(process.cwd(), "src");
const APP_DIR = resolve(process.cwd(), "app");

const RANK: Record<string, number> = {
  core: 0,
  "spatch-kit": 0,
  types: 1,
  data: 2,
  state: 3,
  ui: 4,
  effects: 4,
  features: 5,
  startup: 5,
  app: 6,
  // Loose files directly under src/ (kit-boundary.test.ts, this file) are cross-cutting boundary
  // tests, not part of the DAG proper — rank them above everything so they may import any tier.
  srcRoot: 7,
};

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Every module specifier in `source`, from static imports/exports and dynamic import(). */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s[^'"]*from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      if (m[1] !== undefined) specs.push(m[1]);
    }
  }
  return specs;
}

/** The top-level folder (under src/, or "app") a file lives in — that folder's name is its rank key. */
function tierOf(absPath: string): string {
  if (absPath.startsWith(APP_DIR)) return "app";
  // Normalise to forward slashes: path.relative yields backslashes on Windows, and the checks below
  // are written for "/". Without this, every multi-segment tier is misread as a loose srcRoot file.
  const rel = relative(SRC_DIR, absPath).split(sep).join("/");
  const first = rel.split("/")[0] ?? "";
  if (rel.includes("/")) return first;
  // A single-segment path is ambiguous: "@/startup" resolves to the directory src/startup (its
  // index.ts), while "kit-boundary.test.ts" is a real loose file at the src root. A known tier
  // name wins as the folder; anything else is a loose cross-cutting file (see RANK.srcRoot).
  return first in RANK ? first : "srcRoot";
}

/** Resolve an import specifier to an absolute path (best-effort — extension/index resolution isn't
 * needed because we only care which top-level tier it lands in). */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (spec.startsWith(".")) {
    return resolve(dirname(fromFile), spec);
  }
  if (spec.startsWith("@spatch-kit/")) {
    return resolve(SRC_DIR, "spatch-kit", spec.slice("@spatch-kit/".length));
  }
  if (spec.startsWith("@/")) {
    return resolve(SRC_DIR, spec.slice("@/".length));
  }
  return null; // a bare npm package — not part of the DAG
}

const allFiles = [...tsFilesUnder(SRC_DIR), ...tsFilesUnder(APP_DIR)];

describe("layer boundary", () => {
  it("finds source files to check", () => {
    expect(allFiles.length).toBeGreaterThan(0);
  });

  it.each(allFiles.map((f) => [relative(process.cwd(), f), f] as const))(
    "%s only imports rank <= its own (or its own tier)",
    (_label, file) => {
      const importerTier = tierOf(file);
      const importerRank = RANK[importerTier];
      expect(importerRank, `unknown tier "${importerTier}" for ${file}`).toBeDefined();

      const offenders: string[] = [];

      for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
        const target = resolveSpecifier(file, spec);
        if (target === null) continue; // bare npm package

        const importedTier = tierOf(target);
        if (importedTier === importerTier) continue; // same folder, always fine

        const importedRank = RANK[importedTier];
        if (importedRank === undefined) continue; // outside src/app entirely (shouldn't happen)

        if (importedRank >= importerRank) {
          offenders.push(
            `${spec} (${importerTier}[${importerRank}] -> ${importedTier}[${importedRank}])`,
          );
          continue;
        }

        // Rule 5: ui/ and effects/ (rank 4) may not reach into state/ despite the rank allowing it.
        if ((importerTier === "ui" || importerTier === "effects") && importedTier === "state") {
          offenders.push(
            `${spec} (ui/effects must not import state/ — wiring belongs in features/)`,
          );
        }
      }

      expect(offenders).toEqual([]);
    },
  );
});
