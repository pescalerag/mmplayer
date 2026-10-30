import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { View } from 'react-native';

/** Fixed-height rows use the browser's own viewport, including scroll events
 * received before the opening layout/batch has finished. Never leave the new
 * visible range waiting behind an old native VirtualizedList render window. */
export function FixedVirtualList<T>({ data, rowHeight, renderRow, keyExtractor,
  scrollRef, style, contentContainerStyle, initialNumToRender = 8,
  maxToRenderPerBatch = 8, windowSize = 7, ListEmptyComponent,
  showsVerticalScrollIndicator, scrollEnabled = true, onScroll,
}: {
  data: T[]; rowHeight: number; renderRow: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  [key: string]: any;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ offset: 0, height: 0, inset: 0 });
  const initial = Math.max(1, initialNumToRender), batch = Math.max(1, maxToRenderPerBatch);
  const [range, setRange] = useState({ first: 0, last: initial - 1 });
  const measure = () => {
    const node = scrollRef.current;
    if (!node) return;
    const next = { offset: node.scrollTop, height: node.clientHeight, inset: area.current?.offsetTop || 0 };
    setViewport(previous => previous.offset === next.offset && previous.height === next.height && previous.inset === next.inset ? previous : next);
  };
  useLayoutEffect(() => {
    measure();const observer = new ResizeObserver(measure);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);
  const first = Math.max(0, Math.min(data.length - 1, Math.floor((viewport.offset - viewport.inset) / rowHeight)));
  const count = viewport.height > 0 ? Math.ceil(viewport.height / rowHeight) + 1 : initial;
  const last = Math.min(data.length - 1, first + count - 1);
  const overscan = Math.ceil(count * Math.max(0, windowSize - 1) / 2);
  const targetFirst = Math.max(0, first - overscan), targetLast = Math.min(data.length - 1, last + overscan);
  useEffect(() => {
    let frame = 0;
    const expand = () => {
      setRange(previous => {
        if (previous.last < targetFirst || previous.first > targetLast) {
          return { first: targetFirst, last: Math.min(targetLast, targetFirst + batch - 1) };
        }
        const nextFirst = Math.max(targetFirst, previous.first - batch);
        const remaining = Math.max(0, batch - Math.max(0, previous.first - nextFirst));
        return { first: nextFirst, last: Math.min(targetLast, previous.last + remaining) };
      });
    };
    // Visible rows are always rendered immediately below; only overscan waits
    // for a batch. A fast wheel jump cannot turn the viewport into a blank gap.
    if (range.first !== targetFirst || range.last !== targetLast) frame = requestAnimationFrame(expand);
    return () => cancelAnimationFrame(frame);
  }, [targetFirst, targetLast, range.first, range.last, batch]);
  const indexes = new Set<number>();
  for (let i = 0; i < Math.min(initial, data.length); i++) indexes.add(i);
  for (let i = first; i <= last; i++) indexes.add(i);
  for (let i = Math.max(0, range.first); i <= Math.min(data.length - 1, range.last); i++) indexes.add(i);
  const Empty = ListEmptyComponent;
  return <View style={[{ flex: 1, minHeight: 0 }, style]}>
    <div ref={scrollRef} data-desktop-fixed-virtual-list
      onScroll={event => {
        // Browser scroll has already moved the viewport: publish its range
        // in this event, rather than letting concurrent rendering lag behind.
        flushSync(measure);
        const node = event.currentTarget;
        onScroll?.({ nativeEvent: { contentOffset: { x: node.scrollLeft, y: node.scrollTop }, layoutMeasurement: { width: node.clientWidth, height: node.clientHeight }, contentSize: { width: node.scrollWidth, height: node.scrollHeight } } });
      }}
      style={{ flex: 1, minHeight: 0, overflowY: scrollEnabled ? 'auto' : 'hidden', overflowX: 'hidden', scrollbarWidth: showsVerticalScrollIndicator ? 'auto' : 'none', overflowAnchor: 'none' }}>
      <View style={contentContainerStyle}>
        {data.length ? <div ref={area} style={{ position: 'relative', height: rowHeight * data.length }}>
          {[...indexes].sort((a,b) => a-b).map(index => <div key={keyExtractor(data[index], index)} style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0, height: rowHeight }}>
            {renderRow(data[index], index)}
          </div>)}
        </div> : typeof Empty === 'function' ? <Empty /> : Empty || null}
      </View>
    </div>
  </View>;
}
