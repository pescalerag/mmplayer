import { useAppTheme } from '@/hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCastStore } from '../store/useCastStore';
import { useToastStore } from '../store/useToastStore';

export default function LocalCastSheet() {
  const { colors, fonts } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts), [colors, fonts]);
  const { isServerRunning, serverIp, startServer, stopServer } = useCastStore();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(false);

  const handleStart = () => {
    setIsLoading(true);
    startServer()
      .then(() => {
        setIsLoading(false);
      })
      .catch((err: any) => {
        setIsLoading(false);
        useToastStore.getState().showToast(
          err?.message || 'No se pudo iniciar el casteo.',
          'alert-circle-outline'
        );
      });
  };

  const handleStop = () => {
    setIsLoading(true);
    stopServer()
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.headerLabel}>
            {t('cast.title')}
          </Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>BETA</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>
          {isServerRunning
            ? t('cast.status_active')
            : t('cast.status_idle')}
        </Text>
      </View>

      {/* Status icon */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={isServerRunning ? 'desktop' : 'desktop-outline'}
          size={56}
          color={isServerRunning ? colors.accentLight : '#535353'}
        />
        {isServerRunning && <View style={styles.activeDot} />}
      </View>

      {/* Server IP Address */}
      {isServerRunning && serverIp ? (
        <View style={styles.ipContainer}>
          <Text style={styles.ipLabel}>
            {t('cast.open_in_browser')}
          </Text>
          <Text style={styles.ipAddress} selectable>
            {serverIp}
          </Text>
        </View>
      ) : (
        <View style={styles.ipContainer}>
          <Text style={styles.idleText}>
            {t('cast.idle_desc')}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionContainer}>
        {isServerRunning ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton, isLoading && styles.buttonDisabled]}
            onPress={handleStop}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="stop-circle-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.actionButtonText}>
              {isLoading ? t('cast.stopping') : t('cast.stop')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton, isLoading && styles.buttonDisabled]}
            onPress={handleStart}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="wifi" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={styles.actionButtonText}>
              {isLoading ? t('cast.starting') : t('cast.start')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: any, fonts: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBackground,
    paddingBottom: 15,
  },
  headerLabel: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: fonts.regular,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.regular,
    fontWeight: '800',
    marginTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentLight,
    borderWidth: 2,
    borderColor: '#0E0E0E',
  },
  ipContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 24,
    minHeight: 60,
    justifyContent: 'center',
  },
  ipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginBottom: 8,
  },
  ipAddress: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.regular,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  idleText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  actionButton: {
    borderRadius: 24,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  startButton: {
    backgroundColor: colors.accent,
  },
  stopButton: {
    backgroundColor: colors.heartIcon,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.regular,
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
    fontFamily: fonts.regular,
    letterSpacing: 0.5,
  },
});
