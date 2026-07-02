import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AlbumDetailScreen from '../screens/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/ArtistDetailScreen';
import PlayerScreen from '../screens/PlayerScreen';
import LyricsScreen from '../screens/LyricsScreen';
import LyricsEditorScreen from '../screens/LyricsEditorScreen';
import LyricsSyncScreen from '../screens/LyricsSyncScreen';
import { PlayerStackParamList } from './types';

const Stack = createNativeStackNavigator<PlayerStackParamList>();

export default function PlayerNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#121212' },
        }}>
            <Stack.Screen name="PlayerHome" component={PlayerScreen} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
            <Stack.Screen name="Lyrics" component={LyricsScreen} options={{ animation: 'fade' }} />
            <Stack.Screen name="LyricsEditor" component={LyricsEditorScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="LyricsSync" component={LyricsSyncScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>
    );
}
