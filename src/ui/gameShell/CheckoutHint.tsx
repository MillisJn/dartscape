import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { View } from "react-native";
import { type Bed, label } from "@/core/board";

export interface CheckoutHintProps {
  readonly beds: readonly Bed[] | null;
}

/** bestCheckout(), live — the core has always had this; only the bot could see it before. */
export function CheckoutHint({ beds }: CheckoutHintProps) {
  if (!beds || beds.length === 0) return null;
  return (
    <View className="flex-row gap-app-xs">
      <AppText color="accent" variant="caption">
        {beds.map(label).join(" ")}
      </AppText>
    </View>
  );
}
