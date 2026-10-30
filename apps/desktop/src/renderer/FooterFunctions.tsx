import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../../../src/hooks/useAppTheme";
import { ABRepeatIcon } from "../../../../src/components/player/ABRepeatIcon";
import { openSleepTimer, openSpeedPitch } from "../../../../src/store/useUIStore";
import { useSleepTimerStore } from "./ports/sleepTimer";
import { useABRepeatStore } from "./ports/abRepeat";
import { usePlayerStore } from "./ports/playerStore";
import { player } from "./player";

export function FooterFunctions({ available, hasLyrics, lyricsOpen, queueOpen, toggleLyrics, toggleQueue, share, playerOpen, togglePlayer }: {
  available: boolean; hasLyrics: boolean; lyricsOpen: boolean; queueOpen: boolean;
  toggleLyrics: () => void; toggleQueue: () => void; share: () => void;
  playerOpen: boolean; togglePlayer: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const timerActive = useSleepTimerStore(state => state.isActive);
  const speedActive = usePlayerStore(state => state.playbackSpeed !== 1 || state.playbackPitch !== 1);
  const pointA = useABRepeatStore(state => state.pointA);
  const pointB = useABRepeatStore(state => state.pointB);
  const icon = (name: React.ComponentProps<typeof Ionicons>["name"], active = false) =>
    <Ionicons name={name} size={23} color={active ? colors.accentLight : colors.textSecondary} />;
  return <div className="footer-functions" data-testid="desktop-player-functions">
    <button className="footer-function-button" data-testid="desktop-sleep-timer" disabled={!available}
      aria-label={t("sleep_timer.title")} title={t("sleep_timer.title")} aria-pressed={Boolean(timerActive)} onClick={openSleepTimer}>
      {icon("timer-outline", timerActive)}
    </button>
    <button className="footer-function-button" data-testid="desktop-speed-pitch" disabled={!available}
      aria-label={t("audio_effects.title")} title={t("audio_effects.title")} aria-pressed={speedActive} onClick={openSpeedPitch}>
      {icon("speedometer-outline", speedActive)}
    </button>
    <button className="footer-function-button" data-testid="desktop-toggle-lyrics" disabled={!available}
      aria-label={t("desktop:lyrics")} title={t("desktop:lyrics")} aria-pressed={lyricsOpen} onClick={toggleLyrics}>
      {icon(lyricsOpen ? "mic" : "mic-outline", lyricsOpen || hasLyrics)}
    </button>
    <div title={t("player_tutorial.steps.ab_repeat.title")}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("player_tutorial.steps.ab_repeat.title")}
        accessibilityState={{ selected: pointA !== null }} testID="desktop-ab-repeat" disabled={!available}
        onPress={() => useABRepeatStore.getState().handleButtonPress(player.getSnapshot().position)}
        onLongPress={() => useABRepeatStore.getState().handleLongPress()} delayLongPress={350}
        style={{ width: 32, height: 36, alignItems: "center", justifyContent: "center", opacity: available ? 1 : 0.45 }}>
        <ABRepeatIcon pointA={pointA} pointB={pointB} disabled={!available} />
      </TouchableOpacity>
    </div>
    <button className="footer-function-button" data-testid="desktop-share-track" disabled={!available}
      aria-label={t("actions.share_song_title")} title={t("actions.share_song_title")} onClick={share}>
      {icon("share-social-outline")}
    </button>
    <button className="footer-function-button" data-testid="desktop-open-queue" disabled={!available}
      aria-label={t("desktop:queue")} title={t("desktop:queue")} aria-pressed={queueOpen} onClick={toggleQueue}>
      {icon("list", queueOpen)}
    </button>
    <button className="footer-function-button" data-testid="desktop-toggle-player"
      aria-label={t("desktop:player")} title={t("desktop:player")} aria-expanded={playerOpen} onClick={togglePlayer}>
      <Ionicons name="chevron-up" size={32} color={playerOpen ? colors.accentLight : colors.textSecondary} />
    </button>
  </div>;
}
