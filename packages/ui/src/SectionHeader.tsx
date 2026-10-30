import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface SectionHeaderProps {
  readonly title: string;
  readonly onSeeAll?: () => void;
  readonly showSeeAll?: boolean;
  readonly rightElement?: React.ReactNode;
}

/** Presentation from the mobile SectionHeader, without importing mobile stores. */
export function SectionHeader({
  title,
  onSeeAll,
  showSeeAll = false,
  rightElement,
  seeAllLabel,
  theme,
  horizontalPadding = 20,
}: Readonly<
  SectionHeaderProps & {
    seeAllLabel: string;
    theme: { text: string; accent: string; fontFamily: string };
    horizontalPadding?: number;
  }
>) {
  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <Text
        style={[
          styles.title,
          { color: theme.text, fontFamily: theme.fontFamily },
        ]}
      >
        {title}
      </Text>
      {rightElement ||
        (showSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text
              style={[
                styles.seeAll,
                { color: theme.accent, fontFamily: theme.fontFamily },
              ]}
            >
              {seeAllLabel}
            </Text>
          </TouchableOpacity>
        ))}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 24,
  },
  title: { fontSize: 20, fontWeight: "bold" },
  seeAll: { fontSize: 14, fontWeight: "700" },
});
