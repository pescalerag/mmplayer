import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import PlaylistCover from './PlaylistCover';

interface MediaCardProps {
  id: string;
  type: 'track' | 'album' | 'playlist' | 'artist';
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  customCoverUrl?: string | null; // For playlists
  onPress: (id: string, type: 'track' | 'album' | 'playlist' | 'artist') => void;
  onLongPress?: (id: string, type: 'track' | 'album' | 'playlist' | 'artist') => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  id,
  type,
  title,
  subtitle,
  imageUrl,
  customCoverUrl,
  onPress,
  onLongPress,
}) => {
  const { colors, fonts, radii } = useAppTheme();
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [id, imageUrl]);

  const handlePress = () => onPress(id, type);
  const handleLongPress = () => onLongPress?.(id, type);

  const hasImage = type === 'playlist' ? true : (Boolean(imageUrl && imageUrl !== 'null' && imageUrl.trim() !== '') && !imageError);
  const isRound = type === 'artist';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
      activeOpacity={0.8}
    >
      <View style={[
        styles.imageContainer,
        {
          borderRadius: isRound ? 60 : (radii.md || 8),
          backgroundColor: colors.cardBackground,
        }
      ]}>
        {type === 'playlist' ? (
          <PlaylistCover
            playlistId={id}
            isFavorites={id === 'favorites'}
            width={120}
            height={120}
            borderRadius={isRound ? 60 : (radii.md || 8)}
            customCoverUrl={customCoverUrl}
          />
        ) : hasImage ? (
          <Image
            source={{ uri: imageUrl! }}
            style={styles.image}
            contentFit="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons
              name={type === 'artist' ? 'person' : type === 'album' ? 'albums' : 'musical-note'}
              size={36}
              color={colors.textSecondary}
            />
          </View>
        )}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.regular }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.regular }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 120,
  },
  imageContainer: {
    width: 120,
    height: 120,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
});
