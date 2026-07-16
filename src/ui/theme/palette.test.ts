import { describe, expect, it } from "vitest";
import { blendHex, disabledText } from "./palette";

describe("blendHex", () => {
  it("returns the source color at ratio 0", () => {
    expect(blendHex("#005503", "#ffffff", 0)).toBe("#005503");
  });

  it("returns the target color at ratio 1", () => {
    expect(blendHex("#005503", "#ffffff", 1)).toBe("#ffffff");
  });

  it("linearly interpolates each channel", () => {
    expect(blendHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("disabledText", () => {
  it("returns a well-formed hex color", () => {
    expect(disabledText()).toMatch(/^#[0-9a-f]{6}$/);
  });
});
