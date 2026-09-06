import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { openTagForm, openTagMenu } from '@/store/useUIStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { database } from '../../database';
import Tag from '../../database/models/Tag';
import { TagsNavigationProp } from '../../navigation/types';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';
import { useAppTheme } from '@/hooks/useAppTheme';
import TagSpotlightTutorial from '@/components/modals/TagSpotlightTutorial';

interface TagManagementContentProps {
    tags: Tag[];
}

function TagManagementContent({ tags }: Readonly<TagManagementContentProps>) {
    const openForCreate = () => openTagForm();
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const { colors } = useAppTheme();

    const [isTutorialVisible, setIsTutorialVisible] = useState(false);
    const hasSeenTagsTutorial = useSettingsStore(state => state.hasSeenTagsTutorial);
    const setHasSeenTagsTutorial = useSettingsStore(state => state.setHasSeenTagsTutorial);

    const rootRef = useRef<View>(null);
    const helpButtonRef = useRef<View>(null);
    const createButtonRef = useRef<View>(null);
    const firstTagRef = useRef<View>(null);

    const helpButtonLayout = useRef<any>(null);
    const createButtonLayout = useRef<any>(null);
    const firstTagLayout = useRef<any>(null);
    const [headerHeight, setHeaderHeight] = useState(100);

    // Auto-lanzar el tutorial la primera vez que se visita la pantalla
    useEffect(() => {
        if (isFocused && !hasSeenTagsTutorial) {
            setIsTutorialVisible(true);
        }
    }, [isFocused, hasSeenTagsTutorial]);

    const handleCloseTutorial = () => {
        setIsTutorialVisible(false);
        if (!hasSeenTagsTutorial) {
            setHasSeenTagsTutorial(true);
        }
    };

    // Etiqueta de muestra garantizada si el usuario aún no tiene ninguna en la BD
    const sampleTag = React.useMemo(() => {
        return {
            id: 'sample_tutorial_tag',
            name: t('tags_tutorial.sample_tag_name') || 'Favoritos',
            color: colors.accent,
        } as unknown as Tag;
    }, [t, colors.accent]);

    const effectiveTags = tags.length > 0 ? tags : (isTutorialVisible ? [sampleTag] : []);

    const renderItem = ({ item, index }: { item: Tag; index: number }) => {
        return (
            <View style={{ marginBottom: 12 }}>
                <View
                    ref={index === 0 ? firstTagRef : undefined}
                    collapsable={false}
                    onLayout={index === 0 ? (e) => {
                        firstTagLayout.current = e.nativeEvent.layout;
                    } : undefined}
                >
                    <TouchableOpacity
                        style={[styles.tagCard, { marginBottom: 0 }]}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('TagDetail', { tagId: item.id, tagName: item.name, tagColor: item.color })}
                        onLongPress={() => {
                            openTagMenu(item);
                        }}
                    >
                        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                        <Text style={styles.tagName}>{item.name}</Text>
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => {
                                openTagMenu(item);
                            }}
                        >
                            <Ionicons name="ellipsis-vertical" size={20} color="#888" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View ref={rootRef} collapsable={false} style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeaderLayout
                title={t('tags.manager')}
                showBackButton={false}
                titleStyle={styles.headerTitle}
                rightComponent={
                    <View
                        ref={helpButtonRef}
                        collapsable={false}
                        onLayout={(e) => {
                            helpButtonLayout.current = e.nativeEvent.layout;
                        }}
                    >
                        <TouchableOpacity
                            onPress={() => setIsTutorialVisible(true)}
                            style={styles.helpButton}
                            accessibilityLabel={t('tags_tutorial.help_btn')}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="help-circle-outline" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                }
            >
                {({ headerHeight: hHeight, bottomPadding }) => {
                    if (hHeight !== headerHeight) {
                        setHeaderHeight(hHeight);
                    }
                    return (
                        <View style={StyleSheet.absoluteFill}>
                            <FlashList
                                data={effectiveTags}
                                keyExtractor={t => t.id}
                                renderItem={renderItem}
                                contentContainerStyle={[
                                    styles.listContent,
                                    {
                                        paddingTop: hHeight + 30,
                                        paddingBottom: bottomPadding,
                                    }
                                ]}
                                ListHeaderComponent={
                                    <View style={{ marginBottom: 20 }}>
                                        <View
                                            ref={createButtonRef}
                                            collapsable={false}
                                            onLayout={(e) => {
                                                createButtonLayout.current = e.nativeEvent.layout;
                                            }}
                                        >
                                            <TouchableOpacity
                                                style={[styles.createTagButton, { backgroundColor: colors.accent, shadowColor: colors.accent, marginBottom: 0 }]}
                                                onPress={() => {
                                                    openForCreate();
                                                }}
                                            >
                                                <Ionicons name="add" size={22} color={colors.onAccent} />
                                                <Text style={[styles.createTagButtonText, { color: colors.onAccent }]}>{t('tags.create')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                }
                                ListEmptyComponent={
                                    <Text style={styles.empty}>{t('tags.empty_tags')}</Text>
                                }
                            />
                        </View>
                    );
                }}
            </ScreenHeaderLayout>

            {/* Tutorial Contextual Spotlight montado al nivel raíz sobre toda la pantalla */}
            <TagSpotlightTutorial
                visible={isTutorialVisible}
                onClose={handleCloseTutorial}
                tags={effectiveTags}
                rootRef={rootRef}
                helpButtonRef={helpButtonRef}
                createButtonRef={createButtonRef}
                firstTagRef={firstTagRef}
                headerHeight={headerHeight}
                helpButtonLayout={helpButtonLayout}
                createButtonLayout={createButtonLayout}
                firstTagLayout={firstTagLayout}
            />
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
    },
    listContent: {
        paddingHorizontal: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontFamily: 'Montserrat',
        fontWeight: '900',
        color: '#FFFFFF',
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
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 50,
    },
    helpButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
});