import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useNativeStackOptions } from './useNativeStackOptions';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import ActivityMainScreen from '../screens/activity/ActivityMainScreen';
import SmartListDetailScreen from '../screens/library/SmartListDetailScreen';
import ActivityHistoryScreen from '../screens/activity/ActivityHistoryScreen';
import { ActivityStackParamList } from './types';

const Stack = createNativeStackNavigator<ActivityStackParamList>();

export default function ActivityNavigator() {
    const screenOptions = useNativeStackOptions();
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="Activity" component={ActivityMainScreen} />
            <Stack.Screen
                name="ArtistDetail"
                component={ArtistDetailScreen}
                getId={({ params }) => params.artistId}
            />
            <Stack.Screen
                name="AlbumDetail"
                component={AlbumDetailScreen}
                getId={({ params }) => params.albumId}
            />
            <Stack.Screen
                name="SmartListDetail"
                component={SmartListDetailScreen}
                getId={({ params }) => params.smartListId}
            />
            <Stack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
        </Stack.Navigator>
    );
}
