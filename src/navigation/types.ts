import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

export type LibraryStackParamList = {
    Library: undefined;
    ArtistDetail: { artistId: string; fromPlayer?: boolean };
    AlbumDetail: { albumId: string; fromPlayer?: boolean };
};

export type RootStackParamList = {
    Main: undefined;
    Player: undefined;
};

export type LibraryNavigationProp = NativeStackNavigationProp<LibraryStackParamList>;
export type ArtistDetailRouteProp = RouteProp<LibraryStackParamList, 'ArtistDetail'>;
export type AlbumDetailRouteProp = RouteProp<LibraryStackParamList, 'AlbumDetail'>;

export type MainNavigationProp = NativeStackNavigationProp<RootStackParamList>;
