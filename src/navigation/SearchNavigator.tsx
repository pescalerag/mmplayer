import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import SearchScreen from '../screens/search/SearchScreen';
import TagDetailScreen from '../screens/tags/TagDetailScreen';
import PlaylistDetailScreen from '../screens/library/PlaylistDetailScreen';
import SmartListDetailScreen from '../screens/library/SmartListDetailScreen';
import { SearchStackParamList } from './types';

const Stack = createNativeStackNavigator<SearchStackParamList>();

export default function SearchNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#121212' },
            freezeOnBlur: true
        }}>
            <Stack.Screen name="Search" component={SearchScreen} />
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
                name="TagDetail"
                component={TagDetailScreen}
                getId={({ params }) => params.tagId}
            />
            <Stack.Screen
                name="PlaylistDetail"
                component={PlaylistDetailScreen}
                getId={({ params }) => params.playlistId}
            />
            <Stack.Screen
                name="SmartListDetail"
                component={SmartListDetailScreen}
                getId={({ params }) => params.smartListId}
            />
        </Stack.Navigator>
    );
}
