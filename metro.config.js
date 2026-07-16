const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// spatch-kit lives as a sibling repo (../spatch-kit), not inside this project, so Metro must be
// told to watch it explicitly and to resolve the packages it imports (react, nativewind, ...) from
// THIS app's node_modules — the kit ships none of its own.
const kitRoot = path.resolve(__dirname, "../spatch-kit");
config.watchFolders = [...(config.watchFolders || []), kitRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  ...(config.resolver.nodeModulesPaths || []),
];

// The game's sound effects (assets/sounds/*.ogg, ported from Dartscape OG) are Ogg Vorbis, which
// isn't in Metro's default assetExts — without this, require()-ing them resolves to nothing and no
// audio bundles. Android/iOS/web all decode Ogg, so one line here is enough.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "ogg"])];

module.exports = withNativewind(config, {
  input: "./global.css",
  content: [
    "./src/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "../spatch-kit/**/*.{ts,tsx}",
  ],
});
