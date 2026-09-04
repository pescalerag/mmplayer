import { Platform } from 'react-native';
import Purchases, {
    PurchasesPackage,
    PurchasesOffering,
    CustomerInfo,
    LOG_LEVEL,
} from 'react-native-purchases';
import { useSettingsStore, UserTier } from '../store/useSettingsStore';

export const REVENUECAT_API_KEY = 'goog_HTJeRftEdHZyFEPgUaoImYqscOg';

export const ENTITLEMENT_IDS = {
    SUPPORTER: 'supporter',
    VIP: 'vip',
};

export const PRODUCT_IDS = {
    SUPPORTER: 'supporter',
    VIP: 'vip',
    UPGRADE_VIP: 'upgrade_vip',
};

class PurchasesServiceImpl {
    private isInitialized = false;

    /**
     * Helper to compute user tier & status from CustomerInfo using ONLY active entitlements
     * and strict Upgrade validation.
     * 
     * Security Rule:
     * If VIP was acquired via an Upgrade package (e.g. 'upgrade_vip'), we strictly require
     * that the base Supporter product is ALSO active.
     * 
     * Scenarios:
     * 1. Direct VIP purchase (non-upgrade product) -> VIP, hasOrphanedUpgrade: false
     * 2. Supporter + Upgrade VIP active -> VIP, hasOrphanedUpgrade: false
     * 3. Upgrade VIP active but Supporter refunded/inactive -> USER, hasOrphanedUpgrade: true
     * 4. Upgrade refunded but Supporter active -> SUPPORTER, hasOrphanedUpgrade: false
     * 5. Both refunded/inactive -> USER, hasOrphanedUpgrade: false
     */
    public determineUserStatus(customerInfo: CustomerInfo | null): {
        tier: UserTier;
        hasOrphanedUpgrade: boolean;
    } {
        if (!customerInfo) {
            return { tier: 'USER', hasOrphanedUpgrade: false };
        }

        const activeEntitlements = customerInfo.entitlements?.active || {};

        // 1. Find active VIP entitlement if any
        const vipEntitlement =
            activeEntitlements[ENTITLEMENT_IDS.VIP] ||
            activeEntitlements['VIP'] ||
            Object.values(activeEntitlements).find(e =>
                e.identifier?.toLowerCase().includes('vip') ||
                e.productIdentifier?.toLowerCase().includes('vip')
            );

        // 2. Find active Supporter entitlement if any (excluding upgrade identifiers)
        const supporterEntitlement =
            activeEntitlements[ENTITLEMENT_IDS.SUPPORTER] ||
            activeEntitlements['SUPPORTER'] ||
            Object.values(activeEntitlements).find(e => {
                const id = e.identifier?.toLowerCase() || '';
                const prodId = e.productIdentifier?.toLowerCase() || '';
                return (
                    (id.includes('supporter') || prodId.includes('supporter')) &&
                    !id.includes('upgrade') &&
                    !prodId.includes('upgrade')
                );
            });

        // 3. Find explicit Upgrade entitlement if configured as a standalone entitlement
        const upgradeEntitlement =
            activeEntitlements['upgrade'] ||
            activeEntitlements['UPGRADE'] ||
            activeEntitlements['upgrade_vip'] ||
            activeEntitlements['UPGRADE_VIP'] ||
            Object.values(activeEntitlements).find(e => {
                const id = e.identifier?.toLowerCase() || '';
                const prodId = e.productIdentifier?.toLowerCase() || '';
                return id.includes('upgrade') || prodId.includes('upgrade');
            });

        const isVipEntitlementActive = Boolean(vipEntitlement && vipEntitlement.isActive);
        const isSupporterActive = Boolean(supporterEntitlement && supporterEntitlement.isActive);
        const isUpgradeEntitlementActive = Boolean(upgradeEntitlement && upgradeEntitlement.isActive);

        if (isVipEntitlementActive) {
            const vipProduct = (vipEntitlement?.productIdentifier || '').toLowerCase();
            const vipEntId = (vipEntitlement?.identifier || '').toLowerCase();
            const isUpgrade =
                vipProduct.includes('upgrade') ||
                vipProduct === PRODUCT_IDS.UPGRADE_VIP ||
                vipEntId.includes('upgrade');

            if (isUpgrade) {
                // If VIP was unlocked via Upgrade, require active Supporter base purchase
                if (isSupporterActive) {
                    return { tier: 'VIP', hasOrphanedUpgrade: false };
                } else {
                    // Supporter was refunded or missing -> Drop to USER and flag orphaned upgrade
                    return { tier: 'USER', hasOrphanedUpgrade: true };
                }
            } else {
                // Direct full VIP purchase (does not require Supporter)
                return { tier: 'VIP', hasOrphanedUpgrade: false };
            }
        }

        // Handle case where Upgrade is its own separate entitlement
        if (isUpgradeEntitlementActive) {
            if (isSupporterActive) {
                return { tier: 'VIP', hasOrphanedUpgrade: false };
            } else {
                return { tier: 'USER', hasOrphanedUpgrade: true };
            }
        }

        if (isSupporterActive) {
            return { tier: 'SUPPORTER', hasOrphanedUpgrade: false };
        }

        return { tier: 'USER', hasOrphanedUpgrade: false };
    }

