import { useState, type ReactNode } from "react";
import { Pressable } from "react-native";

import { InlineEditCardSwap } from "@spatch-kit/ui/animated/InlineEditMotion";
import { AppIcon, type IconName } from "@spatch-kit/ui/primitives/AppIcon";
import { IconButton } from "@spatch-kit/ui/primitives/IconButton";
import { SectionSurface } from "@spatch-kit/ui/primitives/SectionSurface";

type InlineEditFlipCardProps = {
  title: string;
  icon?: IconName;
  tone?: "default" | "muted" | "raised";
  // The read-mode body (label/value rows, thumbnails, the record card fields, etc.).
  read: ReactNode;
  // The edit-mode body. Receives `close` to dismiss the editor after a Save/Cancel — the body
  // renders its own FormActionButtons footer (Save/Cancel wiring differs per consumer: a plain
  // onSave prop in settings vs. a hosted-editor hook on the record screen). Omit — or set
  // editable=false — for a read-only card: the read body then renders plainly, with no pencil.
  renderEdit?: (controls: { close: () => void }) => ReactNode;
  editable?: boolean;
  // What flips the card into edit mode. "header" (default): only the header pencil is pressable.
  // "card": tapping anywhere on the card flips it while read-only (a bigger, non-interactive pencil
  // hints it) — opt in when a larger hit target is genuinely wanted.
  editTrigger?: "card" | "header";
  // Header pencil size. Settings cards run a smaller 18; the record screen uses the 24 default.
  editIconSize?: number;
};

// The one read/edit-flip card shell, shared by BOTH the entity record screen
// (InlineFieldsCardEditor) and the settings sections (InlineEditCard) so the pencil, the
// read↔edit crossfade, and the card chrome stay pixel-identical across them. It owns ONLY the
// SectionSurface shell + the toggle state; each consumer supplies its own read/edit bodies and its
// own footer via the shared FormActionButtons. Change the card look here once — the two consumers
// can no longer drift apart.
//
// The toggle ANIMATES via InlineEditCardSwap: ONE persistent SectionSurface (bodyPadded=false so
// the swap owns the single padded box) whose body crossfades read↔edit while the height animates.
export function InlineEditFlipCard({
  title,
  icon,
  tone = "default",
  read,
  renderEdit,
  editable = true,
  editTrigger = "header",
  editIconSize = 24,
}: InlineEditFlipCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Read-only card (no editor): a plain padded section — no pencil, no animation.
  if (!editable || renderEdit == null) {
    return (
      <SectionSurface icon={icon} title={title} tone={tone}>
        {read}
      </SectionSurface>
    );
  }

  const close = () => setIsEditing(false);

  const shell = (
    <SectionSurface
      bodyPadded={false}
      icon={icon}
      title={title}
      tone={tone}
      // Pencil hidden while editing — the footer Cancel/Save dismiss. Header trigger: only the
      // pencil edits, so an interactive body keeps its own tap targets. Card trigger: a non-pressable
      // pencil hint (the whole card is the tap target below).
      trailing={
        isEditing ? undefined : editTrigger === "header" ? (
          <IconButton
            icon="edit"
            label={`Edit ${title}`}
            onPress={() => setIsEditing(true)}
            size={editIconSize}
          />
        ) : (
          <AppIcon name="edit" size={28} />
        )
      }
    >
      <InlineEditCardSwap swapKey={isEditing ? "edit" : "read"}>
        {isEditing ? renderEdit({ close }) : read}
      </InlineEditCardSwap>
    </SectionSurface>
  );

  // Card trigger: the whole card flips into edit mode while read-only; once editing, the footer owns
  // Cancel/Save so the card-level press is dropped.
  if (!isEditing && editTrigger === "card") {
    return (
      <Pressable className="active:opacity-90" onPress={() => setIsEditing(true)}>
        {shell}
      </Pressable>
    );
  }

  return shell;
}
