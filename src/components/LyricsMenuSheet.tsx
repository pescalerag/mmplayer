import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    BackHandler,
    Animated as RNAnimated,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LyricsService } from '../services/LyricsService';
import { useLyricsMenuStore } from '../store/useLyricsMenuStore';
import { useTrackMenuStore } from '../store/useTrackMenuStore';
import { usePlayerStore } from '../store/usePlayerStore';

export default function LyricsMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { isVisible, track, onImportSuccess, closeMenu } = useLyricsMenuStore();
    const hasLyrics = !!track?.lyricsLRC?.trim();
    const isFetchingLyrics = usePlayerStore(state => state.isFetchingLyrics);
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { height: windowHeight } = useWindowDimensions();

    const fadeAnim = useRef(new RNAnimated.Value(0)).current;
    const slideAnim = useRef(new RNAnimated.Value(windowHeight)).current;

    useEffect(() => {
        if (isVisible) {
            RNAnimated.parallel([
                RNAnimated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                RNAnimated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            RNAnimated.parallel([
                RNAnimated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                RNAnimated.timing(slideAnim, { toValue: windowHeight, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim, windowHeight]);

    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeMenu(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeMenu]);

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender && !isVisible) return null;

    const handleMorePress = () => {
        if (!track) return;
        closeMenu();
        useTrackMenuStore.getState().openMenu(track, {
            album: (albumId) => navigation.navigate('AlbumDetail', { albumId }),
            artist: (artistId) => navigation.navigate('ArtistDetail', { artistId }),
        });
    };

    const handleImportLRC = async () => {
        if (!track) return;
        closeMenu();
        try {
            const imported = await LyricsService.importCustomLyrics(track);
            if (imported) {
                onImportSuccess(imported);
                Alert.alert(t('actions.success') || 'Éxito', 'Letras importadas correctamente.');
            }
        } catch {
            Alert.alert(t('actions.error') || 'Error', 'No se pudo leer el archivo de letras.');
        }
    };

    const handleSearchLyrics = async () => {
        if (!track) return;
        if (LyricsService.isFetching()) {
            Alert.alert(
                t('actions.warning') || 'Atención',
                t('lyrics.search_in_progress') || 'Ya hay una búsqueda de letras en curso en este momento.'
            );
            return;
        }

        closeMenu();
        try {
            const lyrics = await LyricsService.fetchLyrics(track, true);
            if (lyrics) {
                onImportSuccess(lyrics);
                Alert.alert(t('actions.success') || 'Éxito', t('lyrics.search_success') || 'Letras encontradas e importadas correctamente.');
            } else {
                Alert.alert(t('actions.error') || 'Error', t('lyrics.search_not_found') || 'No se encontraron letras para esta canción en internet.');
            }
        } catch (e) {
            console.error('Error searching lyrics online:', e);
            Alert.alert(t('actions.error') || 'Error', 'Ocurrió un error al buscar las letras.');
        }
    };

    const handleDeleteLyrics = async () => {
        if (!track) return;
        Alert.alert(
            t('actions.warning') || 'Atención',
            t('lyrics.delete_confirm') || '¿Estás seguro de que quieres eliminar las letras de esta canción?',
            [
                { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
                {
                    text: t('actions.confirm') || 'Confirmar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await LyricsService.saveLyrics(track, '');
                            onImportSuccess('');
                            closeMenu();
                            Alert.alert(t('actions.success') || 'Éxito', t('lyrics.delete_success') || 'Letras eliminadas correctamente.');
                        } catch (e) {
                            console.error('Error deleting lyrics:', e);
                            Alert.alert(t('actions.error') || 'Error', 'No se pudieron eliminar las letras.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeMenu}>
                <RNAnimated.View style={[styles.menuOverlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>
 
            <RNAnimated.View
                style={[
                    styles.menuSheet,
                    {
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}
            >
                <View style={styles.dragHandle} />
 
                <TouchableOpacity onPress={handleMorePress} style={styles.optionRow}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="information-circle-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.more_info') || 'Más info'}</Text>
                </TouchableOpacity>
 
                <TouchableOpacity
                    onPress={handleImportLRC}
                    disabled={isFetchingLyrics}
                    style={[styles.optionRow, isFetchingLyrics && { opacity: 0.4 }]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="cloud-upload-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('audio_effects.lyrics_import') || 'Importar archivo .LRC'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleSearchLyrics}
                    disabled={isFetchingLyrics}
                    style={[styles.optionRow, isFetchingLyrics && { opacity: 0.4 }]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="search-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('lyrics.search_lyrics') || 'Buscar letras en internet'}</Text>
                </TouchableOpacity>
 
                <TouchableOpacity
                    onPress={() => { closeMenu(); navigation.navigate('LyricsEditor'); }}
                    disabled={isFetchingLyrics}
                    style={[styles.optionRow, isFetchingLyrics && { opacity: 0.4 }]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="create-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('lyrics.edit') || 'Editar letras'}</Text>
                </TouchableOpacity>
 
                <TouchableOpacity
                    onPress={() => { closeMenu(); navigation.navigate('LyricsSync'); }}
                    disabled={!hasLyrics || isFetchingLyrics}
                    style={[styles.optionRow, (!hasLyrics || isFetchingLyrics) && { opacity: 0.4 }]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="time-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('lyrics.sync') || 'Sincronizar letras'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleDeleteLyrics}
                    disabled={!hasLyrics || isFetchingLyrics}
                    style={[styles.optionRow, { borderBottomWidth: 0 }, (!hasLyrics || isFetchingLyrics) && { opacity: 0.4 }]}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="trash-outline" size={24} color={colors.heartIcon} />
                    </View>
                    <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('lyrics.delete_lyrics') || 'Eliminar letras'}</Text>
                </TouchableOpacity>
            </RNAnimated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    menuOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    menuSheet: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 14,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: colors.cardBackground,
    },
    dragHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    iconContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionText: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
});
