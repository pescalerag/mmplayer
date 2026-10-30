import React, { createContext, useContext } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export interface HeaderHistory {
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
}

// Desktop supplies its history; native screens keep their existing back action.
export const HeaderHistoryContext = createContext<HeaderHistory | null>(null);

export function HeaderHistoryControls({
  children,
  preserveDismiss = false,
}: {
  readonly children?: React.ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly preserveDismiss?: boolean;
}) {
  const history = useContext(HeaderHistoryContext);
  // Desktop history lives in the persistent title bar. Explicit dismiss
  // actions remain available within their screen.
  return !history || preserveDismiss ? <>{children}</> : null;
}
