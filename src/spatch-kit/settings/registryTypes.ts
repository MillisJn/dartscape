import type { IconName } from "@spatch-kit/ui/primitives/AppIcon";

// The settings MENU MECHANISM, generic over an app's own leaf keys.
//
// The kit ships the mechanism (these types + the row components that render them); the app supplies
// the keys. Bind them to your own union and the menu is yours:
//
//   type MySettingsKey = "account" | "appearance" | "billing";
//   const MY_GROUPS: SettingsGroup<MySettingsKey>[] = [
//     { title: "GENERAL", items: [{ icon: "settings", key: "account", title: "Account" }] },
//   ];
//
// These types were originally keyed directly to one app's concrete union, which welded the mechanism
// to that app's leaves. Parameterizing the key IS the inversion — keep it that way.

// One tappable row in a settings menu. Owner-only items render disabled (not hidden) for non-owners
// — discoverable but gated.
export type SettingsLeafItem<TKey extends string> = {
  icon: IconName;
  key: TKey;
  title: string;
  ownerOnly?: boolean;
};

// A labeled section of a flat settings menu: an UPPERCASE header plus its rows.
export type SettingsGroup<TKey extends string> = {
  title: string;
  items: SettingsLeafItem<TKey>[];
};
