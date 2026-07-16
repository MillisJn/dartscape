import { AppIcon } from "@spatch-kit/ui/primitives/AppIcon";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Avatar } from "@spatch-kit/ui/primitives/Avatar";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { ListSectionShell } from "@spatch-kit/ui/primitives/ListSectionShell";
import { RemoveIconButton } from "@spatch-kit/ui/primitives/RemoveIconButton";
import { SegmentedButtons } from "@spatch-kit/ui/primitives/SegmentedButtons";
import { type SelectOption, SelectPopup } from "@spatch-kit/ui/primitives/SelectPopup";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SKILL } from "@/core/bot/bot";
import type { Player } from "@/core/game/config";
import { getRepo } from "@/state/repoSeam";

export interface DraftPlayer {
  readonly id: string;
  readonly name: string;
  readonly isBot: boolean;
  /** Only meaningful while isBot — retained across a human<->bot toggle so re-enabling keeps the
   * last-picked difficulty instead of resetting it. */
  readonly sigma: number;
}

export interface PlayerListProps {
  readonly players: readonly DraftPlayer[];
  readonly onChange: (next: readonly DraftPlayer[]) => void;
}

const DIFFICULTIES: Array<{ label: string; value: string; sigma: number }> = [
  { label: "EZ", value: "easy", sigma: SKILL.EASY },
  { label: "NM", value: "normal", sigma: SKILL.NORMAL },
  { label: "HD", value: "hard", sigma: SKILL.HARD },
  { label: "EX", value: "expert", sigma: SKILL.EXPERT },
  { label: "MA", value: "master", sigma: SKILL.MASTER },
];

function difficultyValue(sigma: number): string {
  return DIFFICULTIES.reduce((best, d) =>
    Math.abs(d.sigma - sigma) < Math.abs(best.sigma - sigma) ? d : best,
  ).value;
}

/** The setup screen's player roster: reorder (up/down — see PLAN.md, a drag gesture is
 * unverifiable without a device so this ships as the reversible, testable equivalent), tap an
 * avatar to flip human/bot, remove, and add from saved players or type a new name. */
export function PlayerList({ players, onChange }: PlayerListProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedPlayers, setSavedPlayers] = useState<readonly Player[]>([]);
  const anchorRef = useRef<View>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    void getRepo()
      .allPlayers()
      .then((all) => {
        if (!cancelled) setSavedPlayers(all);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen]);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= players.length) return;
    const next = [...players];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  }

  function remove(id: string) {
    onChange(players.filter((p) => p.id !== id));
  }

  function toggleBot(id: string) {
    onChange(players.map((p) => (p.id === id ? { ...p, isBot: !p.isBot } : p)));
  }

  function setDifficulty(id: string, value: string) {
    const found = DIFFICULTIES.find((d) => d.value === value);
    if (!found) return;
    onChange(players.map((p) => (p.id === id ? { ...p, sigma: found.sigma } : p)));
  }

  async function addByName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPickerOpen(false);

    // An existing saved name is just added to this match's roster with its real id; a brand-new
    // name gets a real, persisted player record first (so it shows up next time).
    const existing = savedPlayers.find((p) => p.name === trimmed);
    const id = existing
      ? existing.id
      : await getRepo()
          .createPlayer(trimmed)
          .then((p) => p.id);
    onChange([...players, { id, name: trimmed, isBot: false, sigma: SKILL.NORMAL }]);
  }

  const options: SelectOption[] = savedPlayers
    .filter((saved) => !players.some((p) => p.name === saved.name))
    .map((saved) => ({ avatarUri: null, label: saved.name, value: saved.name }));

  return (
    <ListSectionShell title={`PLAYERS ${players.length}`}>
      <View className="gap-app-xs p-app-sm">
        {players.map((player, index) => (
          <View
            className="flex-row items-center gap-app-sm border-b border-border py-app-xs"
            key={player.id}
          >
            <View className="gap-app-xxs">
              <Pressable
                disabled={index === 0}
                onPress={() => move(index, -1)}
                style={{ opacity: index === 0 ? 0.3 : 1 }}
              >
                <AppIcon name="chevronUp" size={16} />
              </Pressable>
              <Pressable
                disabled={index === players.length - 1}
                onPress={() => move(index, 1)}
                style={{ opacity: index === players.length - 1 ? 0.3 : 1 }}
              >
                <AppIcon name="chevronDown" size={16} />
              </Pressable>
            </View>

            <Pressable onPress={() => toggleBot(player.id)}>
              <Avatar avatarUri={null} name={player.isBot ? "🤖" : player.name} size={36} />
            </Pressable>

            <View className="flex-1 gap-app-xxs">
              <AppText numberOfLines={1} variant="label">
                {player.name}
              </AppText>
              {player.isBot ? (
                <SegmentedButtons
                  onChange={(v) => setDifficulty(player.id, v)}
                  options={DIFFICULTIES}
                  selectedValue={difficultyValue(player.sigma)}
                  size="sm"
                />
              ) : null}
            </View>

            <RemoveIconButton
              accessibilityLabel={`Remove ${player.name}`}
              onPress={() => remove(player.id)}
            />
          </View>
        ))}

        <View ref={anchorRef}>
          <Button leadingIcon="create" onPress={() => setPickerOpen(true)} variant="ghost">
            ADD PLAYER
          </Button>
        </View>
      </View>

      <SelectPopup
        allowCustomValue
        anchorRef={anchorRef}
        clearable={false}
        onChange={addByName}
        onClose={() => setPickerOpen(false)}
        options={options}
        value=""
        visible={pickerOpen}
      />
    </ListSectionShell>
  );
}
