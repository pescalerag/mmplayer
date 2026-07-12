import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAppTheme } from '@/hooks/useAppTheme';

interface BaseMenuSheetProps {
  title?: string;
  subtitle?: string;
  coverUrl?: string | null;
  placeholderIcon?: keyof typeof Ionicons.prototype.props.name | string;
  placeholderIconColor?: string;
  headerLeft?: React.ReactNode;
  circularImage?: boolean;
  children: React.ReactNode;
}

export function BaseMenuSheet({
  title,
  subtitle,
  coverUrl,
  placeholderIcon,
  placeholderIconColor,
  headerLeft,
  circularImage,
  children,
}: BaseMenuSheetProps) {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);

  const hasHeader = title || subtitle || coverUrl || placeholderIcon || headerLeft;

  return (
    <View style={styles.container}>
      {hasHeader && (
        <View style={styles.header}>
          {headerLeft ? (
            <View style={{ marginRight: 16 }}>{headerLeft}</View>
          ) : coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={[styles.thumbnail, circularImage && { borderRadius: 28 }]}
              contentFit="cover"
              transition={200}
            />
          ) : placeholderIcon ? (
            <View style={[styles.thumbnail, styles.placeholder, circularImage && { borderRadius: 28 }]}>
              <Ionicons
                name={placeholderIcon as any}
                size={24}
                color={placeholderIconColor || colors.textSecondary}
              />
            </View>
          ) : null}
          <View style={styles.headerText}>
            {title && (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      )}

      <ScrollView
        style={{ flexShrink: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

interface MenuOptionProps {
  icon: keyof typeof Ionicons.prototype.props.name | string;
  text: string;
  onPress: () => void | Promise<void>;
  iconColor?: string;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function MenuOption({
  icon,
  text,
  onPress,
  iconColor,
  textStyle,
  containerStyle,
  disabled,
}: MenuOptionProps) {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);

  return (
    <TouchableOpacity
      style={[styles.optionRow, containerStyle]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon as any} size={24} color={iconColor || colors.text} />
      </View>
      <Text style={[styles.optionText, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
}

export function MenuSeparator() {
  const { colors, fonts, layout } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
  return <View style={styles.separator} />;
}

const getStyles = (colors: any, fonts: any, layout: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      maxHeight: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBackground,
      paddingBottom: 20,
    },
    thumbnail: {
      width: 56,
      height: 56,
      borderRadius: 8,
      marginRight: 16,
    },
    placeholder: {
      backgroundColor: colors.cardBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerText: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontFamily: fonts.regular,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: fonts.regular,
      fontWeight: '700',
      marginTop: 4,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
    },
    iconContainer: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    optionText: {
      color: colors.text,
      fontSize: 16,
      fontFamily: fonts.regular,
      fontWeight: '700',
    },
    separator: {
      height: 1,
      backgroundColor: colors.cardBackground,
      marginVertical: 8,
    },
  });
