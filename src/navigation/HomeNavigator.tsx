import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import FavoritesDetailScreen from '../screens/library/FavoritesDetailScreen';
import HomeScreen from '../screens/home/HomeScreen';
import PlaylistDetailScreen from '../screens/library/PlaylistDetailScreen';
import ActivityMainScreen from '../screens/activity/ActivityMainScreen';
import SmartListDetailScreen from '../screens/library/SmartListDetailScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import SupportScreen from '../screens/support/SupportScreen';

const Stack = createNativeStackNavigator();

export default function HomeNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            freezeOnBlur: false
        }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
            <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
            <Stack.Screen name="FavoritesDetail" component={FavoritesDetailScreen} />
            <Stack.Screen name="WeeklyActivity" component={ActivityMainScreen} />
            <Stack.Screen name="SmartListDetail" component={SmartListDetailScreen} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
        </Stack.Navigator>
    );
}
