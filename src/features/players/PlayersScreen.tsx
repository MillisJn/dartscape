import { showAppAlert } from "@spatch-kit/ui/overlays/system/appAlertController";
import { AppModal } from "@spatch-kit/ui/primitives/AppModal";
import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { Avatar } from "@spatch-kit/ui/primitives/Avatar";
import { Button } from "@spatch-kit/ui/primitives/Button";
import { ListSectionShell } from "@spatch-kit/ui/primitives/ListSectionShell";
import { RemoveIconButton } from "@spatch-kit/ui/primitives/RemoveIconButton";
import { Screen } from "@spatch-kit/ui/primitives/Screen";
import { SectionHeader } from "@spatch-kit/ui/primitives/SectionHeader";
import { TextField } from "@spatch-kit/ui/primitives/TextField";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { Player } from "@/core/game/config";
import { getRepo } from "@/state/repoSeam";

/**
 * Create, rename, delete (behind an appAlert confirm), and jump to a player's stats. A photo via
 * the kit's cropper needs an image-source picker (camera roll / file picker) that isn't in
 * ALLOWED_PACKAGES or installed — avatars stay initials-only for this build; logged in PLAN.md.
 */
export function PlayersScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<readonly Player[]>([]);
  const [editing, setEditing] = useState<Player | "new" | null>(null);
  const [draftName, setDraftName] = useState("");

  const reload = useCallback(() => {
    void getRepo().allPlayers().then(setPlayers);
  }, []);

  useEffect(reload, [reload]);

  function openEditor(target: Player | "new") {
    setDraftName(target === "new" ? "" : target.name);
    setEditing(target);
  }

  async function saveEditor() {
    const name = draftName.trim();
    if (!name) return;
    if (editing === "new") {
      await getRepo().createPlayer(name);
    } else if (editing) {
      await getRepo().renamePlayer(editing.id, name);
    }
    setEditing(null);
    reload();
  }

  async function remove(player: Player) {
    const value = await showAppAlert({
      title: `Delete ${player.name}?`,
      message: "Their saved games go with them. This can't be undone.",
      buttons: [
        { text: "Cancel", style: "cancel", value: "cancel" },
        { text: "Delete", style: "destructive", value: "delete" },
      ],
    });
    if (value === "delete") {
      await getRepo().deletePlayer(player.id);
      reload();
    }
  }

  return (
    <Screen className="bg-background">
      <SectionHeader title="PLAYERS" titleVariant="hero" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <ListSectionShell>
          <View className="gap-app-xs p-app-sm">
            {players.map((player) => (
              <Pressable
                className="flex-row items-center gap-app-sm border-b border-border py-app-sm"
                key={player.id}
                onPress={() => router.push({ pathname: "/stats", params: { playerId: player.id } })}
              >
                <Avatar avatarUri={null} name={player.name} size={40} />
                <AppText className="flex-1" numberOfLines={1} variant="label">
                  {player.name}
                </AppText>
                <Button onPress={() => openEditor(player)} variant="ghost">
                  RENAME
                </Button>
                <RemoveIconButton
                  accessibilityLabel={`Delete ${player.name}`}
                  onPress={() => remove(player)}
                />
              </Pressable>
            ))}

            <Button leadingIcon="create" onPress={() => openEditor("new")} variant="ghost">
              ADD PLAYER
            </Button>
          </View>
        </ListSectionShell>
      </ScrollView>

      <AppModal
        centered
        footer={
          <View className="flex-row gap-app-sm">
            <Button className="flex-1" onPress={() => setEditing(null)} variant="ghost">
              Cancel
            </Button>
            <Button className="flex-1" onPress={saveEditor} variant="primary">
              Save
            </Button>
          </View>
        }
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New player" : "Rename player"}
        visible={editing !== null}
      >
        <View className="p-app-md">
          <TextField label="Name" onChangeText={setDraftName} value={draftName} />
        </View>
      </AppModal>
    </Screen>
  );
}
