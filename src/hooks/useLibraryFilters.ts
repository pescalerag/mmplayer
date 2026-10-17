import { createContext, useContext, useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useLibraryStore } from '../store/useLibraryStore';
import { LibraryFilterService } from '../services/LibraryFilterService';
import { emptyLibraryFilterIndex, FilterSection, hasSectionFilters, LibraryFilterIndex, SectionFilters } from '../utils/libraryFilters';
import { useDelayedLoader } from './useDelayedLoader';

const EMPTY_INDEX = emptyLibraryFilterIndex();
export const LibraryFilterSectionContext = createContext<FilterSection | 'albums' | null>(null);

export function useLibraryFilters(section: FilterSection) {
  const filters = useLibraryStore(state => state.sectionFilters[section]);
  const focused = useIsFocused();
  const sectionInView = useContext(LibraryFilterSectionContext);
  const visible = sectionInView === null || sectionInView === section;
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ filters: SectionFilters; index: LibraryFilterIndex; error: boolean } | null>(null);
  const active = hasSectionFilters(filters);
  useEffect(() => {
    if (!focused || !visible || !active) return;
    const subscription = LibraryFilterService.observe(section, filters).subscribe({
      next: index => setSnapshot({ filters, index, error: false }),
      error: error => { console.error('[LibraryFilters]', error); setSnapshot({ filters, index: emptyLibraryFilterIndex(), error: true }); },
    });
    return () => subscription.unsubscribe();
  }, [section, filters, focused, visible, active, attempt]);
  const current = snapshot?.filters === filters;
  const ready = !active || current;
  const showLoader = useDelayedLoader(!ready);
  return { filters, active, index: current ? snapshot.index : EMPTY_INDEX, ready, showLoader, error: current && snapshot.error, retry: () => { setSnapshot(null); setAttempt(value => value + 1); } };
}
