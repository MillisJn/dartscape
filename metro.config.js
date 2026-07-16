const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  input: "./global.css",
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
});
