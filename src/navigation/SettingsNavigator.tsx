import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useNativeStackOptions } from './useNativeStackOptions';

import SettingsScreen from '../screens/settings/SettingsScreen';
import ExcludedMediaScreen from '../screens/settings/ExcludedMediaScreen';
import SettingsAppearanceScreen from '../screens/settings/SettingsAppearanceScreen';
import SettingsLanguageScreen from '../screens/settings/SettingsLanguageScreen';
import SettingsAudioScreen from '../screens/settings/SettingsAudioScreen';
import SettingsGesturesScreen from '../screens/settings/SettingsGesturesScreen';
import SettingsExclusionsScreen from '../screens/settings/SettingsExclusionsScreen';
import SettingsDebugScreen from '../screens/settings/SettingsDebugScreen';
import { DebugErrorsScreen, DebugTestsScreen } from '../screens/settings/RuntimeDiagnosticsScreens';
import SettingsArtistImagesScreen from '../screens/settings/SettingsArtistImagesScreen';
import SettingsAlbumCoversScreen from '../screens/settings/SettingsAlbumCoversScreen';
import SettingsStorageScreen from '../screens/settings/SettingsStorageScreen';
import SettingsCanvasScreen from '../screens/settings/SettingsCanvasScreen';
import SettingsShuffleScreen from '../screens/settings/SettingsShuffleScreen';
import SupportScreen from '../screens/support/SupportScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
    const screenOptions = useNativeStackOptions();
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="SettingsStorage" component={SettingsStorageScreen} />
            <Stack.Screen name="SettingsCanvas" component={SettingsCanvasScreen} />
            <Stack.Screen name="ExcludedMedia" component={ExcludedMediaScreen} />
            <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceScreen} />
            <Stack.Screen name="SettingsLanguage" component={SettingsLanguageScreen} />
            <Stack.Screen name="SettingsAudio" component={SettingsAudioScreen} />
            <Stack.Screen name="SettingsShuffle" component={SettingsShuffleScreen} />
            <Stack.Screen name="SettingsGestures" component={SettingsGesturesScreen} />
            <Stack.Screen name="SettingsExclusions" component={SettingsExclusionsScreen} />
            <Stack.Screen name="SettingsDebug" component={SettingsDebugScreen} />
            <Stack.Screen name="DebugErrors" component={DebugErrorsScreen} />
            <Stack.Screen name="DebugTests" component={DebugTestsScreen} />
            <Stack.Screen name="SettingsArtistImages" component={SettingsArtistImagesScreen} />
            <Stack.Screen name="SettingsAlbumCovers" component={SettingsAlbumCoversScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
        </Stack.Navigator>
    );
}
