import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface HorizontalCarouselProps {
  title: string;
  data: any[];
  renderItem: ({ item, index }: { item: any, index: number }) => React.ReactElement;
  emptyText?: string;
  keyExtractor?: (item: any, index: number) => string;
}

export const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  title,
  data,
  renderItem,
  emptyText,
  keyExtractor,
}) => {
  const { colors, fonts, spacing, fontWeights } = useAppTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold, paddingHorizontal: spacing.lg || 20 }]}>
        {title}
      </Text>

      {data.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor || ((item, index) => index.toString())}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: spacing.lg || 20 }]}
          ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
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
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 14,
  },
});
