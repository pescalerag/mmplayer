import { useState, useRef, useEffect } from 'react';
import { View, ScrollView } from 'react-native';

export function useTutorialState(hasSeenActivityTutorial: boolean, isLoading: boolean) {
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);

  const rootRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const periodTabsRef = useRef<View>(null);
  const metricToggleRef = useRef<View>(null);
  const heroCardRef = useRef<View>(null);
  const highlightsCardRef = useRef<View>(null);
  const smartListsRef = useRef<View>(null);
  const shareButtonRef = useRef<View>(null);

  const periodTabsLayout = useRef<any>(null);
  const metricToggleLayout = useRef<any>(null);
  const heroCardLayout = useRef<any>(null);
  const highlightsCardLayout = useRef<any>(null);
  const smartListsLayout = useRef<any>(null);
  const shareButtonLayout = useRef<any>(null);

  // Auto-launch tutorial on first visit
  useEffect(() => {
    if (!hasSeenActivityTutorial && !isLoading) {
      const timer = setTimeout(() => {
        setIsTutorialVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenActivityTutorial, isLoading]);

  return {
    isTutorialVisible,
    setIsTutorialVisible,
    refs: {
      rootRef,
      scrollViewRef,
      periodTabsRef,
      metricToggleRef,
      heroCardRef,
      highlightsCardRef,
      smartListsRef,
      shareButtonRef,
    },
    layouts: {
      periodTabsLayout,
      metricToggleLayout,
      heroCardLayout,
      highlightsCardLayout,
      smartListsLayout,
      shareButtonLayout,
    },
  };
}
