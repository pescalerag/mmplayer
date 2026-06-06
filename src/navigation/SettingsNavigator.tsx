import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import SettingsScreen from '../screens/SettingsScreen';
import ChangelogScreen from '../screens/ChangelogScreen';
import ExcludedFoldersScreen from '../screens/ExcludedFoldersScreen';
import ExcludedSongsScreen from '../screens/ExcludedSongsScreen';

const Stack = createNativeStackNavigator();

export default function SettingsNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ChangelogScreen" component={ChangelogScreen} />
            <Stack.Screen name="ExcludedFolders" component={ExcludedFoldersScreen} />
            <Stack.Screen name="ExcludedSongs" component={ExcludedSongsScreen} />
        </Stack.Navigator>
    );
}
