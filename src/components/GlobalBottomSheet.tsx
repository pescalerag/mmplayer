import { useAppTheme } from "@/hooks/useAppTheme";
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { SheetType, useUIStore } from '../store/useUIStore';

// Components
import TrackMenuSheet from './TrackMenuSheet';
import LyricsMenuSheet from './LyricsMenuSheet';
import AlbumMenuSheet from './AlbumMenuSheet';
import ArtistMenuSheet from './ArtistMenuSheet';
import SortModalSheet from './SortModalSheet';
import QueueSheet from './QueueSheet';
import TagManagerModal from './TagManagerModal';
import TagFormModal from './TagFormModal';
import TagMenuSheet from './TagMenuSheet';
import PlaylistSelectorModal from './PlaylistSelectorModal';
import PlaylistMenuSheet from './PlaylistMenuSheet';
import FolderMenuSheet from './FolderMenuSheet';
import ArtistsListSheet from './ArtistsListSheet';
import SleepTimerSheet from './SleepTimerSheet';
import LocalCastSheet from './LocalCastSheet';
import SpeedPitchSheet from './SpeedPitchSheet';
import LibraryTabsOrderSheet from './LibraryTabsOrderSheet';
import AppTabsOrderSheet from './AppTabsOrderSheet';
import HomeSectionsSheet from './HomeSectionsSheet';
import SwipeActionSheet from './SwipeActionSheet';
import MetadataEditorSheet from './MetadataEditorSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GlobalBottomSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const insets = useSafeAreaInsets();

  const activeSheet = useUIStore((state) => state.activeSheet);
  const closeSheet = useUIStore((state) => state.closeSheet);

  const [renderedSheet, setRenderedSheet] = useState<SheetType | null>(null);

  const isVisible = activeSheet !== null;

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // Track activeSheet changes to handle mount/unmount and transitions
  useEffect(() => {
    if (activeSheet) {
      setRenderedSheet(activeSheet);
      if (Platform.OS === 'android') {
        NavigationBar.setBackgroundColorAsync('#121212').catch(() => {});
      }
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRenderedSheet(null);
      });
    }
  }, [activeSheet, fadeAnim, slideAnim]);

  // Handle hardware back press on Android
  useEffect(() => {
    if (!isVisible) return;
    const onBackPress = () => {
      closeSheet();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isVisible, closeSheet]);

  // Handle Keyboard height changes for input forms
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardHeight]);

  if (!renderedSheet && !isVisible) return null;

  const renderContent = () => {
    switch (renderedSheet) {
      case 'track-menu':
        return <TrackMenuSheet />;
      case 'lyrics-menu':
        return <LyricsMenuSheet />;
      case 'album-menu':
        return <AlbumMenuSheet />;
      case 'artist-menu':
        return <ArtistMenuSheet />;
      case 'sort-modal':
        return <SortModalSheet />;
      case 'queue':
        return <QueueSheet />;
      case 'tag-manager':
        return <TagManagerModal />;
      case 'tag-form':
        return <TagFormModal />;
      case 'tag-menu':
        return <TagMenuSheet />;
      case 'playlist-selector':
        return <PlaylistSelectorModal />;
      case 'playlist-menu':
        return <PlaylistMenuSheet />;
      case 'folder-menu':
        return <FolderMenuSheet />;
      case 'artists-list':
        return <ArtistsListSheet />;
      case 'sleep-timer':
        return <SleepTimerSheet />;
      case 'local-cast':
        return <LocalCastSheet />;
      case 'speed-pitch':
        return <SpeedPitchSheet />;
      case 'library-tabs-order':
        return <LibraryTabsOrderSheet />;
      case 'app-tabs-order':
        return <AppTabsOrderSheet />;
      case 'home-sections':
        return <HomeSectionsSheet />;
      case 'swipe-action':
        return <SwipeActionSheet />;
      case 'metadata-editor':
        return <MetadataEditorSheet />;
      default:
        return null;
    }
  };

  // Some sheets might need specific styling (e.g. customized max-height or scroll indicators).
  // These parameters can be customized per component within the rendered view or via global overrides.
  const getContainerMaxHeight = () => {
    if (renderedSheet === 'queue') return SCREEN_HEIGHT * 0.90;
    if (renderedSheet === 'metadata-editor') return SCREEN_HEIGHT * 0.92;
    if (renderedSheet === 'playlist-selector') return SCREEN_HEIGHT * 0.85;
    if (renderedSheet === 'tag-form') return SCREEN_HEIGHT * 0.85;
    return SCREEN_HEIGHT * 0.80;
  };

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      {/* Background Overlay */}
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); closeSheet(); }}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Slide-in Container with Keyboard Adjustment */}
      <Animated.View
        style={[styles.keyboardAvoid, { paddingBottom: keyboardHeight }]}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              maxHeight: getContainerMaxHeight(),
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.dragIndicator} />
          {renderContent()}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
    paddingHorizontal: 24,
    width: '100%',
    borderTopWidth: 1,
    borderColor: colors.cardBackground || '#282828',
    overflow: 'hidden',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
});
