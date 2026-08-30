import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import PlayerScreen from '../screens/player/PlayerScreen';
import LyricsScreen from '../screens/player/LyricsScreen';
import LyricsEditorScreen from '../screens/player/LyricsEditorScreen';
import LyricsSyncScreen from '../screens/player/LyricsSyncScreen';
import { PlayerStackParamList } from './types';

const Stack = createNativeStackNavigator<PlayerStackParamList>();

export default function PlayerNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: 'transparent' },
            freezeOnBlur: false
        }}>
            <Stack.Screen name="PlayerHome" component={PlayerScreen} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
            <Stack.Screen
                name="Lyrics"
                component={LyricsScreen}
                options={{
                    animation: 'fade',
                    presentation: 'transparentModal',
                }}
            />
            <Stack.Screen name="LyricsEditor" component={LyricsEditorScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="LyricsSync" component={LyricsSyncScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>
    );
}
