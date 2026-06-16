import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { 
    Animated, 
    BackHandler, 
    Dimensions, 
    Platform, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    TouchableWithoutFeedback, 
    View,
    FlatList
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useArtistsListSheetStore } from '../store/useArtistsListSheetStore';
import { useAppTheme } from "@/hooks/useAppTheme";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ArtistsListSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const { isVisible, artists, closeSheet } = useArtistsListSheetStore();

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
            closeSheet();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [isVisible, closeSheet]);

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

    const handleArtistPress = (artistId: string) => {
        closeSheet();
        // Cierre suave de la sheet antes de navegar para evitar saltos en la UI
        setTimeout(() => {
            navigation.navigate('ArtistDetail', { artistId });
        }, 150);
    };

    return (
        <View 
            style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} 
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            {/* Fondo oscuro animado con Fade */}
            <TouchableWithoutFeedback onPress={closeSheet}>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
            </TouchableWithoutFeedback>

            {/* Contenedor del Menú animado con Slide */}
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
                    <Text style={styles.title}>{t('screens.artists') || 'Artistas'}</Text>
                </View>

                {/* Lista de artistas */}
                <FlatList
                    data={artists}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.artistRow} 
                            onPress={() => handleArtistPress(item.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.artistInfo}>
                                {item.imageUrl ? (
                                    <Image 
                                        source={{ uri: item.imageUrl }} 
                                        style={styles.thumbnail}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                ) : (
                                    <View style={[styles.thumbnail, styles.placeholder]}>
                                        <Ionicons name="person" size={24} color={colors.textSecondary} />
                                    </View>
                                )}
                                <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                />
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
        maxHeight: SCREEN_HEIGHT * 0.6,
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
        marginBottom: 16,
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    artistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    },
    artistInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 16,
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 16,
    },
    placeholder: {
        backgroundColor: colors.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    artistName: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.regular,
        fontWeight: '700',
        flex: 1,
    },
});
