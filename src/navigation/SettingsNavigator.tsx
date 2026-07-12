import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import SettingsScreen from '../screens/settings/SettingsScreen';
import ChangelogScreen from '../screens/settings/ChangelogScreen';
import ExcludedMediaScreen from '../screens/settings/ExcludedMediaScreen';
import SettingsAppearanceScreen from '../screens/settings/SettingsAppearanceScreen';
import SettingsLanguageScreen from '../screens/settings/SettingsLanguageScreen';
import SettingsAudioScreen from '../screens/settings/SettingsAudioScreen';
import SettingsGesturesScreen from '../screens/settings/SettingsGesturesScreen';
import SettingsExclusionsScreen from '../screens/settings/SettingsExclusionsScreen';
import SettingsDebugScreen from '../screens/settings/SettingsDebugScreen';
import SettingsArtistImagesScreen from '../screens/settings/SettingsArtistImagesScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            freezeOnBlur: false
        }}>
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
