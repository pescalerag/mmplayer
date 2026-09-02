import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { HallOfFameService, HallOfFameData, HallOfFameMember } from '../../services/HallOfFameService';
import { HallOfFameModal } from './HallOfFameModal';

export const HallOfFameView: React.FC = () => {
    const { t } = useTranslation();
    const { colors, fonts } = useAppTheme();
    const userTier = useSettingsStore((state) => state.userTier);
    const userAlias = useSettingsStore((state) => state.userAlias);

    const [data, setData] = useState<HallOfFameData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const isSupporterOrVip = userTier === 'SUPPORTER' || userTier === 'VIP';

    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const result = await HallOfFameService.getHallOfFameData();
            setData(result);
        } catch (error) {
            console.error('Error loading Hall of Fame data:', error);
        } finally {
            if (showLoading) setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        loadData(false);
    }, [loadData]);

    // Filtro reactivo para búsqueda
    const filteredVip = useMemo(() => {
        if (!data?.vip) return [];
        if (!searchQuery.trim()) return data.vip;
        const q = searchQuery.toLowerCase().trim();
        return data.vip.filter((item) =>
            item.name.toLowerCase().includes(q) || (item.quote && item.quote.toLowerCase().includes(q))
        );
    }, [data?.vip, searchQuery]);

    const filteredSupporters = useMemo(() => {
        if (!data?.supporters) return [];
        if (!searchQuery.trim()) return data.supporters;
        const q = searchQuery.toLowerCase().trim();
        return data.supporters.filter((item) =>
            item.name.toLowerCase().includes(q)
        );
    }, [data?.supporters, searchQuery]);

    const totalResults = filteredVip.length + filteredSupporters.length;

    const styles = useMemo(() => getStyles(colors, fonts), [colors, fonts]);

    return (
        <View style={styles.container}>
            {/* Modal para editar/registrar alias */}
            <HallOfFameModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                tier={userTier}
                onSuccess={() => loadData(false)}
            />

            {/* ========================================================================= */}
            {/* HERO CARD CABECERA                                                        */}
            {/* ========================================================================= */}
            <LinearGradient
                colors={['rgba(245, 158, 11, 0.16)', 'rgba(20, 184, 166, 0.08)', 'rgba(0, 0, 0, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
            >
                <View style={styles.heroIconCircle}>
                    <Ionicons name="trophy" size={28} color="#FBBF24" />
                </View>
                <Text style={styles.heroTitle}>{t('support.hall_of_fame.title')}</Text>
                <Text style={styles.heroSubtitle}>{t('support.hall_of_fame.subtitle')}</Text>
            </LinearGradient>

            {/* ========================================================================= */}
            {/* TU MENCIÓN PERSONAL (Si el usuario es Supporter o VIP)                     */}
            {/* ========================================================================= */}
            {isSupporterOrVip && (
                <View style={[styles.userSpotCard, userTier === 'VIP' ? styles.userSpotVip : styles.userSpotSupporter]}>
                    <View style={styles.userSpotLeft}>
                        <View style={[styles.userSpotIconCircle, userTier === 'VIP' ? styles.userSpotIconVip : styles.userSpotIconSupporter]}>
                            {userTier === 'VIP' ? (
                                <MaterialCommunityIcons name="crown" size={18} color="#FBBF24" />
                            ) : (
                                <Ionicons name="heart" size={16} color="#2DD4BF" />
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.userSpotTitle}>{t('support.hall_of_fame.your_spot_title')}</Text>
                            <Text style={styles.userSpotDesc} numberOfLines={1}>
                                {userAlias ? `Alias: ${userAlias}` : t('support.hall_of_fame.your_spot_desc')}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.editSpotBtn, userTier === 'VIP' ? { borderColor: '#FBBF24' } : { borderColor: '#2DD4BF' }]}
                        activeOpacity={0.7}
                        onPress={() => setIsModalVisible(true)}
                    >
                        <Ionicons name="pencil" size={12} color={userTier === 'VIP' ? '#FBBF24' : '#2DD4BF'} style={{ marginRight: 4 }} />
                        <Text style={[styles.editSpotBtnText, { color: userTier === 'VIP' ? '#FBBF24' : '#2DD4BF' }]}>
                            {t('support.hall_of_fame.edit_hof_name')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ========================================================================= */}
            {/* BUSCADOR                                                                  */}
            {/* ========================================================================= */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={colors.textSecondary || '#888'} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t('support.hall_of_fame.search_placeholder')}
                    placeholderTextColor={colors.textSecondary || '#888'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary || '#888'} />
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FBBF24" />
                    <Text style={styles.loadingText}>{t('support.hall_of_fame.syncing')}</Text>
                </View>
            ) : totalResults === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={38} color={colors.textSecondary || '#888'} style={{ opacity: 0.6, marginBottom: 12 }} />
                    <Text style={styles.emptyText}>{t('support.hall_of_fame.no_results')}</Text>
                </View>
            ) : (
                <>
                    {/* ===================================================================== */}
                    {/* 1. SECCIÓN VIP LEGENDS (MÁXIMA PRIORIDAD)                             */}
                    {/* ===================================================================== */}
                    {filteredVip.length > 0 && (
                        <View style={styles.sectionContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <MaterialCommunityIcons name="crown" size={20} color="#FBBF24" />
                                    <Text style={[styles.sectionTitle, { color: '#FBBF24' }]}>
                                        {t('support.hall_of_fame.vip_section_title')}
                                    </Text>
                                </View>
                                <View style={styles.vipBadge}>
                                    <Text style={styles.vipBadgeText}>{filteredVip.length}</Text>
                                </View>
                            </View>

                            <View style={styles.vipList}>
                                {filteredVip.map((member) => (
                                    <View key={member.id} style={styles.vipCard}>
                                        <LinearGradient
                                            colors={['rgba(245, 158, 11, 0.16)', 'rgba(0, 0, 0, 0)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={StyleSheet.absoluteFillObject}
                                        />
                                        <View style={styles.vipCardContent}>
                                            <View style={styles.vipAvatarCircle}>
                                                <MaterialCommunityIcons name="crown" size={20} color="#FBBF24" />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Text style={styles.vipMemberName} numberOfLines={1}>
                                                        {member.name}
                                                    </Text>
                                                    <Text style={styles.memberDate}>{member.date}</Text>
                                                </View>
                                                {member.quote && (
                                                    <Text style={styles.vipQuote} numberOfLines={2}>
                                                        "{member.quote}"
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ===================================================================== */}
                    {/* 2. SECCIÓN SUPPORTERS                                                 */}
                    {/* ===================================================================== */}
                    {filteredSupporters.length > 0 && (
                        <View style={[styles.sectionContainer, { marginTop: filteredVip.length > 0 ? 16 : 0 }]}>
                            <View style={styles.sectionHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="heart" size={18} color="#2DD4BF" />
                                    <Text style={[styles.sectionTitle, { color: '#2DD4BF' }]}>
                                        {t('support.hall_of_fame.supporters_section_title')}
                                    </Text>
                                </View>
                                <View style={styles.supporterBadge}>
                                    <Text style={styles.supporterBadgeText}>{filteredSupporters.length}</Text>
                                </View>
                            </View>

                            <View style={styles.supportersGrid}>
                                {filteredSupporters.map((member) => (
                                    <View key={member.id} style={styles.supporterCard}>
                                        <View style={styles.supporterIconCircle}>
                                            <Ionicons name="heart" size={14} color="#2DD4BF" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.supporterMemberName} numberOfLines={1}>
                                                {member.name}
                                            </Text>
                                            <Text style={styles.supporterDate}>{member.date}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </>
            )}
        </View>
    );
};

const getStyles = (colors: any, fonts: any) =>
    StyleSheet.create({
        container: {
            width: '100%',
        },
        heroCard: {
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.25)',
        },
        heroIconCircle: {
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
        },
        heroTitle: {
            color: colors.text || '#FFFFFF',
            fontSize: 20,
            fontFamily: fonts.bold,
            marginBottom: 6,
            textAlign: 'center',
        },
        heroSubtitle: {
            color: colors.textSecondary || '#AAAAAA',
            fontSize: 12.5,
            lineHeight: 18,
            fontFamily: fonts.regular,
            textAlign: 'center',
            paddingHorizontal: 8,
        },
        // Spot Personal
        userSpotCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
            borderWidth: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
        },
        userSpotVip: {
            borderColor: 'rgba(245, 158, 11, 0.4)',
        },
        userSpotSupporter: {
            borderColor: 'rgba(20, 184, 166, 0.4)',
        },
        userSpotLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            marginRight: 10,
        },
        userSpotIconCircle: {
            width: 32,
            height: 32,
            borderRadius: 16,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
        },
        userSpotIconVip: {
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
        },
        userSpotIconSupporter: {
            backgroundColor: 'rgba(20, 184, 166, 0.2)',
        },
        userSpotTitle: {
            color: colors.text || '#FFFFFF',
            fontSize: 13,
            fontFamily: fonts.bold,
        },
        userSpotDesc: {
            color: colors.textSecondary || '#AAAAAA',
            fontSize: 11.5,
            fontFamily: fonts.regular,
            marginTop: 2,
        },
        editSpotBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 5,
            paddingHorizontal: 10,
        },
        editSpotBtnText: {
            fontSize: 11,
            fontFamily: fonts.semiBold,
        },
        // Buscador
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.cardBackground || '#1E1E1E',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
        },
        searchIcon: {
            marginRight: 8,
        },
        searchInput: {
            flex: 1,
            color: colors.text || '#FFFFFF',
            fontSize: 13.5,
            fontFamily: fonts.regular,
        },
        loadingContainer: {
            paddingVertical: 36,
            alignItems: 'center',
        },
        loadingText: {
            color: colors.textSecondary || '#AAAAAA',
            fontSize: 12,
            fontFamily: fonts.regular,
            marginTop: 8,
        },
        emptyContainer: {
            paddingVertical: 36,
            alignItems: 'center',
        },
        emptyText: {
            color: colors.textSecondary || '#AAAAAA',
            fontSize: 13,
            fontFamily: fonts.regular,
            textAlign: 'center',
            paddingHorizontal: 20,
        },
        // Secciones
        sectionContainer: {
            marginBottom: 20,
        },
        sectionHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingHorizontal: 4,
        },
        sectionTitle: {
            fontSize: 16,
            fontFamily: fonts.bold,
        },
        vipBadge: {
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
        },
        vipBadgeText: {
            color: '#FBBF24',
            fontSize: 11,
            fontFamily: fonts.bold,
        },
        supporterBadge: {
            backgroundColor: 'rgba(20, 184, 166, 0.2)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
        },
        supporterBadgeText: {
            color: '#2DD4BF',
            fontSize: 11,
            fontFamily: fonts.bold,
        },
        // Tarjetas VIP
        vipList: {
            gap: 10,
        },
        vipCard: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.35)',
            backgroundColor: colors.cardBackground || '#1A1A1A',
            overflow: 'hidden',
        },
        vipCardContent: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
        },
        vipAvatarCircle: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(245, 158, 11, 0.25)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        vipMemberName: {
            color: colors.text || '#FFFFFF',
            fontSize: 14.5,
            fontFamily: fonts.bold,
            flex: 1,
            marginRight: 8,
        },
        memberDate: {
            color: '#FBBF24',
            fontSize: 11,
            fontFamily: fonts.regular,
            opacity: 0.85,
        },
        vipQuote: {
            color: colors.textSecondary || '#AAAAAA',
            fontSize: 12,
            fontFamily: fonts.regular,
            fontStyle: 'italic',
            marginTop: 3,
        },
        // Grid Supporters
        supportersGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        supporterCard: {
            flexDirection: 'row',
            alignItems: 'center',
            width: '48.5%',
            backgroundColor: colors.cardBackground || '#1A1A1A',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderWidth: 1,
            borderColor: 'rgba(20, 184, 166, 0.25)',
        },
        supporterIconCircle: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(20, 184, 166, 0.18)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
        },
        supporterMemberName: {
            color: colors.text || '#FFFFFF',
            fontSize: 13,
            fontFamily: fonts.semiBold,
        },
        supporterDate: {
            color: '#2DD4BF',
            fontSize: 10.5,
            fontFamily: fonts.regular,
            opacity: 0.8,
            marginTop: 1,
        },
    });
