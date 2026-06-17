import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Animated, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getChangelogForVersion } from '../constants/changelogs';
import { useSettingsStore } from '../store/useSettingsStore';
import { navigationRef } from '../navigation/navigationRef';
import { ScannerService } from '../services/ScannerService';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/theme';
import { useAppTheme } from "@/hooks/useAppTheme";

const { width, height } = Dimensions.get('window');

// Calculamos tamaño de la imagen para mantener proporción 1080x1920 (9:16)
const IMAGE_WIDTH = width * 0.75;
const IMAGE_HEIGHT = IMAGE_WIDTH * (1920 / 1080);

export default function UpdatedAppModal() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const { t } = useTranslation();
  
  const { lastSeenVersion, setLastSeenVersion } = useSettingsStore();
  const currentVersion = Constants.expoConfig?.version || '1.1.0';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Montaje / Desmontaje controlado
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  useEffect(() => {
    if (lastSeenVersion !== currentVersion) {
      if (lastSeenVersion !== null) {
        ScannerService.repairCorruptedData();
      }
      setVisible(true);
    }
  }, [lastSeenVersion, currentVersion]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const handleClose = React.useCallback(() => {
    setVisible(false);
    setLastSeenVersion(currentVersion);
  }, [currentVersion, setLastSeenVersion]);

  useEffect(() => {
    if (!visible) return;
    const onBackPress = () => {
      handleClose();
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [visible, handleClose]);

  const handleSeeChanges = () => {
    handleClose();
    navigationRef.current?.navigate('Configuración', { screen: 'ChangelogScreen' });
  };

  if (!shouldRender && !visible) return null;

  const versionData = getChangelogForVersion(currentVersion);

  return (
    <View 
      style={[StyleSheet.absoluteFill, { zIndex: 10000, justifyContent: 'center', alignItems: 'center' }]} 
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      
      <Animated.View style={[styles.modalContent, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        
        {/* Imagen del Changelog */}
        <View style={styles.imageWrapper}>
          <Image
            source={versionData.image}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
        </View>

        {/* Botones fuera de la imagen */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSeeChanges} activeOpacity={0.8}>
            <Ionicons name="sparkles" size={20} color={colors.text} style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>{t('settings.view_changes')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} activeOpacity={0.6}>
            <Text style={styles.secondaryButtonText}>{t('settings.now_no')}</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: IMAGE_WIDTH,
    height: Math.min(IMAGE_HEIGHT, height * 0.65), // Limit height so it fits on small screens
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.overlayAlpha10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  buttonsContainer: {
    width: IMAGE_WIDTH,
    marginTop: 30,
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    width: '100%',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.regular,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '700',
  },
});
