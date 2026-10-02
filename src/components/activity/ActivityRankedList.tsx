import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Metric, getItemStatLabel } from '../../screens/activity/utils/activityStatUtils';
import Animated from 'react-native-reanimated';
import { getItemFadeIn } from '@/utils/cascadeAnimations';

interface ActivityRankedItemProps {
  readonly rank: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly imageUrl?: string | null;
  readonly isAvatar?: boolean;
  readonly placeholderIcon: keyof typeof Ionicons.glyphMap;
  readonly statLabel: string;
  readonly onPress: () => void;
}

function ActivityRankedItem({
  rank,
  title,
  subtitle,
  imageUrl,
  isAvatar = false,
  placeholderIcon,
  statLabel,
  onPress,
}: ActivityRankedItemProps) {
  const { colors, fonts, radii } = useAppTheme();
  const borderRadius = isAvatar ? 20 : (radii.sm || 4);
  const imageStyle = isAvatar ? styles.listAvatar : styles.listCover;
  const placeholderStyle = isAvatar ? styles.listAvatarPlaceholder : styles.listCoverPlaceholder;

  return (
    <TouchableOpacity
      style={styles.listItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Text style={[styles.rankText, { fontFamily: fonts.bold, color: colors.textSecondary }]}>
        {rank}
      </Text>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[imageStyle, { borderRadius }]} />
      ) : (
        <View style={[placeholderStyle, { borderRadius, backgroundColor: colors.accentAlpha30 }]}>
          <Ionicons name={placeholderIcon} size={20} color={colors.accentLight} />
        </View>
      )}
      <View style={styles.listItemInfo}>
        <Text style={[styles.listItemTitle, { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined && (
          <Text style={[styles.listItemSubtitle, { fontFamily: fonts.regular, color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text style={[styles.listStatText, { fontFamily: fonts.regular, color: colors.textSecondary }]}>
        {statLabel}
      </Text>
    </TouchableOpacity>
  );
}

interface ActivityRankedListProps {
  readonly items: readonly any[];
  readonly type: 'songs' | 'albums' | 'artists';
  readonly metric: Metric;
  readonly onItemPress: (id: string) => void;
}

export function ActivityRankedList({
  items,
  type,
  metric,
  onItemPress,
}: ActivityRankedListProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.listContainer}>
      {items.map((item, index) => {
        const statLabel = getItemStatLabel(metric, item.duration, item.plays, t);
        const rank = index + 1;

        let content = null;
        if (type === 'songs') {
          content = (
            <ActivityRankedItem
              rank={rank}
              title={item.title}
              subtitle={item.artistName}
              imageUrl={item.coverUrl}
              placeholderIcon="musical-note"
              statLabel={statLabel}
              onPress={() => onItemPress(item.id)}
            />
          );
        } else if (type === 'albums') {
          content = (
            <ActivityRankedItem
              rank={rank}
              title={item.title}
              subtitle={item.artistName || t('activity.unknown_artist')}
              imageUrl={item.coverUrl}
              placeholderIcon="albums"
              statLabel={statLabel}
              onPress={() => onItemPress(item.id)}
            />
          );
        } else {
          content = (
            <ActivityRankedItem
              rank={rank}
              title={item.name}
              imageUrl={item.imageUrl}
              isAvatar
              placeholderIcon="person"
              statLabel={statLabel}
              onPress={() => onItemPress(item.id)}
            />
          );
        }

        return (
          <Animated.View key={item.id} entering={getItemFadeIn(index)}>
            {content}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    gap: 8,
    marginTop: 10,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  rankText: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
    marginRight: 8,
  },
  listCover: {
    width: 40,
    height: 40,
  },
  listCoverPlaceholder: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listAvatar: {
    width: 40,
    height: 40,
  },
  listAvatarPlaceholder: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  listItemSubtitle: {
    fontSize: 12,
  },
  listStatText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
});
