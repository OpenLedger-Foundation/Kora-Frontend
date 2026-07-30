# Soroban Snapshot Token (Governance-Enabled)

A Soroban fungible token contract featuring state-of-the-art **balance snapshotting** support. This contract allows governance organizations (like DAOs) to record point-in-time balance snapshots and subsequently query any account's historical balance at a specific snapshot ID, primarily for secure, flash-loan-resistant voting-power calculations.

## Overview

In decentralized governance, naively querying current token balances for voting weight exposes the system to **flash loan attacks**—where a user borrows a large amount of tokens, votes, and returns the tokens in a single transaction block.

By utilizing a snapshot token, a DAO can announce a proposal and take a snapshot of all balances at a specific block or moment in time. When voting begins, each voter's voting power is read from that historical snapshot ID via `balance_at_snapshot(account, snapshot_id)`. Subsequent token transfers have no effect on the captured voting weights.

## Contract Interface

The smart contract exposes the following public interface:

- **`initialize(env: Env, admin: Address, decimals: u32, name: String, symbol: String)`**
  Initializes the contract metadata, set the admin, and sets total supply and snapshot counter to `0`. Can only be called once.
- **`mint(env: Env, to: Address, amount: i128)`**
  Mints a positive amount of new tokens to the specified receiver. Requires admin authorization. Records pre-change balance for the sparse-snapshot pattern.
- **`transfer(env: Env, from: Address, to: Address, amount: i128)`**
  Transfers `amount` of tokens from the sender to the receiver. Requires authorization of the `from` account. Records pre-change balances for both sender and receiver.
- **`balance(env: Env, account: Address) -> i128`**
  Returns the current balance of the specified account.
- **`create_snapshot(env: Env, caller: Address) -> u32`**
  Creates a new snapshot and returns the incremented snapshot ID. Requires admin authorization.
- **`balance_at_snapshot(env: Env, account: Address, snapshot_id: u32) -> i128`**
  Queries the balance of `account` exactly at the moment `snapshot_id` was created. Handles all edge cases gracefully.
- **`current_snapshot(env: Env) -> u32`**
  Returns the latest created snapshot ID.
- **`total_snapshots(env: Env) -> u32`**
  Returns the total number of snapshots created.
- **`decimals(env: Env) -> u32`**
  Returns the number of decimals.
- **`name(env: Env) -> String`**
  Returns the token name.
- **`symbol(env: Env) -> String`**
  Returns the token symbol.
- **`total_supply(env: Env) -> i128`**
  Returns the current total supply of the token.
- **`admin(env: Env) -> Address`**
  Returns the administrator's address.

## The Sparse-Snapshot Pattern

Naively copying and storing the balance of *every* account at *every* snapshot would require `O(holders * snapshot_count)` storage, resulting in astronomical transaction fees and unbound storage growth.

To avoid this, we implement the standard **sparse-snapshot pattern** (inspired by OpenZeppelin's `ERC20Snapshot`):
1. Balance histories are stored lazily: we only write a new snapshot entry for an account when its balance actually changes *after* a snapshot has been taken.
2. During `mint` or `transfer`, the contract checks if the current snapshot has already recorded the pre-change balance of the involved accounts. If not, the current balance is written to their snapshot history map first before the balance is updated.
3. This guarantees that each account's snapshot history grows at most by `1` entry per snapshot boundary crossed with transaction activity, completely independent of the total number of token holders.

### Historical Query Resolution

When querying `balance_at_snapshot(account, snapshot_id)`:
1. If the requested `snapshot_id` does not exist yet (i.e. is `0` or greater than `current_snapshot`), the contract returns a `SnapshotNotFound` error.
2. The contract searches the account's sparse snapshot records (stored as a sorted map of `snapshot_id -> balance`):
   - It finds the smallest recorded snapshot ID `k` such that `k >= snapshot_id`.
   - If found, the balance during `snapshot_id` is exactly the value recorded at `k` (because that was the pre-change balance stored during the first transaction after `snapshot_id` existed).
   - If no such key exists, it means the account has had **no activity** since `snapshot_id` was created, so its current balance is still exactly what it was during `snapshot_id`.
3. If an account has never held any tokens, querying returns `0` (given a valid snapshot ID), not an error.

## Step-by-Step Build & Test Guide

To compile and test the snapshot token example:

```bash
# 1. Navigate to the snapshot token directory
cd examples/tokens/04-snapshot-token

# 2. Run all unit tests
cargo test

# 3. Compile the contract to WASM release target
cargo build --target wasm32-unknown-unknown --release
```

## Concrete Governance Walkthrough

Below is a step-by-step example of how a DAO governance flow utilizes this token:

1. **Setup**: The DAO initializes the `SnapshotToken` and mints `100 GT` to Alice and `50 GT` to Bob.
2. **Proposal Created**: A new proposal is submitted to the DAO. To prevent voting manipulation, the DAO admin creates a snapshot:
   ```rust
   let snapshot_id = client.create_snapshot(&admin); // returns 1
   ```
3. **Voting Power Queried**: Alice has `100` votes and Bob has `50` votes at `snapshot_id = 1`.
4. **Subsequent Transfer**: Alice transfers `40 GT` to Bob after the snapshot was taken. Alice's current balance becomes `60 GT` and Bob's current balance becomes `90 GT`.
5. **Vote Counting**: When the voting contract tallies the votes:
   - Alice's voting weight = `client.balance_at_snapshot(&alice, &1)` -> returns `100`.
   - Bob's voting weight = `client.balance_at_snapshot(&bob, &1)` -> returns `50`.
   - The transfer that occurred after the snapshot did not alter their voting weight.

## Design Notes

- **Access Control for `create_snapshot`**: Creating snapshots is strictly restricted to the token `admin` using `caller.require_auth()`. This prevents griefing/spamming snapshot creation to block storage.
- **Unbounded Storage Prevention**: Balance history entries are entirely activity-driven. If an account is inactive, its history takes `0` additional bytes of storage regardless of how many snapshots are taken.
