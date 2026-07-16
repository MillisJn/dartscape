import { memo } from "react";
import { View } from "react-native";

import { formatAppDateNoYear } from "@spatch-kit/theme/appDateFormat";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { IconButton } from "@spatch-kit/ui/primitives/IconButton";
import { SelectField } from "@spatch-kit/ui/primitives/SelectField";
import { clockOfMinutes, formatClockLabel } from "@spatch-kit/ui/time/timeModel";
import {
  DURATION_OPTIONS,
  snapToHalfHour,
  TIME_OPTIONS_30,
} from "@spatch-kit/ui/time/timeSelectOptions";
import type { TimeRangeDraftController } from "@spatch-kit/ui/time/useTimeRangeDraft";

// The range controls: the date/time summary on top, then a START time (30-min steps) and a DURATION
// (15-min steps) as SelectFields side by side on one row. Driven by a useTimeRangeDraft controller;
// end = start + duration. Shared by TimeRangeField (ui) and the schedule picker (features). When `day`
// is given the summary leads with the (global-format) date.
export const TimeRangeEditor = memo(function TimeRangeEditor({
  controller,
  day,
  onClear,
}: {
  controller: TimeRangeDraftController;
  day?: Date;
  // When provided, a trash button sits at the end of the start/duration row that empties the window.
  // Opt-in (only the schedule picker passes it), so TimeRangeField's usage is unchanged.
  onClear?: () => void;
}) {
  const { minutes, dispatch } = controller;
  const durationMinutes = minutes.endMinutes - minutes.startMinutes;

  const timeRange = `${formatClockLabel(minutes.startMinutes)} – ${formatClockLabel(
    minutes.endMinutes,
  )}`;
  const summary = day ? `${formatAppDateNoYear(day)}, ${timeRange}` : timeRange;

  return (
    <View className="gap-app-sm ">
      <AppText
        adjustsFontSizeToFit
        className="text-center"
        color="text"
        numberOfLines={1}
        variant="sectionTitle"
      >
        {summary}
      </AppText>

      <View className="flex-row items-center">
        <View className="flex-1 pr-app-xxs">
          <SelectField
            clearable={false}
            label="Start"
            leadingIcon="clock"
            onChange={(next) => {
              const clock = clockOfMinutes(Number(next));
              dispatch({
                origin: "startInput",
                hour24: clock.hour24,
                minute: clock.minute,
              });
            }}
            options={TIME_OPTIONS_30}
            value={String(snapToHalfHour(minutes.startMinutes))}
          />
        </View>

        <View className="flex-1">
          <SelectField
            clearable={false}
            label="Duration"
            leadingIcon="clock"
            onChange={(next) =>
              dispatch({ origin: "durationChip", minutes: Number(next) })
            }
            options={DURATION_OPTIONS}
            value={String(durationMinutes)}
          />
        </View>
        {onClear ? (
          <IconButton
            icon="trash"
            label="Clear time"
            onPress={onClear}
            tone="muted"
          />
        ) : null}
      </View>
    </View>
  );
});
