import { createThirdwebClient, defineChain } from "thirdweb";

// thirdweb client ID - get from https://thirdweb.com/dashboard
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

// Only create client if we have a client ID
export const thirdwebClient = clientId
  ? createThirdwebClient({ clientId })
  : null;

export const hasThirdwebClient = !!clientId;

// Base Sepolia chain definition
export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpc: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  blockExplorers: [
    {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  ],
  testnet: true,
});
