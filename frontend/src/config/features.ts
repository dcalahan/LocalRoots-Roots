/**
 * Feature flags for the application
 * Controlled via environment variables
 */

export const features = {
  /**
   * Enable "Browse All Listings" page
   * When false, only location-based discovery is available
   */
  browseAllListings: process.env.NEXT_PUBLIC_ENABLE_BROWSE_ALL === 'true',

  /**
   * Enable wallet connection for blockchain transactions
   * When false, app runs in "demo mode" without real transactions
   */
  walletEnabled: true,

  /**
   * Show ETH equivalent prices alongside ROOTS
   */
  showEthEquivalent: true,
} as const;

export type FeatureFlags = typeof features;
