import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

interface HorizontalCarouselProps {
  title: string;
  data: any[];
  renderItem: ({ item, index }: { item: any, index: number }) => React.ReactElement;
  emptyText?: string;
  keyExtractor?: (item: any, index: number) => string;
  readonly onSeeAll?: () => void;
  readonly seeAllLabel?: string;
}

export const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  title,
  data,
  renderItem,
  emptyText,
  keyExtractor,
  onSeeAll,
  seeAllLabel,
}) => {
  const { colors, fonts, spacing, fontWeights } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg || 20 }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
          {title}
        </Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll} hitSlop={8}>
          <Text style={{ color: colors.accent, fontFamily: fonts.regular, fontSize: 14, fontWeight: '700' }}>{seeAllLabel}</Text>
        </TouchableOpacity>}
      </View>

      {data.length > 0 ? (
        <FlatList
          horizontal
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          showsHorizontalScrollIndicator={false}
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor || ((item, index) => index.toString())}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.lg || 20 }]}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={{ paddingHorizontal: spacing.lg || 20 }}>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
            {emptyText || 'No hay elementos'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  title: {
    fontSize: 20,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 14,
  },
});
