import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useNativeStackOptions } from './useNativeStackOptions';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import PlayerScreen from '../screens/player/PlayerScreen';
import LyricsScreen from '../screens/player/LyricsScreen';
import LyricsEditorScreen from '../screens/player/LyricsEditorScreen';
import LyricsSyncScreen from '../screens/player/LyricsSyncScreen';
import SongShareScreen from '../screens/player/SongShareScreen';
import LyricsShareScreen from '../screens/player/LyricsShareScreen';
import { PlayerStackParamList } from './types';

const Stack = createNativeStackNavigator<PlayerStackParamList>();

export default function PlayerNavigator() {
    const screenOptions = useNativeStackOptions();
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="PlayerHome" component={PlayerScreen} options={{ contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
            <Stack.Screen
                name="Lyrics"
                component={LyricsScreen}
                options={{
                    animation: 'fade',
                    presentation: 'transparentModal',
                    contentStyle: { backgroundColor: 'transparent' },
                }}
            />
            <Stack.Screen name="LyricsEditor" component={LyricsEditorScreen} getId={({ params }) => params.trackId} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="LyricsSync" component={LyricsSyncScreen} getId={({ params }) => params.trackId} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
                name="ShareSong"
                component={SongShareScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'fullScreenModal',
                }}
            />
            <Stack.Screen
                name="ShareLyrics"
                component={LyricsShareScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'fullScreenModal',
                }}
            />
        </Stack.Navigator>
    );
}
