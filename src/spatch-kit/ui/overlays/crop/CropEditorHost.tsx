// Globally-mounted image crop editor (mounted once beside AppAlertHost), in the app's standard modal
// chrome (AppModal — left-aligned title + leading icon). Two modes:
//   • FIXED (avatar/icon/logo/cover): the image PANS + ZOOMS behind a fixed-ratio frame with a dimmed
//     mask + rule-of-thirds grid (Instagram / iOS / react-easy-crop style). Zoom by pinch, slider, or
//     the mouse WHEEL (desktop).
//   • FREEFORM (document logo): a resizable + movable crop BOX over the fit image — drag inside to
//     move, drag an edge/corner to resize to ANY size/ratio (Cropper.js / Photoshop style).
// The captured rect maps to the same oriented pixels the platform-split cropImage writes out.
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, View, type LayoutChangeEvent } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { ButtonSurface } from "@spatch-kit/ui/primitives/Button";
import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import {
  boxToNormRect,
  computeContainFit,
  computeCropRect,
  type FitBox,
} from "@spatch-kit/ui/overlays/crop/cropGeometry";
import { applyCropToImage } from "@spatch-kit/ui/overlays/crop/cropImage";
import {
  cancelImageCrop,
  failImageCrop,
  getImageCropperState,
  resolveImageCrop,
  subscribeImageCropper,
  type CropRequest,
} from "@spatch-kit/ui/overlays/crop/imageCropperController";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const FRAME_PADDING = 20; // gap between the crop frame/image and the edge of the image area
const THUMB = 20;
const EDGE_GRAB = 28; // px proximity to a box edge that starts a resize (finger/mouse)
const MIN_BOX = 48; // smallest freeform crop box

type Frame = {
  frameW: number;
  frameH: number;
  coverW: number;
  coverH: number;
  frameLeft: number;
  frameTop: number;
};

export function CropEditorHost() {
  const [request, setRequest] = useState<CropRequest | null>(
    getImageCropperState,
  );
  useEffect(() => subscribeImageCropper(setRequest), []);

  // Keep the editor mounted through its EXIT animation: latch the last request and only drop it once
  // the modal has faded out (onClosed). `visible` tracks the LIVE request, so clearing it (cancel /
  // confirm) makes the modal animate out instead of unmounting instantly — which skipped the fade.
  const [rendered, setRendered] = useState<CropRequest | null>(request);
  useEffect(() => {
    if (request) setRendered(request);
  }, [request]);

  if (!rendered) return null;
  return (
    <CropEditor
      key={rendered.id}
      onClosed={() => setRendered(null)}
      request={rendered}
      visible={!!request}
    />
  );
}

