import { describe, expect, it } from "vitest";
import {
  HIT_FLASH_MS,
  hitFlashRatioAt,
  LIGHT_UP_MS,
  LIGHT_UP_PEAK,
  lightUpRatioAt,
} from "./cellAnimation";

describe("lightUpRatioAt", () => {
  it("starts at `from`", () => {
    expect(lightUpRatioAt(0, 0, LIGHT_UP_PEAK)).toBeCloseTo(0);
  });

  it("reaches `to` by the end of the transition", () => {
    expect(lightUpRatioAt(LIGHT_UP_MS, 0, LIGHT_UP_PEAK)).toBeCloseTo(LIGHT_UP_PEAK);
  });

  it("clamps past the end of the transition", () => {
    expect(lightUpRatioAt(LIGHT_UP_MS * 2, 0, LIGHT_UP_PEAK)).toBeCloseTo(LIGHT_UP_PEAK);
  });

  it("can animate back down", () => {
    expect(lightUpRatioAt(0, LIGHT_UP_PEAK, 0)).toBeCloseTo(LIGHT_UP_PEAK);
    expect(lightUpRatioAt(LIGHT_UP_MS, LIGHT_UP_PEAK, 0)).toBeCloseTo(0);
  });
});

describe("hitFlashRatioAt", () => {
  it("starts at 0", () => {
    expect(hitFlashRatioAt(0)).toBe(0);
  });

  it("peaks at 0.8 at the midpoint (200ms)", () => {
    expect(hitFlashRatioAt(HIT_FLASH_MS / 2)).toBeCloseTo(0.8);
  });

  it("rises linearly to the midpoint", () => {
    expect(hitFlashRatioAt(HIT_FLASH_MS / 4)).toBeCloseTo(0.4);
  });

  it("falls back to 0 by the end", () => {
    expect(hitFlashRatioAt(HIT_FLASH_MS)).toBe(0);
  });

  it("is symmetric around the midpoint", () => {
    const before = hitFlashRatioAt(HIT_FLASH_MS / 2 - 50);
    const after = hitFlashRatioAt(HIT_FLASH_MS / 2 + 50);
    expect(before).toBeCloseTo(after);
  });

  it("is 0 outside the flash window", () => {
    expect(hitFlashRatioAt(-10)).toBe(0);
    expect(hitFlashRatioAt(HIT_FLASH_MS + 100)).toBe(0);
  });
});
