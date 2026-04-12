import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    BackHandler,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { Track as TPTrack } from 'react-native-track-player';
import { useQueueSheetStore } from '../store/useQueueSheetStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { PlayingIndicator } from './PlayingIndicator';

const { height } = Dimensions.get('window');

export default function QueueSheet() {
    const { isVisible, closeQueue } = useQueueSheetStore();
    const activeTrack = usePlayerStore(state => state.activeTrack);
    const isPlayingGlobal = usePlayerStore(state => state.isPlaying);
    const insets = useSafeAreaInsets();

    const [queue, setQueue] = useState<TPTrack[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);

    const slideAnim = useRef(new Animated.Value(height)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // --- ANIMACIONES ---
    useEffect(() => {
        if (isVisible) {
            loadQueueData();
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: height, duration: 250, useNativeDriver: true })
            ]).start();
        }
    }, [isVisible]);

    // --- BACKHANDLER ---
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => { closeQueue(); return true; };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeQueue]);

    // --- SINCRONIZACIÓN PASIVA (PULSOS) ---
    useEffect(() => {
        if (isVisible) {
            refreshActiveIndex();
        }
    }, [activeTrack, isVisible]);

    const loadQueueData = async () => {
        try {
            const currentQueue = await TrackPlayer.getQueue();
            setQueue(currentQueue);
            await refreshActiveIndex();
        } catch (error) {
            console.error('Error loading queue data:', error);
        }
    };

    const refreshActiveIndex = async () => {
        try {
            const currentIndex = await TrackPlayer.getActiveTrackIndex();
            if (currentIndex !== undefined && currentIndex !== null) {
                setActiveIndex(currentIndex);
            }
        } catch (error) {
            console.error('Error refreshing active index:', error);
        }
    };

    const handleSkipTo = async (index: number) => {
        try {
            await TrackPlayer.skip(index);
            await TrackPlayer.play();
            // No recargamos la cola completa, solo actualizamos el índice visualmente
            setActiveIndex(index);
        } catch (error) {
            console.error('Error skipping to track:', error);
        }
    };

    const handleRemove = async (index: number) => {
        try {
            await TrackPlayer.remove(index);
            // Al remover, la cola ha cambiado, así que refrescamos los datos completos
            await loadQueueData();
        } catch (error) {
            console.error('Error removing track:', error);
        }
    };

    // --- RENDERIZADO DE FILA ---
    const renderItem = ({ item, index }: { item: TPTrack; index: number }) => {
        const isPlaying = index === activeIndex;

        return (
            <TouchableOpacity 
                style={[styles.trackRow, isPlaying && styles.trackRowActive]} 
                onPress={() => handleSkipTo(index)}
            >
                {item.artwork ? (
                    <Image 
                        source={{ uri: item.artwork }} 
                        style={styles.thumbnail} 
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholder]}>
                        <Ionicons name="musical-notes" size={20} color="#666" />
                    </View>
                )}
                
                <View style={styles.trackInfo}>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.title, isPlaying && styles.textActive]} numberOfLines={1}>
                            {item.title}
                        </Text>
                        {isPlaying && <PlayingIndicator isPlaying={isPlayingGlobal} />}
                    </View>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {item.artist || 'Desconocido'}
                    </Text>
                </View>

                {/* BOTÓN ELIMINAR */}
                <TouchableOpacity 
                    style={styles.removeButton} 
                    onPress={() => handleRemove(index)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <Ionicons name="close-outline" size={24} color="#666" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // Ocultar completamente el componente cuando no está visible para no interceptar toques
    // Pero dejamos que termine la animación
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

    return (
        <View 
            style={[StyleSheet.absoluteFill, { zIndex: 9998 }]} 
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <TouchableWithoutFeedback onPress={closeQueue}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View style={[
                styles.sheetContainer, 
                { 
                    height: height * 0.75,
                    paddingBottom: insets.bottom, 
                    transform: [{ translateY: slideAnim }] 
                }
            ]}>
                <View style={styles.dragIndicator} />
                <Text style={styles.headerTitle}>Cola de reproducción</Text>

                <FlatList
                    data={queue}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
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
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 15,
        marginBottom: 10,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        paddingHorizontal: 24,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#232323',
    },
    listContainer: {
        paddingVertical: 10,
        paddingBottom: 40,
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    trackRowActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: '#232323',
        justifyContent: 'center',
        alignItems: 'center',
    },
    trackInfo: {
        flex: 1,
        marginRight: 10,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        flexShrink: 1,
    },
    textActive: {
        color: '#A78BFA', // Violet-400
    },
    subtitle: {
        color: '#9CA3AF', // Gray-400
        fontSize: 13,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        marginTop: 4,
    },
    removeButton: {
        padding: 8,
    },
});
