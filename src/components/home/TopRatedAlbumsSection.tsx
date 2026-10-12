import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MediaCard } from '../cards/MediaCard';
import { HorizontalCarousel } from '../layouts/HorizontalCarousel';
import { AlbumRatingCaption } from '../library/AlbumRatingCaption';
import { useAlbumRanking } from '../../hooks/useAlbumRanking';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useCascadeEntry } from '../../hooks/useCascadeEntry';
import { getTopRatedAlbums } from '../../utils/albumRanking';
import { useLibraryStore } from '../../store/useLibraryStore';
import { openAlbumMenu } from '../../store/useUIStore';

export function TopRatedAlbumsSection() {
  const { data, error, loading, showLoader, retry } = useAlbumRanking();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const cascade = useCascadeEntry();
  const top = React.useMemo(() => getTopRatedAlbums(data), [data]);
  const viewAll = () => {
    useLibraryStore.getState().setAlbumSort('rating_desc');
    navigation.navigate('Biblioteca', { screen: 'Library', params: { tab: 'albums' } });
  };
  if (showLoader) return <ActivityIndicator color={colors.accent} />;
  if (error) return <TouchableOpacity onPress={retry}><Text style={{ color: colors.text, textAlign: 'center' }}>{t('album_ranking.load_error')}</Text></TouchableOpacity>;
  if (loading) return null;
  return (
    <View>
      <HorizontalCarousel
        title={t('home.top_rated_albums')}
        onSeeAll={top.length > 0 ? viewAll : undefined}
        seeAllLabel={t('album_ranking.view_all')}
        data={top}
        emptyText={t('album_ranking.empty')}
        keyExtractor={item => item.album.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={cascade.item(index)} style={{ width: 120 }}>
            <MediaCard id={item.album.id} type="album" title={item.album.title} imageUrl={item.album.coverUrl}
              onPress={id => navigation.navigate('AlbumDetail', { albumId: id })}
              onLongPress={() => openAlbumMenu(item.album)} />
            <AlbumRatingCaption rating={item} />
          </Animated.View>
        )}
      />
    </View>
  );
}
