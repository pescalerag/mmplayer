import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import * as NavigationBar from 'expo-navigation-bar';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../database';
import Track from '../database/models/Track';
import { ScannerService } from '../services/ScannerService';
import { useFolderMenuStore } from '../store/useFolderMenuStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { usePlaylistSelectorStore } from '../store/usePlaylistSelectorStore';
import { useMultiSelectStore } from '../store/useMultiSelectStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useToastStore } from '../store/useToastStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FolderMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { isVisible, selectedFolderPath, selectedFolderName, closeMenu } = useFolderMenuStore();
    const excludeFolder = useSettingsStore(state => state.excludeFolder);
    const [tracks, setTracks] = useState<Track[]>([]);

    // Valores animados
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Controlar la animación cuando cambia isVisible
    useEffect(() => {
        if (isVisible) {
            if (Platform.OS === 'android') {
                NavigationBar.setBackgroundColorAsync('#121212').catch(() => { });
            }

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 300,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [isVisible, fadeAnim, slideAnim]);

    useEffect(() => {
        if (!isVisible) return;

        const onBackPress = () => {
            closeMenu();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeMenu]);

    // Cargar todas las canciones de la carpeta seleccionada
    useEffect(() => {
        if (!isVisible || !selectedFolderPath) {
            setTracks([]);
            return;
        }

        const loadTracks = async () => {
            try {
                const tracksList = await database.collections.get<Track>('tracks').query(
                    Q.where('file_url', Q.like(`${selectedFolderPath}%`))
                ).fetch();
                
                const directTracksList = tracksList.filter(t => {
                    const lastSlash = t.fileUrl.lastIndexOf('/');
                    if (lastSlash === -1) return false;
                    const dirPath = t.fileUrl.substring(0, lastSlash);
                    return dirPath === selectedFolderPath;
                });

                setTracks(directTracksList);
            } catch (error) {
                console.error("Error loading folder tracks in menu sheet:", error);
            }
        };

        loadTracks();
    }, [isVisible, selectedFolderPath]);

    const [shouldRender, setShouldRender] = useState(isVisible);

    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    const handleExclude = () => {
        if (!selectedFolderPath) return;

        Alert.alert(
            t('actions.exclude_folder_title'),
            t('actions.exclude_folder_confirm'),
            [
                { text: t('actions.cancel'), style: "cancel" },
                {
                    text: t('actions.exclude'),
                    style: "destructive",
                    onPress: async () => {
                        closeMenu();
                        // 1. Excluir carpeta en settings (persistente)
                        excludeFolder(selectedFolderPath);
                        // 2. Borrar contenido de la carpeta en la db y limpiar huérfanos
                        await ScannerService.deleteFolderContents(selectedFolderPath);
                    }
                }
            ]
        );
    };

    if (!shouldRender && !isVisible) return null;

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeMenu}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.sheetContainer,
                    {
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}
            >
                <View style={styles.dragIndicator} />

                <View style={styles.header}>
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <Ionicons name="folder" size={24} color={colors.accent} />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedFolderName}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>{t('library.folder_singular')}</Text>
                    </View>
                </View>

                {/* OPCIÓN: Añadir a continuación */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (tracks.length > 0) {
                            usePlayerStore.getState().addMultipleToQueueNext(tracks);
                            useToastStore.getState().showToast(t('toasts.folder_next'), 'return-down-forward');
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="return-down-forward" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_next')}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir al final de la cola */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (tracks.length > 0) {
                            usePlayerStore.getState().addMultipleToQueueEnd(tracks);
                            useToastStore.getState().showToast(t('toasts.folder_queued'), 'list');
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="list" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_to_queue')}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir a Playlist */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                        if (tracks.length > 0) {
                            closeMenu();
                            usePlaylistSelectorStore.getState().openSelector(tracks);
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="add-circle-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.add_to_playlist')}</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Seleccionar canciones */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (tracks.length > 0) {
                            closeMenu();
                            useMultiSelectStore.getState().selectMultipleTracks(tracks);
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="checkmark-circle-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('actions.select_all')}</Text>
                </TouchableOpacity>

                {/* Separador */}
                <View style={styles.separator} />

                {/* OPCIÓN: Excluir */}
                <TouchableOpacity
                    style={styles.optionRow}
                    onPress={handleExclude}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="eye-off-outline" size={24} color={colors.heartIcon} />
                    </View>
                    <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.exclude_scan')}</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheetContainer: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: colors.cardBackground,
    },
    dragIndicator: {
        width: 36,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: colors.cardBackground,
        paddingBottom: 20,
    },
    thumbnail: {
        width: 56,
        height: 56,
        borderRadius: 8, // Cuadrado para carpetas
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: colors.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
        marginTop: 4,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
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
    separator: {
        height: 1,
        backgroundColor: colors.cardBackground,
        marginVertical: 8,
    },
});
