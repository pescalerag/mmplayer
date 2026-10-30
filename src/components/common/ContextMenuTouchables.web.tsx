import React from 'react';
import { TouchableOpacity, Pressable, TouchableOpacityProps, PressableProps } from 'react-native';

type ContextProps = { onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void };
function contextHandler(props: { disabled?: boolean | null; onLongPress?: any } & ContextProps) {
    return (event: MouseEvent) => {
        if (props.disabled || (!props.onLongPress && !props.onContextMenu)) return;
        event.preventDefault();
        // One context menu, even when its item contains other pressable controls.
        event.stopPropagation();
        if (props.onContextMenu) props.onContextMenu(event as unknown as React.MouseEvent<HTMLElement>);
        else props.onLongPress(event);
    };
}
function useContextRef(props: { disabled?: boolean | null; onLongPress?: any } & ContextProps, forwarded: React.ForwardedRef<any>) {
    const host = React.useRef<HTMLElement | null>(null);
    // RN Web's TouchableOpacity replaces an onContextMenu prop with its own
    // press responder. A DOM listener preserves that responder for long press
    // while also allowing the item's right-click action to run exactly once.
    React.useLayoutEffect(() => {
        const element = host.current, handler = contextHandler(props);
        element?.addEventListener('contextmenu', handler);
        return () => element?.removeEventListener('contextmenu', handler);
    });
    return React.useCallback((element: HTMLElement | null) => {
        host.current = element;
        if (typeof forwarded === 'function') forwarded(element);
        else if (forwarded) forwarded.current = element;
    }, [forwarded]);
}
/** Right click uses the same item-specific action as long press. */
export const ContextMenuTouchableOpacity = React.forwardRef<any, TouchableOpacityProps & ContextProps>((props, ref) => {
    const host = useContextRef(props, ref), { onContextMenu, ...rest } = props;
    return <TouchableOpacity {...rest} ref={host} dataSet={{ ...props.dataSet, contextMenuTrigger: props.onLongPress || onContextMenu ? 'true' : undefined }} />;
});
ContextMenuTouchableOpacity.displayName = 'ContextMenuTouchableOpacity';
export const ContextMenuPressable = React.forwardRef<any, PressableProps & ContextProps>((props, ref) => {
    const host = useContextRef(props, ref), { onContextMenu, ...rest } = props;
    return <Pressable {...rest} ref={host} dataSet={{ ...props.dataSet, contextMenuTrigger: props.onLongPress || onContextMenu ? 'true' : undefined }} />;
});
ContextMenuPressable.displayName = 'ContextMenuPressable';
