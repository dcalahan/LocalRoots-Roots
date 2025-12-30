import { createConnector } from 'wagmi';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'wagmi/chains';
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem';
import type { Abi, Address } from 'viem';

// Use explicit RPC URL for consistent data
const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

// Only use in development - this private key should only have testnet funds!
const TEST_PRIVATE_KEY = process.env.NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY as `0x${string}` | undefined;

export function isTestWalletAvailable(): boolean {
  // Just check if the private key is available
  // NEXT_PUBLIC_ variables are available in the browser
  return !!TEST_PRIVATE_KEY;
}

// Get the test wallet account (for direct viem usage)
export function getTestWalletAccount() {
  if (!TEST_PRIVATE_KEY) return null;
  return privateKeyToAccount(TEST_PRIVATE_KEY);
}

// Get a wallet client for direct transaction sending (bypasses wagmi)
export function getTestWalletClient() {
  if (!TEST_PRIVATE_KEY) return null;
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

// Helper to send a contract write directly via test wallet
export async function testWalletWriteContract<TAbi extends Abi>({
  address,
  abi,
  functionName,
  args,
  gas,
}: {
  address: Address;
  abi: TAbi;
  functionName: string;
  args: unknown[];
  gas?: bigint;
}) {
  console.log('[testWalletWriteContract] Called with:', {
    address,
    functionName,
    argsCount: args.length,
    gas: gas?.toString(),
    hasPrivateKey: !!TEST_PRIVATE_KEY
  });

  const walletClient = getTestWalletClient();
  if (!walletClient) {
    console.error('[testWalletWriteContract] Wallet client not available');
    throw new Error('Test wallet not available - private key may be missing');
  }

  console.log('[testWalletWriteContract] Wallet address:', walletClient.account.address);

  let data: `0x${string}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data = encodeFunctionData({
      abi: abi as any,
      functionName,
      args,
    } as any);
    console.log('[testWalletWriteContract] Encoded data length:', data.length);
  } catch (encodeErr) {
    console.error('[testWalletWriteContract] Failed to encode function data:', encodeErr);
    throw new Error(`Failed to encode transaction: ${encodeErr instanceof Error ? encodeErr.message : 'Unknown error'}`);
  }

  console.log('[testWalletWriteContract] Sending transaction to:', address);

  try {
    const hash = await walletClient.sendTransaction({
      to: address,
      data,
      gas: gas || 500000n,
    });
    console.log('[testWalletWriteContract] Transaction sent:', hash);
    return hash;
  } catch (sendErr) {
    console.error('[testWalletWriteContract] sendTransaction failed:', sendErr);
    // Re-throw with more context
    if (sendErr instanceof Error) {
      if (sendErr.message.includes('insufficient funds')) {
        throw new Error('Insufficient ETH for gas fees. Please add testnet ETH to your wallet.');
      }
      throw sendErr;
    }
    throw new Error(`Transaction failed: ${String(sendErr)}`);
  }
}

export function testWalletConnector() {
  if (!TEST_PRIVATE_KEY) {
    throw new Error('TEST_PRIVATE_KEY not configured');
  }

  const account = privateKeyToAccount(TEST_PRIVATE_KEY);

  // Create clients once with explicit RPC URL
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return createConnector((config) => ({
    id: 'testWallet',
    name: 'Test Wallet (Dev Only)',
    type: 'testWallet',

    // @ts-expect-error - wagmi connector type is overly strict for test wallet
    async connect() {
      return {
        accounts: [account.address],
        chainId: baseSepolia.id,
      };
    },

    async disconnect() {
      // No-op for test wallet
    },

    async getAccounts() {
      return [account.address];
    },

    async getChainId() {
      return baseSepolia.id;
    },

    async getProvider() {
      console.log('[TestWallet] getProvider called');
      return {
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          console.log(`[TestWallet] Provider.request called: ${method}`, params);
          switch (method) {
            case 'eth_accounts':
              return [account.address];
            case 'eth_chainId':
              return `0x${baseSepolia.id.toString(16)}`;
            case 'eth_sendTransaction':
              console.log('[TestWallet] Handling eth_sendTransaction', params);
              if (params?.[0]) {
                try {
                  const txParams = {
                    to: params[0].to as `0x${string}`,
                    value: params[0].value ? BigInt(params[0].value) : undefined,
                    data: params[0].data as `0x${string}`,
                    gas: params[0].gas ? BigInt(params[0].gas) : undefined,
                  };
                  console.log('[TestWallet] Sending transaction with params:', txParams);
                  const hash = await walletClient.sendTransaction(txParams);
                  console.log('[TestWallet] Transaction sent, hash:', hash);
                  return hash;
                } catch (error) {
                  console.error('[TestWallet] sendTransaction error:', error);
                  throw error;
                }
              }
              throw new Error('Invalid transaction params');
            case 'personal_sign':
            case 'eth_sign':
              if (params?.[0] && params?.[1]) {
                const signature = await walletClient.signMessage({
                  message: { raw: params[0] as `0x${string}` },
                });
                return signature;
              }
              throw new Error('Invalid sign params');
            // Pass through read operations to public client
            case 'eth_estimateGas':
            case 'eth_call':
            case 'eth_getBalance':
            case 'eth_getCode':
            case 'eth_getTransactionCount':
            case 'eth_getTransactionReceipt':
            case 'eth_getTransactionByHash':
            case 'eth_blockNumber':
            case 'eth_getBlockByNumber':
            case 'eth_getBlockByHash':
            case 'eth_gasPrice':
            case 'eth_maxPriorityFeePerGas':
            case 'eth_feeHistory':
            case 'eth_getLogs':
              console.log(`[TestWallet] Forwarding ${method} to RPC`);
              // Forward to public RPC
              const rpcUrl = 'https://sepolia.base.org';
              const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: Date.now(),
                  method,
                  params: params || [],
                }),
              });
              const data = await response.json();
              console.log(`[TestWallet] ${method} response:`, data);
              if (data.error) {
                throw new Error(data.error.message || 'RPC error');
              }
              return data.result;
            default:
              console.warn(`Test wallet: Method ${method} not explicitly handled, trying RPC`);
              // Try forwarding unknown methods to RPC
              try {
                const resp = await fetch(baseSepolia.rpcUrls.default.http[0], {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params: params || [],
                  }),
                });
                const result = await resp.json();
                if (result.error) {
                  throw new Error(result.error.message || 'RPC error');
                }
                return result.result;
              } catch (e) {
                throw new Error(`Method ${method} not supported`);
              }
          }
        },
      };
    },

    async isAuthorized() {
      return true;
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  }));
}
