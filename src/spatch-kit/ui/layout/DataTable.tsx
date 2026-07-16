import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@spatch-kit/theme/provider";
import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { SkeletonText } from "@spatch-kit/ui/primitives/Skeleton";

// A selected row's tint: the accent at ~20% alpha — a stronger version of the muted multi-select
// color, so a selected/multi-selected row reads clearly and isn't washed out by the hover color.
const SELECTED_ROW_ALPHA = "33";

// A deliberately SMALL desktop data table: sortable headers, a sticky header (it sits
// outside the body ScrollView), row hover/press/selection, and an empty state. It is
// intentionally NOT an enterprise grid — no column pinning, drag-reorder, saved views,
// grouped rows, inline cell editors, or virtualization. Phone never renders this; the
// browse screen falls back to the existing card list below the tablet breakpoint.

export type DataTableSort = { direction: "asc" | "desc"; key: string };

export type DataTableColumn<TRow> = {
  align?: "center" | "left" | "right";
  // Flex weight when no fixed `width` is given (defaults to 1).
  flex?: number;
  header: string;
  key: string;
  render: (row: TRow) => ReactNode;
  // Whether this column participates in click-to-sort (defaults to true when
  // `onToggleSort` is provided).
  sortable?: boolean;
  // Fixed pixel width; omit to share remaining space by `flex`.
  width?: number;
};

type DataTableProps<TRow> = {
  columns: DataTableColumn<TRow>[];
  emptyState?: ReactNode;
  // Rendered inside the scroll body after the last row (e.g. a load-more spinner).
  footer?: ReactNode;
  // Called when the body scrolls near its bottom — for infinite scroll (auto-load the next page).
  // The handler should self-guard against re-entry / no-more-pages; it may fire on several frames.
  onEndReached?: () => void;
  // Per-row hover affordance: content (e.g. an actions pill) that fades in on mouse-over and sits
  // centered on the row's TOP edge, on the right. Lets the data columns use the full width instead
  // of a dedicated actions column. Return null for rows with nothing to show.
  rowOverlay?: (row: TRow) => ReactNode;
  // First-load gate: when true AND there are no rows yet, render skeleton rows (matching the real
  // row geometry exactly) instead of the empty state, so a cold load doesn't flash blank.
  isLoading?: boolean;
  // How many skeleton rows to show during first load (defaults to 8 — roughly a screenful).
  skeletonRows?: number;
  onRowPress?: (row: TRow) => void;
  onToggleSort?: (key: string) => void;
  rowKey: (row: TRow) => string;
  rows: TRow[];
  selectedRowKey?: string | null;
  // Multi-select: when `selectedRowKeys` is provided, a leading checkbox column appears (select-all
  // in the header, a checkbox per row). The row body still fires onRowPress; the checkbox toggles
  // selection independently. Omit to keep the table selection-free (the default).
  selectedRowKeys?: ReadonlySet<string>;
  onToggleRowKey?: (key: string) => void;
  onToggleAllRows?: () => void;
  allRowsSelected?: boolean;
  sort?: DataTableSort | null;
  // Whether the body owns a vertical scroll region (default true — the standalone browse screen).
  // Set false to render every row at natural height with NO inner ScrollView, for embedding inside
  // an already-scrolling page (e.g. a relation collection on the record screen). When false there's
  // no scrollbar, so the header's scrollbar-gutter spacer and onEndReached are inert.
  scrollable?: boolean;
};

// Leading checkbox column width (header select-all + per-row checkbox), when multi-select is on.
const SELECT_COL_WIDTH = 44;

// The hover pill sits centered on the row's TOP edge (half above it), on the right. A fixed
// half-height keeps positioning simple — the pill's content height (a row of icons) is ~constant.
const OVERLAY_PILL_STRADDLE = 18;

// Deterministic per-column bar widths so the ghost rows look like real content (a wider first
// "name" column, narrower trailing columns) without any randomness.
const SKELETON_WIDTH_FRACTIONS = [0.7, 0.5, 0.6, 0.45, 0.55, 0.4];

