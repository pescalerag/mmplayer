import React, { useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import QueueSheet from "../../../../src/components/sheets/QueueSheet";
import { ScreenWidthProvider } from "../../../../src/hooks/useScreenWidth";

export function DesktopQueuePanel({ close }: { close: () => void }) {
  const [size, setSize] = useState({ width: 360, height: 700 });
  return <div className="queue-overlay">
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, ...size }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }} onLayout={({ nativeEvent }) => {
          const { width, height } = nativeEvent.layout;
          setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
        }}>
          <ScreenWidthProvider value={size}>
            <QueueSheet embedded visible onClose={close} />
          </ScreenWidthProvider>
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  </div>;
}
