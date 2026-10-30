import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useLibraryStore } from '../store/useLibraryStore';
import { LibraryFilterService } from '../services/LibraryFilterService';
import { emptyLibraryFilterIndex, FilterSection, hasSectionFilters, LibraryFilterIndex, SectionFilters } from '../utils/libraryFilters';
import { useDelayedLoader } from './useDelayedLoader';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';
import type { Subscription } from 'rxjs';

const EMPTY_INDEX = emptyLibraryFilterIndex();
export const LibraryFilterSectionContext = createContext<FilterSection | 'albums' | null>(null);

export function useLibraryFilters(section: FilterSection) {
  const filters = useLibraryStore(state => state.sectionFilters[section]);
  const navigation = useNavigation();
  const sectionInView = useContext(LibraryFilterSectionContext);
  const visible = sectionInView === null || sectionInView === section;
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ filters: SectionFilters; index: LibraryFilterIndex; error: boolean } | null>(null);
  const active = hasSectionFilters(filters);
  useEffect(() => {
    if (!visible || !active) return;
    let subscription: Subscription | undefined;
    let cancel: (() => void) | undefined;
    const stop = () => { cancel?.(); cancel = undefined; subscription?.unsubscribe(); subscription = undefined; };
    const start = () => {
      stop();
      cancel = scheduleScreenRefresh(() => {
        subscription = LibraryFilterService.observe(section, filters).subscribe({
          next: index => setSnapshot({ filters, index, error: false }),
          error: error => { console.error('[LibraryFilters]', error); setSnapshot({ filters, index: emptyLibraryFilterIndex(), error: true }); },
        });
      });
    };
    const unsubscribeFocus = navigation.addListener('focus', start);
    const unsubscribeBlur = navigation.addListener('blur', stop);
    if (navigation.isFocused()) start();
    return () => { stop(); unsubscribeFocus(); unsubscribeBlur(); };
  }, [section, filters, navigation, visible, active, attempt]);
  const current = snapshot?.filters === filters;
  const ready = !active || current;
  const showLoader = useDelayedLoader(!ready);
  return { filters, active, index: current ? snapshot.index : EMPTY_INDEX, ready, showLoader, error: current && snapshot.error, retry: () => { setSnapshot(null); setAttempt(value => value + 1); } };
}
