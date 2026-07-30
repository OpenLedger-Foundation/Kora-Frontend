#![no_std]
#![allow(deprecated)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Map, String, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum SnapshotTokenError {
    AlreadyInitialized = 1,
    NotAuthorized = 2,
    InsufficientBalance = 3,
    SnapshotNotFound = 4,
    InvalidAmount = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Decimals,
    Name,
    Symbol,
    TotalSupply,
    Balances(Address),
    SnapshotCounter,
    SnapshotBalances(Address),
}

#[contract]
pub struct SnapshotToken;

#[contractimpl]
impl SnapshotToken {
    pub fn initialize(
        env: Env,
        admin: Address,
        decimals: u32,
        name: String,
        symbol: String,
    ) -> Result<(), SnapshotTokenError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(SnapshotTokenError::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Decimals, &decimals);
        env.storage().persistent().set(&DataKey::Name, &name);
        env.storage().persistent().set(&DataKey::Symbol, &symbol);
        env.storage()
            .persistent()
            .set(&DataKey::TotalSupply, &0i128);
        env.storage()
            .persistent()
            .set(&DataKey::SnapshotCounter, &0u32);
        Ok(())
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), SnapshotTokenError> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(SnapshotTokenError::InvalidAmount);
        }

        record_snapshot_balance(&env, &to);

        let current_bal = get_current_balance(&env, &to);
        let new_bal = current_bal
            .checked_add(amount)
            .ok_or(SnapshotTokenError::InvalidAmount)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balances(to.clone()), &new_bal);

        let total_supply: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_supply = total_supply
            .checked_add(amount)
            .ok_or(SnapshotTokenError::InvalidAmount)?;
        env.storage()
            .persistent()
            .set(&DataKey::TotalSupply, &new_supply);

        env.events()
            .publish((Symbol::new(&env, "mint"), admin, to), amount);

        Ok(())
    }

    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), SnapshotTokenError> {
        from.require_auth();

        if amount <= 0 {
            return Err(SnapshotTokenError::InvalidAmount);
        }

        let from_bal = get_current_balance(&env, &from);
        if from_bal < amount {
            return Err(SnapshotTokenError::InsufficientBalance);
        }

        record_snapshot_balance(&env, &from);
        record_snapshot_balance(&env, &to);

        let new_from_bal = from_bal - amount;
        env.storage()
            .persistent()
            .set(&DataKey::Balances(from.clone()), &new_from_bal);

        let to_bal = get_current_balance(&env, &to);
        let new_to_bal = to_bal
            .checked_add(amount)
            .ok_or(SnapshotTokenError::InvalidAmount)?;
        env.storage()
            .persistent()
            .set(&DataKey::Balances(to.clone()), &new_to_bal);

        env.events()
            .publish((Symbol::new(&env, "transfer"), from, to), amount);

        Ok(())
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        get_current_balance(&env, &account)
    }

    pub fn create_snapshot(env: Env, caller: Address) -> Result<u32, SnapshotTokenError> {
        let admin = get_admin(&env)?;
        if caller != admin {
            return Err(SnapshotTokenError::NotAuthorized);
        }
        caller.require_auth();

        let current_snap = get_current_snapshot(&env);
        let next_snap = current_snap
            .checked_add(1)
            .ok_or(SnapshotTokenError::InvalidAmount)?;

        env.storage()
            .persistent()
            .set(&DataKey::SnapshotCounter, &next_snap);

        env.events()
            .publish((Symbol::new(&env, "snapshot"), caller), next_snap);

        Ok(next_snap)
    }

    pub fn balance_at_snapshot(
        env: Env,
        account: Address,
        snapshot_id: u32,
    ) -> Result<i128, SnapshotTokenError> {
        get_balance_at_snapshot(&env, account, snapshot_id)
    }

    pub fn current_snapshot(env: Env) -> u32 {
        get_current_snapshot(&env)
    }

    pub fn total_snapshots(env: Env) -> u32 {
        get_current_snapshot(&env)
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Decimals)
            .unwrap_or(0)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .persistent()
            .get(&DataKey::Name)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .persistent()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn admin(env: Env) -> Result<Address, SnapshotTokenError> {
        get_admin(&env)
    }
}

#[cfg(test)]
mod test;

// Private helper functions

fn get_admin(env: &Env) -> Result<Address, SnapshotTokenError> {
    env.storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(SnapshotTokenError::NotAuthorized)
}

fn get_current_balance(env: &Env, account: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balances(account.clone()))
        .unwrap_or(0)
}

fn get_current_snapshot(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::SnapshotCounter)
        .unwrap_or(0)
}

fn record_snapshot_balance(env: &Env, account: &Address) {
    let current_snap = get_current_snapshot(env);
    if current_snap == 0 {
        return;
    }

    let history_key = DataKey::SnapshotBalances(account.clone());
    let mut history = env
        .storage()
        .persistent()
        .get::<_, Map<u32, i128>>(&history_key)
        .unwrap_or_else(|| Map::new(env));

    if !history.contains_key(current_snap) {
        let current_bal = get_current_balance(env, account);
        history.set(current_snap, current_bal);
        env.storage().persistent().set(&history_key, &history);
    }
}

fn get_balance_at_snapshot(
    env: &Env,
    account: Address,
    snapshot_id: u32,
) -> Result<i128, SnapshotTokenError> {
    let current_snap = get_current_snapshot(env);
    if snapshot_id == 0 || snapshot_id > current_snap {
        return Err(SnapshotTokenError::SnapshotNotFound);
    }

    let history_key = DataKey::SnapshotBalances(account.clone());
    if let Some(history) = env
        .storage()
        .persistent()
        .get::<_, Map<u32, i128>>(&history_key)
    {
        for key in history.keys() {
            if key >= snapshot_id {
                return Ok(history.get(key).unwrap_or(0));
            }
        }
    }

    Ok(get_current_balance(env, &account))
}
