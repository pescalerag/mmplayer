import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

export type LibraryStackParamList = {
    Library: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    TagDetail: { tagId: string; tagName: string; tagColor: string };
    FavoritesDetail: undefined;
    PlaylistDetail: { playlistId: string };
};

export type SearchStackParamList = {
    Search: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    TagDetail: { tagId: string; tagName: string; tagColor: string };
};

export type RootStackParamList = {
    Main: undefined;
    Player: undefined;
    DebugHistory: undefined;
};

export type LibraryNavigationProp = NativeStackNavigationProp<LibraryStackParamList>;
export type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
export type ArtistDetailRouteProp = RouteProp<LibraryStackParamList, 'ArtistDetail'>;
export type AlbumDetailRouteProp = RouteProp<LibraryStackParamList, 'AlbumDetail'>;
export type TagDetailRouteProp = RouteProp<SearchStackParamList, 'TagDetail'>;

export type MainNavigationProp = NativeStackNavigationProp<RootStackParamList>;
