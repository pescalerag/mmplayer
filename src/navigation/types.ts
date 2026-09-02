import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, NavigatorScreenParams } from '@react-navigation/native';
export type HomeStackParamList = {
    Home: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    PlaylistDetail: { playlistId: string };
    FavoritesDetail: undefined;
    WeeklyActivity: undefined;
    SmartListDetail: { smartListId: string };
    UserProfile: undefined;
    Support: undefined;
};

export type LibraryStackParamList = {
    Library: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    TagDetail: { tagId: string; tagName: string; tagColor: string };
    FavoritesDetail: undefined;
    PlaylistDetail: { playlistId: string };
    SmartListDetail: { smartListId: string };
    Support: undefined;
};

export type SearchStackParamList = {
    Search: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    TagDetail: { tagId: string; tagName: string; tagColor: string };
    PlaylistDetail: { playlistId: string };
    SmartListDetail: { smartListId: string };
};

export type TagsStackParamList = {
    Tags: undefined;
    TagDetail: { tagId: string; tagName: string; tagColor: string };
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
};

export interface ShareSongParams {
    trackId: string;
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string | null;
    fileUrl: string;
    duration?: number;
}

export interface ShareLyricsParams {
    trackId: string;
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string | null;
    lyricsLines: { time?: number; text: string }[];
    initialIndex?: number;
}

export type PlayerStackParamList = {
    PlayerHome: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
    Lyrics: undefined;
    LyricsEditor: undefined;
    LyricsSync: undefined;
    ShareSong: ShareSongParams;
    ShareLyrics: ShareLyricsParams;
};

export type RootStackParamList = {
    Main: undefined;
    Player: undefined | NavigatorScreenParams<PlayerStackParamList>;
    DebugHistory: undefined;
    ShareStats: {
        formattedPeriodText: string;
        metric: 'duration' | 'plays';
        totalHours: number;
        totalPlays: number;
        topArtists: any[];
        topSongs: any[];
    };
    ShareSong: ShareSongParams;
    ShareLyrics: ShareLyricsParams;
};

export type HomeNavigationProp = NativeStackNavigationProp<HomeStackParamList>;
export type LibraryNavigationProp = NativeStackNavigationProp<LibraryStackParamList>;
export type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
export type TagsNavigationProp = NativeStackNavigationProp<TagsStackParamList>;
export type ArtistDetailRouteProp = RouteProp<LibraryStackParamList, 'ArtistDetail'>;
export type AlbumDetailRouteProp = RouteProp<LibraryStackParamList, 'AlbumDetail'>;
export type TagDetailRouteProp = RouteProp<SearchStackParamList, 'TagDetail'>;

export type MainNavigationProp = NativeStackNavigationProp<RootStackParamList>;
