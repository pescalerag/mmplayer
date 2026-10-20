import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useNativeStackOptions } from './useNativeStackOptions';
import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import FavoritesDetailScreen from '../screens/library/FavoritesDetailScreen';
import HomeScreen from '../screens/home/HomeScreen';
import PlaylistDetailScreen from '../screens/library/PlaylistDetailScreen';
import ActivityMainScreen from '../screens/activity/ActivityMainScreen';
import SmartListDetailScreen from '../screens/library/SmartListDetailScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import SupportScreen from '../screens/support/SupportScreen';
import SettingsNavigator from './SettingsNavigator';
import ActivityHistoryScreen from '../screens/activity/ActivityHistoryScreen';
import FolderDetailScreen from '../screens/library/FolderDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
    const screenOptions = useNativeStackOptions();
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} getId={({ params }) => params.playlistId} />
            <Stack.Screen name="FavoritesDetail" component={FavoritesDetailScreen} />
            <Stack.Screen name="WeeklyActivity" component={ActivityMainScreen} />
            <Stack.Screen name="SmartListDetail" component={SmartListDetailScreen} getId={({ params }) => params.smartListId} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="Settings" component={SettingsNavigator} />
            <Stack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
            <Stack.Screen name="FolderDetail" component={FolderDetailScreen} getId={({ params }) => params.folderPath} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
    );
}
