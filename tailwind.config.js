/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // Must cover the kit (trap 4) — spatch-kit's className strings are otherwise invisible to Tailwind's
  // content scan and every utility it uses would be purged.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // theme/nativewind.ts emits these as --fp-* custom properties (via nativewind's vars(), see
      // src/ui/ThemeVarsRoot.tsx) at runtime from createAppTheme(). Referencing var(--fp-*) here is
      // what lets every themed token (light/dark, any accent hex, text scale, density) be a runtime
      // value instead of a fixed palette baked into this config.
      colors: {
        accent: "var(--fp-color-accent)",
        "accent-contrast": "var(--fp-color-accent-contrast)",
        "accent-muted": "var(--fp-color-accent-muted)",
        background: "var(--fp-color-background)",
        "background-muted": "var(--fp-color-background-muted)",
        border: "var(--fp-color-border)",
        "border-strong": "var(--fp-color-border-strong)",
        danger: "var(--fp-color-danger)",
        "focus-glow": "var(--fp-color-focus-glow)",
        "focus-ring": "var(--fp-color-focus-ring)",
        "input-background": "var(--fp-color-input-background)",
        "input-placeholder": "var(--fp-color-input-placeholder)",
        "muted-text": "var(--fp-color-muted-text)",
        success: "var(--fp-color-success)",
        surface: "var(--fp-color-surface)",
        "surface-muted": "var(--fp-color-surface-muted)",
        "surface-overlay": "var(--fp-color-surface-overlay)",
        "surface-raised": "var(--fp-color-surface-raised)",
        text: "var(--fp-color-text)",
        warning: "var(--fp-color-warning)",
      },
      spacing: {
        "app-xxs": "var(--fp-space-xxs)",
        "app-xs": "var(--fp-space-xs)",
        "app-sm": "var(--fp-space-sm)",
        "app-md": "var(--fp-space-md)",
        "app-lg": "var(--fp-space-lg)",
        "app-xl": "var(--fp-space-xl)",
        "app-xxl": "var(--fp-space-xxl)",
        "app-gutter": "var(--fp-space-gutter)",
        "app-section": "var(--fp-space-section-gap)",
      },
      borderRadius: {
        "app-sm": "var(--fp-radius-sm)",
        "app-md": "var(--fp-radius-md)",
        "app-lg": "var(--fp-radius-lg)",
        "app-pill": "var(--fp-radius-pill)",
      },
    },
  },
  plugins: [],
};
