import { AppText } from "@spatch-kit/ui/primitives/AppText";
import { SegmentedButtons } from "@spatch-kit/ui/primitives/SegmentedButtons";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { GameConfig, InOutRule } from "@/core/game/config";

export interface OptionRowsProps {
  readonly config: GameConfig;
  readonly onChange: (next: GameConfig) => void;
}

const IN_OUT_OPTIONS: Array<{ label: string; value: InOutRule }> = [
  { label: "STR", value: "straight" },
  { label: "DBL", value: "double" },
  { label: "TRP", value: "treble" },
  { label: "MAS", value: "master" },
];

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-app-xs">
      <AppText color="mutedText" variant="caption">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/**
 * The option rows generated from GameConfig — pick a game and the rows that make sense for it
 * appear, because the union already guarantees which fields exist. Exhaustive over GameKind: a
 * ninth game with no case here fails to compile.
 */
export function OptionRows({ config, onChange }: OptionRowsProps) {
  switch (config.kind) {
    case "x01":
      return (
        <View className="gap-app-md">
          <Row title="START">
            <SegmentedButtons
              layout="scroll"
              onChange={(start) =>
                onChange({ ...config, start: Number(start) as typeof config.start })
              }
              options={[301, 501, 701, 901, 1001, 1201, 1501].map((n) => ({
                label: String(n),
                value: String(n),
              }))}
              selectedValue={String(config.start)}
            />
          </Row>
          <Row title="IN">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, in: v as InOutRule })}
              options={IN_OUT_OPTIONS}
              selectedValue={config.in}
            />
          </Row>
          <Row title="OUT">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, out: v as InOutRule })}
              options={IN_OUT_OPTIONS}
              selectedValue={config.out}
            />
          </Row>
        </View>
      );

    case "cricket":
      return (
        <Row title="SCORING">
          <SegmentedButtons
            onChange={(v) => onChange({ ...config, scoring: v as typeof config.scoring })}
            options={[
              { label: "POINTS", value: "points" },
              { label: "CUT-THROAT", value: "cutThroat" },
              { label: "NO POINTS", value: "noPoints" },
            ]}
            selectedValue={config.scoring}
          />
        </Row>
      );

    case "shanghai":
      return (
        <Row title="RANGE">
          <SegmentedButtons
            onChange={(v) => {
              const [from, to] = v === "classic" ? [1, 7] : [1, 20];
              onChange({ ...config, from: from as typeof config.from, to: to as typeof config.to });
            }}
            options={[
              { label: "1 → 7", value: "classic" },
              { label: "1 → 20", value: "full" },
            ]}
            selectedValue={config.from === 1 && config.to === 7 ? "classic" : "full"}
          />
        </Row>
      );

    case "baseball":
      return (
        <Row title="INNINGS">
          <SegmentedButtons
            onChange={(v) => onChange({ ...config, innings: Number(v) })}
            options={[7, 9].map((n) => ({ label: String(n), value: String(n) }))}
            selectedValue={String(config.innings)}
          />
        </Row>
      );

    case "killer":
      return (
        <View className="gap-app-md">
          <Row title="LIVES">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, lives: Number(v) })}
              options={[3, 5].map((n) => ({ label: String(n), value: String(n) }))}
              selectedValue={String(config.lives)}
            />
          </Row>
          <Row title="TARGET">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, target: v as typeof config.target })}
              options={[
                { label: "DOUBLE", value: "double" },
                { label: "SINGLE", value: "single" },
              ]}
              selectedValue={config.target}
            />
          </Row>
          <Row title="KILLERS">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, oneKiller: v === "one" })}
              options={[
                { label: "SHARED", value: "shared" },
                { label: "ONE AT A TIME", value: "one" },
              ]}
              selectedValue={config.oneKiller ? "one" : "shared"}
            />
          </Row>
        </View>
      );

    case "aroundTheClock":
      return (
        <View className="gap-app-md">
          <Row title="RING">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, ring: v as typeof config.ring })}
              options={[
                { label: "ANY", value: "any" },
                { label: "DOUBLE", value: "double" },
                { label: "TREBLE", value: "treble" },
              ]}
              selectedValue={config.ring}
            />
          </Row>
          <Row title="BULL">
            <SegmentedButtons
              onChange={(v) => onChange({ ...config, includeBull: v === "yes" })}
              options={[
                { label: "SKIP", value: "no" },
                { label: "INCLUDE", value: "yes" },
              ]}
              selectedValue={config.includeBull ? "yes" : "no"}
            />
          </Row>
        </View>
      );

    case "halveIt":
    case "bobs27":
      // No configurable options — the union already says so.
      return null;
  }
}
