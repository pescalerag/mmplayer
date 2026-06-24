import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated as RNAnimated,
    BackHandler,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    Alert,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/hooks/useAppTheme";
import { useLyricsMenuStore } from '../store/useLyricsMenuStore';
import { useTrackMenuStore } from '../store/useTrackMenuStore';
import { LyricsService } from '../services/LyricsService';
import { useNavigation } from '@react-navigation/native';

export default function LyricsMenuSheet() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const { isVisible, track, onImportSuccess, closeMenu } = useLyricsMenuStore();
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

                <TouchableOpacity onPress={handleImportLRC} style={styles.optionRow}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="cloud-upload-outline" size={24} color={colors.text} />
                    </View>
                    <Text style={styles.optionText}>{t('audio_effects.lyrics_import') || 'Importar archivo .LRC'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={closeMenu} style={[styles.optionRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="close-outline" size={24} color={colors.heartIcon} />
                    </View>
                    <Text style={[styles.optionText, { color: colors.heartIcon }]}>{t('actions.cancel') || 'Cancelar'}</Text>
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
