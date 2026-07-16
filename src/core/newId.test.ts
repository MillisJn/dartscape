import { afterEach, describe, expect, it } from "vitest";

import { newId, setIdGenerator } from "./newId";

describe("newId", () => {
  afterEach(() => {
    setIdGenerator(() => `id-${Math.random()}`);
  });

  it("is inert by default: no crypto global required, still unique", () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
  });

  it("can be swapped for a real generator, seam-style", () => {
    setIdGenerator(() => "fixed-id");
    expect(newId()).toBe("fixed-id");
  });
});
