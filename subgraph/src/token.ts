import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/RootsToken/RootsToken";
import { TokenHolder, Transfer } from "../generated/schema";

let ZERO_ADDRESS = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

function getOrCreateHolder(address: Address): TokenHolder {
  let holder = TokenHolder.load(address.toHexString());
  if (!holder) {
    holder = new TokenHolder(address.toHexString());
    holder.balance = BigInt.fromI32(0);
    holder.totalReceived = BigInt.fromI32(0);
    holder.totalSent = BigInt.fromI32(0);
    holder.transferCount = BigInt.fromI32(0);
  }
  return holder;
}

export function handleTransfer(event: TransferEvent): void {
  // Create transfer record
  let transferId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let transfer = new Transfer(transferId);
  transfer.from = event.params.from;
  transfer.to = event.params.to;
  transfer.amount = event.params.value;
  transfer.timestamp = event.block.timestamp;
  transfer.txHash = event.transaction.hash;
  transfer.blockNumber = event.block.number;
  transfer.save();

  // Update sender (if not mint)
  if (event.params.from != ZERO_ADDRESS) {
    let sender = getOrCreateHolder(event.params.from);
    sender.balance = sender.balance.minus(event.params.value);
    sender.totalSent = sender.totalSent.plus(event.params.value);
    sender.transferCount = sender.transferCount.plus(BigInt.fromI32(1));
    sender.save();
  }

  // Update receiver (if not burn)
  if (event.params.to != ZERO_ADDRESS) {
    let receiver = getOrCreateHolder(event.params.to);
    receiver.balance = receiver.balance.plus(event.params.value);
    receiver.totalReceived = receiver.totalReceived.plus(event.params.value);
    receiver.transferCount = receiver.transferCount.plus(BigInt.fromI32(1));
    receiver.save();
  }
}
