import { useEffect } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useMultipleQueuesStore } from '../store/useMultipleQueuesStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useUIStore } from '../store/useUIStore';

export function useDismissEmptyPlayer(enabled = true) {
    const activeTrack = usePlayerStore(state => state.activeTrack);
    const isSwitching = useMultipleQueuesStore(state => state.isSwitching);
    const isFocused = useIsFocused();
    const navigation = useNavigation();
    useEffect(() => {
        // A transparent player route still captures touches when its content is null.
        // Pop it only after the switch completes, never during a populated queue's reset.
        if (!enabled || activeTrack || isSwitching || !isFocused) return;
        useUIStore.getState().closeSheet();
        const playerNavigation = navigation.getParent() ?? navigation;
        if (playerNavigation.canGoBack()) playerNavigation.goBack();
    }, [activeTrack, isSwitching, isFocused, navigation, enabled]);
}