function CropEditor({
  onClosed,
  request,
  visible,
}: {
  onClosed: () => void;
  request: CropRequest;
  visible: boolean;
}) {
  const theme = useTheme();
  const [processing, setProcessing] = useState(false);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  // FIXED-mode transform.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  // FREEFORM-mode box (display/area coords) + gesture-start snapshot + grab flags.
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const bw = useSharedValue(0);
  const bh = useSharedValue(0);

  const frame = useMemo<Frame | null>(() => {
    if (!area || request.freeform) return null;
    const availW = area.w - FRAME_PADDING * 2;
    const availH = area.h - FRAME_PADDING * 2;
    let frameW = availW;
    let frameH = frameW / request.aspect;
    if (frameH > availH) {
      frameH = availH;
      frameW = frameH * request.aspect;
    }
    const coverScale = Math.max(
      frameW / request.sourceWidth,
      frameH / request.sourceHeight,
    );
    return {
      frameW,
      frameH,
      coverW: request.sourceWidth * coverScale,
      coverH: request.sourceHeight * coverScale,
      frameLeft: (area.w - frameW) / 2,
      frameTop: (area.h - frameH) / 2,
    };
  }, [
    area,
    request.freeform,
    request.aspect,
    request.sourceWidth,
    request.sourceHeight,
  ]);

  const fit = useMemo<FitBox | null>(() => {
    if (!area || !request.freeform) return null;
    return computeContainFit(
      area.w,
      area.h,
      request.sourceWidth,
      request.sourceHeight,
      FRAME_PADDING,
    );
  }, [area, request.freeform, request.sourceWidth, request.sourceHeight]);

  // Initialize the freeform box to the whole image once the fit is known (only once, so a re-layout
  // doesn't discard the user's box). STATE (not a ref) so `ready` below re-evaluates and enables the
  // Use-photo button once the box exists.
  const [boxInited, setBoxInited] = useState(false);
  useEffect(() => {
    if (!request.freeform || !fit || boxInited) return;
    bx.value = fit.imgLeft;
    by.value = fit.imgTop;
    bw.value = fit.dispW;
    bh.value = fit.dispH;
    setBoxInited(true);
  }, [fit, request.freeform, boxInited, bx, by, bw, bh]);

  const ready = request.freeform ? Boolean(fit) && boxInited : Boolean(frame);

  async function confirm(): Promise<void> {
    if (processing) return;
    let rect;
    if (request.freeform) {
      if (!fit) return;
      rect = boxToNormRect(
        { x: bx.value, y: by.value, w: bw.value, h: bh.value },
        fit,
      );
    } else {
      if (!frame) return;
      rect = computeCropRect({
        coverW: frame.coverW,
        coverH: frame.coverH,
        frameW: frame.frameW,
        frameH: frame.frameH,
        scale: scale.value,
        tx: tx.value,
        ty: ty.value,
      });
    }
    setProcessing(true);
    try {
      const output = await applyCropToImage({
        sourceUri: request.sourceUri,
        sourceWidth: request.sourceWidth,
        sourceHeight: request.sourceHeight,
        rect,
        maxEdge: request.maxEdge,
        quality: request.quality,
      });
      resolveImageCrop(request.id, output);
    } catch (error) {
      failImageCrop(request.id, error);
    }
  }

  return (
    <AppModal
      visible={visible}
      onClosed={onClosed}
      panelSize="wide"
      title="Crop photo"
      headerTitleAlign="left"
      headerLeadingAccessory={
        <AppIcon name="media" size={22} color={theme.colors.text} />
      }
      onClose={() => cancelImageCrop(request.id)}
      footer={
        <View className="flex-row gap-app-sm">
          <ButtonSurface
            className="flex-1"
            variant="secondary"
            onPress={() => cancelImageCrop(request.id)}
            disabled={processing}
          >
            Cancel
          </ButtonSurface>
          <ButtonSurface
            className="flex-1"
            variant="primary"
            onPress={() => void confirm()}
            disabled={processing || !ready}
          >
            {processing ? "Cropping…" : "Use photo"}
          </ButtonSurface>
        </View>
      }
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {request.freeform ? (
          <FreeformCropStage
            request={request}
            fit={fit}
            onArea={(w, h) => setArea({ w, h })}
            bx={bx}
            by={by}
            bw={bw}
            bh={bh}
          />
        ) : (
          <CropStage
            request={request}
            frame={frame}
            onArea={(w, h) => setArea({ w, h })}
            scale={scale}
            savedScale={savedScale}
            tx={tx}
            ty={ty}
            savedTx={savedTx}
            savedTy={savedTy}
          />
        )}
      </GestureHandlerRootView>
    </AppModal>
  );
}

