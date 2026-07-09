import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import TagManagementScreen from '../screens/tags/TagManagementScreen';
import TagDetailScreen from '../screens/tags/TagDetailScreen';
import { TagsStackParamList } from './types';

const Stack = createNativeStackNavigator<TagsStackParamList>();

export default function TagsNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#121212' },
            freezeOnBlur: false
        }}>
            <Stack.Screen name="Tags" component={TagManagementScreen} />
            <Stack.Screen name="TagDetail" component={TagDetailScreen} getId={({ params }) => params.tagId} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
        </Stack.Navigator>
    );
}
