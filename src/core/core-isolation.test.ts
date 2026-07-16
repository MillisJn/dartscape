import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The core must run in node with zero mocks. No React, no react-native, no
 * native modules, no third-party anything. If this test fails, the layering
 * described in PLAN.md has been breached and Phase 2 is no longer just wiring.
 *
 * Rules:
 *   - relative imports must resolve to somewhere inside src/core
 *   - bare imports are forbidden outright, except `vitest` and `node:*`
 *     inside test files
 */

const CORE_DIR = resolve(process.cwd(), "src/core");

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Every module specifier in `source`, from static imports/exports and dynamic import(). */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/g, // static, with bindings
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g, // bare side-effect import
    /(?:^|\n)\s*export\s[^'"]*from\s*['"]([^'"]+)['"]/g, // re-export
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // cjs
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      if (m[1] !== undefined) specs.push(m[1]);
    }
  }
  return specs;
}

const files = tsFilesUnder(CORE_DIR);

describe("core isolation", () => {
  it("finds core source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(CORE_DIR, f), f] as const))(
    "%s imports nothing outside src/core",
    (_label, file) => {
      const isTest = file.endsWith(".test.ts");
      const offenders: string[] = [];

      for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
        if (spec.startsWith(".")) {
          // Relative: must land inside the core.
          const target = resolve(dirname(file), spec);
          if (!target.startsWith(CORE_DIR)) {
            offenders.push(`${spec} (escapes src/core)`);
          }
          continue;
        }
        // Bare specifier.
        if (isTest && (spec === "vitest" || spec.startsWith("node:"))) continue;
        offenders.push(`${spec} (third-party import)`);
      }

      expect(offenders).toEqual([]);
    },
  );
});
