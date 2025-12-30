#!/bin/bash
source .env
echo "Using key starting with: ${PRIVATE_KEY:0:10}..."
ETH_RPC_URL=https://sepolia.base.org forge create src/AmbassadorRewards.sol:AmbassadorRewards \
  --constructor-args 0x509dd8D46E66C6B6591c111551C6E6039941E63C \
  --private-key "$PRIVATE_KEY"
