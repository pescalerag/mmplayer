import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    BackHandler,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Tag from '../database/models/Tag';
import { TagService } from '../services/tagService';
import { useTagManagerStore } from '../store/useTagManagerStore';
import { useTagFormStore } from '../store/useTagFormStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TagManagerModal() {
    const insets = useSafeAreaInsets();
    const { isVisible, targetType, targetId, targetTitle, closeManager } = useTagManagerStore();
    const { openForCreate } = useTagFormStore();

    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

    // Animaciones
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Cargar tags y selecciones
    const reloadData = async () => {
        if (!targetId || !targetType) return;
        try {
            const tags = await TagService.getAllTags();
            setAllTags(tags);

            let selectedIds: string[] = [];
            if (targetType === 'track') {
                selectedIds = await TagService.getTagIdsForTrack(targetId);
            } else {
                selectedIds = await TagService.getTagIdsForAlbum(targetId);
            }
            setSelectedTagIds(selectedIds);
        } catch (e) {
            console.error('Error cargando tags:', e);
        }
    };

    useEffect(() => {
        if (isVisible) {
            reloadData();
            // Animación de entrada
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
            // Animación de salida
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
    }, [isVisible, targetId, targetType]);

    // Manejar botón físico de atrás en Android
    useEffect(() => {
        if (!isVisible) return;
        const onBackPress = () => {
            closeManager();
            return true;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeManager]);

    const updateTagSelection = (tagId: string, isAssociated: boolean) => {
        if (isAssociated) {
            setSelectedTagIds(prev => prev.filter(id => id !== tagId));
        } else {
            setSelectedTagIds(prev => [...prev, tagId]);
        }
    };

    const toggleAlbum = async (targetId: string, tagId: string, shouldAssociate: boolean, isAssociated: boolean, propagate: boolean) => {
        try {
            await TagService.toggleAlbumTag(targetId, tagId, shouldAssociate, propagate);
            updateTagSelection(tagId, isAssociated);
        } catch (e) {
            console.error('Error toggling album tag:', e);
        }
    };

    const handleAlbumTagToggle = (targetId: string, tagId: string, isAssociated: boolean) => {
        const shouldAssociate = !isAssociated;
        const tagName = allTags.find(t => t.id === tagId)?.name ?? '';
        const title = shouldAssociate ? 'Aplicar etiqueta' : 'Quitar etiqueta';
        const message = shouldAssociate
            ? `¿Quieres aplicar la etiqueta "${tagName}" también a todas las canciones de este álbum?`
            : `¿Quieres quitar la etiqueta "${tagName}" también de todas las canciones de este álbum?`;

        Alert.alert(title, message, [
            { text: 'Cancelar', style: 'cancel' },
            { text: shouldAssociate ? 'Solo al Álbum' : 'Solo del Álbum', onPress: () => toggleAlbum(targetId, tagId, shouldAssociate, isAssociated, false) },
            { text: 'Álbum y Canciones', style: shouldAssociate ? 'default' : 'destructive', onPress: () => toggleAlbum(targetId, tagId, shouldAssociate, isAssociated, true) },
        ], { cancelable: true });
    };


    const handleToggleTag = async (tagId: string) => {
        if (!targetId || !targetType) return;
        const isAssociated = selectedTagIds.includes(tagId);

        if (targetType === 'track') {
            try {
                await TagService.toggleTrackTag(targetId, tagId, !isAssociated);
                updateTagSelection(tagId, isAssociated);
            } catch (e) {
                console.error('Error toggling track tag:', e);
            }
        } else {
            handleAlbumTagToggle(targetId, tagId, isAssociated);
        }
    };

    const [shouldRender, setShouldRender] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isVisible]);

    if (!shouldRender) return null;

    return (
        <View
            style={[StyleSheet.absoluteFill, { zIndex: 10000 }]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            {/* Fondo oscuro animado */}
            <TouchableWithoutFeedback onPress={closeManager}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            {/* Contenedor del bottom sheet */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardAvoid}
                pointerEvents="box-none"
            >
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
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            Etiquetas de {targetType === 'track' ? 'canción' : 'álbum'}
                        </Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>
                            {targetTitle}
                        </Text>
                    </View>



                    {/* Lista de etiquetas disponibles */}
                    <Text style={styles.sectionTitle}>Selecciona etiquetas</Text>
                    <View style={styles.tagsContainer}>
                        <ScrollView
                            style={styles.tagsScrollView}
                            contentContainerStyle={styles.tagsScrollContent}
                            showsVerticalScrollIndicator={true}
                        >
                            {allTags.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="pricetags-outline" size={32} color="#555" />
                                    <Text style={styles.emptyText}>No tienes etiquetas.</Text>
                                </View>
                            ) : (
                                allTags.map(tag => {
                                    const isSelected = selectedTagIds.includes(tag.id);
                                    return (
                                        <TouchableOpacity
                                            key={tag.id}
                                            style={[
                                                styles.tagItem,
                                                isSelected && { borderColor: tag.color, backgroundColor: `${tag.color}15` }
                                            ]}
                                            onPress={() => handleToggleTag(tag.id)}
                                        >
                                            <View style={[styles.colorIndicator, { backgroundColor: tag.color }]} />
                                            <Text style={styles.tagName}>{tag.name}</Text>
                                            <View style={styles.checkboxContainer}>
                                                <Ionicons
                                                    name={isSelected ? "checkbox" : "square-outline"}
                                                    size={22}
                                                    color={isSelected ? tag.color : '#666'}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>

                    {/* Botón para crear nueva etiqueta usando el modal compartido */}
                    <TouchableOpacity
                        style={styles.createTagButtonGlobal}
                        onPress={() => {
                            openForCreate(reloadData);
                        }}
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                        <Text style={styles.createTagButtonGlobalText}>Crear nueva etiqueta</Text>
                    </TouchableOpacity>

                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    keyboardAvoid: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#121212',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        maxHeight: SCREEN_HEIGHT * 0.85,
        borderTopWidth: 1,
        borderColor: '#282828',
    },
    dragIndicator: {
        width: 36,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#282828',
        paddingBottom: 15,
    },
    headerTitle: {
        color: '#8B5CF6',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerSubtitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontFamily: 'Montserrat',
        fontWeight: '800',
        marginTop: 4,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 10,
    },
    tagsContainer: {
        height: 180,
        marginBottom: 15,
    },
    tagsScrollView: {
        flex: 1,
    },
    tagsScrollContent: {
        paddingBottom: 10,
    },
    tagItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    colorIndicator: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: 12,
    },
    tagName: {
        color: '#E0E0E0',
        fontSize: 15,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        flex: 1,
    },
    checkboxContainer: {
        paddingLeft: 10,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        fontFamily: 'Montserrat',
        fontWeight: '600',
        marginTop: 10,
        textAlign: 'center',
    },
    createTagButtonGlobal: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 12,
        marginTop: 10,
        gap: 8,
    },
    createTagButtonGlobalText: {
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        fontWeight: '800',
        fontSize: 14,
    },
});
