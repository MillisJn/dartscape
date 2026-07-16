// Native entry point. Metro resolves this for iOS/Android; web uses index.web.tsx instead
// (which must load CanvasKit's WASM before the app renders any Skia surface). Keeping the two
// split means native pays none of the web-only Skia bootstrap.
import "expo-router/entry";
