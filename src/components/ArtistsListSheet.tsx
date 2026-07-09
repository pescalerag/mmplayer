import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSheetProps } from '@/hooks/useSheetProps';

export default function ArtistsListSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { props: { artists }, close: closeSheet } = useSheetProps<{ artists: any[] }>('artists-list');

  const handleArtistPress = (artistId: string) => {
    closeSheet();
    setTimeout(() => {
      navigation.navigate('ArtistDetail', { artistId });
    }, 150);
  };

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{t('screens.artists') || 'Artistas'}</Text>
      </View>

      {/* Artists list */}
      <FlatList
        data={artists}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.artistRow}
            onPress={() => handleArtistPress(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.artistInfo}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.thumbnail, styles.placeholder]}>
                  <Ionicons name="person" size={24} color={colors.textSecondary} />
                </View>
              )}
              <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      />
    </>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.regular,
    fontWeight: '800',
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  placeholder: {
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.regular,
    fontWeight: '700',
    flex: 1,
  },
});
