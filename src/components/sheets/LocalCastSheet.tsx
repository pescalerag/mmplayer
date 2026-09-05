import { useAppTheme } from '@/hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import CastContext, { CastButton, useDevices } from 'react-native-google-cast';
import { useActiveTrack } from 'react-native-track-player';
import { ChromecastService } from '../../services/ChromecastService';
import { useCastStore } from '../../store/useCastStore';
import { useToastStore } from '../../store/useToastStore';
import {
  isBatteryOptimizationIgnored,
  requestIgnoreBatteryOptimizations,
} from '../../../modules/native-audio-scanner';

export default function LocalCastSheet() {
  const { colors, fonts } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts), [colors, fonts]);
  const {
    isServerRunning,
    isLocalCastActive,
    serverIp,
    selectedMode,
    setSelectedMode,
    startLocalCast,
    stopLocalCast,
    isChromecastConnected,
    isChromecastConnecting,
    connectedDeviceName,
    disconnectChromecast,
    castVolume,
    setCastVolume,
  } = useCastStore();

  const { t } = useTranslation();
  const devices = useDevices();
  const activeTrack = useActiveTrack();

  const [isLoading, setIsLoading] = useState(false);
  const [isBatteryIgnored, setIsBatteryIgnored] = useState(true);
  const [hasInternet, setHasInternet] = useState<boolean | null>(null);

  const checkBattery = async () => {
    if (Platform.OS === 'android') {
      const isIgnored = await isBatteryOptimizationIgnored();
      setIsBatteryIgnored(isIgnored);
    }
  };

  useEffect(() => {
    ChromecastService.init();
    checkBattery();
    const checkInternet = () =>
      NetInfo.fetch().then(netState => setHasInternet(!!netState.isConnected && !!netState.isInternetReachable));

    const sub = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        checkBattery();
        // Re-check internet when app comes to foreground
        checkInternet();
      }
    });
    // Initial internet check
    checkInternet();
    return () => sub.remove();
  }, []);

  const handleRequestBattery = async () => {
    await requestIgnoreBatteryOptimizations();
  };

  // Determine current active mode
  const activeMode = isChromecastConnected || isChromecastConnecting
    ? 'chromecast'
    : isLocalCastActive
    ? 'local'
    : selectedMode;

  const handleStartLocal = () => {
    setIsLoading(true);
    startLocalCast()
      .then(() => {
        setIsLoading(false);
      })
      .catch((err: any) => {
        setIsLoading(false);
        useToastStore.getState().showToast(
          err?.message || t('cast.start_error'),
          'alert-circle-outline'
        );
      });
  };

  const handleStopLocal = () => {
    setIsLoading(true);
    stopLocalCast()
      .then(() => {
        setIsLoading(false);
        useToastStore.getState().showToast(
          t('toasts.cast_stopped') || 'Casteo detenido',
          'desktop-outline'
        );
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  const handleConnectChromecast = async (deviceId?: string) => {
    setIsLoading(true);
    try {
      await ChromecastService.startSession(deviceId);
      setIsLoading(false);
    } catch (err: any) {
      setIsLoading(false);
      useToastStore.getState().showToast(
        err?.message || 'Error al conectar con Chromecast',
        'alert-circle-outline'
      );
    }
  };

  const handleDisconnectChromecast = async () => {
    setIsLoading(true);
    try {
      await disconnectChromecast();
      setIsLoading(false);
      useToastStore.getState().showToast(
        'Chromecast desconectado',
        'tv-outline'
      );
    } catch (err) {
      setIsLoading(false);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setCastVolume(vol);
    ChromecastService.setVolume(vol);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Selector Mode View (Before choosing LocalCast or ChromeCast)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!activeMode) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerLabel}>{t('cast.title_main')}</Text>
          </View>
          <Text style={styles.headerTitle}>{t('cast.choose_service')}</Text>
        </View>

        {/* Options Cards */}
        <View style={styles.optionsContainer}>
          {/* LocalCast Card */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setSelectedMode('local')}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIconWrapper, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="desktop-outline" size={28} color={colors.accentLight || '#A78BFA'} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{t('cast.option_local')}</Text>
              <Text style={styles.optionDesc}>{t('cast.option_local_desc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* ChromeCast Card */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => setSelectedMode('chromecast')}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="tv-outline" size={28} color="#60A5FA" />
            </View>
            <View style={styles.optionContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.optionTitle}>{t('cast.option_chromecast')}</Text>
                <View style={[styles.betaBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                  <Text style={[styles.betaBadgeText, { color: '#60A5FA' }]}>GOOGLE CAST</Text>
                </View>
              </View>
              <Text style={styles.optionDesc}>{t('cast.option_chromecast_desc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. LocalCast Flow
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeMode === 'local') {
    return (
      <View style={styles.container}>
        {/* Navigation & Header */}
        <View style={styles.header}>
          {!isLocalCastActive && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedMode(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={18} color={colors.accentLight || '#A78BFA'} />
              <Text style={styles.backButtonText}>{t('cast.change_option')}</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.headerLabel, { marginTop: !isLocalCastActive ? 8 : 0 }]}>{t('cast.title')}</Text>
          <Text style={styles.headerTitle}>
            {isLocalCastActive ? t('cast.status_active') : t('cast.status_idle')}
          </Text>
        </View>

        {/* Status icon */}
        <View style={styles.iconContainer}>
          <Ionicons
            name={isLocalCastActive ? 'desktop' : 'desktop-outline'}
            size={56}
            color={isLocalCastActive ? colors.accentLight : '#535353'}
          />
          {isLocalCastActive && <View style={styles.activeDot} />}
        </View>

        {/* Server IP Address */}
        {isLocalCastActive && serverIp ? (
          <View style={styles.ipContainer}>
            <Text style={styles.ipLabel}>{t('cast.open_in_browser')}</Text>
            <Text style={styles.ipAddress} selectable>
              {serverIp}
            </Text>
          </View>
        ) : (
          <View style={styles.ipContainer}>
            <Text style={styles.idleText}>{t('cast.idle_desc')}</Text>
          </View>
        )}

        {/* Battery Optimization Card (Android) */}
        {Platform.OS === 'android' && !isBatteryIgnored && (
          <View style={styles.batteryCard}>
            <View style={styles.batteryHeader}>
              <View style={styles.batteryIconCircle}>
                <Ionicons name="battery-charging" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.batteryTitle}>{t('cast.battery_opt_title')}</Text>
                <Text style={styles.batteryDesc}>{t('cast.battery_opt_desc')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.batteryButton}
              onPress={handleRequestBattery}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={15} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.batteryButtonText}>{t('cast.battery_opt_button')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionContainer}>
          {isLocalCastActive ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton, isLoading && styles.buttonDisabled]}
              onPress={handleStopLocal}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
              ) : (
                <Ionicons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
              )}
              <Text style={styles.actionButtonText}>
                {isLoading ? (t('cast.stopping') || 'Desconectando...') : t('cast.stop')}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton, isLoading && styles.buttonDisabled]}
              onPress={handleStartLocal}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="wifi" size={20} color={colors.onAccent} style={{ marginRight: 10 }} />
              <Text style={[styles.actionButtonText, { color: colors.onAccent }]}>
                {isLoading ? t('cast.starting') : t('cast.start')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. ChromeCast Flow
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Navigation & Header */}
      <View style={styles.header}>
        {!isChromecastConnected && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedMode(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={18} color="#60A5FA" />
            <Text style={[styles.backButtonText, { color: '#60A5FA' }]}>{t('cast.change_option')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: !isChromecastConnected ? 8 : 0 }}>
          <Text style={[styles.headerLabel, { color: '#60A5FA' }]}>{t('cast.chromecast_title')}</Text>
          <View style={[styles.betaBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
            <Text style={[styles.betaBadgeText, { color: '#60A5FA' }]}>APP ID: 5622F67E</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>
          {isChromecastConnected
            ? t('cast.chromecast_connected_to', { device: connectedDeviceName || 'Chromecast' })
            : isChromecastConnecting
            ? t('cast.chromecast_connecting')
            : t('cast.chromecast_devices_title')}
        </Text>
      </View>

      {/* Internet required warning - only when not connected and internet unavailable */}
      {!isChromecastConnected && hasInternet === false && (
        <View style={styles.internetWarningBox}>
          <Ionicons name="wifi-outline" size={20} color="#F59E0B" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.internetWarningTitle}>{t('cast.chromecast_internet_required')}</Text>
            <Text style={styles.internetWarningDesc}>{t('cast.chromecast_internet_desc')}</Text>
          </View>
        </View>
      )}

      {/* Connected State */}
      {isChromecastConnected ? (
        <View style={styles.connectedContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="tv" size={56} color="#60A5FA" />
            <View style={[styles.activeDot, { backgroundColor: '#60A5FA' }]} />
          </View>

          {/* Active Track Info */}
          {activeTrack && (
            <View style={styles.trackInfoBox}>
              <View style={styles.trackDetails}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {typeof activeTrack.title === 'string' ? activeTrack.title : 'Reproduciendo'}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {typeof activeTrack.artist === 'string' ? activeTrack.artist : 'Artista desconocido'}
                </Text>
              </View>
            </View>
          )}

          {/* Volume Control */}
          <View style={styles.volumeBox}>
            <Ionicons name="volume-medium-outline" size={20} color={colors.textSecondary} />
            <Slider
              style={{ flex: 1, height: 40 }}
              minimumValue={0}
              maximumValue={1}
              value={castVolume}
              minimumTrackTintColor="#60A5FA"
              maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor="#FFFFFF"
              onValueChange={handleVolumeChange}
            />
            <Ionicons name="volume-high-outline" size={20} color={colors.textSecondary} />
          </View>

          {/* Disconnect Button */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton, isLoading && styles.buttonDisabled]}
              onPress={handleDisconnectChromecast}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.actionButtonText}>{t('cast.chromecast_disconnect')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Disconnected State - Devices List */
        <View style={styles.devicesContainer}>
          {isChromecastConnecting ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#60A5FA" />
              <Text style={styles.loadingText}>{t('cast.chromecast_connecting')}</Text>
              <TouchableOpacity
                style={styles.cancelConnectingButton}
                onPress={handleDisconnectChromecast}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelConnectingText}>{t('common.cancel') || 'Cancelar'}</Text>
              </TouchableOpacity>
            </View>
          ) : devices && devices.length > 0 ? (
            <View style={styles.deviceList}>
              {devices.map((dev) => (
                <TouchableOpacity
                  key={dev.deviceId}
                  style={styles.deviceItem}
                  onPress={() => handleConnectChromecast(dev.deviceId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.deviceIconWrapper}>
                    <Ionicons
                      name={
                        dev.modelName?.toLowerCase().includes('audio') || dev.modelName?.toLowerCase().includes('speaker')
                          ? 'volume-high-outline'
                          : 'tv-outline'
                      }
                      size={22}
                      color="#60A5FA"
                    />
                  </View>
                  <View style={styles.deviceItemContent}>
                    <Text style={styles.deviceName}>{dev.friendlyName || 'Chromecast'}</Text>
                    {dev.modelName && <Text style={styles.deviceModel}>{dev.modelName}</Text>}
                  </View>
                  <View style={styles.connectPill}>
                    <Text style={styles.connectPillText}>Conectar</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            /* No devices found yet / Searching */
            <View style={styles.emptyDevicesBox}>
              <ActivityIndicator size="small" color="#60A5FA" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyDevicesTitle}>{t('cast.chromecast_searching')}</Text>
              <Text style={styles.emptyDevicesTip}>{t('cast.chromecast_searching_tip')}</Text>
            </View>
          )}

          {/* Hidden Native CastButton to ensure framework binding on Android/iOS */}
          <CastButton style={{ width: 0, height: 0, opacity: 0 }} />
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any, fonts: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    internetWarningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    internetWarningTitle: {
      color: '#F59E0B',
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 2,
    },
    internetWarningDesc: {
      color: colors.textSecondary || '#888',
      fontSize: 12,
      lineHeight: 17,
    },
    header: {
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground || '#282828',
      paddingBottom: 12,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    backButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accentLight || '#A78BFA',
    },
    headerLabel: {
      color: colors.accent || '#8B5CF6',
      fontSize: 13,
      fontFamily: fonts?.regular,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    headerTitle: {
      color: colors.text || '#FFFFFF',
      fontSize: 19,
      fontFamily: fonts?.regular,
      fontWeight: '800',
      marginTop: 4,
    },
    optionsContainer: {
      gap: 12,
      paddingVertical: 8,
      marginBottom: 16,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.07)',
      borderRadius: 18,
      padding: 16,
      gap: 14,
    },
    optionIconWrapper: {
      width: 50,
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      color: colors.text || '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      fontFamily: fonts?.regular,
    },
    optionDesc: {
      color: colors.textSecondary || '#888888',
      fontSize: 12,
      fontFamily: fonts?.regular,
      marginTop: 2,
      lineHeight: 16,
    },
    iconContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      position: 'relative',
    },
    activeDot: {
      position: 'absolute',
      bottom: 14,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.accentLight || '#A78BFA',
      borderWidth: 2,
      borderColor: '#0E0E0E',
    },
    ipContainer: {
      alignItems: 'center',
      paddingHorizontal: 8,
      marginBottom: 20,
      minHeight: 50,
      justifyContent: 'center',
    },
    ipLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts?.regular,
      textAlign: 'center',
      marginBottom: 6,
    },
    ipAddress: {
      color: colors.text,
      fontSize: 18,
      fontFamily: fonts?.regular,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    idleText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: fonts?.regular,
      textAlign: 'center',
      lineHeight: 20,
    },
    actionContainer: {
      marginTop: 6,
      marginBottom: 8,
    },
    actionButton: {
      borderRadius: 24,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 4,
    },
    startButton: {
      backgroundColor: colors.accent || '#8B5CF6',
    },
    stopButton: {
      backgroundColor: colors.heartIcon || '#EF4444',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 15,
      fontFamily: fonts?.regular,
      fontWeight: 'bold',
    },
    betaBadge: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      alignSelf: 'center',
    },
    betaBadgeText: {
      color: '#F59E0B',
      fontSize: 9,
      fontWeight: '900',
      fontFamily: fonts?.regular,
      letterSpacing: 0.5,
    },
    connectedContainer: {
      width: '100%',
    },
    trackInfoBox: {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: 14,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.05)',
      alignItems: 'center',
    },
    trackDetails: {
      alignItems: 'center',
    },
    trackTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    trackArtist: {
      color: colors.textSecondary || '#888888',
      fontSize: 13,
      marginTop: 2,
      textAlign: 'center',
    },
    volumeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      marginBottom: 14,
    },
    devicesContainer: {
      width: '100%',
      paddingVertical: 4,
    },
    deviceList: {
      gap: 8,
      marginBottom: 12,
    },
    deviceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: 14,
      padding: 12,
      gap: 12,
    },
    deviceIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deviceItemContent: {
      flex: 1,
    },
    deviceName: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    deviceModel: {
      color: colors.textSecondary || '#888888',
      fontSize: 12,
      marginTop: 1,
    },
    connectPill: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    connectPillText: {
      color: '#60A5FA',
      fontSize: 12,
      fontWeight: '800',
    },
    systemDialogButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginTop: 6,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    systemDialogButtonText: {
      color: colors.textSecondary || '#888888',
      fontSize: 13,
      fontWeight: '600',
    },
    loadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 10,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    cancelConnectingButton: {
      marginTop: 10,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    cancelConnectingText: {
      color: colors.textSecondary || '#888888',
      fontSize: 13,
      fontWeight: '600',
    },
    emptyDevicesBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      paddingHorizontal: 16,
    },
    emptyDevicesTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 6,
    },
    emptyDevicesTip: {
      color: colors.textSecondary || '#888888',
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 16,
    },
    batteryCard: {
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
      borderRadius: 16,
      padding: 14,
      marginTop: 4,
      marginBottom: 16,
      gap: 12,
    },
    batteryHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    batteryIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    batteryTitle: {
      color: '#F59E0B',
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    batteryDesc: {
      color: colors.textSecondary || '#94A3B8',
      fontSize: 12,
      lineHeight: 16,
    },
    batteryButton: {
      backgroundColor: '#F59E0B',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    batteryButtonText: {
      color: '#000000',
      fontSize: 13,
      fontWeight: '800',
    },
  });
