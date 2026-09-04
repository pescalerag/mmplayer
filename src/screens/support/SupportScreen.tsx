import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchasesPackage } from 'react-native-purchases';

import { useAppTheme } from '@/hooks/useAppTheme';
import { Layout } from '../../theme/theme';
import { useSettingsStore } from '../../store/useSettingsStore';
import { PurchasesService, PRODUCT_IDS } from '../../services/PurchasesService';
import { UserTier } from '../../store/useSettingsStore';
import BenefitsView from './BenefitsView';
import { HallOfFameView } from './HallOfFameView';
import { HallOfFameModal } from './HallOfFameModal';

export default function SupportScreen() {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { colors, fonts, layout, spacing, radii, fontWeights } = useAppTheme();

    const userTier = useSettingsStore(state => state.userTier);
    const hasOrphanedUpgrade = useSettingsStore(state => state.hasOrphanedUpgrade);

    const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    const [supporterPack, setSupporterPack] = useState<PurchasesPackage | null>(null);
    const [vipPack, setVipPack] = useState<PurchasesPackage | null>(null);
    const [upgradeVipPack, setUpgradeVipPack] = useState<PurchasesPackage | null>(null);

    const [activeTab, setActiveTab] = useState<'tiers' | 'benefits' | 'hall_of_fame'>('tiers');
    const [isHofModalVisible, setIsHofModalVisible] = useState(false);
    const [purchasedTier, setPurchasedTier] = useState<UserTier>('SUPPORTER');

    const loadOfferings = useCallback(async () => {
        setIsLoadingOfferings(true);
        try {
            const currentOffering = await PurchasesService.getOfferings();
            if (currentOffering?.availablePackages) {
                const packages = currentOffering.availablePackages;

                // Match Supporter package
                const supporter = packages.find(
                    p => p.product.identifier === PRODUCT_IDS.SUPPORTER ||
                         p.identifier === PRODUCT_IDS.SUPPORTER ||
                         (!p.identifier.toLowerCase().includes('upgrade') &&
                          !p.product.identifier.toLowerCase().includes('upgrade') &&
                          (p.identifier.toLowerCase().includes('supporter') || p.product.identifier.toLowerCase().includes('supporter')))
                );
                if (supporter) setSupporterPack(supporter);

                // Match Upgrade VIP package
                const upgrade = packages.find(
                    p => p.product.identifier === PRODUCT_IDS.UPGRADE_VIP ||
                         p.identifier === PRODUCT_IDS.UPGRADE_VIP ||
                         p.identifier.toLowerCase().includes('upgrade') ||
                         p.product.identifier.toLowerCase().includes('upgrade')
                );
                if (upgrade) setUpgradeVipPack(upgrade);

                // Match VIP package (ensuring it's not the upgrade package)
                const vip = packages.find(
                    p => p !== upgrade && (
                        p.product.identifier === PRODUCT_IDS.VIP ||
                        p.identifier === PRODUCT_IDS.VIP ||
                        p.identifier.toLowerCase().includes('vip') ||
                        p.product.identifier.toLowerCase().includes('vip')
                    )
                );
                if (vip) setVipPack(vip);
            }
        } catch (error) {
            console.error('Error loading offerings in SupportScreen:', error);
        } finally {
            setIsLoadingOfferings(false);
        }
    }, []);

    useEffect(() => {
        loadOfferings();
    }, [loadOfferings]);

    const handlePurchase = async (pack: PurchasesPackage | null) => {
        if (!pack) {
            Alert.alert(
                t('actions.error'),
                'El producto no está disponible temporalmente en Google Play. Inténtalo más tarde.'
            );
            return;
        }

        setIsPurchasing(true);
        try {
            const res = await PurchasesService.purchasePackage(pack);
            if (res.success) {
                if (res.userTier === 'SUPPORTER' || res.userTier === 'VIP') {
                    setPurchasedTier(res.userTier);
                    setIsHofModalVisible(true);
                } else {
                    Alert.alert(
                        '¡Éxito!',
                        t('support.purchase_success') || '¡Muchas gracias por apoyar a MMPlayer!'
                    );
                }
            } else if (res.error && !res.error.userCancelled) {
                Alert.alert(
                    t('actions.error'),
                    t('support.purchase_error') || 'Hubo un error al procesar la compra.'
                );
            }
        } catch (error) {
            console.error('Purchase error:', error);
            Alert.alert(t('actions.error'), t('support.purchase_error') || 'Hubo un error.');
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setIsRestoring(true);
        try {
            const res = await PurchasesService.restorePurchases();
            if (res.success) {
                if (res.userTier !== 'USER') {
                    Alert.alert(
                        '¡Restaurado! ✓',
                        `${t('support.restore_success')} (${res.userTier})`
                    );
                } else {
                    Alert.alert(
                        'MMPlayer',
                        t('support.restore_no_purchases') || 'No se encontraron compras en tu cuenta.'
                    );
                }
            } else {
                Alert.alert(t('actions.error'), 'No se pudieron restaurar las compras.');
            }
        } catch (error) {
            console.error('Restore error:', error);
            Alert.alert(t('actions.error'), 'Error al restaurar compras.');
        } finally {
            setIsRestoring(false);
        }
    };

    const isSupporter = userTier === 'SUPPORTER';
    const isVip = userTier === 'VIP';
    const isUser = userTier === 'USER';

    const supporterPrice = supporterPack?.product.priceString || '--';
    const vipPrice = vipPack?.product.priceString || '--';
    const upgradePrice = upgradeVipPack?.product.priceString || '--';

    const styles = useMemo(() => getStyles(colors, fonts, layout, spacing, radii, fontWeights), [colors, fonts, layout, spacing, radii, fontWeights]);

    return (
        <View style={styles.container}>
            {/* Header bar */}
            <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{t('support.screen_title') || 'Apoyo y Tiers'}</Text>

                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{
                    paddingHorizontal: spacing.lg || 20,
                    paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom + 20
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'tiers' && styles.activeTab]}
                        onPress={() => setActiveTab('tiers')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'tiers' && styles.activeTabText]}>
                            {t('support.tab_tiers') || 'Tiers'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'benefits' && styles.activeTab]}
                        onPress={() => setActiveTab('benefits')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'benefits' && styles.activeTabText]}>
                            {t('support.tab_benefits') || 'Beneficios'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'hall_of_fame' && styles.activeTab]}
                        onPress={() => setActiveTab('hall_of_fame')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.tabText, activeTab === 'hall_of_fame' && styles.activeTabText]}>
                            {t('support.tab_hall_of_fame') || 'Hall of Fame'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'benefits' ? (
                    <BenefitsView />
                ) : activeTab === 'hall_of_fame' ? (
                    <HallOfFameView />
                ) : (
                    <>
                {/* Hero / Intro Card */}
                <LinearGradient
                    colors={
                        isVip
                            ? ['rgba(245, 158, 11, 0.16)', 'rgba(245, 158, 11, 0.04)', 'rgba(0, 0, 0, 0)']
                            : isSupporter
                            ? ['rgba(20, 184, 166, 0.16)', 'rgba(20, 184, 166, 0.04)', 'rgba(0, 0, 0, 0)']
                            : ['rgba(20, 184, 166, 0.14)', 'rgba(245, 158, 11, 0.08)', 'rgba(0, 0, 0, 0)']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.introCard}
                >
                    <View style={[
                        styles.introIconCircle,
                        isVip && { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
                        isSupporter && { backgroundColor: 'rgba(20, 184, 166, 0.2)' }
                    ]}>
                        {isVip ? (
                            <MaterialCommunityIcons name="crown" size={30} color="#FBBF24" />
                        ) : (
                            <Ionicons name="heart" size={28} color="#2DD4BF" />
                        )}
                    </View>
                    <Text style={styles.introTitle}>{t('support.title')}</Text>
                    <Text style={styles.introDescription}>{t('support.description')}</Text>

                    {/* Current User Tier Badge */}
                    <View style={styles.currentTierRow}>
                        <Text style={styles.currentTierLabel}>{t('support.current_tier')}:</Text>
                        <View style={[
                            styles.statusBadge,
                            isVip && styles.statusBadgeVip,
                            isSupporter && styles.statusBadgeSupporter,
                        ]}>
                            {isVip && <MaterialCommunityIcons name="crown" size={13} color="#FBBF24" />}
                            {isSupporter && <Ionicons name="heart" size={12} color="#2DD4BF" />}
                            <Text style={[
                                styles.statusBadgeText,
                                isVip && styles.statusBadgeTextVip,
                                isSupporter && styles.statusBadgeTextSupporter,
                            ]}>
                                {isVip ? 'VIP' : isSupporter ? 'SUPPORTER' : 'USER'}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {isLoadingOfferings && (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#2DD4BF" />
                    </View>
                )}

                {/* ========================================================================= */}
                {/* AVISO DE MEJORA VIP HUÉRFANA (Reembolso de Supporter con Upgrade previo)   */}
                {/* ========================================================================= */}
                {hasOrphanedUpgrade && isUser && (
                    <View style={styles.orphanedUpgradeBanner}>
                        <LinearGradient
                            colors={['rgba(245, 158, 11, 0.20)', 'rgba(245, 158, 11, 0.05)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                        <View style={styles.orphanedUpgradeHeader}>
                            <View style={styles.orphanedUpgradeIconCircle}>
                                <MaterialCommunityIcons name="shield-alert-outline" size={22} color="#F59E0B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.orphanedUpgradeTitle}>
                                    {t('support.orphaned_upgrade_title')}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.orphanedUpgradeDesc}>
                            {t('support.orphaned_upgrade_desc')}
                        </Text>
                        <View style={styles.orphanedUpgradeHintRow}>
                            <Ionicons name="information-circle" size={16} color="#F59E0B" />
                            <Text style={styles.orphanedUpgradeHintText}>
                                {t('support.orphaned_upgrade_action_hint')}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ========================================================================= */}
                {/* CASO 1: USUARIO ESTÁNDAR (USER) -> Muestra Supporter y VIP                */}
                {/* ========================================================================= */}
                {isUser && (
                    <>
                        {/* --- TIER 1: SUPPORTER (Verde Agua / Teal) --- */}
                        <View style={[styles.tierCard, styles.supporterCard]}>
                            <LinearGradient
                                colors={['rgba(20, 184, 166, 0.12)', 'rgba(0, 0, 0, 0)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFillObject}
                            />

                            <View style={styles.tierHeader}>
                                <View style={styles.tierHeaderLeft}>
                                    <View style={[styles.tierIconContainer, { backgroundColor: 'rgba(20, 184, 166, 0.2)' }]}>
                                        <Ionicons name="heart" size={24} color="#2DD4BF" />
                                    </View>
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.tierName}>{t('support.supporter.name')}</Text>
                                            {hasOrphanedUpgrade && (
                                                <View style={styles.reactivateBadge}>
                                                    <Ionicons name="sparkles" size={10} color="#FBBF24" />
                                                    <Text style={styles.reactivateBadgeText}>{t('support.orphaned_upgrade_badge')}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.tierPaymentType}>{t('support.one_time_payment')}</Text>
                                    </View>
                                </View>
                                <View style={styles.priceContainer}>
                                    <Text style={[styles.tierPrice, { color: '#2DD4BF' }]}>{supporterPrice}</Text>
                                </View>
                            </View>

                            <Text style={styles.tierShortDesc}>{t('support.supporter.short_desc')}</Text>

                            <View style={styles.benefitList}>
                                <View style={styles.benefitItem}>
                                    <View style={[styles.benefitBullet, { backgroundColor: 'rgba(20, 184, 166, 0.2)' }]}>
                                        <Ionicons name="apps" size={14} color="#2DD4BF" />
                                    </View>
                                    <View style={styles.benefitTexts}>
                                        <Text style={styles.benefitTitle}>{t('support.supporter.benefit_icons')}</Text>
                                        <Text style={styles.benefitDesc}>{t('support.supporter.benefit_icons_desc')}</Text>
                                    </View>
                                </View>

                                <View style={styles.benefitItem}>
                                    <View style={[styles.benefitBullet, { backgroundColor: 'rgba(20, 184, 166, 0.2)' }]}>
                                        <Ionicons name="trophy" size={14} color="#2DD4BF" />
                                    </View>
                                    <View style={styles.benefitTexts}>
                                        <Text style={styles.benefitTitle}>{t('support.supporter.benefit_fame')}</Text>
                                        <Text style={styles.benefitDesc}>{t('support.supporter.benefit_fame_desc')}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Supporter Action Button */}
                            <TouchableOpacity
                                style={[
                                    styles.purchaseButton,
                                    styles.supporterButton,
                                    hasOrphanedUpgrade && styles.reactivateButton,
                                ]}
                                onPress={() => handlePurchase(supporterPack)}
                                disabled={isPurchasing}
                                activeOpacity={0.8}
                            >
                                {isPurchasing ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.purchaseButtonText}>
                                        {hasOrphanedUpgrade
                                            ? (supporterPrice !== '--'
                                                ? `${t('support.orphaned_upgrade_button')} • ${supporterPrice}`
                                                : t('support.orphaned_upgrade_button'))
                                            : (supporterPrice !== '--'
                                                ? `${t('support.supporter.button')} • ${supporterPrice}`
                                                : t('support.supporter.button'))
                                        }
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* --- TIER 2: VIP (Dorado / Gold) - Solo visible si no tiene upgrade huérfana --- */}
                        {!hasOrphanedUpgrade && (
                            <View style={[styles.tierCard, styles.vipCard]}>
                                <LinearGradient
                                    colors={['rgba(245, 158, 11, 0.12)', 'rgba(0, 0, 0, 0)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                <View style={styles.tierHeader}>
                                    <View style={styles.tierHeaderLeft}>
                                        <View style={[styles.tierIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <MaterialCommunityIcons name="crown" size={26} color="#FBBF24" />
                                        </View>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.tierName}>{t('support.vip.name')}</Text>
                                                <View style={styles.popularBadge}>
                                                    <Text style={styles.popularBadgeText}>TOP</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.tierPaymentType}>{t('support.one_time_payment')}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.priceContainer}>
                                        <Text style={[styles.tierPrice, { color: '#FBBF24' }]}>{vipPrice}</Text>
                                    </View>
                                </View>

                                <Text style={styles.tierShortDesc}>{t('support.vip.short_desc')}</Text>

                                <View style={styles.benefitList}>
                                    <View style={styles.benefitItem}>
                                        <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Ionicons name="color-palette" size={14} color="#FBBF24" />
                                        </View>
                                        <View style={styles.benefitTexts}>
                                            <Text style={styles.benefitTitle}>{t('support.vip.benefit_color')}</Text>
                                            <Text style={styles.benefitDesc}>{t('support.vip.benefit_color_desc')}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.benefitItem}>
                                        <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Ionicons name="tv-outline" size={14} color="#FBBF24" />
                                        </View>
                                        <View style={styles.benefitTexts}>
                                            <Text style={styles.benefitTitle}>{t('support.vip.benefit_localcast')}</Text>
                                            <Text style={styles.benefitDesc}>{t('support.vip.benefit_localcast_desc')}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.benefitItem}>
                                        <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Ionicons name="stats-chart" size={14} color="#FBBF24" />
                                        </View>
                                        <View style={styles.benefitTexts}>
                                            <Text style={styles.benefitTitle}>{t('support.vip.benefit_stats')}</Text>
                                            <Text style={styles.benefitDesc}>{t('support.vip.benefit_stats_desc')}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.benefitItem}>
                                        <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Ionicons name="trophy" size={14} color="#FBBF24" />
                                        </View>
                                        <View style={styles.benefitTexts}>
                                            <Text style={styles.benefitTitle}>{t('support.vip.benefit_fame')}</Text>
                                            <Text style={styles.benefitDesc}>{t('support.vip.benefit_fame_desc')}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.benefitItem}>
                                        <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                            <Ionicons name="checkmark-circle" size={14} color="#FBBF24" />
                                        </View>
                                        <View style={styles.benefitTexts}>
                                            <Text style={styles.benefitTitle}>{t('support.vip.benefit_all_supporter')}</Text>
                                            <Text style={styles.benefitDesc}>{t('support.vip.benefit_all_supporter_desc')}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* VIP Action Button */}
                                <TouchableOpacity
                                    style={[styles.purchaseButton, styles.vipButton]}
                                    onPress={() => handlePurchase(vipPack)}
                                    disabled={isPurchasing}
                                    activeOpacity={0.8}
                                >
                                    {isPurchasing ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.purchaseButtonText}>
                                            {vipPrice !== '--'
                                                ? `${t('support.vip.button')} • ${vipPrice}`
                                                : t('support.vip.button')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}

                {/* ========================================================================= */}
                {/* CASO 2: ES SUPPORTER -> Muestra SOLO tarjeta de MEJERA A VIP              */}
                {/* ========================================================================= */}
                {isSupporter && (
                    <View style={[styles.tierCard, styles.vipCard, styles.tierCardActiveVip]}>
                        <LinearGradient
                            colors={['rgba(245, 158, 11, 0.16)', 'rgba(0, 0, 0, 0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                        />

                        <View style={styles.tierHeader}>
                            <View style={styles.tierHeaderLeft}>
                                <View style={[styles.tierIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                    <MaterialCommunityIcons name="crown" size={26} color="#FBBF24" />
                                </View>
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.tierName}>{t('support.upgrade_card_title')}</Text>
                                        <View style={styles.popularBadge}>
                                            <Text style={styles.popularBadgeText}>UPGRADE</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.tierPaymentType}>{t('support.one_time_payment')}</Text>
                                </View>
                            </View>
                            <View style={styles.priceContainer}>
                                <Text style={[styles.tierPrice, { color: '#FBBF24' }]}>{upgradePrice}</Text>
                            </View>
                        </View>

                        <Text style={styles.tierShortDesc}>{t('support.upgrade_card_desc')}</Text>

                        <View style={styles.benefitList}>
                            <View style={styles.benefitItem}>
                                <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                    <Ionicons name="color-palette" size={14} color="#FBBF24" />
                                </View>
                                <View style={styles.benefitTexts}>
                                    <Text style={styles.benefitTitle}>{t('support.vip.benefit_color')}</Text>
                                    <Text style={styles.benefitDesc}>{t('support.vip.benefit_color_desc')}</Text>
                                </View>
                            </View>

                            <View style={styles.benefitItem}>
                                <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                    <Ionicons name="tv-outline" size={14} color="#FBBF24" />
                                </View>
                                <View style={styles.benefitTexts}>
                                    <Text style={styles.benefitTitle}>{t('support.vip.benefit_localcast')}</Text>
                                    <Text style={styles.benefitDesc}>{t('support.vip.benefit_localcast_desc')}</Text>
                                </View>
                            </View>

                            <View style={styles.benefitItem}>
                                <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                    <Ionicons name="stats-chart" size={14} color="#FBBF24" />
                                </View>
                                <View style={styles.benefitTexts}>
                                    <Text style={styles.benefitTitle}>{t('support.vip.benefit_stats')}</Text>
                                    <Text style={styles.benefitDesc}>{t('support.vip.benefit_stats_desc')}</Text>
                                </View>
                            </View>

                            <View style={styles.benefitItem}>
                                <View style={[styles.benefitBullet, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                                    <Ionicons name="trophy" size={14} color="#FBBF24" />
                                </View>
                                <View style={styles.benefitTexts}>
                                    <Text style={styles.benefitTitle}>{t('support.vip.benefit_fame')}</Text>
                                    <Text style={styles.benefitDesc}>{t('support.vip.benefit_fame_desc')}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Upgrade Button */}
                        <TouchableOpacity
                            style={[styles.purchaseButton, styles.vipButton]}
                            onPress={() => handlePurchase(upgradeVipPack || vipPack)}
                            disabled={isPurchasing}
                            activeOpacity={0.8}
                        >
                            {isPurchasing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.purchaseButtonText}>
                                    {upgradePrice !== '--'
                                        ? `${t('support.vip.upgrade_button')} • ${upgradePrice}`
                                        : t('support.vip.upgrade_button')}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* ========================================================================= */}
                {/* CASO 3: ES VIP -> Oculta pagos y muestra Tarjeta de Agradecimiento        */}
                {/* ========================================================================= */}
                {isVip && (
                    <View style={[styles.tierCard, styles.vipCard, styles.tierCardActiveVip, { alignItems: 'center', paddingVertical: 28 }]}>
                        <LinearGradient
                            colors={['rgba(245, 158, 11, 0.18)', 'rgba(245, 158, 11, 0.04)', 'rgba(0, 0, 0, 0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                        />

                        <View style={[styles.tierIconContainer, { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(245, 158, 11, 0.2)', marginBottom: 16 }]}>
                            <MaterialCommunityIcons name="crown" size={38} color="#FBBF24" />
                        </View>

                        <Text style={[styles.tierName, { fontSize: 22, textAlign: 'center', marginBottom: 8 }]}>
                            {t('support.vip_thank_you_title')}
                        </Text>
                        <Text style={[styles.tierShortDesc, { textAlign: 'center', paddingHorizontal: 12, marginBottom: 20 }]}>
                            {t('support.vip_thank_you_desc')}
                        </Text>

                        {/* Active Perks List */}
                        <View style={{ width: '100%', gap: 10, paddingHorizontal: 10, marginBottom: 8 }}>
                            <View style={styles.vipActiveBenefitRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#FBBF24" />
                                <Text style={styles.vipActiveBenefitText}>{t('support.vip.benefit_color')}</Text>
                            </View>
                            <View style={styles.vipActiveBenefitRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#FBBF24" />
                                <Text style={styles.vipActiveBenefitText}>{t('support.vip.benefit_localcast')}</Text>
                            </View>
                            <View style={styles.vipActiveBenefitRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#FBBF24" />
                                <Text style={styles.vipActiveBenefitText}>{t('support.vip.benefit_stats')}</Text>
                            </View>
                            <View style={styles.vipActiveBenefitRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#FBBF24" />
                                <Text style={styles.vipActiveBenefitText}>{t('support.vip.benefit_fame')}</Text>
                            </View>
                            <View style={styles.vipActiveBenefitRow}>
                                <Ionicons name="checkmark-circle" size={18} color="#FBBF24" />
                                <Text style={styles.vipActiveBenefitText}>{t('support.supporter.benefit_icons')}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* --- TIER 3: DONACIÓN LIBRE KO-FI (Marrón / Warm Coffee) - Visible para todos --- */}
                <View style={[styles.tierCard, styles.kofiCard]}>
                    <LinearGradient
                        colors={['rgba(180, 83, 9, 0.16)', 'rgba(0, 0, 0, 0)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />

                    <View style={styles.tierHeader}>
                        <View style={styles.tierHeaderLeft}>
                            <View style={[styles.tierIconContainer, styles.kofiIconContainer]}>
                                <Ionicons name="cafe" size={24} color="#D97706" />
                            </View>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.tierName}>{t('support.kofi.name')}</Text>
                                    <View style={styles.kofiBadge}>
                                        <Text style={styles.kofiBadgeText}>{t('support.kofi.badge')}</Text>
                                    </View>
                                </View>
                                <Text style={styles.tierPaymentType}>{t('support.kofi.type')}</Text>
                            </View>
                        </View>
                        <View style={styles.priceContainer}>
                            <Text style={[styles.tierPrice, { color: '#D97706' }]}>Ko-fi</Text>
                        </View>
                    </View>

                    <Text style={styles.tierShortDesc}>{t('support.kofi.short_desc')}</Text>

                    <View style={styles.benefitList}>
                        <View style={styles.benefitItem}>
                            <View style={[styles.benefitBullet, styles.kofiBullet]}>
                                <Ionicons name="heart-outline" size={14} color="#D97706" />
                            </View>
                            <View style={styles.benefitTexts}>
                                <Text style={styles.benefitTitle}>{t('support.kofi.benefit_direct')}</Text>
                                <Text style={styles.benefitDesc}>{t('support.kofi.benefit_direct_desc')}</Text>
                            </View>
                        </View>

                        <View style={styles.benefitItem}>
                            <View style={[styles.benefitBullet, styles.kofiBullet]}>
                                <Ionicons name="gift-outline" size={14} color="#D97706" />
                            </View>
                            <View style={styles.benefitTexts}>
                                <Text style={styles.benefitTitle}>{t('support.kofi.benefit_custom')}</Text>
                                <Text style={styles.benefitDesc}>{t('support.kofi.benefit_custom_desc')}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Ko-fi Action Button */}
                    <TouchableOpacity
                        style={[styles.purchaseButton, styles.kofiButton]}
                        onPress={() => Linking.openURL('https://ko-fi.com/pescalerag')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="cafe" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.purchaseButtonText}>
                            {t('support.kofi.button')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Restore Purchases Button */}
                <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={handleRestore}
                    disabled={isRestoring}
                    activeOpacity={0.7}
                >
                    {isRestoring ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                        <>
                            <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.restoreButtonText}>{t('support.restore_purchases')}</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Disclaimer */}
                <Text style={styles.disclaimerText}>{t('support.disclaimer')}</Text>
                    </>
                )}
            </ScrollView>

            {/* Modal para captura de alias de Hall of Fame tras compra */}
            <HallOfFameModal
                visible={isHofModalVisible}
                onClose={() => setIsHofModalVisible(false)}
                tier={purchasedTier}
            />
        </View>
    );
}

const getStyles = (
    colors: any,
    fonts: any,
    layout: any,
    spacing: any = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radii: any = { sm: 4, md: 8, lg: 12, full: 9999 },
    fontWeights: any = { regular: '400', semiBold: '600', bold: '700' }
) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: colors.text,
        fontSize: 17,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    // Intro
    introCard: {
        borderRadius: radii.lg || 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(20, 184, 166, 0.25)',
        alignItems: 'center',
    },
    introIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(20, 184, 166, 0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    introTitle: {
        color: colors.text,
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
    },
    introDescription: {
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: fonts.regular,
        textAlign: 'center',
        marginBottom: 16,
    },
    currentTierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    currentTierLabel: {
        color: colors.textSecondary,
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        gap: 4,
    },
    statusBadgeSupporter: {
        backgroundColor: 'rgba(20, 184, 166, 0.18)',
        borderColor: '#14B8A6',
    },
    statusBadgeVip: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: '#F59E0B',
    },
    statusBadgeText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '800',
    },
    statusBadgeTextSupporter: {
        color: '#2DD4BF',
    },
    statusBadgeTextVip: {
        color: '#FBBF24',
    },
    // Tier Cards
    tierCard: {
        backgroundColor: colors.cardBackground,
        borderRadius: radii.lg || 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
    },
    supporterCard: {
        borderColor: 'rgba(20, 184, 166, 0.25)',
    },
    vipCard: {
        borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    tierCardActiveVip: {
        borderColor: '#FBBF24',
    },
    kofiCard: {
        borderColor: 'rgba(180, 83, 9, 0.35)',
    },
    kofiIconContainer: {
        backgroundColor: 'rgba(180, 83, 9, 0.22)',
    },
    kofiBadge: {
        backgroundColor: 'rgba(180, 83, 9, 0.25)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    kofiBadgeText: {
        color: '#D97706',
        fontSize: 9,
        fontWeight: '900',
    },
    kofiBullet: {
        backgroundColor: 'rgba(180, 83, 9, 0.22)',
    },
    kofiButton: {
        flexDirection: 'row',
        backgroundColor: '#92400E',
    },
    tierHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    tierHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tierIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tierName: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    popularBadge: {
        backgroundColor: 'rgba(245, 158, 11, 0.3)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    popularBadgeText: {
        color: '#FBBF24',
        fontSize: 9,
        fontWeight: '900',
    },
    tierPaymentType: {
        color: colors.textSecondary,
        fontSize: 11,
        fontFamily: fonts.regular,
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    tierPrice: {
        color: colors.accentLight || '#A78BFA',
        fontSize: 20,
        fontFamily: fonts.regular,
        fontWeight: '800',
    },
    tierShortDesc: {
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
        fontFamily: fonts.regular,
        marginBottom: 16,
    },
    benefitList: {
        gap: 12,
        marginBottom: 20,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    benefitBullet: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(20, 184, 166, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
    },
    benefitTexts: {
        flex: 1,
    },
    benefitTitle: {
        color: colors.text,
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
        marginBottom: 2,
    },
    benefitDesc: {
        color: colors.textSecondary,
        fontSize: 12,
        lineHeight: 16,
        fontFamily: fonts.regular,
    },
    purchaseButton: {
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    supporterButton: {
        backgroundColor: '#0D9488',
    },
    vipButton: {
        backgroundColor: '#D97706',
    },
    reactivateButton: {
        backgroundColor: '#D97706',
    },
    purchaseButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: fonts.regular,
        fontWeight: 'bold',
    },
    // Orphaned Upgrade Banner
    orphanedUpgradeBanner: {
        borderRadius: radii.lg || 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(245, 158, 11, 0.45)',
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        overflow: 'hidden',
    },
    orphanedUpgradeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    orphanedUpgradeIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    orphanedUpgradeTitle: {
        color: '#FBBF24',
        fontSize: 15,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    orphanedUpgradeDesc: {
        color: colors.text,
        fontSize: 13,
        lineHeight: 19,
        fontFamily: fonts.regular,
        marginBottom: 12,
        opacity: 0.9,
    },
    orphanedUpgradeHintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    orphanedUpgradeHintText: {
        color: '#FDE68A',
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.semiBold,
        flex: 1,
    },
    reactivateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.5)',
    },
    reactivateBadgeText: {
        color: '#FBBF24',
        fontSize: 10,
        fontWeight: '800',
    },
    vipActiveBenefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 2,
    },
    vipActiveBenefitText: {
        color: colors.text,
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    // Restore & Disclaimer
    restoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        marginBottom: 12,
    },
    restoreButtonText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontFamily: fonts.regular,
        fontWeight: fontWeights.bold,
    },
    disclaimerText: {
        color: colors.textSecondary,
        fontSize: 11,
        lineHeight: 16,
        fontFamily: fonts.regular,
        textAlign: 'center',
        opacity: 0.6,
        paddingHorizontal: 16,
    },
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    tabButton: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#282828',
    },
    activeTab: {
        backgroundColor: colors.accent || '#8B5CF6',
    },
    tabText: {
        color: '#B3B3B3',
        fontFamily: fonts.semiBold,
    },
    activeTabText: {
        color: '#FFFFFF',
    },
});
