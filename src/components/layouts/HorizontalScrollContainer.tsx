import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';

export interface HorizontalScrollChildProps {
  ref: React.RefObject<any>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  onLayout: (e: LayoutChangeEvent) => void;
  onContentSizeChange: (w: number, h: number) => void;
  showsHorizontalScrollIndicator: boolean;
}

export interface HorizontalScrollContainerProps {
  children: React.ReactNode | ((props: HorizontalScrollChildProps) => React.ReactNode);
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  arrowTop?: number;
  arrowOffset?: number;
  scrollStepRatio?: number;
  dataLength?: number;
}

export const HorizontalScrollContainer = React.forwardRef<any, HorizontalScrollContainerProps>(({
  children,
  contentContainerStyle,
  style,
  arrowTop,
  arrowOffset = 8,
  scrollStepRatio = 0.75,
  dataLength,
}, ref) => {
  const { colors } = useAppTheme();
  const innerScrollRef = useRef<any>(null);

  useImperativeHandle(ref, () => innerScrollRef.current);

  const [isHovered, setIsHovered] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollXRef = useRef(0);
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  const updateScrollability = useCallback(() => {
    if (Platform.OS === 'web' && innerScrollRef.current) {
      const node =
        innerScrollRef.current.getScrollableNode?.() ||
        innerScrollRef.current._listRef?._scrollRef?.getScrollableNode?.() ||
        (typeof innerScrollRef.current.scrollTo === 'function' ? null : innerScrollRef.current);

      if (node && typeof node.scrollLeft === 'number') {
        const { scrollLeft, scrollWidth, clientWidth } = node;
        scrollXRef.current = scrollLeft;
        containerWidthRef.current = clientWidth;
        contentWidthRef.current = scrollWidth;
        setCanScrollLeft(scrollLeft > 2);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
        return;
      }
    }

    const curX = scrollXRef.current;
    const cWidth = containerWidthRef.current;
    const tWidth = contentWidthRef.current;
    setCanScrollLeft(curX > 2);
    setCanScrollRight(tWidth > cWidth && curX < tWidth - cWidth - 2);
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    scrollXRef.current = contentOffset.x;
    containerWidthRef.current = layoutMeasurement.width;
    contentWidthRef.current = contentSize.width;
    setCanScrollLeft(contentOffset.x > 2);
    setCanScrollRight(contentOffset.x < contentSize.width - layoutMeasurement.width - 2);
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    containerWidthRef.current = e.nativeEvent.layout.width;
    updateScrollability();
  }, [updateScrollability]);

  const handleContentSizeChange = useCallback((w: number, _h: number) => {
    contentWidthRef.current = w;
    updateScrollability();
  }, [updateScrollability]);

  useEffect(() => {
    const t1 = setTimeout(updateScrollability, 50);
    const t2 = setTimeout(updateScrollability, 200);
    const t3 = setTimeout(updateScrollability, 500);

    let removeListener: (() => void) | undefined;
    if (Platform.OS === 'web') {
      const handleResize = () => updateScrollability();
      window.addEventListener('resize', handleResize);

      const node =
        innerScrollRef.current?.getScrollableNode?.() ||
        innerScrollRef.current?._listRef?._scrollRef?.getScrollableNode?.();

      if (node) {
        node.addEventListener('scroll', handleResize, { passive: true });
        removeListener = () => {
          window.removeEventListener('resize', handleResize);
          node.removeEventListener('scroll', handleResize);
        };
      } else {
        removeListener = () => window.removeEventListener('resize', handleResize);
      }
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      removeListener?.();
    };
  }, [updateScrollability, dataLength]);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const containerW = containerWidthRef.current || 400;
    const step = Math.max(160, containerW * scrollStepRatio);
    const delta = direction === 'left' ? -step : step;

    if (Platform.OS === 'web' && innerScrollRef.current) {
      const node =
        innerScrollRef.current.getScrollableNode?.() ||
        innerScrollRef.current._listRef?._scrollRef?.getScrollableNode?.() ||
        (typeof innerScrollRef.current.scrollTo === 'function' ? null : innerScrollRef.current);

      if (node && typeof node.scrollBy === 'function') {
        node.scrollBy({ left: delta, behavior: 'smooth' });
        setTimeout(updateScrollability, 150);
        setTimeout(updateScrollability, 350);
        setTimeout(updateScrollability, 600);
        return;
      }
    }

    const target = Math.max(0, scrollXRef.current + delta);
    if (typeof innerScrollRef.current?.scrollToOffset === 'function') {
      innerScrollRef.current.scrollToOffset({ offset: target, animated: true });
    } else if (typeof innerScrollRef.current?.scrollTo === 'function') {
      innerScrollRef.current.scrollTo({ x: target, animated: true });
    }
    setTimeout(updateScrollability, 350);
  }, [scrollStepRatio, updateScrollability]);

  const childProps: HorizontalScrollChildProps = {
    ref: innerScrollRef,
    onScroll: handleScroll,
    scrollEventThrottle: 16,
    onLayout: handleLayout,
    onContentSizeChange: handleContentSizeChange,
    showsHorizontalScrollIndicator: false,
  };

  const isWeb = Platform.OS === 'web';
  const showLeft = isWeb && canScrollLeft;
  const showRight = isWeb && canScrollRight;

  const arrowTopStyle = arrowTop != null
    ? { top: arrowTop, marginTop: -19 }
    : { top: '50%' as const, marginTop: -19 };

  return (
    <View
      style={[styles.wrapper, style]}
      {...(isWeb ? {
        className: 'horizontal-scroll-wrapper',
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
      } as any : {})}
    >
      {showLeft && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => scroll('left')}
          accessibilityRole="button"
          accessibilityLabel="Anterior"
          style={[
            styles.arrowButton,
            styles.leftArrow,
            { left: arrowOffset },
            arrowTopStyle,
            isWeb && {
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
            } as any,
          ]}
          {...(isWeb ? { className: 'horizontal-scroll-arrow' } as any : {})}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text || '#FFFFFF'} />
        </TouchableOpacity>
      )}

      {typeof children === 'function' ? (
        children(childProps)
      ) : (
        <ScrollView
          ref={innerScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={handleLayout}
          onContentSizeChange={handleContentSizeChange}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      )}

      {showRight && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => scroll('right')}
          accessibilityRole="button"
          accessibilityLabel="Siguiente"
          style={[
            styles.arrowButton,
            styles.rightArrow,
            { right: arrowOffset },
            arrowTopStyle,
            isWeb && {
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
            } as any,
          ]}
          {...(isWeb ? { className: 'horizontal-scroll-arrow' } as any : {})}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text || '#FFFFFF'} />
        </TouchableOpacity>
      )}
    </View>
  );
});

HorizontalScrollContainer.displayName = 'HorizontalScrollContainer';

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: '100%',
  },
  arrowButton: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20, 20, 22, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.18s ease',
          userSelect: 'none',
        } as any)
      : null),
  },
  leftArrow: {
    left: 8,
  },
  rightArrow: {
    right: 8,
  },
});
