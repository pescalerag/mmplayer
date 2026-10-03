import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../hooks/useAppTheme';
import AppNotification, { NotificationType } from '../../database/models/AppNotification';
import withObservables from '@nozbe/with-observables';
import { of } from 'rxjs';
import { formatNotificationDate } from '../../utils/notificationHelpers';

interface NotificationCardProps {
  notification: AppNotification;
  onPress?: (notification: AppNotification) => void;
  onDelete?: (id: string) => void;
}

interface NotificationVisualConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  hasArrow: boolean;
}

export const NOTIFICATION_VISUAL_MAP: Record<NotificationType, NotificationVisualConfig> = {
  songs_added: {
    icon: 'add-circle-outline',
    color: '#22C55E',
    hasArrow: true,
  },
  songs_moved: {
    icon: 'swap-horizontal',
    color: '#22C55E',
    hasArrow: true,
  },
  songs_deleted: {
    icon: 'close-circle-outline',
    color: '#EF4444',
    hasArrow: false,
  },
  summary_weekly: {
    icon: 'time-outline',
    color: '#3B82F6',
    hasArrow: true,
  },
  summary_monthly: {
    icon: 'calendar-outline',
    color: '#14B8A6',
    hasArrow: true,
  },
  summary_yearly: {
    icon: 'bar-chart-outline',
    color: '#8B5CF6',
    hasArrow: true,
  },
  app_update: {
    icon: 'arrow-up-circle-outline',
    color: '#F97316',
    hasArrow: true,
  },
};

const SWIPE_LIMIT = 80;
const SWIPE_THRESHOLD = 55;

function NotificationCard({
  notification,
  onPress,
  onDelete,
}: Readonly<NotificationCardProps>) {
  const { colors, fonts } = useAppTheme();
  const { t, i18n } = useTranslation();

  const translateX = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);

  const config = NOTIFICATION_VISUAL_MAP[notification.type] || {
    icon: 'notifications-outline',
    color: colors.accent,
    hasArrow: false,
  };

  const isNavigable = config.hasArrow && notification.actionType !== 'none';
  const rawDate = notification.createdAt || (notification as any)?._raw?.created_at || new Date();
  const formattedDate = formatNotificationDate(rawDate, t, i18n.language || 'es-ES');

  const triggerHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = () => {
    onDelete?.(notification.id);
  };

  const panGesture = Gesture.Pan()
    .enabled(Boolean(onDelete))
    .activeOffsetX([-15, 999999])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      let newTranslateX = event.translationX;
      if (newTranslateX > 0) newTranslateX = 0;

      translateX.value = clamp(newTranslateX, -SWIPE_LIMIT, 0);

      if (translateX.value < -SWIPE_THRESHOLD && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        scheduleOnRN(triggerHaptic);
      } else if (translateX.value >= -SWIPE_THRESHOLD) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd(() => {
      if (translateX.value < -SWIPE_THRESHOLD) {
        scheduleOnRN(handleDelete);
      }
      translateX.value = withSpring(0, {
        stiffness: 400,
        damping: 30,
        mass: 1,
      });
      hasTriggeredHaptic.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const underlayStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
  }));

  const rightIconStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
    transform: [{ scale: translateX.value < -SWIPE_THRESHOLD ? 1.2 : 1 }],
  }));

  const cardInner = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground || '#1E1E1E',
          borderColor: notification.isRead ? 'rgba(255, 255, 255, 0.06)' : colors.accentAlpha30,
        },
      ]}
    >
      {/* ICON */}
      <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
        <Ionicons name={config.icon} size={22} color={config.color} />
      </View>

      {/* TEXT CONTENT */}
      <View style={styles.textContent}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontFamily: fonts.bold,
              },
            ]}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          {!notification.isRead && (
            <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
          )}
        </View>

        <Text style={[styles.date, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
          {formattedDate}
        </Text>

        {Boolean(notification.description) && (
          <Text
            style={[styles.description, { color: colors.textSecondary, fontFamily: fonts.regular }]}
            numberOfLines={2}
          >
            {notification.description}
          </Text>
        )}
      </View>

      {/* ARROW */}
      {isNavigable && (
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* UNDERLAY (RED WITH TRASH ICON) */}
      <Animated.View
        style={[
          styles.underlay,
          { backgroundColor: colors.heartIcon || '#EF4444' },
          underlayStyle,
        ]}
      >
        <Animated.View style={[styles.underlayIconContainer, rightIconStyle]}>
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>

      {/* SWIPEABLE CARD */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            animatedStyle,
            {
              borderRadius: 14,
              backgroundColor: colors.cardBackground || '#1E1E1E',
            },
          ]}
        >
          {onPress ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onPress(notification)}
              accessibilityRole="button"
              accessibilityLabel={notification.title}
            >
              {cardInner}
            </TouchableOpacity>
          ) : (
            cardInner
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const ObservableNotificationCard = withObservables(
  ['notification'],
  ({ notification }: NotificationCardProps) => ({
    notification: notification?.observe ? notification.observe() : of(notification),
  })
)(NotificationCard);

export default ObservableNotificationCard;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  underlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 24,
    borderRadius: 14,
  },
  underlayIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  date: {
    fontSize: 11,
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  arrowContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
