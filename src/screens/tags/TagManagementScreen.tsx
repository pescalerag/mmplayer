import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { openTagForm, openTagMenu } from '@/store/useUIStore';
import { database } from '../../database';
import Tag from '../../database/models/Tag';
import { TagsNavigationProp } from '../../navigation/types';
import { ScreenHeaderLayout } from '../../components/ScreenHeaderLayout';

interface TagManagementContentProps {
    tags: Tag[];
}

function TagManagementContent({ tags }: Readonly<TagManagementContentProps>) {
    const openForCreate = () => openTagForm();
    const { t } = useTranslation();
    const navigation = useNavigation<any>();

    const renderItem = ({ item }: { item: Tag }) => {
        return (
            <TouchableOpacity
                style={styles.tagCard}
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
        );
    };

    return (
        <ScreenHeaderLayout title={t('tags.manager')} showBackButton={false} titleStyle={styles.headerTitle}>
            {({ headerHeight, bottomPadding }) => (
                <View style={StyleSheet.absoluteFill}>
                    <FlashList
                        data={tags}
                        keyExtractor={t => t.id}
                        renderItem={renderItem}
                        contentContainerStyle={[
                            styles.listContent,
                            {
                                paddingTop: headerHeight + 30,
                                paddingBottom: bottomPadding,
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
                                <Text style={styles.createTagButtonText}>{t('tags.create')}</Text>
                            </TouchableOpacity>
                        }
                        ListEmptyComponent={
                            <Text style={styles.empty}>{t('tags.empty_tags')}</Text>
                        }
                    />
                </View>
            )}
        </ScreenHeaderLayout>
    );
}

const EnhancedTagManagement = withObservables([], () => ({
    tags: database.collections.get<Tag>('tags').query(Q.sortBy('name', Q.asc)).observe(),
}))(TagManagementContent);

export default function TagManagementScreen() {
    return <EnhancedTagManagement />;
}

const styles = StyleSheet.create({
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
});