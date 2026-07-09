import React, { useState } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useABRepeatStore } from '../../store/useABRepeatStore';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ABSliderMarkersProps {
  duration: number;
}

export const ABSliderMarkers: React.FC<ABSliderMarkersProps> = ({ duration }) => {
  const { pointA, pointB } = useABRepeatStore();
  const { colors } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  if (duration <= 0) return null;
  if (pointA === null && pointB === null) return null;

  // Slider has padding on the edges where the track starts/ends.
  // By default, for react-native-community/slider, this is around 15dp on both iOS and Android.
  const SLIDER_PADDING = Platform.OS === 'android' ? 15 : 15;

  const getX = (time: number) => {
    const ratio = Math.min(Math.max(time / duration, 0), 1);
    const trackWidth = containerWidth - 2 * SLIDER_PADDING;
    return SLIDER_PADDING + ratio * trackWidth;
  };

  const handleLayout = (e: any) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const xA = pointA !== null && containerWidth > 0 ? getX(pointA) : null;
  const xB = pointB !== null && containerWidth > 0 ? getX(pointB) : null;

  return (
    <View 
      style={StyleSheet.absoluteFillObject} 
      onLayout={handleLayout} 
      pointerEvents="none"
    >
      {/* Highlight between A and B if both are set */}
      {xA !== null && xB !== null && xA < xB && (
        <View
          style={[
            styles.highlightBar,
            {
              left: xA,
              width: xB - xA,
              backgroundColor: 'rgba(167, 139, 250, 0.35)', // semi-transparent accentLight
            },
          ]}
        />
      )}

      {/* Marker A */}
      {xA !== null && (
        <View style={[styles.markerContainer, { left: xA - 10 }]}>
          <Text style={[styles.markerLabel, { color: colors.accentLight }]}>A</Text>
          <View style={[styles.markerLine, { backgroundColor: colors.accentLight }]} />
        </View>
      )}

      {/* Marker B */}
      {xB !== null && (
        <View style={[styles.markerContainer, { left: xB - 10 }]}>
          <Text style={[styles.markerLabel, { color: colors.accentLight }]}>B</Text>
          <View style={[styles.markerLine, { backgroundColor: colors.accentLight }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  highlightBar: {
    position: 'absolute',
    top: 18, // vertically centered relative to slider track (height 40)
    height: 4,
    borderRadius: 2,
  },
  markerContainer: {
    position: 'absolute',
    top: 4, // starting near the top of the 40px container
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  markerLine: {
    width: 3,
    height: 14,
    borderRadius: 1.5,
  },
});
