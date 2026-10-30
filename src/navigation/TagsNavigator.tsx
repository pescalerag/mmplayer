import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useNativeStackOptions } from './useNativeStackOptions';

import AlbumDetailScreen from '../screens/library/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/library/ArtistDetailScreen';
import TagManagementScreen from '../screens/tags/TagManagementScreen';
import TagDetailScreen from '../screens/tags/TagDetailScreen';
import { TagsStackParamList } from './types';

const Stack = createNativeStackNavigator<TagsStackParamList>();

export default function TagsNavigator() {
    const screenOptions = useNativeStackOptions();
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="Tags" component={TagManagementScreen} />
            <Stack.Screen name="TagDetail" component={TagDetailScreen} getId={({ params }) => params.tagId} />
            <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} getId={({ params }) => params.artistId} />
            <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} getId={({ params }) => params.albumId} />
        </Stack.Navigator>
    );
}
