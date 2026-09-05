import { useAppTheme } from "@/hooks/useAppTheme";
import * as NavigationBar from 'expo-navigation-bar';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetType, useUIStore } from '../../store/useUIStore';

// Components
import PlaylistSelectorModal from '@/components/modals/PlaylistSelectorModal';
import TagManagerModal from '@/components/modals/TagManagerModal';
import AlbumMenuSheet from '@/components/sheets/AlbumMenuSheet';
import AppTabsOrderSheet from '@/components/sheets/AppTabsOrderSheet';
import ArtistMenuSheet from '@/components/sheets/ArtistMenuSheet';
import ArtistsListSheet from '@/components/sheets/ArtistsListSheet';
import FolderMenuSheet from '@/components/sheets/FolderMenuSheet';
import HomeSectionsSheet from '@/components/sheets/HomeSectionsSheet';
import LibraryTabsOrderSheet from '@/components/sheets/LibraryTabsOrderSheet';
import LocalCastSheet from '@/components/sheets/LocalCastSheet';
import LyricsMenuSheet from '@/components/sheets/LyricsMenuSheet';
import MetadataEditorSheet from '@/components/sheets/MetadataEditorSheet';
import PlaylistMenuSheet from '@/components/sheets/PlaylistMenuSheet';
import PlayerMenuSheet from '@/components/sheets/PlayerMenuSheet';
import SleepTimerSheet from '@/components/sheets/SleepTimerSheet';
import SortModalSheet from '@/components/sheets/SortModalSheet';
import SpeedPitchSheet from '@/components/sheets/SpeedPitchSheet';
import SwipeActionSheet from '@/components/sheets/SwipeActionSheet';
import TagMenuSheet from '@/components/sheets/TagMenuSheet';
import TrackMenuSheet from '@/components/sheets/TrackMenuSheet';
import BatchMenuSheet from '@/components/sheets/BatchMenuSheet';
import AdvancedTagSearchSheet from '@/components/sheets/AdvancedTagSearchSheet';
import EditAliasSheet from '@/components/sheets/EditAliasSheet';
import QueueManageSheet from '@/components/sheets/QueueManageSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function GlobalBottomSheet() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const insets = useSafeAreaInsets();

  const activeSheet = useUIStore((state) => state.activeSheet);
  const closeSheet = useUIStore((state) => state.closeSheet);

  const [renderedSheet, setRenderedSheet] = useState<SheetType | null>(null);

  const effectiveSheet = activeSheet === 'queue' ? null : activeSheet;
  const isVisible = effectiveSheet !== null;

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  const slideTranslateY = useSharedValue(SCREEN_HEIGHT);
  const dragTranslateY = useSharedValue(0);

  const performCloseSheet = React.useCallback(() => {
    closeSheet();
  }, [closeSheet]);

  const handlePanGesture = Gesture.Pan()
    .activeOffsetY(5)
    .onUpdate((event) => {
      if (event.translationY > 0) {
        dragTranslateY.value = event.translationY;
      } else {
        dragTranslateY.value = 0;
      }
    })
    .onEnd((event) => {
      const DISMISS_THRESHOLD = 90;
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        dragTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(performCloseSheet)();
          }
        });
      } else {
        dragTranslateY.value = withSpring(0, { damping: 25, stiffness: 150 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideTranslateY.value + dragTranslateY.value }],
  }));

  // Track activeSheet changes to handle mount/unmount and transitions
  useEffect(() => {
    if (effectiveSheet) {
      setRenderedSheet(effectiveSheet);
      if (Platform.OS === 'android') {
        NavigationBar.setBackgroundColorAsync('#121212').catch(() => { });
      }
      dragTranslateY.value = 0;
      slideTranslateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.8 });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      slideTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, (finished) => {
        if (finished) {
          runOnJS(setRenderedSheet)(null);
        }
      });
    }
  }, [effectiveSheet, fadeAnim, slideTranslateY, dragTranslateY]);

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
      case 'tag-manager':
        return <TagManagerModal />;
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
      case 'player-menu':
        return <PlayerMenuSheet />;
      case 'batch-menu':
        return <BatchMenuSheet />;
      case 'advanced-tag-search':
        return <AdvancedTagSearchSheet />;
      case 'edit-alias':
        return <EditAliasSheet />;
      case 'clear-queue':
        return <QueueManageSheet />;
      default:
        return null;
    }
  };

  const getContainerMaxHeight = () => {
    if (renderedSheet === 'queue') return SCREEN_HEIGHT * 0.90;
    if (renderedSheet === 'metadata-editor') return SCREEN_HEIGHT * 0.92;
    if (renderedSheet === 'playlist-selector') return SCREEN_HEIGHT * 0.85;
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
        <AnimatedReanimated.View
          style={[
            styles.sheetContainer,
            {
              maxHeight: getContainerMaxHeight(),
              paddingBottom: Math.max(insets.bottom, 12),
            },
            sheetAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={handlePanGesture}>
            <View style={styles.handleContainer}>
              <View style={styles.dragIndicator} />
            </View>
          </GestureDetector>
          {renderContent()}
        </AnimatedReanimated.View>
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
  handleContainer: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -6,
    marginBottom: 8,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
  },
});
