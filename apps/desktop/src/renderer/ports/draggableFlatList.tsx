import React, { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { FixedVirtualList } from './fixedVirtualList';

export interface RenderItemParams<T> {
  item: T;
  getIndex: () => number | undefined;
  drag: () => void;
  isActive: boolean;
}
export const ScaleDecorator: React.FC<{ children: React.ReactNode; activeScale?: number }> = ({ children }) => <>{children}</>;
export const ShadowDecorator: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
export const OpacityDecorator: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

type Props<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (params: RenderItemParams<T>) => React.ReactNode;
  onDragEnd?: (params: { data: T[]; from: number; to: number }) => unknown;
  onDragBegin?: (index: number) => void;
  onRelease?: (index: number) => void;
  onPlaceholderIndexChange?: (index: number) => void;
  [key: string]: any;
};
type DragSession = { from: number; to: number; key: string; keys: string };

/** Share Android's FlatList batching/windowing. Pointer-driven dragging survives
 * virtualization removing the source row, unlike a browser HTML drag session. */
export default function DraggableFlatList<T>(props: Props<T>) {
  const { data, keyExtractor, renderItem, onDragEnd, onDragBegin, onRelease,
    onPlaceholderIndexChange, activationDistance, autoscrollThreshold = 50,
    autoscrollSpeed = 120, containerStyle, dragItemOverflow, style, extraData,
    ...listProps } = props;
  const [preview, setPreview] = useState<T[] | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), list = useRef<FlatList<T>>(null);
  const fixedScroll = useRef<HTMLDivElement>(null);
  const latest = useRef(props);latest.current = props;
  const items = useRef(data);items.current = preview ?? data;
  const session = useRef<DragSession | null>(null);
  const pointer = useRef<{ x: number; y: number; id?: number } | null>(null);
  const frame = useRef(0), previousFrame = useRef(0), suppressClickUntil = useRef(0);
  const keys = (rows: T[]) => JSON.stringify(rows.map(latest.current.keyExtractor));
  const scrollNode = () => {
    const node = fixedScroll.current ?? list.current?.getScrollableNode();
    return node instanceof HTMLElement ? node : null;
  };
  const move = (to: number) => {
    const drag = session.current;
    if (!drag || to === drag.to || to < 0 || to >= items.current.length) return;
    const next = [...items.current], [item] = next.splice(drag.to, 1);
    next.splice(to, 0, item);drag.to = to;items.current = next;setPreview(next);
    latest.current.onPlaceholderIndexChange?.(to);
  };
  const hover = () => {
    const node = scrollNode(), point = pointer.current;
    if (!node || !point || !session.current) return;
    const bounds = node.getBoundingClientRect();
    if (point.x < bounds.left || point.x > bounds.right) return;
    const hit = document.elementFromPoint(point.x, Math.max(bounds.top + 1, Math.min(point.y, bounds.bottom - 1)));
    const row = hit?.closest<HTMLElement>('[data-desktop-drag-index]');
    if (row && root.current?.contains(row)) move(Number(row.dataset.desktopDragIndex));
  };
  const tick = (time: number) => {
    if (!session.current) return;
    const elapsed = previousFrame.current ? Math.min(32, time - previousFrame.current) / 1000 : 0;
    previousFrame.current = time;
    const node = scrollNode(), point = pointer.current;
    if (node && point) {
      const bounds = node.getBoundingClientRect();
      const threshold = Math.min(latest.current.autoscrollThreshold ?? 50, bounds.height / 2);
      const speed = latest.current.autoscrollSpeed ?? 120;
      if (threshold > 0 && point.x >= bounds.left && point.x <= bounds.right) {
        const above = Math.max(0, Math.min(1, (bounds.top + threshold - point.y) / threshold));
        const below = Math.max(0, Math.min(1, (point.y - bounds.bottom + threshold) / threshold));
        // Native advances towards an offset of autoscrollSpeed per animated
        // scroll. Use a quarter-second interval for the equivalent smooth pace.
        node.scrollTop += (below - above) * speed * elapsed * 4;
      }
      hover();
    }
    frame.current = requestAnimationFrame(tick);
  };
  const finish = (commit: boolean) => {
    const drag = session.current;
    if (!drag) return;
    session.current = null;cancelAnimationFrame(frame.current);previousFrame.current = 0;
    setActiveKey(null);suppressClickUntil.current = Date.now() + 50;
    latest.current.onRelease?.(drag.to);
    const next = items.current;
    if (commit && drag.from !== drag.to && drag.keys === keys(latest.current.data)) {
      // Commit exactly once; never persist intermediate hover positions.
      void Promise.resolve(latest.current.onDragEnd?.({ data: next, from: drag.from, to: drag.to }))
        .catch(error => console.error('Desktop reorder failed:', error)).finally(() => { if (!session.current) setPreview(null); });
    } else setPreview(null);
  };
  const begin = (index: number) => {
    if (session.current || index < 0 || index >= items.current.length) return;
    const key = latest.current.keyExtractor(items.current[index], index);
    session.current = { from: index, to: index, key, keys: keys(latest.current.data) };
    setActiveKey(key);setPreview([...items.current]);latest.current.onDragBegin?.(index);
    const id = pointer.current?.id;
    if (id !== undefined) { try { root.current?.setPointerCapture(id); } catch {} }
    previousFrame.current = 0;frame.current = requestAnimationFrame(tick);
  };
  useEffect(() => {
    const moved = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
      if (session.current) { event.preventDefault();hover(); }
    };
    const released = () => finish(true);
    const cancelled = () => finish(false);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && session.current) { event.preventDefault();event.stopImmediatePropagation();finish(false); }
    };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil.current && root.current?.contains(event.target as Node)) { suppressClickUntil.current = 0;event.preventDefault();event.stopImmediatePropagation(); }
    };
    window.addEventListener('pointermove', moved, { passive: false });
    window.addEventListener('pointerup', released);
    window.addEventListener('pointercancel', cancelled);
    window.addEventListener('blur', cancelled);
    window.addEventListener('keydown', key, true);
    document.addEventListener('click', click, true);
    return () => {
      session.current = null;cancelAnimationFrame(frame.current);
      window.removeEventListener('pointermove', moved);window.removeEventListener('pointerup', released);
      window.removeEventListener('pointercancel', cancelled);window.removeEventListener('blur', cancelled);
      window.removeEventListener('keydown', key, true);document.removeEventListener('click', click, true);
    };
  }, []);
  useEffect(() => {
    // A queue switch, removal or playback transition invalidates a pending drag.
    if (session.current && session.current.keys !== keys(data)) finish(false);
  }, [data]);
  const renderRow = (item: T, index: number) => <div key={keyExtractor(item, index)} data-desktop-drag-index={index} draggable
    onDragStart={event => {
      event.preventDefault();event.stopPropagation();
      if (event.clientX || event.clientY) pointer.current = { ...pointer.current, x: event.clientX, y: event.clientY };
      begin(index);
    }}
    onDragOver={event => { event.preventDefault();move(index); }}
    onDragEnd={() => finish(true)}
    style={{ userSelect: 'none', cursor: activeKey === keyExtractor(item, index) ? 'grabbing' : 'grab' }}>
    {renderItem({ item, getIndex: () => index, drag: () => begin(index), isActive: activeKey === keyExtractor(item, index) })}
  </div>;
  const layout = listProps.getItemLayout?.(data, 0);
  const fixed = layout?.length > 0 && layout.offset === 0 && !listProps.ListHeaderComponent && !listProps.ListFooterComponent;
  return <View style={[{ flex: 1, minHeight: 0 }, containerStyle]}>
    <div ref={root} data-desktop-draggable-list data-dragging={activeKey !== null}
      onPointerDownCapture={event => { if (event.button === 0) pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; }}
      onDragOver={event => { event.preventDefault(); }}
      onDrop={event => { event.preventDefault();finish(true); }}
      style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, cursor: activeKey ? 'grabbing' : undefined }}>
      {fixed ? <FixedVirtualList {...listProps} data={preview ?? data} keyExtractor={keyExtractor}
        rowHeight={layout.length} scrollRef={fixedScroll} style={style} renderRow={renderRow} /> :
      <FlatList {...listProps} ref={list} data={preview ?? data} keyExtractor={keyExtractor}
        style={[{ flex: 1, minHeight: 0 }, style]} extraData={[extraData, activeKey]}
        renderItem={({ item, index }) => renderRow(item, index)} />}
    </div>
  </View>;
}
