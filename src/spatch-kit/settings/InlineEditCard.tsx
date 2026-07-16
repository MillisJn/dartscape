import { type ReactNode } from "react";
import { View } from "react-native";

import { type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { FormActionButtons } from "@spatch-kit/ui/primitives/FormActionButtons";
import { InlineEditFlipCard } from "@spatch-kit/ui/primitives/InlineEditFlipCard";

type InlineEditCardProps = {
  title: string;
  icon?: IconName;
  tone?: "default" | "muted" | "raised";
  // The read-mode body (label/value rows, thumbnails, etc.).
  read: ReactNode;
  // The edit-mode body (form fields, pickers). Omit for a purely read-only card.
  edit?: ReactNode;
  // When false, no pencil is shown — the card is read-only.
  editable?: boolean;
  errorMessage?: string | null;
  isSaving?: boolean;
  // Provide for a field card: shows Save/Cancel. Return true to close the editor (saved),
  // false to keep it open (validation/save error). Omit for an action card (pick an image,
  // etc.) where changes persist immediately — the footer then shows a single "Done".
  onSave?: () => Promise<boolean> | boolean;
  // Called when the user cancels a field edit (revert the draft) — not on "Done".
  onCancel?: () => void;
  saveLabel?: string;
};

// A settings card that edits in place — the pencil flips the section into an editor with
// Save/Cancel. A thin wrapper over the shared InlineEditFlipCard shell + FormActionButtons row, so
// it stays pixel-identical to the entity record screen's inline cards. This owns only the settings
// specifics: the read/edit BODIES the caller passes, and the Save/Cancel/Done wiring.
export function InlineEditCard({
  title,
  icon,
  tone,
  read,
  edit,
  editable = true,
  errorMessage,
  isSaving = false,
  onSave,
  onCancel,
  saveLabel = "Save",
}: InlineEditCardProps) {
  return (
    <InlineEditFlipCard
      editable={editable && edit != null}
      editIconSize={18}
      icon={icon}
      read={read}
      renderEdit={({ close }) => (
        <>
          {edit}

          {errorMessage ? (
            <AppText color="danger" variant="caption">
              {errorMessage}
            </AppText>
          ) : null}

          {onSave ? (
            // Field card: the shared Cancel/Save row. The divider sits above; FormActionButtons
            // supplies its own top gap, so the wrapper adds none.
            <View className="border-t border-border">
              <FormActionButtons
                isSaving={isSaving}
                onCancel={() => {
                  onCancel?.();
                  close();
                }}
                onSave={() => {
                  void (async () => {
                    const ok = await onSave();
                    if (ok) {
                      close();
                    }
                  })();
                }}
                submitLabel={saveLabel}
              />
            </View>
          ) : (
            // Action card (changes already persisted): a single Done that just dismisses.
            <View className="border-t border-border pt-app-sm">
              <Button className="flex-1" onPress={close} variant="primary">
                Done
              </Button>
            </View>
          )}
        </>
      )}
      title={title}
      tone={tone}
    />
  );
}
