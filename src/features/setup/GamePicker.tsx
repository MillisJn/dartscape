import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { CardSurface } from "@spatch-kit/ui/primitives/CardSurface";
import { Pressable, View } from "react-native";
import type { GameKind } from "@/core/game/config";

import { GAME_CATALOG } from "./gameCatalog";

export interface GamePickerProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSelect: (kind: GameKind) => void;
}

/** Eight games in a 2x4 grid, each with its icon and a one-line hook. */
export function GamePicker({ visible, onClose, onSelect }: GamePickerProps) {
  return (
    <AppModal centered onClose={onClose} title="PICK A GAME" visible={visible}>
      <View className="flex-row flex-wrap gap-app-sm p-app-md">
        {GAME_CATALOG.map((entry) => (
          <Pressable
            key={entry.kind}
            className="w-[47%]"
            onPress={() => {
              onSelect(entry.kind);
              onClose();
            }}
          >
            <CardSurface>
              <View className="items-center gap-app-xs py-app-sm">
                <AppIcon name={entry.icon} size={32} />
                <AppText variant="label">{entry.label}</AppText>
                <AppText color="mutedText" variant="caption">
                  {entry.hook}
                </AppText>
              </View>
            </CardSurface>
          </Pressable>
        ))}
      </View>
    </AppModal>
  );
}