// Column layout shared by header + body cells (and reused by the relation-collection table) so
// they line up. A fixed `width` wins; otherwise the column shares remaining space by `flex`.
export function columnSizeStyle(column: { flex?: number; width?: number }) {
  return column.width != null
    ? { width: column.width }
    : { flex: column.flex ?? 1 };
}

export function alignItemsClass(
  align: "center" | "left" | "right" | undefined,
) {
  if (align === "right") {
    return "items-end";
  }

  if (align === "center") {
    return "items-center";
  }

  return "items-start";
}

// Horizontal placement for a flex-ROW cell (the header cells are pressable rows), matching what
// alignItemsClass does for the column-direction body cells so header + body line up.
function justifyContentClass(align: "center" | "left" | "right" | undefined) {
  if (align === "right") {
    return "justify-end";
  }

  if (align === "center") {
    return "justify-center";
  }

  return "justify-start";
}

// The up/down sort chevrons shown on every sortable header. Both are muted by default; the active
// sort direction's chevron lights up (accent). A tight vertical stack reads as one control. The
// active tint CROSS-FADES: an accent-colored copy sits over each muted chevron and its opacity
// animates 0↔1 as the direction changes (AppIcon's color can't take an Animated value directly, so
// fading a second copy is how we transition the color smoothly).
function SortChevrons({
  activeColor,
  direction,
  mutedColor,
}: {
  activeColor: string;
  direction: "asc" | "desc" | null;
  mutedColor: string;
}) {
  const upOpacity = useRef(
    new Animated.Value(direction === "asc" ? 1 : 0),
  ).current;
  const downOpacity = useRef(
    new Animated.Value(direction === "desc" ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(upOpacity, {
      duration: 160,
      toValue: direction === "asc" ? 1 : 0,
      useNativeDriver: true,
    }).start();
    Animated.timing(downOpacity, {
      duration: 160,
      toValue: direction === "desc" ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [direction, upOpacity, downOpacity]);

  return (
    <View className="items-center p-0" style={{ marginLeft: 2 }}>
      <View>
        <AppIcon
          color={mutedColor}
          name="chevronUp"
          size={11}
          strokeWidth={4}
        />
        <Animated.View
          pointerEvents="none"
          style={{ opacity: upOpacity, position: "absolute" }}
        >
          <AppIcon
            color={activeColor}
            name="chevronUp"
            size={11}
            strokeWidth={4}
          />
        </Animated.View>
      </View>
      <View style={{ marginTop: -4 }}>
        <AppIcon
          color={mutedColor}
          name="chevronDown"
          size={11}
          strokeWidth={4}
        />
        <Animated.View
          pointerEvents="none"
          style={{ opacity: downOpacity, position: "absolute" }}
        >
          <AppIcon
            color={activeColor}
            name="chevronDown"
            size={11}
            strokeWidth={4}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// The hover pill's animated inner. DataTable owns the pill CHROME (rounded surface + border +
// shadow) so it can MORPH as the content changes from row to row: the width eases to the new
// actions' natural size (measured off-screen so the ease isn't self-referential), while the old
// actions cross-fade out under the new ones fading in. Callers pass just the actions via rowOverlay.
function HoverActionPill({
  content,
  contentKey,
}: {
  content: ReactNode;
  contentKey: string;
}) {
  const theme = useTheme();
  const [cur, setCur] = useState<{ key: string; node: ReactNode }>({
    key: contentKey,
    node: content,
  });
  const [prev, setPrev] = useState<{ key: string; node: ReactNode } | null>(
    null,
  );
  const [innerWidth, setInnerWidth] = useState<number | undefined>(undefined);
  const curOpacity = useRef(new Animated.Value(1)).current;
  const prevOpacity = useRef(new Animated.Value(0)).current;
  // Mirror of `cur` read inside the effect so we can compare against the previous content WITHOUT
  // depending on `cur` (which would re-run the effect) and WITHOUT reading it via a setCur updater —
  // running side effects (setPrev, Animated.start) inside an updater fires React's "setState while
  // rendering" warning, since React may invoke updaters during render.
  const curRef = useRef(cur);
  const initialisedRef = useRef(false);

  useEffect(() => {
    // Skip the first run: useState already seeded `cur` with this content.
    if (!initialisedRef.current) {
      initialisedRef.current = true;
      curRef.current = { key: contentKey, node: content };
      return;
    }

    const existing = curRef.current;
    const next = { key: contentKey, node: content };
    curRef.current = next;

    if (existing.key !== contentKey) {
      // New row: the outgoing actions become `prev` and fade out beneath the incoming ones fading in.
      setPrev(existing);
      prevOpacity.setValue(1);
      curOpacity.setValue(0);
      Animated.timing(prevOpacity, {
        duration: 140,
        toValue: 0,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setPrev(null);
        }
      });
      Animated.timing(curOpacity, {
        duration: 140,
        toValue: 1,
        useNativeDriver: false,
      }).start();
    }

    // Same row (content re-created) → swap the node; new row → adopt the incoming node.
    setCur(next);
  }, [content, contentKey, curOpacity, prevOpacity]);

  const pad = theme.space.xxs;

  return (
    // Shadow on an OUTER layer — RN clips a view's own shadow under overflow:hidden, which the inner
    // clip layer needs for the rounded width-morph. The matching borderRadius is set INLINE (not a
    // className) so the web box-shadow hugs the pill's stadium shape instead of casting a rectangular
    // ghost around it — inline keeps it from being dropped/reordered like the className was.
    <View
      style={[{ boxShadow: theme.shadow.card.boxShadow }, { borderRadius: 9999 }]}
    >
      <View
        className="flex-row items-center justify-end overflow-hidden rounded-full border border-border bg-surface-raised"
        style={[
          {
            paddingHorizontal: pad,
            paddingVertical: pad / 2,
            width: innerWidth,
          },
          // Web-only: ease the width between content sizes. Native ignores it (snaps).
          Platform.OS === "web"
            ? ({
                transitionDuration: "160ms",
                transitionProperty: "width",
              } as unknown as ViewStyle)
            : null,
        ]}
      >
        {/* Off-screen measurer: the current actions' NATURAL width (absolute → not constrained by
            the animated width). +2 covers the 1px borders (RN width is border-box). */}
        <View
          onLayout={(event) =>
            setInnerWidth(event.nativeEvent.layout.width + pad * 2 + 2)
          }
          pointerEvents="none"
          style={{ left: 0, opacity: 0, position: "absolute", top: 0 }}
        >
          {cur.node}
        </View>
        <Animated.View style={{ opacity: curOpacity }}>
          {cur.node}
        </Animated.View>
        {prev ? (
          <Animated.View
            pointerEvents="none"
            style={{ opacity: prevOpacity, position: "absolute", right: pad }}
          >
            {prev.node}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

// The leading selection checkbox, shared by the browse DataTable AND the relation collection lists
// (header select-all + per-row toggle) so they're pixel-identical.
//
// It must be the FIRST child of a row whose padding is `px-app-md py-app-sm` (every table row +
// header here). Rows own that padding, so without help the strip to the LEFT of the icon and the
// gap ABOVE/BELOW it belong to the row Pressable — click there and you open the row instead of
// toggling. So the cell bleeds OUT over that padding with negative margins (to the row's very left
// edge and the full row height) and grows its width by the reclaimed left inset, keeping the data
// columns starting exactly where they did. The result is one solid clickable square — icon centered
// in it — flush to the row edge. onPress stops propagation so a toggle never also opens the row.
export function SelectionCheckboxCell({
  accessibilityLabel,
  checked,
  onToggle,
  width = SELECT_COL_WIDTH,
}: {
  accessibilityLabel?: string;
  checked: boolean;
  onToggle: () => void;
  width?: number;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center justify-center self-stretch"
      onPress={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={{
        marginBottom: -theme.space.sm,
        marginLeft: -theme.space.md,
        marginTop: -theme.space.sm,
        // Reclaim the left padding into the cell so it reaches the row edge without shifting where
        // the data columns begin (advance = -marginLeft + width = original inset + width).
        width: width + theme.space.md,
      }}
    >
      <AppIcon name={checked ? "checkboxChecked" : "checkbox"} size={20} />
    </Pressable>
  );
}

// One table body row. The hover pill it triggers is NOT rendered here — it lives in a single
// absolute layer at the table root (see DataTable) so it can float ON TOP of the sticky header
// without being clipped by the body ScrollView. On hover the row reports its own top edge (in
// viewport coords) up to the parent, which positions the shared pill there.
function DataTableRow<TRow>({
  checked,
  columns,
  onHoverRow,
  onRowPress,
  onToggleRowKey,
  row,
  rowKeyValue,
  selectable,
  selected,
  selectedRowTint,
}: {
  checked: boolean;
  columns: DataTableColumn<TRow>[];
  onHoverRow: (viewportTop: number, row: TRow) => void;
  onRowPress?: (row: TRow) => void;
  onToggleRowKey?: (key: string) => void;
  row: TRow;
  rowKeyValue: string;
  selectable: boolean;
  selected: boolean;
  selectedRowTint: string;
}) {
  const rowRef = useRef<View>(null);

  return (
    <Pressable
      ref={rowRef}
      // Deliberately NOT accessibilityRole="button": rows can contain their own action buttons
      // (the pill's kebab) and a button can't legally nest a button on web.
      className={[
        "flex-row items-center border-b border-border px-app-md py-app-sm",
        selected ? "" : "bg-background",
        onRowPress ? "active:opacity-80" : "",
        onRowPress && !selected ? "hover:bg-surface" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onHoverIn={() => {
        // Report the row's top edge so the shared pill can straddle it. web-only: the pill is a
        // mouse affordance and getBoundingClientRect only exists on the DOM host node.
        const node = rowRef.current as unknown as HTMLElement | null;
        if (node?.getBoundingClientRect) {
          onHoverRow(node.getBoundingClientRect().top, row);
        }
      }}
      // No onHoverOut hide here on purpose: the pill floats over its own row, so a per-row hide
      // would fire the moment the pill covers the cursor and fight the pill in a flicker loop.
      // Dismissal is anchored to the table root's onPointerLeave (+ scroll) instead.
      onPress={onRowPress ? () => onRowPress(row) : undefined}
      style={[
        selected ? { backgroundColor: selectedRowTint } : null,
        // Web-only: ease the hover wash AND the selection tint in/out (native snaps). This is what
        // makes sweeping the list and selecting/deselecting fade rather than flip.
        Platform.OS === "web"
          ? ({
              transitionDuration: "150ms",
              transitionProperty: "background-color",
            } as unknown as ViewStyle)
          : null,
      ]}
    >
      {selectable ? (
        <SelectionCheckboxCell
          checked={checked}
          onToggle={() => onToggleRowKey?.(rowKeyValue)}
        />
      ) : null}
      {columns.map((column) => (
        <View
          key={column.key}
          className={[
            "overflow-hidden pr-app-sm",
            alignItemsClass(column.align),
          ].join(" ")}
          style={columnSizeStyle(column)}
        >
          {column.render(row)}
        </View>
      ))}
    </Pressable>
  );
}

export function DataTable<TRow>({
  columns,
  emptyState,
  footer,
  isLoading,
  skeletonRows = 8,
  onEndReached,
  onRowPress,
  onToggleSort,
  rowKey,
  rowOverlay,
  rows,
  selectedRowKey,
  selectedRowKeys,
  onToggleRowKey,
  onToggleAllRows,
  allRowsSelected,
  sort,
  scrollable = true,
}: DataTableProps<TRow>) {
  const theme = useTheme();
  const selectable = selectedRowKeys != null;
  const selectedRowTint = theme.colors.accent + SELECTED_ROW_ALPHA;

  // The header is a sticky sibling ABOVE the body ScrollView, so it never loses width to the
  // body's vertical scrollbar — that mismatch makes the header's flex columns wider than the
  // rows', drifting header content right (only visible once the body overflows). Fix: pin a
  // stable scrollbar gutter on the body (reserved whether or not a bar is showing) and reserve
  // the SAME width at the end of the header via a spacer, so the two lay out over equal space.
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const scrollbarObserver = useRef<ResizeObserver | null>(null);
  const attachScrollNode = useCallback((instance: ScrollView | null) => {
    if (scrollbarObserver.current) {
      scrollbarObserver.current.disconnect();
      scrollbarObserver.current = null;
    }
    if (Platform.OS !== "web" || !instance) {
      return;
    }
    const node = (
      instance as unknown as { getScrollableNode?: () => HTMLElement }
    ).getScrollableNode?.();
    if (!node) {
      return;
    }
    node.style.scrollbarGutter = "stable";
    const measure = () =>
      setScrollbarWidth(node.offsetWidth - node.clientWidth);
    measure();
    // Re-measure on size changes (browser zoom, window/container resize) — the reserved gutter
    // can round differently, and a stale spacer would reintroduce the drift.
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      scrollbarObserver.current = observer;
    }
  }, []);
  useEffect(
    () => () => {
      scrollbarObserver.current?.disconnect();
    },
    [],
  );

  // The hover pill floats in a single absolute layer at the table root (rendered last, below), so
  // it can sit ON TOP of the sticky header rather than being clipped inside the body ScrollView.
  // `overlay` holds the hovered row + its top edge relative to this root; `rowHovered`/`pillHovered`
  // are OR'd so moving the cursor between the row and the pill (which straddles the row's top edge)
  // keeps it up.
  const rootRef = useRef<View>(null);
  // `overlay` only carries WHICH row's content to show; the vertical position is an Animated value
  // (overlayTop) so the pill GLIDES between rows instead of snapping. A single visibility flag
  // drives one continuous opacity fade — it never flips off between adjacent rows (moving row→row
  // just re-targets the glide), so opacity holds at 1 and never flickers.
  const [overlay, setOverlay] = useState<{ row: TRow } | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const overlayVisibleRef = useRef(false);
  overlayVisibleRef.current = overlayVisible;
  // JS driver (useNativeDriver:false) on purpose: react-native-web can snap native-driven
  // animations instead of tweening them, which is exactly the "no fade, just clicks" symptom.
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayTop = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  // Leaving a row/the pill SCHEDULES a fade-out rather than firing it now. Moving onto the next row
  // (or the pill) within the window cancels it, so the pill stays solid across the 1px gaps between
  // rows and the row→pill hand-off — no per-move blink. It fades out only if nothing re-hovers.
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      setOverlayVisible(false);
    }, 90);
  }, [cancelHide]);

  const keepOverlayVisible = useCallback(() => {
    cancelHide();
    setOverlayVisible(true);
  }, [cancelHide]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  useEffect(() => {
    Animated.timing(overlayOpacity, {
      duration: 150,
      toValue: overlayVisible ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [overlayVisible, overlayOpacity]);

  const handleHoverRow = useCallback(
    (viewportTop: number, row: TRow) => {
      cancelHide();
      const node = rootRef.current as unknown as HTMLElement | null;
      const rootTop = node?.getBoundingClientRect?.().top ?? 0;
      const targetTop = viewportTop - rootTop - OVERLAY_PILL_STRADDLE;
      setOverlay({ row });
      if (overlayVisibleRef.current) {
        // Already showing: GLIDE to the new row so sweeping up/down the list reads as one smooth
        // moving pill rather than a stack of blinks.
        Animated.timing(overlayTop, {
          duration: 130,
          toValue: targetTop,
          useNativeDriver: false,
        }).start();
      } else {
        // First appearance (or after a real fade-out): drop it straight onto the row and fade in —
        // never glide across the whole list from a stale position.
        overlayTop.setValue(targetTop);
      }
      setOverlayVisible(true);
    },
    [cancelHide, overlayTop],
  );

  // Fire onEndReached once the body scrolls within a screenful of the bottom, so the next page
  // loads before the user hits the very end (smooth infinite scroll). onEndReached self-guards, so
  // firing on multiple frames is safe. Scrolling also dismisses the hover pill immediately — its
  // measured position goes stale as rows move, and a fresh hover re-positions it once settled.
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    cancelHide();
    setOverlayVisible(false);

    if (!onEndReached) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (distanceFromBottom < 480) {
      onEndReached();
    }
  }

  return (
    <View
      ref={rootRef}
      // Own the vertical space (flex-1) only when we host our own scroll region; embedded/inline
      // (scrollable=false) we size to content so the parent page scrolls.
      className={scrollable ? "min-h-0 flex-1" : undefined}
      // The pill is dismissed when the cursor leaves the WHOLE table, not when it leaves an
      // individual row. The pill floats on top of its own row (pointerEvents auto), so a row-level
      // hide would fire the instant the pill covers the cursor — and since the pill appears under a
      // stationary cursor (no reliable pointerEnter to cancel it), that hid → re-hovered → re-showed
      // in a loop (the fade in/out flicker). Anchoring dismissal to the root breaks the loop: the
      // pill is a descendant, so moving onto it never triggers this leave. (Scroll still hides via
      // handleScroll since the measured position goes stale.)
      onPointerLeave={scheduleHide}
    >
      <View className="flex-row items-center border-b border-border-strong bg-surface px-app-md py-app-sm">
        {selectable ? (
          <SelectionCheckboxCell
            accessibilityLabel={allRowsSelected ? "Deselect all" : "Select all"}
            checked={Boolean(allRowsSelected)}
            onToggle={() => onToggleAllRows?.()}
          />
        ) : null}
        {columns.map((column) => {
          const sorted = sort?.key === column.key;
          const sortable = Boolean(onToggleSort) && column.sortable !== false;
          const headerLabel = (
            <AppText numberOfLines={1} variant="caption">
              {column.header}
            </AppText>
          );

          // Non-sortable: a plain cell. gap-app-xxs + justify match the sortable layout so
          // headers line up. flex-row items-center centers the label vertically.
          if (!sortable) {
            return (
              <View
                key={column.key}
                className={[
                  "flex-row items-center gap-app-xxs pr-app-sm",
                  justifyContentClass(column.align),
                ].join(" ")}
                style={columnSizeStyle(column)}
              >
                {headerLabel}
              </View>
            );
          }

          // Sortable: the WHOLE cell is the button — full column width, and bled over the row's
          // vertical padding (marginY -sm + paddingY sm, same trick as the checkbox) so the entire
          // header-bar rectangle is clickable, not just the text. Every sortable column carries the
          // muted up/down chevrons; the active direction lights up.
          return (
            <Pressable
              key={column.key}
              accessibilityRole="button"
              // No press feedback (no opacity/color flash on click-down) — the sort chevrons are
              // the only affordance that should change on interaction.
              className={[
                "flex-row items-center gap-app-xxs pr-app-sm",
                justifyContentClass(column.align),
              ].join(" ")}
              onPress={() => onToggleSort?.(column.key)}
              style={{
                ...columnSizeStyle(column),
                marginBottom: -theme.space.sm,
                marginTop: -theme.space.sm,
                paddingBottom: theme.space.sm,
                paddingTop: theme.space.sm,
              }}
            >
              {headerLabel}
              <SortChevrons
                activeColor={theme.colors.accent}
                direction={sorted ? (sort?.direction ?? null) : null}
                mutedColor={theme.colors.mutedText}
              />
            </Pressable>
          );
        })}
        {/* Mirror the body's reserved scrollbar gutter so header columns share the exact same
            layout width as the rows below (see attachScrollNode). */}
        {scrollbarWidth > 0 ? <View style={{ width: scrollbarWidth }} /> : null}
      </View>

      {isLoading && rows.length === 0 ? (
        <View>
          {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
            <View
              // Same geometry as a real row (border + px-app-md py-app-sm) so nothing shifts when
              // data lands. Not pressable; purely visual.
              key={`skeleton-${rowIndex}`}
              className="flex-row items-center border-b border-border bg-background px-app-md py-app-sm"
            >
              {selectable ? <View style={{ width: SELECT_COL_WIDTH }} /> : null}
              {columns.map((column, columnIndex) => (
                <View
                  key={column.key}
                  className={[
                    "overflow-hidden pr-app-sm",
                    alignItemsClass(column.align),
                  ].join(" ")}
                  style={columnSizeStyle(column)}
                >
                  <SkeletonText
                    variant="body"
                    widthFraction={
                      SKELETON_WIDTH_FRACTIONS[
                        columnIndex % SKELETON_WIDTH_FRACTIONS.length
                      ]
                    }
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : rows.length === 0 && emptyState != null ? (
        <View
          className={[
            "items-center justify-center",
            // Standalone (browse/reports) keeps a generous full-height empty state; embedded
            // in a record page it's ~1 tight row so it doesn't eat vertical space.
            scrollable ? "flex-1 p-app-xl" : "py-app-xs",
          ]
            .filter(Boolean)
            .join(" ")}
          // Embedded empty area sits on the page background, not the surface the populated
          // table uses — so an empty collection reads distinct from a filled one.
          style={
            scrollable ? undefined : { backgroundColor: theme.colors.background }
          }
        >
          {emptyState}
        </View>
      ) : (
        (() => {
          const body = (
            <>
              {rows.map((row) => {
                const key = rowKey(row);
                const checked = selectable && selectedRowKeys.has(key);
                const selected =
                  checked || (selectedRowKey != null && key === selectedRowKey);

                return (
                  <DataTableRow
                    key={key}
                    checked={checked}
                    columns={columns}
                    onHoverRow={handleHoverRow}
                    onRowPress={onRowPress}
                    onToggleRowKey={onToggleRowKey}
                    row={row}
                    rowKeyValue={key}
                    selectable={selectable}
                    selected={selected}
                    selectedRowTint={selectedRowTint}
                  />
                );
              })}
              {footer}
            </>
          );

          // Embedded (scrollable=false): render rows at natural height in a plain View so the
          // parent page scrolls. Standalone: a flex-1 ScrollView owns infinite-scroll + pill dismiss.
          return scrollable ? (
            <ScrollView
              ref={attachScrollNode}
              className="flex-1"
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {body}
            </ScrollView>
          ) : (
            <View>{body}</View>
          );
        })()
      )}

      {/* The hover pill, rendered LAST so it paints on top of the sticky header, and OUTSIDE the
          body ScrollView so it isn't clipped — letting it straddle/float above the header for the
          top rows. Positioned at the hovered row's top edge (relative to this root). `right` clears
          the reserved scrollbar gutter so it lines up over the row content, not the scrollbar.
          pointerEvents auto only while shown so the pill's buttons take clicks; none while faded so
          it never blocks the header/rows beneath. */}
      {(() => {
        const overlayContent = overlay ? rowOverlay?.(overlay.row) : null;
        if (!overlay || overlayContent == null) {
          return null;
        }

        return (
          <Animated.View
            onPointerEnter={keepOverlayVisible}
            onPointerLeave={scheduleHide}
            pointerEvents={overlayVisible ? "auto" : "none"}
            // opacity = whole-pill show/hide fade; translateY = the glide between rows (both JS-
            // driven). The inner HoverActionPill handles the content morph as the row changes.
            style={{
              opacity: overlayOpacity,
              position: "absolute",
              right: 12 + scrollbarWidth,
              top: 0,
              transform: [{ translateY: overlayTop }],
            }}
          >
            <HoverActionPill
              content={overlayContent}
              contentKey={rowKey(overlay.row)}
            />
          </Animated.View>
        );
      })()}
    </View>
  );
}
