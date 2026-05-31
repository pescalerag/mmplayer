import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
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
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useFolderMenuStore } from '../store/useFolderMenuStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { ScannerService } from '../services/ScannerService';
import { database } from '../database';
import Track from '../database/models/Track';
import { usePlayerStore } from '../store/usePlayerStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FolderMenuSheet() {
    const insets = useSafeAreaInsets();
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
                NavigationBar.setBackgroundColorAsync('#121212').catch(() => {});
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
                setTracks(tracksList);
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
            "Excluir carpeta",
            "¿Estás seguro de que deseas excluir esta carpeta del escaneo? Se borrarán todas sus canciones de la biblioteca.",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Excluir", 
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
                        <Ionicons name="folder" size={24} color="#8B5CF6" />
                    </View>
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>{selectedFolderName}</Text>
                        <Text style={styles.subtitle} numberOfLines={1}>Carpeta</Text>
                    </View>
                </View>

                {/* OPCIÓN: Añadir a continuación */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (tracks.length > 0) {
                            usePlayerStore.getState().addMultipleToQueueNext(tracks);
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="return-down-forward" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir a continuación</Text>
                </TouchableOpacity>

                {/* OPCIÓN: Añadir al final de la cola */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={() => {
                        if (tracks.length > 0) {
                            usePlayerStore.getState().addMultipleToQueueEnd(tracks);
                            closeMenu();
                        }
                    }}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="list" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.optionText}>Añadir al final de la cola</Text>
                </TouchableOpacity>

                {/* Separador */}
                <View style={styles.separator} />

                {/* OPCIÓN: Excluir */}
                <TouchableOpacity 
                    style={styles.optionRow} 
                    onPress={handleExclude}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="eye-off-outline" size={24} color="#EF4444" />
                    </View>
                    <Text style={[styles.optionText, { color: '#EF4444' }]}>Excluir del escaneo</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
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
        borderColor: '#282828',
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
        borderBottomColor: '#282828',
        paddingBottom: 20,
    },
    thumbnail: {
        width: 56,
        height: 56,
        borderRadius: 8, // Cuadrado para carpetas
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Montserrat',
        fontWeight: '800',
    },
    subtitle: {
        color: '#B3B3B3',
        fontSize: 14,
        fontFamily: 'Montserrat',
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
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    separator: {
        height: 1,
        backgroundColor: '#282828',
        marginVertical: 8,
    },
});