    /**
     * Helper to compute user tier from CustomerInfo and update hasOrphanedUpgrade in store.
     */
    public determineUserTier(customerInfo: CustomerInfo | null): UserTier {
        const { tier, hasOrphanedUpgrade } = this.determineUserStatus(customerInfo);
        useSettingsStore.getState().setHasOrphanedUpgrade(hasOrphanedUpgrade);
        return tier;
    }

    private handleTierUpdate(tier: UserTier) {
        useSettingsStore.getState().setUserTier(tier);
        if (tier === 'USER' && useSettingsStore.getState().appIcon !== 'DEFAULT') {
            useSettingsStore.getState().setAppIcon('DEFAULT');
            try {
                const { setAppIcon } = require('@howincodes/expo-dynamic-app-icon');
                setAppIcon('DEFAULT');
            } catch (e) {
                console.warn('Failed to reset app icon:', e);
            }
        }
    }

    /**
     * Refresh and sync customer info from RevenueCat / Google Play in real-time
     */
    public async syncCustomerInfo(): Promise<UserTier> {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') return 'USER';
        try {
            const customerInfo = await Purchases.getCustomerInfo();
            const tier = this.determineUserTier(customerInfo);
            this.handleTierUpdate(tier);
            return tier;
        } catch (error) {
            console.error('Error syncing customer info in PurchasesService:', error);
            return useSettingsStore.getState().userTier;
        }
    }

    /**
     * Initialize RevenueCat SDK on app startup
     */
    public async init(): Promise<void> {
        if (this.isInitialized) return;
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

        try {
            if (__DEV__) {
                await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
            } else {
                await Purchases.setLogLevel(LOG_LEVEL.WARN);
            }

            await Purchases.configure({ apiKey: REVENUECAT_API_KEY });

            // Listen for customer info updates (e.g. background purchase sync, restore, subscription changes)
            Purchases.addCustomerInfoUpdateListener((customerInfo) => {
                const newTier = this.determineUserTier(customerInfo);
                this.handleTierUpdate(newTier);
            });

            // Fetch initial customer info
            const initialInfo = await Purchases.getCustomerInfo();
            const currentTier = this.determineUserTier(initialInfo);
            this.handleTierUpdate(currentTier);

            this.isInitialized = true;
        } catch (error) {
            console.error('Error initializing RevenueCat PurchasesService:', error);
        }
    }

    /**
     * Fetch available offerings and packages from RevenueCat
     */
    public async getOfferings(): Promise<PurchasesOffering | null> {
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current) return offerings.current;
            if (offerings.all['default']) return offerings.all['default'];
            const allOfferings = Object.values(offerings.all);
            return allOfferings.length > 0 ? allOfferings[0] : null;
        } catch (error) {
            console.error('Error fetching offerings from RevenueCat:', error);
            return null;
        }
    }

    /**
     * Purchase a specific package
     */
    public async purchasePackage(pack: PurchasesPackage): Promise<{
        success: boolean;
        customerInfo?: CustomerInfo;
        userTier: UserTier;
        error?: any;
    }> {
        try {
            const { customerInfo } = await Purchases.purchasePackage(pack);
            const userTier = this.determineUserTier(customerInfo);
            useSettingsStore.getState().setUserTier(userTier);
            return {
                success: true,
                customerInfo,
                userTier,
            };
        } catch (error: any) {
            if (!error.userCancelled) {
                console.error('Error purchasing package in RevenueCat:', error);
            }
            return {
                success: false,
                userTier: useSettingsStore.getState().userTier,
                error,
            };
        }
    }

    /**
     * Restore previous purchases
     */
    public async restorePurchases(): Promise<{
        success: boolean;
        customerInfo?: CustomerInfo;
        userTier: UserTier;
        error?: any;
    }> {
        try {
            const customerInfo = await Purchases.restorePurchases();
            const userTier = this.determineUserTier(customerInfo);
            useSettingsStore.getState().setUserTier(userTier);
            return {
                success: true,
                customerInfo,
                userTier,
            };
        } catch (error) {
            console.error('Error restoring purchases in RevenueCat:', error);
            return {
                success: false,
                userTier: useSettingsStore.getState().userTier,
                error,
            };
        }
    }

    /**
     * Set the user's display name and custom attributes in RevenueCat for Hall of Fame
     */
    public async setHallOfFameAlias(alias: string, tier: UserTier): Promise<void> {
        if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
        try {
            const cleanAlias = alias.trim();
            if (cleanAlias) {
                await Purchases.setDisplayName(cleanAlias);
                await Purchases.setAttributes({
                    hall_of_fame_name: cleanAlias,
                    tier: tier,
                    submitted_at: new Date().toISOString(),
                });
            }
        } catch (error) {
            console.warn('Error setting Hall of Fame attributes in RevenueCat:', error);
        }
    }
}

export const PurchasesService = new PurchasesServiceImpl();
