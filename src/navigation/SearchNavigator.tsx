import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AlbumDetailScreen from '../screens/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/ArtistDetailScreen';
import SearchScreen from '../screens/SearchScreen';
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
        </Stack.Navigator>
    );
}
