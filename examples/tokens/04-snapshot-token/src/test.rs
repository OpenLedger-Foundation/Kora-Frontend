#![cfg(test)]
#![allow(deprecated)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_test() -> (Env, SnapshotTokenClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SnapshotToken);
    let client = SnapshotTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "GovToken"),
        &String::from_str(&env, "GT"),
    );

    (env, client, admin, user1, user2)
}

#[test]
fn test_initialization() {
    let (env, client, admin, _, _) = setup_test();
    assert_eq!(client.decimals(), 7);
    assert_eq!(client.name(), String::from_str(&env, "GovToken"));
    assert_eq!(client.symbol(), String::from_str(&env, "GT"));
    assert_eq!(client.admin(), admin);
    assert_eq!(client.total_supply(), 0);
    assert_eq!(client.current_snapshot(), 0);
}

#[test]
fn test_mint_admin() {
    let (_, client, _, user1, _) = setup_test();
    let amount = 1000i128;
    client.mint(&user1, &amount);
    assert_eq!(client.balance(&user1), amount);
    assert_eq!(client.total_supply(), amount);
}

#[test]
fn test_mint_invalid_amount() {
    let (_, client, _, user1, _) = setup_test();
    let err = client.try_mint(&user1, &-100);
    assert!(err.is_err());

    let err2 = client.try_mint(&user1, &0);
    assert!(err2.is_err());
}

#[test]
fn test_transfer_success() {
    let (_, client, _, user1, user2) = setup_test();
    client.mint(&user1, &100);
    client.transfer(&user1, &user2, &40);
    assert_eq!(client.balance(&user1), 60);
    assert_eq!(client.balance(&user2), 40);
}

#[test]
fn test_transfer_insufficient_balance() {
    let (_, client, _, user1, user2) = setup_test();
    client.mint(&user1, &50);
    let err = client.try_transfer(&user1, &user2, &100);
    assert!(err.is_err());
}

#[test]
fn test_snapshot_id_incrementing() {
    let (_, client, admin, _, _) = setup_test();
    assert_eq!(client.create_snapshot(&admin), 1);
    assert_eq!(client.current_snapshot(), 1);
    assert_eq!(client.create_snapshot(&admin), 2);
    assert_eq!(client.current_snapshot(), 2);
    assert_eq!(client.total_snapshots(), 2);
}

#[test]
fn test_create_snapshot_not_authorized() {
    let (_, client, _, user1, _) = setup_test();
    let err = client.try_create_snapshot(&user1);
    assert!(err.is_err());
}

#[test]
fn test_balance_at_snapshot_no_activity() {
    let (_, client, admin, user1, _) = setup_test();
    client.mint(&user1, &500);

    assert_eq!(client.create_snapshot(&admin), 1);

    assert_eq!(client.balance_at_snapshot(&user1, &1), 500);
}

#[test]
fn test_balance_at_snapshot_change_before() {
    let (_, client, admin, user1, _) = setup_test();
    client.mint(&user1, &100);
    client.mint(&user1, &200);

    assert_eq!(client.create_snapshot(&admin), 1);

    assert_eq!(client.balance_at_snapshot(&user1, &1), 300);
}

#[test]
fn test_balance_at_snapshot_unaffected_by_subsequent() {
    let (_, client, admin, user1, user2) = setup_test();
    client.mint(&user1, &500);

    assert_eq!(client.create_snapshot(&admin), 1);

    client.transfer(&user1, &user2, &200);

    assert_eq!(client.balance(&user1), 300);
    assert_eq!(client.balance(&user2), 200);

    assert_eq!(client.balance_at_snapshot(&user1, &1), 500);
    assert_eq!(client.balance_at_snapshot(&user2, &1), 0);
}

#[test]
fn test_multi_snapshot_complex() {
    let (_, client, admin, user1, user2) = setup_test();

    client.mint(&user1, &100);

    assert_eq!(client.create_snapshot(&admin), 1);

    client.transfer(&user1, &user2, &30);

    assert_eq!(client.create_snapshot(&admin), 2);

    client.mint(&user2, &50);

    assert_eq!(client.create_snapshot(&admin), 3);

    assert_eq!(client.balance_at_snapshot(&user1, &1), 100);
    assert_eq!(client.balance_at_snapshot(&user2, &1), 0);

    assert_eq!(client.balance_at_snapshot(&user1, &2), 70);
    assert_eq!(client.balance_at_snapshot(&user2, &2), 30);

    assert_eq!(client.balance_at_snapshot(&user1, &3), 70);
    assert_eq!(client.balance_at_snapshot(&user2, &3), 80);

    assert_eq!(client.balance(&user1), 70);
    assert_eq!(client.balance(&user2), 80);
}

#[test]
fn test_query_non_existent_snapshot() {
    let (_, client, admin, user1, _) = setup_test();
    let err1 = client.try_balance_at_snapshot(&user1, &1);
    assert!(err1.is_err());

    let err2 = client.try_balance_at_snapshot(&user1, &0);
    assert!(err2.is_err());

    assert_eq!(client.create_snapshot(&admin), 1);
    let err3 = client.try_balance_at_snapshot(&user1, &2);
    assert!(err3.is_err());
}

#[test]
fn test_query_user_with_no_history() {
    let (_, client, admin, _, _) = setup_test();
    let stranger = Address::generate(&client.env);

    assert_eq!(client.create_snapshot(&admin), 1);

    assert_eq!(client.balance_at_snapshot(&stranger, &1), 0);
}
