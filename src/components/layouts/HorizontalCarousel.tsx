import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';

interface HorizontalCarouselProps {
  itemGap?: number;
  title: string;
  data: any[];
  renderItem: ({ item, index }: { item: any; index: number }) => React.ReactElement;
  emptyText?: string;
  keyExtractor?: (item: any, index: number) => string;
  readonly onSeeAll?: () => void;
  readonly seeAllLabel?: string;
  arrowTop?: number;
  cardSize?: number;
}

export const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  itemGap = 12,
  title,
  data,
  renderItem,
  emptyText,
  keyExtractor,
  onSeeAll,
  seeAllLabel,
  arrowTop,
  cardSize,
}) => {
  const { colors, fonts, spacing, fontWeights } = useAppTheme();

  const resolvedArrowTop = arrowTop != null ? arrowTop : (cardSize ? cardSize / 2 : undefined);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: spacing.lg || 20 }]}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
          {title}
        </Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} hitSlop={8}>
            <Text style={{ color: colors.accent, fontFamily: fonts.regular, fontSize: 14, fontWeight: '700' }}>
              {seeAllLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {data.length > 0 ? (
        <HorizontalScrollContainer arrowTop={resolvedArrowTop} dataLength={data.length}>
          {({ ref, onScroll, onLayout, onContentSizeChange, scrollEventThrottle, showsHorizontalScrollIndicator }) => (
            <FlatList
              ref={ref}
              horizontal
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={5}
              showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
              data={data}
              renderItem={renderItem}
              keyExtractor={keyExtractor || ((item, index) => index.toString())}
              contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.lg || 20 }]}
              ItemSeparatorComponent={() => <View style={{ width: itemGap }} />}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              onLayout={onLayout}
              onContentSizeChange={onContentSizeChange}
              scrollEventThrottle={scrollEventThrottle}
            />
          )}
        </HorizontalScrollContainer>
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
