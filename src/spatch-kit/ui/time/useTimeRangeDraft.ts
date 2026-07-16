import { useCallback, useMemo, useRef, useState } from "react";

import { startOfDay } from "@spatch-kit/utils/scheduledDateTime";
import {
  applyRangeEdit,
  buildStoredTime,
  resolveDraftMinutes,
  seedRangeDraft,
  type RangeEdit,
  type TimeRangeDraft,
} from "@spatch-kit/ui/time/timeModel";

// Owns the single authoritative in-progress range (with its `pristine` latch). Shared by the
// range-capable SchedulePickerModal and QuickAddJobModal so the draft rules live in exactly one place.
//
// The internal model is start+end, but the UI presents it as a start TIME + a DURATION: `dispatch`
// routes every edit through applyRangeEdit, the only normalizer. The controls are controlled
// SelectFields that re-render from `minutes`, so there is nothing to mirror imperatively.
export function useTimeRangeDraft(
  baseDate: Date,
  startValue: string,
  endValue: string,
) {
  const [draft, setDraft] = useState<TimeRangeDraft>(() =>
    seedRangeDraft(startValue, endValue),
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const reset = useCallback((nextStart: string, nextEnd: string) => {
    const next = seedRangeDraft(nextStart, nextEnd);
    draftRef.current = next;
    setDraft(next);
  }, []);

  // Move the current clock-times onto a different day (an intentional edit — clears pristine). Used
  // by the range picker's calendar step so changing the day keeps the chosen start time + duration.
  const moveToDay = useCallback((day: Date) => {
    const dayStart = startOfDay(day);
    const minutes = resolveDraftMinutes(draftRef.current, dayStart);
    const next: TimeRangeDraft = {
      startISO: buildStoredTime(dayStart, minutes.startMinutes),
      endISO: buildStoredTime(dayStart, minutes.endMinutes),
      pristine: false,
    };
    draftRef.current = next;
    setDraft(next);
  }, []);

  const dispatch = useCallback(
    (edit: RangeEdit) => {
      const next = applyRangeEdit(draftRef.current, edit, baseDate);
      if (next === draftRef.current) {
        return;
      }
      draftRef.current = next;
      setDraft(next);
    },
    [baseDate],
  );

  // Memoized so `minutes` and the controller object keep a stable identity across re-renders that
  // don't touch the draft (e.g. the rail expanding, a parent state flip) — that's what lets a memoized
  // TimeRangeEditor / timeline actually bail on those renders instead of recomputing every frame.
  const minutes = useMemo(
    () => resolveDraftMinutes(draft, baseDate),
    [draft, baseDate],
  );

  return useMemo(
    () => ({ draft, minutes, dispatch, reset, moveToDay }),
    [draft, minutes, dispatch, reset, moveToDay],
  );
}

export type TimeRangeDraftController = ReturnType<typeof useTimeRangeDraft>;
