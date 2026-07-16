// The icon vocabulary, split into what the KIT owns and what an APP adds.
//
// Kept in this Leaf module (no react-native import) so ANY tier can type an `icon` field without
// importing up into ui/primitives/AppIcon — a data-tier filter descriptor, a settings leaf, a menu
// item. AppIcon re-exports these and maps each kit name to its Lucide glyph.
//
// THE SPLIT. KitIconName is UI vocabulary: affordances (create/edit/close/sort), chrome (chevrons,
// checkboxes, drag handles), and universal glyphs (clock, phone, folder). It deliberately does NOT
// name business entities. An app's own nouns — "jobs", "invoice", "catalogItems" — are the APP's
// vocabulary: it declares them in its own union and registers their glyphs via registerIcons()
// (see ui/primitives/AppIcon). That inversion is what stops one product's domain model from living
// in the kit's type system, and stops every other app from bundling glyphs it will never render.
//
// WHY PROPS TAKE `IconName`, NOT `KitIconName`. The kit cannot know an app's names, so any kit prop
// that accepts an icon is typed `IconName` — the kit's names (which still autocomplete) plus any
// string. This is not a safety regression: `icon` fields have always been plain strings by the time
// they reach AppIcon, which is why it has always fallen back to a neutral glyph for an unmapped
// name. Apps keep strict checking where it matters by typing their OWN fields against their OWN
// closed union (see app/src/types/appIconNames.ts for how this app does it).
export type KitIconName =
  // Navigation / chrome
  | "home"
  | "search"
  | "settings"
  | "overview"
  | "chevronRight"
  | "chevronLeft"
  | "chevronDown"
  | "chevronUp"
  | "moreVertical"
  | "maximize"
  | "minimize"
  // Actions
  | "create"
  | "edit"
  | "close"
  | "undo"
  | "trash"
  | "save"
  | "cut"
  | "link"
  | "send"
  | "share"
  | "filter"
  | "sort"
  | "reorder"
  | "dragHandle"
  | "reset"
  | "view"
  | "navigate"
  // Selection state
  | "selected"
  | "star"
  | "checkbox"
  | "checkboxChecked"
  | "empty"
  | "eye"
  | "eyeOff"
  // Time
  | "calendar"
  | "calenderWeek"
  | "calenderMonth"
  | "clock"
  // Comms
  | "phone"
  | "sms"
  | "email"
  | "bell"
  | "mic"
  | "volume"
  | "mute"
  // Content
  | "document"
  | "receipt"
  | "media"
  | "folder"
  | "list"
  | "earth"
  // Account
  | "login"
  | "logout"
  // Appearance settings (the ThemeControls vocabulary)
  | "theme"
  | "type"
  | "density"
  | "motion"
  | "database";

// Any icon token: the kit's own names (autocompleted) plus whatever an app has registered.
// `(string & {})` is the standard trick to keep KitIconName's literals in autocomplete while still
// widening to string — a plain `KitIconName | string` collapses to `string` and loses the hints.
export type IconName = KitIconName | (string & {});
