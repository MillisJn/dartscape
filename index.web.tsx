// Web entry point. On web, @shopify/react-native-skia renders through CanvasKit (a WASM build of
// Skia) which must be fully loaded before ANY Skia API runs — including matchFont/Canvas that the
// dartboard surfaces (TargetBoard, ScoreGrid) touch on their first render. Without this gate the
// app throws "Cannot read properties of undefined (reading 'TypefaceFontProvider')" because
// global.CanvasKit isn't there yet.
//
// So we defer rendering the router until LoadSkiaWeb() resolves. See:
// https://shopify.github.io/react-native-skia/docs/getting-started/web/
import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

// canvaskit.wasm isn't served by Metro out of the box, so point CanvasKit at the CDN copy pinned to
// the exact canvaskit-wasm version resolved in node_modules (keep these in sync on upgrade).
LoadSkiaWeb({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}`,
}).then(() => {
  renderRootComponent(App);
});
