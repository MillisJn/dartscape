import { describe, expect, it } from "vitest";

describe("spatch-kit", () => {
  it("stays liftable into another app", async () => {
    // The kit's own boundary script. It throws on a real violation at import time.
    await expect(import("./spatch-kit/kitBoundary.test")).resolves.toBeDefined();
  });
});
