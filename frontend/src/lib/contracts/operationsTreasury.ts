import { type Address } from 'viem';

// Contract address - will be set after deployment
export const OPERATIONS_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_OPERATIONS_TREASURY_ADDRESS as Address | undefined;

// ABI for the Operations Treasury contract
export const OPERATIONS_TREASURY_ABI = [
  // View functions
  {
    inputs: [],
    name: 'safe',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'usdc',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getServiceIds',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'serviceId', type: 'bytes32' }],
    name: 'getServiceConfig',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'address', name: 'payee', type: 'address' },
          { internalType: 'uint256', name: 'monthlyBudget', type: 'uint256' },
          { internalType: 'uint256', name: 'currentSpend', type: 'uint256' },
          { internalType: 'uint256', name: 'lastResetTime', type: 'uint256' },
          { internalType: 'bool', name: 'active', type: 'bool' },
          { internalType: 'bool', name: 'requiresOfframp', type: 'bool' },
        ],
        internalType: 'struct IOperationsTreasury.ServiceConfig',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'serviceId', type: 'bytes32' }],
    name: 'getPaymentCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { internalType: 'uint256', name: 'index', type: 'uint256' },
    ],
    name: 'getPaymentRecord',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'string', name: 'usageIpfsHash', type: 'string' },
          { internalType: 'address', name: 'proposedBy', type: 'address' },
          { internalType: 'bool', name: 'executed', type: 'bool' },
        ],
        internalType: 'struct IOperationsTreasury.PaymentRecord',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'canSpend',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'serviceId', type: 'bytes32' }],
    name: 'getRemainingBudget',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'name', type: 'string' }],
    name: 'generateServiceId',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'pure',
    type: 'function',
  },
  // Admin functions (Safe only)
  {
    inputs: [
      { internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'address', name: 'payee', type: 'address' },
      { internalType: 'uint256', name: 'monthlyBudget', type: 'uint256' },
      { internalType: 'bool', name: 'requiresOfframp', type: 'bool' },
    ],
    name: 'configureService',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { internalType: 'address', name: 'payee', type: 'address' },
      { internalType: 'uint256', name: 'monthlyBudget', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
    ],
    name: 'updateService',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'string', name: 'usageIpfsHash', type: 'string' },
    ],
    name: 'executePayment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'serviceId', type: 'bytes32' }],
    name: 'resetMonthlySpend',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'newSafe', type: 'address' }],
    name: 'updateSafe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'withdrawUSDC',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'address', name: 'payee', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'monthlyBudget', type: 'uint256' },
      { indexed: false, internalType: 'bool', name: 'requiresOfframp', type: 'bool' },
    ],
    name: 'ServiceConfigured',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { indexed: false, internalType: 'address', name: 'payee', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'monthlyBudget', type: 'uint256' },
      { indexed: false, internalType: 'bool', name: 'active', type: 'bool' },
    ],
    name: 'ServiceUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { indexed: true, internalType: 'uint256', name: 'paymentIndex', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'usageIpfsHash', type: 'string' },
      { indexed: false, internalType: 'address', name: 'proposedBy', type: 'address' },
    ],
    name: 'PaymentProposed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { indexed: true, internalType: 'uint256', name: 'paymentIndex', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'payee', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'usageIpfsHash', type: 'string' },
    ],
    name: 'PaymentExecuted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'serviceId', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'previousSpend', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'resetTime', type: 'uint256' },
    ],
    name: 'MonthlyBudgetReset',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'oldSafe', type: 'address' },
      { indexed: true, internalType: 'address', name: 'newSafe', type: 'address' },
    ],
    name: 'SafeUpdated',
    type: 'event',
  },
] as const;
