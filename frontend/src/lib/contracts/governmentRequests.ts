import { type Address } from 'viem';

// Contract address on Base Sepolia - loaded from environment variable
export const GOVERNMENT_REQUESTS_ADDRESS: Address = (process.env.NEXT_PUBLIC_GOVERNMENT_REQUESTS_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;

// ABI for government requests functions
export const governmentRequestsAbi = [
  // Read functions
  {
    type: 'function',
    name: 'getRequest',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'requester', type: 'address' },
          { name: 'agencyName', type: 'string' },
          { name: 'agencyEmail', type: 'string' },
          { name: 'jurisdiction', type: 'string' },
          { name: 'requestType', type: 'string' },
          { name: 'justification', type: 'string' },
          { name: 'credentialsIpfs', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'votingEndsAt', type: 'uint256' },
          { name: 'votesApprove', type: 'uint256' },
          { name: 'votesDeny', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'approved', type: 'bool' },
          { name: 'dataExportIpfs', type: 'string' },
          { name: 'adminResolved', type: 'bool' },
          { name: 'adminReason', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveRequests',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllRequests',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVotedOnRequest',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'ambassadorId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getQualifiedVoterCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextRequestId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agencyLastRequest',
    inputs: [{ name: 'agencyName', type: 'string' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Constants
  {
    type: 'function',
    name: 'VOTE_DURATION',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_VOTES_REQUIRED',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'REQUEST_COOLDOWN',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'SEEDS_PER_VOTE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'submitRequest',
    inputs: [
      { name: 'agencyName', type: 'string' },
      { name: 'agencyEmail', type: 'string' },
      { name: 'jurisdiction', type: 'string' },
      { name: 'requestType', type: 'string' },
      { name: 'justification', type: 'string' },
      { name: 'credentialsIpfs', type: 'string' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'voteOnRequest',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'approve', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveRequest',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'adminResolveRequest',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'approve', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'uploadDataExport',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'dataExportIpfs', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'RequestSubmitted',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'requester', type: 'address', indexed: true },
      { name: 'agencyName', type: 'string', indexed: false },
      { name: 'jurisdiction', type: 'string', indexed: false },
      { name: 'requestType', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RequestVoteCast',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'ambassadorId', type: 'uint256', indexed: true },
      { name: 'votedApprove', type: 'bool', indexed: false },
      { name: 'seedsEarned', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RequestResolved',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'approved', type: 'bool', indexed: false },
      { name: 'totalVotes', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RequestAdminResolved',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'approved', type: 'bool', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DataExportUploaded',
    inputs: [
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'dataExportIpfs', type: 'string', indexed: false },
    ],
  },
] as const;

// DataRequest type for frontend use
export interface DataRequest {
  requester: Address;
  agencyName: string;
  agencyEmail: string;
  jurisdiction: string;
  requestType: string;
  justification: string;
  credentialsIpfs: string;
  createdAt: bigint;
  votingEndsAt: bigint;
  votesApprove: bigint;
  votesDeny: bigint;
  resolved: boolean;
  approved: boolean;
  dataExportIpfs: string;
  adminResolved: boolean;
  adminReason: string;
}
