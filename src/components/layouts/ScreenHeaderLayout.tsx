import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../../theme/theme';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ScreenHeaderLayoutProps {
  title: string;
  showBackButton?: boolean;
  onBackButtonPress?: () => void;
  rightComponent?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  headerContainerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  children: (props: { headerHeight: number; bottomPadding: number }) => React.ReactNode;
}

export function ScreenHeaderLayout({
  title,
  showBackButton = true,
  onBackButtonPress,
  rightComponent,
  containerStyle,
  headerContainerStyle,
  titleStyle,
  children,
}: ScreenHeaderLayoutProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const estimatedHeight = insets.top + (showBackButton ? 66 : 60);
  const [headerHeight, setHeaderHeight] = useState(estimatedHeight);

  React.useEffect(() => {
    setHeaderHeight(estimatedHeight);
  }, [insets.top, showBackButton]);

  const handleBack = () => {
    if (onBackButtonPress) {
      onBackButtonPress();
    } else {
      navigation.goBack();
    }
  };

  const bottomPadding =
    Layout.MINI_PLAYER_HEIGHT +
    Layout.TAB_BAR_HEIGHT +
    Layout.PLAYER_MARGIN +
    insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, containerStyle]}>
      {/* CAPA DEL HUMO */}
      <LinearGradient
        colors={['#000000', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'transparent']}
        locations={[0, 0.4, 0.7, 1]}
        style={[styles.smokeEffect, { height: headerHeight + 30 }]}
        pointerEvents="none"
      />

      {/* CAPA DE ILUMINACIÓN DE ACENTO */}
      <LinearGradient
        colors={[colors.accentAlpha20, 'transparent']}
        style={styles.purpleGlow}
        pointerEvents="none"
      />

      {/* INTERFAZ HEADER */}
      <View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        style={[styles.headerContainer, { paddingTop: insets.top + 10 }, headerContainerStyle]}
      >
        <View style={styles.headerRow}>
          {showBackButton ? (
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color={colors.accent} />
            </TouchableOpacity>
          ) : null}
          <Text
            style={[styles.headerTitle, !showBackButton && { marginLeft: 0 }, titleStyle]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {rightComponent ? (
            <View style={styles.rightComponentContainer}>{rightComponent}</View>
          ) : null}
        </View>
      </View>

      {/* CONTENIDO SCROLLABLE */}
      {children({ headerHeight, bottomPadding })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  smokeEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  purpleGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 2,
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingBottom: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 12,
    marginLeft: -8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
  },
  rightComponentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
