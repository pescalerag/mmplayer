// These source transforms are used only while building the standalone beta.
// The build script restores both files, including when Gradle fails.
function enableBetaVipSettings(source) {
  const updated = source.replace("userTier: 'USER',", "userTier: 'VIP',")
    .replace('setUserTier: (tier) => set({ userTier: tier }),', "setUserTier: (_tier) => set({ userTier: 'VIP' }),")
    .replace('if (!state) return;', "if (!state) return;\n                state.setUserTier('VIP');");
  if (!updated.includes("setUserTier: (_tier) => set({ userTier: 'VIP' })")) {
    throw new Error('Expected tier configuration not found');
  }
  return updated;
}

function enableBetaVipPurchases(source) {
  const signature = 'public determineUserStatus(customerInfo: CustomerInfo | null): {';
  if (!source.includes(signature)) throw new Error('Expected purchase tier resolver not found');
  // Keep the real resolver intact under a private name. All public status paths,
  // including startup/listener refreshes, must agree with the beta's VIP store.
  return source.replace(signature, `public determineUserStatus(_customerInfo: CustomerInfo | null): {
        tier: UserTier;
        hasOrphanedUpgrade: boolean;
    } {
        return { tier: 'VIP', hasOrphanedUpgrade: false };
    }

    private determinePurchasedUserStatus(customerInfo: CustomerInfo | null): {`);
}

module.exports = { enableBetaVipSettings, enableBetaVipPurchases };
