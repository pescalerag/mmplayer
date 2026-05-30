import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTagFormStore } from '../store/useTagFormStore';
import Tag from '../database/models/Tag';
import { TagService } from '../services/tagService';
import { database } from '../database';
import { Layout } from '../theme/theme';

interface TagManagementContentProps {
    tags: Tag[];
}

function TagManagementContent({ tags }: TagManagementContentProps) {
    const insets = useSafeAreaInsets();
    const { openForCreate, openForEdit } = useTagFormStore();

    // Altura dinámica del header para el smoke y padding del contenido
    const [headerHeight, setHeaderHeight] = useState(100);

    const handleDelete = (tag: Tag) => {
        Alert.alert(
            "Eliminar Etiqueta",
            `¿Estás seguro de que quieres eliminar la etiqueta "${tag.name}"? Se quitará de todas las canciones y álbumes.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        await TagService.deleteTag(tag.id);
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Tag }) => {
        return (
            <View style={styles.tagCard}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <Text style={styles.tagName}>{item.name}</Text>

                <TouchableOpacity
                    onPress={() => {
                        openForEdit(item);
                    }}
                    style={styles.iconButton}
                >
                    <Ionicons name="pencil" size={20} color="#888" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.iconButton}
                >
                    <Ionicons name="trash" size={20} color="#EF4444" />
                </TouchableOpacity>
            </View>
        );
    };

    const bottomOffset = Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom;

    return (
        <View style={styles.container}>
            {/* Fondo gradiente */}
            <LinearGradient
                colors={['#000000', '#22222221', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />

            {/* 1. CONTENIDO - LISTA */}
            <View style={StyleSheet.absoluteFill}>
                <FlashList
                    data={tags}
                    keyExtractor={t => t.id}
                    renderItem={renderItem}
                    contentContainerStyle={[
                        styles.listContent,
                        {
                            paddingTop: headerHeight + 20,
                            paddingBottom: bottomOffset,
                        }
                    ]}
                    ListHeaderComponent={
                        <TouchableOpacity
                            style={styles.createTagButton}
                            onPress={() => {
                                openForCreate();
                            }}
                        >
                            <Ionicons name="add" size={22} color="#FFF" />
                            <Text style={styles.createTagButtonText}>Crear nueva etiqueta</Text>
                        </TouchableOpacity>
                    }
                    ListEmptyComponent={
                        <Text style={styles.empty}>No hay etiquetas creadas.</Text>
                    }

                />
            </View>

            {/* 2. HUMO / DEGRADE HEADER */}
            <LinearGradient
                colors={[
                    '#000000',
                    'rgba(0, 0, 0, 0.95)',
                    'rgba(0, 0, 0, 0.8)',
                    'transparent'
                ]}
                locations={[0, 0.45, 0.8, 1]}
                style={[styles.smokeEffect, { height: headerHeight + 30 }]}
                pointerEvents="none"
            />

            {/* 2.5 CAPA DE ILUMINACIÓN MORADA (SOBRE EL HUMO) */}
            <LinearGradient
                colors={["#8B5CF633", "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* 3. HEADER DE LA INTERFAZ */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}
            >
                <Text style={styles.headerTitle}>Gestión de Etiquetas</Text>
            </View>

        </View>
    );
}

const EnhancedTagManagement = withObservables([], () => ({
    tags: database.collections.get<Tag>('tags').query(Q.sortBy('name', Q.asc)).observe(),
}))(TagManagementContent);

export default function TagManagementScreen() {
    return <EnhancedTagManagement />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    listContent: {
        paddingHorizontal: 20,
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
    },
    smokeEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    createTagButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 8,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    createTagButtonText: {
        color: '#FFFFFF',
        fontFamily: 'Montserrat',
        fontWeight: '800',
        fontSize: 15,
    },
    tagCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.03)',
    },
    colorDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 15,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    tagName: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
    },
    iconButton: {
        padding: 6,
        marginLeft: 10,
    },
    empty: {
        color: '#888',
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '400',
        textAlign: 'center',
        marginTop: 50,
    },
});