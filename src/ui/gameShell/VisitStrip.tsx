import { Text, View } from "react-native";
import { type Dart, isMiss, label, points } from "@/core/board";
import { PALETTE } from "@/ui/theme/palette";

export interface VisitStripProps {
  readonly darts: readonly Dart[];
}

function chipColor(dart: Dart): string {
  if (isMiss(dart)) return PALETTE.divider;
  switch (dart.ring) {
    case "single":
    case "outerBull":
      return PALETTE.single;
    case "double":
      return PALETTE.double;
    case "treble":
    case "innerBull":
      return PALETTE.treble;
  }
}

/** This visit's three darts, each in a filled box that mirrors the score boxes up top —
 * flat columns on the header background, the throw's label big and colored by multiplier,
 * with the running visit total as the last box. Props only — no store. */
export function VisitStrip({ darts }: VisitStripProps) {
  const total = darts.reduce((sum, d) => sum + points(d), 0);

  return (
    <View
      style={{
        backgroundColor: PALETTE.header,
        borderBottomWidth: 1,
        borderColor: PALETTE.divider,
        borderTopWidth: 1,
        flexDirection: "row",
      }}
    >
      {[0, 1, 2].map((i) => {
        const dart = darts[i];
        const color = dart ? chipColor(dart) : PALETTE.divider;
        return (
          <View
            key={i}
            style={{
              alignItems: "center",
              borderColor: PALETTE.divider,
              borderRightWidth: 1,
              flex: 1,
              justifyContent: "center",
              paddingVertical: PALETTE.controlPadding,
            }}
          >
            <Text numberOfLines={1} style={{ color, fontSize: 26, fontWeight: "800" }}>
              {dart ? label(dart) : "·"}
            </Text>
          </View>
        );
      })}
      <View
        style={{
          alignItems: "center",
          backgroundColor: PALETTE.activeHighlight,
          flex: 1,
          justifyContent: "center",
          paddingVertical: PALETTE.controlPadding,
        }}
      >
        <Text style={{ color: PALETTE.text, fontSize: 26, fontWeight: "800" }}>{total}</Text>
      </View>
    </View>
  );
}
