/**
 * fetchPrivyUsers.ts
 *
 * Fetches all Privy users and their embedded wallet addresses via the Privy REST API.
 * Used to identify which Seeds earners should receive direct ROOTS transfers vs Merkle claims.
 *
 * Usage:
 *   npx ts-node scripts/distribution/fetchPrivyUsers.ts
 *
 * Environment Variables:
 *   PRIVY_APP_ID - Your Privy app ID
 *   PRIVY_APP_SECRET - Your Privy app secret (Management API)
 *
 * Output:
 *   - privy-users.json - All Privy users with their embedded wallet addresses
 *   - privy-wallets.txt - Just the wallet addresses (one per line)
 */

import * as fs from 'fs';
import * as path from 'path';

const PRIVY_API_URL = 'https://auth.privy.io/api/v1/users';
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';

interface LinkedAccount {
  type: string;
  address?: string;
  number?: string;
  chainType?: string;
  walletClientType?: string;
  connectorType?: string;
  recoveryMethod?: string;
  imported?: boolean;
  delegated?: boolean;
}

interface PrivyUser {
  id: string;
  createdAt: string;
  linkedAccounts: LinkedAccount[];
  hasAcceptedTerms?: boolean;
  isGuest?: boolean;
}

interface PrivyUserOutput {
  userId: string;
  walletAddress: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

interface UsersResponse {
  data: PrivyUser[];
  next_cursor?: string;
}

/**
 * Create Basic Auth header for Privy API
 */
function createAuthHeader(): string {
  const credentials = `${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`;
  const encoded = Buffer.from(credentials).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Fetch all users from Privy API with pagination
 */
async function fetchAllPrivyUsers(): Promise<PrivyUser[]> {
  const allUsers: PrivyUser[] = [];
  let cursor: string | undefined;
  const limit = 100;

  console.log('Fetching users from Privy API...');

  while (true) {
    const url = new URL(PRIVY_API_URL);
    url.searchParams.set('limit', limit.toString());
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': createAuthHeader(),
          'privy-app-id': PRIVY_APP_ID,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Privy API error ${response.status}: ${errorText}`);
      }

      const result: UsersResponse = await response.json();
      const users = result.data || [];

      if (users.length === 0) break;

      allUsers.push(...users);
      console.log(`  Fetched ${allUsers.length} users...`);

      if (!result.next_cursor) break;
      cursor = result.next_cursor;

    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  console.log(`Total users fetched: ${allUsers.length}`);
  return allUsers;
}

/**
 * Extract embedded wallet addresses from Privy users
 * Only includes users with Privy-created embedded wallets (walletClientType: 'privy')
 */
function extractEmbeddedWallets(users: PrivyUser[]): PrivyUserOutput[] {
  const output: PrivyUserOutput[] = [];

  for (const user of users) {
    // Find the Privy embedded wallet (Ethereum)
    const embeddedWallet = user.linkedAccounts.find(
      (account) =>
        account.type === 'wallet' &&
        account.walletClientType === 'privy' &&
        account.chainType === 'ethereum' &&
        account.address
    );

    if (!embeddedWallet || !embeddedWallet.address) {
      continue; // Skip users without embedded wallets
    }

    // Find email if linked
    const emailAccount = user.linkedAccounts.find(
      (account) => account.type === 'email' && account.address
    );

    // Find phone if linked
    const phoneAccount = user.linkedAccounts.find(
      (account) => account.type === 'phone' && account.number
    );

    output.push({
      userId: user.id,
      walletAddress: embeddedWallet.address.toLowerCase(),
      email: emailAccount?.address,
      phone: phoneAccount?.number,
      createdAt: user.createdAt,
    });
  }

  return output;
}

async function main() {
  console.log('=== Privy Users Fetcher ===\n');

  // Validate environment
  if (!PRIVY_APP_ID) {
    console.error('Error: PRIVY_APP_ID environment variable is required');
    console.error('Set PRIVY_APP_ID or NEXT_PUBLIC_PRIVY_APP_ID');
    process.exit(1);
  }

  if (!PRIVY_APP_SECRET) {
    console.error('Error: PRIVY_APP_SECRET environment variable is required');
    console.error('Get your app secret from the Privy Dashboard');
    process.exit(1);
  }

  // Fetch all users
  const users = await fetchAllPrivyUsers();

  if (users.length === 0) {
    console.log('No users found in Privy.');
    process.exit(0);
  }

  // Extract embedded wallet addresses
  console.log('\nExtracting embedded wallet addresses...');
  const embeddedWalletUsers = extractEmbeddedWallets(users);

  console.log(`\nSummary:`);
  console.log(`  Total Privy users: ${users.length}`);
  console.log(`  Users with embedded wallets: ${embeddedWalletUsers.length}`);
  console.log(`  Users without embedded wallets: ${users.length - embeddedWalletUsers.length}`);

  // Output directory
  const outputDir = path.join(__dirname, '../../distribution-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save full user data
  const usersOutputPath = path.join(outputDir, 'privy-users.json');
  fs.writeFileSync(usersOutputPath, JSON.stringify(embeddedWalletUsers, null, 2));
  console.log(`\nSaved: ${usersOutputPath}`);

  // Save just wallet addresses (for quick filtering)
  const walletsOutputPath = path.join(outputDir, 'privy-wallets.txt');
  const walletAddresses = embeddedWalletUsers.map((u) => u.walletAddress).join('\n');
  fs.writeFileSync(walletsOutputPath, walletAddresses);
  console.log(`Saved: ${walletsOutputPath}`);

  // Also save as a Set-compatible JSON for easy import
  const walletsSetPath = path.join(outputDir, 'privy-wallets.json');
  fs.writeFileSync(
    walletsSetPath,
    JSON.stringify(embeddedWalletUsers.map((u) => u.walletAddress), null, 2)
  );
  console.log(`Saved: ${walletsSetPath}`);

  console.log('\n=== Fetch Complete ===');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
