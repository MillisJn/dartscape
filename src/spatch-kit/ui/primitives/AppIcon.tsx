import type { ComponentType } from "react";
import type { ColorValue } from "react-native";
import { View } from "react-native";
// Only the glyphs the KIT's own vocabulary needs. An app's entity glyphs (Hammer for "jobs",
// ReceiptText for "invoice", …) are imported and registered by the APP — see registerIcons below —
// so no app bundles the icons of a product it isn't.
import {
  ArrowUpDown,
  Bell,
  Calendar,
  CalendarDays,
  Calendar1,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CirclePlay,
  Clock,
  Database,
  Droplet,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Globe,
  GripVertical,
  Home,
  Image,
  Info,
  Link,
  List,
  LogIn,
  LogOut,
  type LucideIcon,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  Mic,
  Minimize2,
  MoreVertical,
  Move,
  Navigation,
  PanelLeft,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Send,
  Settings,
  Share2,
  SlidersHorizontal,
  Square,
  SquareCheck,
  Star,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react-native";

import { useTheme } from "@spatch-kit/theme/provider";

import type { IconName, KitIconName } from "@spatch-kit/theme/iconNames";
export type { IconName, KitIconName };

// The kit's own glyphs — UI vocabulary only. Exhaustive over KitIconName, so adding a name to that
// union without a glyph here fails to compile.
const kitIconMap: Record<KitIconName, LucideIcon> = {
  home: Home,
  search: Search,
  settings: Settings,
  overview: Info,
  media: Image,
  document: FileText,
  receipt: Receipt,
  email: Mail,
  theme: Droplet,
  type: Type,
  density: PanelLeft,
  motion: CirclePlay,
  database: Database,
  reset: RotateCcw,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  filter: SlidersHorizontal,
  empty: Circle,
  create: Plus,
  edit: Pencil,
  sort: ArrowUpDown,
  reorder: Move,
  dragHandle: GripVertical,
  moreVertical: MoreVertical,
  calendar: Calendar,
  calenderWeek: Calendar1,
  calenderMonth: CalendarDays,
  clock: Clock,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  selected: Check,
  star: Star,
  checkbox: Square,
  checkboxChecked: SquareCheck,
  login: LogIn,
  logout: LogOut,
  close: X,
  undo: Undo2,
  trash: Trash2,
  save: Save,
  cut: Scissors,
  link: Link,
  phone: Phone,
  sms: MessageCircle,
  navigate: Navigation,
  view: MapPin,
  earth: Globe,
  mic: Mic,
  volume: Volume2,
  mute: VolumeX,
  bell: Bell,
  send: Send,
  share: Share2,
  folder: Folder,
  list: List,
  eye: Eye,
  eyeOff: EyeOff,
  maximize: Maximize2,
  minimize: Minimize2,
};

// Glyphs an APP has registered for its own vocabulary (its entity nouns, its section names). Kept
// separate from kitIconMap so the kit's set stays exhaustively typed while the app's stays open.
const appIconMap = new Map<string, LucideIcon>();

/**
 * Register glyphs for an app's own icon names, e.g.
 *   registerIcons({ jobs: Hammer, invoice: ReceiptText });
 *
 * Call from a composition root at module load, BEFORE first paint — an icon looked up before its
 * registration renders the neutral fallback and does NOT re-render when it later arrives (the
 * lookup is not reactive). Re-registering a name replaces it; registering over a kit name has no
 * effect, since the kit's map is checked first (so an app can't silently repoint a kit affordance).
 */
export function registerIcons(icons: Record<string, LucideIcon>): void {
  for (const [name, icon] of Object.entries(icons)) {
    appIconMap.set(name, icon);
  }
}

// `__DEV__` is a build-time global on device; guard with typeof so this is also safe under plain
// node (tests), where it is undefined.
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;
// Warn once per name — AppIcon renders in list rows, so an un-deduped warning would spam the console
// once per row per render and get muted, which defeats the point.
const warnedNames = new Set<string>();

function warnUnmappedIconOnce(name: string): void {
  if (!IS_DEV || warnedNames.has(name)) {
    return;
  }
  warnedNames.add(name);
  console.warn(
    `[AppIcon] No glyph for "${name}" — rendering the fallback. Either it's a typo, or the app ` +
      `never registered it (registerIcons), or it registered LATE: the lookup is not reactive, so ` +
      `an icon that rendered before registration keeps the fallback until something re-renders it.`,
  );
}

// When an icon sits inline BEFORE a text label, the label's capitals ride high in their line box
// (the descender band under the baseline is empty), so a box-centered icon reads slightly low next
// to the text. `alignText` nudges the icon up by this fraction of its rendered size — a good proxy
// for the adjacent text size, since a well-set icon tracks its label's size. Tuned by eye; bump it
// if text-adjacent icons still read low. Standalone/centered icons don't opt in, so they're untouched.
const TEXT_ALIGN_NUDGE_RATIO = 0.03;

type AppIconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  // Lucide stroke weight. Left undefined the icon keeps Lucide's default (2);
  // nudge it up to render a bolder glyph (e.g. a selected nav item).
  strokeWidth?: number;
  // Set when this icon sits inline before a text label so it optically centers with the text (see
  // TEXT_ALIGN_NUDGE_RATIO). Omit for standalone / already-centered icons — a tab-bar glyph, a close
  // button, an empty-state hero, an icon-only button — which need no correction and render bare.
  alignText?: boolean;
};

// Lucide icons accept `color` and `size`, but react-native-svg ships an
// incomplete `.web` type variant that (under our `moduleSuffixes` config)
// drops `SvgProps` — so `LucideProps` loses `color` at typecheck time even
// though it works on every platform at runtime. Render through a minimal,
// correct prop surface to keep `tsc` honest about the props we actually pass.
type IconRenderer = ComponentType<{
  color?: ColorValue;
  size?: number;
  strokeWidth?: number;
}>;

export function AppIcon({
  name,
  size,
  color,
  strokeWidth,
  alignText,
}: AppIconProps) {
  const theme = useTheme();
  // Kit glyphs first, then whatever the app registered. `icon` fields are plain strings by the time
  // they reach here (a data-tier descriptor, a server payload), so an unmapped name is a normal
  // runtime possibility, not a bug: Feather silently rendered nothing, but Lucide THROWS on an
  // undefined component, so an unknown name must degrade to a neutral glyph rather than crash the
  // screen. Kit-first ordering also means an app can't silently repoint a kit affordance.
  const resolved = kitIconMap[name as KitIconName] ?? appIconMap.get(name);
  // An EMPTY name is a legitimate "no icon here" (data-tier icon fields use "" for an unknown kind),
  // so only a non-empty name that resolved to nothing is worth flagging.
  if (!resolved && name) {
    warnUnmappedIconOnce(name);
  }
  const Icon = (resolved ?? Circle) as unknown as IconRenderer;
  const resolvedSize = size ?? theme.type.label + 2;

  const glyph = (
    <Icon
      color={color ?? theme.colors.text}
      size={resolvedSize}
      strokeWidth={strokeWidth}
    />
  );

  // Standalone icons render bare (no wrapper, no shift). Only text-adjacent icons opt into the
  // optical nudge that lifts them to the text's cap-center.
  if (!alignText) {
    return glyph;
  }
  return (
    <View
      style={{
        transform: [{ translateY: -(resolvedSize * TEXT_ALIGN_NUDGE_RATIO) }],
      }}
    >
      {glyph}
    </View>
  );
}
