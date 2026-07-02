import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, NavigatorScreenParams } from '@react-navigation/native';
export type HomeStackParamList = {
    Home: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    PlaylistDetail: { playlistId: string };
    FavoritesDetail: undefined;
    ChangelogScreen: undefined;
    WeeklyActivity: undefined;
};

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
    PlaylistDetail: { playlistId: string };
};

export type TagsStackParamList = {
    Tags: undefined;
    TagDetail: { tagId: string; tagName: string; tagColor: string };
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
};

export type PlayerStackParamList = {
    PlayerHome: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    Lyrics: undefined;
    LyricsEditor: undefined;
    LyricsSync: undefined;
};

export type RootStackParamList = {
    Main: undefined;
    Player: undefined | NavigatorScreenParams<PlayerStackParamList>;
    DebugHistory: undefined;
};

export type HomeNavigationProp = NativeStackNavigationProp<HomeStackParamList>;
export type LibraryNavigationProp = NativeStackNavigationProp<LibraryStackParamList>;
export type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
export type TagsNavigationProp = NativeStackNavigationProp<TagsStackParamList>;
export type ArtistDetailRouteProp = RouteProp<LibraryStackParamList, 'ArtistDetail'>;
export type AlbumDetailRouteProp = RouteProp<LibraryStackParamList, 'AlbumDetail'>;
export type TagDetailRouteProp = RouteProp<SearchStackParamList, 'TagDetail'>;

export type MainNavigationProp = NativeStackNavigationProp<RootStackParamList>;
