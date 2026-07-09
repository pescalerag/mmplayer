import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import SettingsScreen from '../screens/SettingsScreen';
import ChangelogScreen from '../screens/ChangelogScreen';
import ExcludedMediaScreen from '../screens/ExcludedMediaScreen';
import SettingsAppearanceScreen from '../screens/SettingsAppearanceScreen';
import SettingsLanguageScreen from '../screens/SettingsLanguageScreen';
import SettingsAudioScreen from '../screens/SettingsAudioScreen';
import SettingsGesturesScreen from '../screens/SettingsGesturesScreen';
import SettingsExclusionsScreen from '../screens/SettingsExclusionsScreen';
import SettingsDebugScreen from '../screens/SettingsDebugScreen';
import SettingsArtistImagesScreen from '../screens/SettingsArtistImagesScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ChangelogScreen" component={ChangelogScreen} />
            <Stack.Screen name="ExcludedMedia" component={ExcludedMediaScreen} />
            <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceScreen} />
            <Stack.Screen name="SettingsLanguage" component={SettingsLanguageScreen} />
            <Stack.Screen name="SettingsAudio" component={SettingsAudioScreen} />
            <Stack.Screen name="SettingsGestures" component={SettingsGesturesScreen} />
            <Stack.Screen name="SettingsExclusions" component={SettingsExclusionsScreen} />
            <Stack.Screen name="SettingsDebug" component={SettingsDebugScreen} />
            <Stack.Screen name="SettingsArtistImages" component={SettingsArtistImagesScreen} />
        </Stack.Navigator>
    );
}
