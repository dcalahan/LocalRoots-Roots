import { encodeFunctionData, type Address } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { publicClient } from './clients';
import {
  FORWARDER_ADDRESS,
  forwarderAbi,
  forwarderDomain,
  forwardRequestTypes,
} from './contracts';

const RELAY_API_URL = process.env.RELAY_API_URL || 'https://www.localroots.love/api/relay';

interface GaslessParams {
  account: PrivateKeyAccount;
  to: Address;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
  gas?: bigint;
}

/**
 * Execute a gasless meta-transaction via the relay API.
 * Replicates the frontend's EIP-712 flow without Privy.
 */
export async function executeGasless(params: GaslessParams): Promise<`0x${string}`> {
  const { account, to, abi, functionName, args, gas = 500_000n } = params;
  const from = account.address;

  // 1. Encode the function call
  const data = encodeFunctionData({ abi, functionName, args });

  // 2. Get current nonce
  const nonce = await publicClient.readContract({
    address: FORWARDER_ADDRESS,
    abi: forwarderAbi,
    functionName: 'nonces',
    args: [from],
  }) as bigint;

  // 3. Deadline = 10 minutes from now
  const deadline = Math.floor(Date.now() / 1000) + 600;

  // 4. Build forward request message
  const message = {
    from,
    to,
    value: 0n,
    gas,
    nonce,
    deadline,
    data,
  };

  console.log(`[Gasless] ${functionName} from=${from.slice(0, 10)}... nonce=${nonce}`);

  // 5. Sign EIP-712 typed data
  const signature = await account.signTypedData({
    domain: {
      name: forwarderDomain.name,
      version: forwarderDomain.version,
      chainId: BigInt(forwarderDomain.chainId),
      verifyingContract: FORWARDER_ADDRESS,
    },
    types: forwardRequestTypes,
    primaryType: 'ForwardRequest',
    message,
  });

  // 6. POST to relay API
  const response = await fetch(RELAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forwardRequest: {
        from: message.from,
        to: message.to,
        value: message.value.toString(),
        gas: message.gas.toString(),
        nonce: message.nonce.toString(),
        deadline: message.deadline,
        data: message.data,
      },
      signature,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    // Rate limit — wait and retry once
    if (response.status === 429) {
      console.log('[Gasless] Rate limited. Waiting 60s...');
      await new Promise(r => setTimeout(r, 60_000));
      return executeGasless(params); // Retry
    }
    // Nonce conflict — wait and retry once
    if (response.status === 500 && result.error?.includes('nonce')) {
      console.log('[Gasless] Nonce conflict. Waiting 10s and retrying...');
      await new Promise(r => setTimeout(r, 10_000));
      return executeGasless(params); // Retry with fresh nonce
    }
    throw new Error(`Relay failed (${response.status}): ${result.error || JSON.stringify(result)}`);
  }

  const txHash = result.transactionHash as `0x${string}`;
  console.log(`[Gasless] ${functionName} tx=${txHash}`);

  // 7. Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted: ${txHash}`);
  }

  // 8. Small delay after successful relay to let relayer nonce sync
  await new Promise(r => setTimeout(r, 3_000));

  return txHash;
}