// ── FIXED-ratio pan/zoom stage ─────────────────────────────────────────────────────────────────
function CropStage({
  request,
  frame,
  onArea,
  scale,
  savedScale,
  tx,
  ty,
  savedTx,
  savedTy,
}: {
  request: CropRequest;
  frame: Frame | null;
  onArea: (w: number, h: number) => void;
  scale: SharedValue<number>;
  savedScale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  savedTx: SharedValue<number>;
  savedTy: SharedValue<number>;
}) {
  const theme = useTheme();
  const [trackW, setTrackW] = useState(0);
  const areaRef = useRef<View>(null);

  const cover = frame ?? {
    coverW: 0,
    coverH: 0,
    frameW: 0,
    frameH: 0,
    frameLeft: 0,
    frameTop: 0,
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = areaRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.06 : 1 / 1.06;
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, scale.value * factor),
      );
      scale.value = next;
      savedScale.value = next;
      const maxX = Math.max(0, (cover.coverW * next - cover.frameW) / 2);
      const maxY = Math.max(0, (cover.coverH * next - cover.frameH) / 2);
      tx.value = Math.max(-maxX, Math.min(maxX, tx.value));
      ty.value = Math.max(-maxY, Math.min(maxY, ty.value));
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [
    cover.coverW,
    cover.coverH,
    cover.frameW,
    cover.frameH,
    savedScale,
    savedTx,
    savedTy,
    scale,
    tx,
    ty,
  ]);

  const pinch = Gesture.Pinch()
    .onChange((e) => {
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, savedScale.value * e.scale),
      );
      scale.value = next;
      const maxX = Math.max(0, (cover.coverW * next - cover.frameW) / 2);
      const maxY = Math.max(0, (cover.coverH * next - cover.frameH) / 2);
      tx.value = Math.max(-maxX, Math.min(maxX, tx.value));
      ty.value = Math.max(-maxY, Math.min(maxY, ty.value));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pan = Gesture.Pan()
    .onChange((e) => {
      const maxX = Math.max(0, (cover.coverW * scale.value - cover.frameW) / 2);
      const maxY = Math.max(0, (cover.coverH * scale.value - cover.frameH) / 2);
      tx.value = Math.max(
        -maxX,
        Math.min(maxX, savedTx.value + e.translationX),
      );
      ty.value = Math.max(
        -maxY,
        Math.min(maxY, savedTy.value + e.translationY),
      );
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const zoomFromTrack = (x: number) => {
    "worklet";
    if (trackW <= 0) return;
    const t = Math.max(0, Math.min(1, x / trackW));
    const next = MIN_SCALE + t * (MAX_SCALE - MIN_SCALE);
    scale.value = next;
    savedScale.value = next;
    const maxX = Math.max(0, (cover.coverW * next - cover.frameW) / 2);
    const maxY = Math.max(0, (cover.coverH * next - cover.frameH) / 2);
    tx.value = Math.max(-maxX, Math.min(maxX, tx.value));
    ty.value = Math.max(-maxY, Math.min(maxY, ty.value));
    savedTx.value = tx.value;
    savedTy.value = ty.value;
  };
  const slider = Gesture.Pan()
    .onBegin((e) => zoomFromTrack(e.x))
    .onChange((e) => zoomFromTrack(e.x));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const thumbStyle = useAnimatedStyle(() => {
    const t = (scale.value - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
    return { transform: [{ translateX: t * Math.max(0, trackW - THUMB) }] };
  });

  const maskColor = "rgba(0,0,0,0.55)";
  const gridColor = "rgba(255,255,255,0.4)";

  return (
    <View
      style={{ flex: 1, gap: theme.space.md, paddingVertical: theme.space.md }}
    >
      <GestureDetector gesture={composed}>
        <View
          ref={areaRef}
          onLayout={(e: LayoutChangeEvent) =>
            onArea(e.nativeEvent.layout.width, e.nativeEvent.layout.height)
          }
          style={{
            flex: 1,
            overflow: "hidden",
            backgroundColor: "#000",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {frame ? (
            <>
              <Animated.Image
                accessibilityIgnoresInvertColors
                source={{ uri: request.sourceUri }}
                resizeMode="cover"
                style={[
                  {
                    position: "absolute",
                    width: frame.coverW,
                    height: frame.coverH,
                    left: frame.frameLeft + (frame.frameW - frame.coverW) / 2,
                    top: frame.frameTop + (frame.frameH - frame.coverH) / 2,
                  },
                  imageStyle,
                ]}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: frame.frameTop,
                  backgroundColor: maskColor,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: frame.frameTop + frame.frameH,
                  bottom: 0,
                  backgroundColor: maskColor,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  width: frame.frameLeft,
                  top: frame.frameTop,
                  height: frame.frameH,
                  backgroundColor: maskColor,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: 0,
                  width: frame.frameLeft,
                  top: frame.frameTop,
                  height: frame.frameH,
                  backgroundColor: maskColor,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: frame.frameLeft,
                  top: frame.frameTop,
                  width: frame.frameW,
                  height: frame.frameH,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.9)",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    left: "33.33%",
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: "66.66%",
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: "33.33%",
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: "66.66%",
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: gridColor,
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      </GestureDetector>

      <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.xs }}>
        <AppText variant="caption" style={{ color: theme.colors.mutedText }}>
          Zoom
        </AppText>
        <GestureDetector gesture={slider}>
          <View
            onLayout={(e: LayoutChangeEvent) =>
              setTrackW(e.nativeEvent.layout.width)
            }
            style={{ height: THUMB, justifyContent: "center" }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            />
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: THUMB,
                  height: THUMB,
                  borderRadius: THUMB / 2,
                  backgroundColor: theme.colors.accent,
                  borderWidth: 2,
                  borderColor: theme.colors.surface,
                },
                thumbStyle,
              ]}
            />
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

// ── FREEFORM resizable-box stage ───────────────────────────────────────────────────────────────
function FreeformCropStage({
  request,
  fit,
  onArea,
  bx,
  by,
  bw,
  bh,
}: {
  request: CropRequest;
  fit: FitBox | null;
  onArea: (w: number, h: number) => void;
  bx: SharedValue<number>;
  by: SharedValue<number>;
  bw: SharedValue<number>;
  bh: SharedValue<number>;
}) {
  const theme = useTheme();

  // Gesture-start snapshot + grab flags (0/1). Kept local — only the box (bx/by/bw/bh) is read at confirm.
  const sBx = useSharedValue(0);
  const sBy = useSharedValue(0);
  const sBw = useSharedValue(0);
  const sBh = useSharedValue(0);
  const gLeft = useSharedValue(0);
  const gRight = useSharedValue(0);
  const gTop = useSharedValue(0);
  const gBottom = useSharedValue(0);
  const gMove = useSharedValue(0);

  const bounds = fit ?? { dispW: 0, dispH: 0, imgLeft: 0, imgTop: 0 };
  const L = bounds.imgLeft;
  const T = bounds.imgTop;
  const R = bounds.imgLeft + bounds.dispW;
  const B = bounds.imgTop + bounds.dispH;

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      const nearL = Math.abs(e.x - bx.value) <= EDGE_GRAB;
      const nearR = Math.abs(e.x - (bx.value + bw.value)) <= EDGE_GRAB;
      const nearT = Math.abs(e.y - by.value) <= EDGE_GRAB;
      const nearB = Math.abs(e.y - (by.value + bh.value)) <= EDGE_GRAB;
      const withinX =
        e.x >= bx.value - EDGE_GRAB && e.x <= bx.value + bw.value + EDGE_GRAB;
      const withinY =
        e.y >= by.value - EDGE_GRAB && e.y <= by.value + bh.value + EDGE_GRAB;
      gLeft.value = nearL && withinY ? 1 : 0;
      gRight.value = nearR && withinY ? 1 : 0;
      gTop.value = nearT && withinX ? 1 : 0;
      gBottom.value = nearB && withinX ? 1 : 0;
      gMove.value =
        gLeft.value || gRight.value || gTop.value || gBottom.value ? 0 : 1;
      sBx.value = bx.value;
      sBy.value = by.value;
      sBw.value = bw.value;
      sBh.value = bh.value;
    })
    .onChange((e) => {
      if (gMove.value) {
        bx.value = Math.max(
          L,
          Math.min(R - sBw.value, sBx.value + e.translationX),
        );
        by.value = Math.max(
          T,
          Math.min(B - sBh.value, sBy.value + e.translationY),
        );
        return;
      }
      let x1 = sBx.value;
      let y1 = sBy.value;
      let x2 = sBx.value + sBw.value;
      let y2 = sBy.value + sBh.value;
      if (gLeft.value)
        x1 = Math.max(L, Math.min(x2 - MIN_BOX, sBx.value + e.translationX));
      if (gRight.value)
        x2 = Math.min(
          R,
          Math.max(x1 + MIN_BOX, sBx.value + sBw.value + e.translationX),
        );
      if (gTop.value)
        y1 = Math.max(T, Math.min(y2 - MIN_BOX, sBy.value + e.translationY));
      if (gBottom.value)
        y2 = Math.min(
          B,
          Math.max(y1 + MIN_BOX, sBy.value + sBh.value + e.translationY),
        );
      bx.value = x1;
      by.value = y1;
      bw.value = x2 - x1;
      bh.value = y2 - y1;
    });

  const boxStyle = useAnimatedStyle(() => ({
    left: bx.value,
    top: by.value,
    width: bw.value,
    height: bh.value,
  }));
  const maskTop = useAnimatedStyle(() => ({ height: Math.max(0, by.value) }));
  const maskBottom = useAnimatedStyle(() => ({ top: by.value + bh.value }));
  const maskLeft = useAnimatedStyle(() => ({
    top: by.value,
    height: bh.value,
    width: Math.max(0, bx.value),
  }));
  const maskRight = useAnimatedStyle(() => ({
    top: by.value,
    height: bh.value,
    left: bx.value + bw.value,
  }));

  const maskColor = "rgba(0,0,0,0.55)";
  const gridColor = "rgba(255,255,255,0.4)";
  const handle = {
    position: "absolute" as const,
    width: 14,
    height: 14,
    backgroundColor: theme.colors.accent,
    borderColor: "#fff",
    borderWidth: 2,
    borderRadius: 3,
  };

  return (
    <View
      style={{ flex: 1, gap: theme.space.sm, paddingVertical: theme.space.md }}
    >
      <AppText
        variant="caption"
        style={{
          color: theme.colors.mutedText,
          paddingHorizontal: theme.space.lg,
        }}
      >
        Drag inside to move · drag an edge or corner to resize
      </AppText>
      <GestureDetector gesture={gesture}>
        <View
          onLayout={(e: LayoutChangeEvent) =>
            onArea(e.nativeEvent.layout.width, e.nativeEvent.layout.height)
          }
          style={{ flex: 1, overflow: "hidden", backgroundColor: "#000" }}
        >
          {fit ? (
            <>
              <Animated.Image
                accessibilityIgnoresInvertColors
                source={{ uri: request.sourceUri }}
                resizeMode="contain"
                style={{
                  position: "absolute",
                  left: fit.imgLeft,
                  top: fit.imgTop,
                  width: fit.dispW,
                  height: fit.dispH,
                }}
              />
              {/* Dimmed mask outside the box (4 animated strips). */}
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    backgroundColor: maskColor,
                  },
                  maskTop,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: maskColor,
                  },
                  maskBottom,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  { position: "absolute", left: 0, backgroundColor: maskColor },
                  maskLeft,
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    right: 0,
                    backgroundColor: maskColor,
                  },
                  maskRight,
                ]}
              />
              {/* The crop box: border, rule-of-thirds grid, corner handles. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.95)",
                  },
                  boxStyle,
                ]}
              >
                <View
                  style={{
                    position: "absolute",
                    left: "33.33%",
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: "66.66%",
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: "33.33%",
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: "66.66%",
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: gridColor,
                  }}
                />
                <View style={[handle, { left: -7, top: -7 }]} />
                <View style={[handle, { right: -7, top: -7 }]} />
                <View style={[handle, { left: -7, bottom: -7 }]} />
                <View style={[handle, { right: -7, bottom: -7 }]} />
              </Animated.View>
            </>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}
