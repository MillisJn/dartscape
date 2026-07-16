import { View } from "react-native";

import { Button } from "@spatch-kit/ui/primitives/Button";
import { useLayoutMode } from "@spatch-kit/ui/responsive/useLayoutMode";

type FormActionButtonsProps = {
  // Save is in flight: Cancel is disabled and Save shows an inline spinner, so a mid-save Cancel
  // can't tear down the editor before the async persist resolves.
  isSaving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  // Independently disables Save (e.g. the form is invalid) without implying a save is running.
  saveDisabled?: boolean;
  submitLabel: string;
};

// The shared Cancel / Save row for every creator + editor popup AND every inline read/edit flip card
// (record screen + settings), so they all read as one system.
//
// - Phone/native: the two buttons split the width 50/50 (`flex-1`) — thumb-friendly, the standard
//   for a bottom sheet.
// - Wide web (isExpanded ≥ 768): the buttons shrink to their content and right-align, so a roomy
//   dialog doesn't stretch a giant Cancel/Save bar across its full width.
export function FormActionButtons({
  isSaving = false,
  onCancel,
  onSave,
  saveDisabled = false,
  submitLabel,
}: FormActionButtonsProps) {
  const { isExpanded } = useLayoutMode();

  // A plain View owns the flex-row (NativeWind doesn't reliably apply layout classes through the
  // styled Button/Surface wrappers on web). Auto-width buttons get a min width on desktop so a short
  // label ("Save") still reads as a comfortable target rather than a tiny pill.
  const buttonStyle = isExpanded ? { minWidth: 112 } : undefined;

  return (
    // `w-full` so the row fills its host even when nested inside another flex-row (e.g.
    // BottomActionBar wraps its children in a flex-row) — without it the flex-1 buttons collapse to
    // their content width and bunch up on the left.
    <View
      className={
        isExpanded
          ? "w-full flex-row justify-end gap-app-sm pt-app-sm"
          : "w-full flex-row gap-app-sm pt-app-sm"
      }
    >
      <Button
        className={isExpanded ? undefined : "flex-1"}
        disabled={isSaving}
        onPress={onCancel}
        style={buttonStyle}
        variant="secondary"
      >
        Cancel
      </Button>
      <Button
        className={isExpanded ? undefined : "flex-1"}
        disabled={saveDisabled || isSaving}
        loading={isSaving}
        onPress={onSave}
        style={buttonStyle}
        variant="primary"
      >
        {submitLabel}
      </Button>
    </View>
  );
}
