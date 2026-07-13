import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import LibraryScreen from '../screens/library/LibraryScreen';
import TagDetailScreen from '../screens/tags/TagDetailScreen';
import FavoritesDetailScreen from '../screens/library/FavoritesDetailScreen';
import PlaylistDetailScreen from '../screens/library/PlaylistDetailScreen';
import SmartListDetailScreen from '../screens/library/SmartListDetailScreen';
import { LibraryStackParamList } from './types';

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export default function LibraryNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#121212' },
            freezeOnBlur: false
        }}>
            <Stack.Screen name="Library" component={LibraryScreen} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
            <Stack.Screen name="TagDetail" component={TagDetailScreen} getId={({ params }) => params.tagId} />
            <Stack.Screen name="FavoritesDetail" component={FavoritesDetailScreen} />
            <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} getId={({ params }) => params.playlistId} />
            <Stack.Screen name="SmartListDetail" component={SmartListDetailScreen} getId={({ params }) => params.smartListId} />
        </Stack.Navigator>
    );
}
