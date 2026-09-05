import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useAppTheme } from '../../hooks/useAppTheme';

interface DraggableTabItemProps {
  icon: string;
  label: string;
  drag: () => void;
  isActive: boolean;
}

export function DraggableTabItem({ icon, label, drag, isActive }: DraggableTabItemProps) {
  const { colors } = useAppTheme();

  return (
    <ScaleDecorator>
      <View
        style={[
          styles.itemContainer,
          { backgroundColor: isActive ? (colors.accentAlpha15 || 'rgba(139, 92, 246, 0.15)') : 'transparent' }
        ]}
      >
        <View style={styles.itemLeft}>
          <Ionicons name={icon as any} size={24} color={colors.accent} style={styles.itemIcon} />
          <Text style={styles.itemText}>{label}</Text>
        </View>
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={350}
          style={styles.dragHandle}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="menu" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  itemText: {
    fontSize: 16,
    fontFamily: 'Montserrat',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dragHandle: {
    paddingLeft: 16,
    paddingVertical: 8,
  },
});
